import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { signCalendarToken, verifyScheduleToken } from "@/lib/escalas/availability-token"

// GET - Escala publicada de um servo (link pessoal do e-mail: ?s=<servo>&k=<assinatura>)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const servantId = request.nextUrl.searchParams.get("s")
    const signature = request.nextUrl.searchParams.get("k")

    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    const { data: period } = await supabase
      .from("schedule_periods")
      .select("id, month, year, status, ministry:ministries(name, color)")
      .eq("availability_token", token)
      .maybeSingle()

    if (!period || !servantId || !verifyScheduleToken(servantId, period.id, signature)) {
      return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 })
    }
    if (period.status !== "published") {
      return NextResponse.json({ error: "Esta escala ainda não foi publicada" }, { status: 400 })
    }

    const { data: servant } = await supabase.from("servants").select("id, name").eq("id", servantId).maybeSingle()
    if (!servant) {
      return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 })
    }

    const { data: rows } = await supabase
      .from("schedule_assignments")
      .select(`
        id, status, responded_at,
        area:areas(name),
        decline:schedule_assignment_declines(reason),
        schedule_events!inner(id, event_date, event_time, title, period_id)
      `)
      .eq("servant_id", servantId)
      .eq("schedule_events.period_id", period.id)

    const assignments = ((rows ?? []) as any[])
      .map((r) => ({
        id: r.id,
        status: r.status,
        responded_at: r.responded_at,
        area: r.area?.name ?? "",
        decline_reason: r.decline?.reason ?? (Array.isArray(r.decline) ? r.decline[0]?.reason : null) ?? null,
        event: {
          id: r.schedule_events.id,
          event_date: r.schedule_events.event_date,
          event_time: r.schedule_events.event_time,
          title: r.schedule_events.title,
        },
      }))
      .sort((a, b) =>
        `${a.event.event_date}${a.event.event_time}`.localeCompare(`${b.event.event_date}${b.event.event_time}`)
      )

    return NextResponse.json({
      servant: { id: servant.id, name: servant.name },
      period: { id: period.id, month: period.month, year: period.year, ministry: period.ministry },
      assignments,
      calendar_token: signCalendarToken(servant.id),
    })
  } catch (error) {
    console.error("Erro ao carregar escala pessoal:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
