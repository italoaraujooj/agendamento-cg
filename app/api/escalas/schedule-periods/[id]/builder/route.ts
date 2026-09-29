import { NextRequest, NextResponse } from "next/server"
import { requireManagerOf } from "@/lib/escalas/auth"
import { loadBlockoutsForServants } from "@/lib/escalas/availability"
import { findPeriodConflicts } from "@/lib/escalas/conflicts"

/**
 * GET - Tudo o que a tela de montagem precisa, para admin ou líder do
 * ministério. Substitui as consultas feitas direto do navegador (que
 * dependiam de RLS de admin e não funcionavam para líderes).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: periodId } = await params
    const auth = await requireManagerOf("period", periodId)
    if (!auth.ok) return auth.response
    const { supabase } = auth

    const { data: period } = await supabase
      .from("schedule_periods")
      .select("*, ministry:ministries(*)")
      .eq("id", periodId)
      .single()
    if (!period) return NextResponse.json({ error: "Período não encontrado" }, { status: 404 })

    const [{ data: events }, { data: areas }, { data: allServants }, { data: availabilities }] = await Promise.all([
      supabase.from("schedule_events").select("*").eq("period_id", periodId).order("event_date").order("event_time"),
      supabase
        .from("areas")
        .select("*")
        .eq("ministry_id", period.ministry_id)
        .eq("is_active", true)
        .order("order_index")
        .order("name"),
      supabase
        .from("servants")
        .select("*, area:areas!servants_area_id_fkey(*), servant_areas(area_id, area:areas(id, ministry_id))")
        .eq("is_active", true),
      supabase.from("servant_availability").select("*").eq("period_id", periodId),
    ])

    // Servos do ministério (área primária ou secundária)
    const servants = (allServants ?? []).filter(
      (s: any) =>
        s.area?.ministry_id === period.ministry_id ||
        s.servant_areas?.some((sa: any) => sa.area?.ministry_id === period.ministry_id)
    )

    const eventIds = (events ?? []).map((e: { id: string }) => e.id)
    const [{ data: assignments }, { data: declines }, conflicts, blockouts] = await Promise.all([
      eventIds.length
        ? supabase.from("schedule_assignments").select("*, servant:servants(*), area:areas(*)").in("schedule_event_id", eventIds)
        : Promise.resolve({ data: [] as any[] }),
      eventIds.length
        ? supabase
            .from("schedule_assignment_declines")
            .select("assignment_id, reason, schedule_assignments!inner(schedule_event_id)")
            .in("schedule_assignments.schedule_event_id", eventIds)
        : Promise.resolve({ data: [] as any[] }),
      eventIds.length ? findPeriodConflicts(supabase, periodId) : Promise.resolve([]),
      loadBlockoutsForServants(supabase, servants, period.start_date, period.end_date),
    ])

    const declineReasons: Record<string, string | null> = {}
    for (const d of (declines ?? []) as { assignment_id: string; reason: string | null }[]) {
      declineReasons[d.assignment_id] = d.reason
    }

    return NextResponse.json({
      period,
      events: events ?? [],
      areas: areas ?? [],
      servants,
      availabilities: availabilities ?? [],
      assignments: assignments ?? [],
      conflicts,
      declineReasons,
      blockouts,
    })
  } catch (error) {
    console.error("Erro ao carregar dados da montagem:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
