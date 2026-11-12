import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { verifyBookingsCalendarToken } from "@/lib/escalas/availability-token"
import { icsEscape, icsResponse, nowStamp, utcStamp } from "@/lib/ics"

/**
 * GET - Feed de calendário (ICS) com as reservas da pessoa (aprovadas e em
 * análise; recusadas ficam de fora). Assinável no Google Agenda / iPhone /
 * Outlook: o app de calendário busca de novo periodicamente, então novas
 * reservas e aprovações aparecem sozinhas. Substitui a integração com a API
 * do Google Calendar, que exigia escopos sensíveis do Google.
 */

const STATUS_SUFFIX: Record<string, string> = {
  pending: " (aguardando aprovação)",
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const userId = verifyBookingsCalendarToken(token.replace(/\.ics$/, ""))
  if (!userId) {
    return NextResponse.json({ error: "Link inválido" }, { status: 404 })
  }

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
  }

  const since = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const { data: rows, error } = await supabase
    .from("bookings")
    .select("id, occasion, name, responsible_person, estimated_participants, booking_date, start_time, end_time, status, blocks_all_environments, environments(name)")
    .eq("user_id", userId)
    .neq("status", "rejected")
    .gte("booking_date", since)
    .order("booking_date", { ascending: true })

  if (error) {
    console.error("Erro ao montar o feed de reservas:", error)
    return NextResponse.json({ error: "Erro ao carregar reservas" }, { status: 500 })
  }

  const now = nowStamp()
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cidade Viva CG//Reservas//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape("Reservas — Cidade Viva CG")}`,
    "X-WR-TIMEZONE:America/Sao_Paulo",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
  ]

  for (const b of (rows ?? []) as any[]) {
    const env = Array.isArray(b.environments) ? b.environments[0] : b.environments
    const place = b.blocks_all_environments ? "Igreja inteira" : env?.name ?? "Ambiente"
    const title = b.occasion || b.name
    const status = STATUS_SUFFIX[b.status] ?? ""
    lines.push(
      "BEGIN:VEVENT",
      `UID:booking-${b.id}@agendamento.icvcg`,
      `DTSTAMP:${now}`,
      `DTSTART:${utcStamp(b.booking_date, b.start_time)}`,
      `DTEND:${utcStamp(b.booking_date, b.end_time)}`,
      `SUMMARY:${icsEscape(`${title} — ${place}${status}`)}`,
      `LOCATION:${icsEscape(`${place} · Igreja Cidade Viva CG`)}`,
      `DESCRIPTION:${icsEscape(`Reserva: ${b.name}\nResponsável: ${b.responsible_person}\nParticipantes: ${b.estimated_participants}`)}`,
      `STATUS:${b.status === "approved" ? "CONFIRMED" : "TENTATIVE"}`,
      "END:VEVENT"
    )
  }
  lines.push("END:VCALENDAR")

  return icsResponse(lines, "reservas.ics")
}
