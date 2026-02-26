import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase()
  if (!email) {
    return NextResponse.json({ error: "Email obrigatório" }, { status: 400 })
  }

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
  }

  // Buscar servos com esse email
  const { data: servants } = await supabase
    .from("servants")
    .select("id, name, area:areas!servants_area_id_fkey(id, name, ministry_id)")
    .ilike("email", email)
    .eq("is_active", true)

  if (!servants || servants.length === 0) {
    return NextResponse.json({ error: "Nenhum servo encontrado com esse email" }, { status: 404 })
  }

  const servantIds = servants.map((s) => s.id)
  const servantName = servants[0].name

  // Coletar ministry_ids únicos dos servos encontrados
  const ministryIds = [
    ...new Set(
      servants
        .map((s) => (s.area as unknown as { ministry_id: string } | null)?.ministry_id)
        .filter(Boolean) as string[]
    ),
  ]

  if (ministryIds.length === 0) {
    return NextResponse.json({ error: "Servo não está associado a nenhum ministério" }, { status: 404 })
  }

  // Buscar períodos publicados dos ministérios, ordenado do mais recente
  const { data: periods } = await supabase
    .from("schedule_periods")
    .select("id, month, year, ministry_id, published_at, ministry:ministries(name, color)")
    .in("ministry_id", ministryIds)
    .eq("status", "published")
    .order("year", { ascending: false })
    .order("month", { ascending: false })

  if (!periods || periods.length === 0) {
    return NextResponse.json({ error: "Nenhuma escala publicada encontrada" }, { status: 404 })
  }

  // Para cada período, buscar eventos e atribuições
  const periodsWithEvents = await Promise.all(
    periods.map(async (period) => {
      const { data: events } = await supabase
        .from("schedule_events")
        .select("id, event_date, event_time, title, requires_areas")
        .eq("period_id", period.id)
        .order("event_date")
        .order("event_time")

      if (!events || events.length === 0) return null

      const eventIds = events.map((e) => e.id)
      const { data: assignments } = await supabase
        .from("schedule_assignments")
        .select("id, schedule_event_id, servant_id, area_id, servant:servants(name), area:areas(name)")
        .in("schedule_event_id", eventIds)

      const myAssignmentEventIds = new Set(
        (assignments ?? [])
          .filter((a) => servantIds.includes(a.servant_id))
          .map((a) => a.schedule_event_id)
      )

      return {
        id: period.id,
        month: period.month,
        year: period.year,
        ministry: period.ministry,
        events: events.map((event) => ({
          id: event.id,
          event_date: event.event_date,
          event_time: event.event_time,
          title: event.title,
          requires_areas: event.requires_areas,
          isMyEvent: myAssignmentEventIds.has(event.id),
          assignments: (assignments ?? [])
            .filter((a) => a.schedule_event_id === event.id)
            .map((a) => ({
              servantName: (a.servant as unknown as { name: string } | null)?.name ?? "—",
              areaName: (a.area as unknown as { name: string } | null)?.name ?? "—",
              isMe: servantIds.includes(a.servant_id),
            })),
        })),
      }
    })
  )

  const result = periodsWithEvents.filter(Boolean)

  return NextResponse.json({
    servantName,
    periods: result,
  })
}
