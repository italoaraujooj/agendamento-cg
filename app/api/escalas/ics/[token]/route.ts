import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { verifyCalendarToken } from "@/lib/escalas/availability-token"

/**
 * GET - Feed de calendário (ICS) com as escalas publicadas da pessoa, em todos
 * os ministérios. Assinável no Google Agenda / iPhone / Outlook; o app de
 * calendário busca de novo periodicamente, então mudanças aparecem sozinhas.
 */

const EVENT_DURATION_HOURS = 2
const BRT_OFFSET_HOURS = 3 // Brasília = UTC-3 (sem horário de verão desde 2019)

const icsEscape = (v: string) =>
  v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n")

/** Quebra linhas longas (RFC 5545: máx. 75 octetos por linha) */
function fold(line: string): string {
  const out: string[] = []
  let current = ""
  for (const ch of line) {
    if (Buffer.byteLength(current + ch) > 73) {
      out.push(current)
      current = " " + ch
    } else {
      current += ch
    }
  }
  out.push(current)
  return out.join("\r\n")
}

function utcStamp(date: string, time: string, plusHours = 0): string {
  const [y, m, d] = date.split("-").map(Number)
  const [hh, mm] = time.split(":").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, hh + BRT_OFFSET_HOURS + plusHours, mm))
  return dt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const servantId = verifyCalendarToken(token.replace(/\.ics$/, ""))
  if (!servantId) {
    return NextResponse.json({ error: "Link inválido" }, { status: 404 })
  }

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
  }

  const { data: servant } = await supabase
    .from("servants")
    .select("id, name, user_id, email")
    .eq("id", servantId)
    .maybeSingle()
  if (!servant) {
    return NextResponse.json({ error: "Link inválido" }, { status: 404 })
  }

  // A mesma pessoa em todos os ministérios (conta ou e-mail)
  const ids = new Set<string>([servant.id])
  if (servant.user_id) {
    const { data } = await supabase.from("servants").select("id").eq("user_id", servant.user_id)
    data?.forEach((s: { id: string }) => ids.add(s.id))
  }
  if (servant.email) {
    const email = servant.email.toLowerCase().trim()
    const { data } = await supabase.from("servants").select("id, email").ilike("email", email)
    data?.forEach((s: { id: string; email: string | null }) => {
      if (s.email?.toLowerCase().trim() === email) ids.add(s.id)
    })
  }

  const since = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const { data: rows } = await supabase
    .from("schedule_assignments")
    .select(`
      id, status, updated_at,
      area:areas(name),
      schedule_events!inner(event_date, event_time, title, description,
        schedule_periods!inner(status, ministries(name)))
    `)
    .in("servant_id", Array.from(ids))
    .neq("status", "declined")
    .gte("schedule_events.event_date", since)
    .eq("schedule_events.schedule_periods.status", "published")

  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cidade Viva CG//Escalas//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(`Escalas — ${servant.name}`)}`,
    "X-WR-TIMEZONE:America/Sao_Paulo",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
  ]

  for (const r of (rows ?? []) as any[]) {
    const ev = r.schedule_events
    const ministry = ev.schedule_periods?.ministries?.name ?? ""
    const area = r.area?.name ?? ""
    const status = r.status === "pending" ? " (a confirmar)" : ""
    lines.push(
      "BEGIN:VEVENT",
      `UID:${r.id}@escalas.icvcg`,
      `DTSTAMP:${now}`,
      `DTSTART:${utcStamp(ev.event_date, ev.event_time)}`,
      `DTEND:${utcStamp(ev.event_date, ev.event_time, EVENT_DURATION_HOURS)}`,
      `SUMMARY:${icsEscape(`${area} — ${ev.title}${status}`)}`,
      `DESCRIPTION:${icsEscape(`Escala ${ministry} · ${area}${ev.description ? `\n${ev.description}` : ""}`)}`,
      `CATEGORIES:${icsEscape(ministry)}`,
      "END:VEVENT"
    )
  }
  lines.push("END:VCALENDAR")

  return new NextResponse(lines.map(fold).join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="escalas.ics"',
      "Cache-Control": "public, max-age=900",
    },
  })
}
