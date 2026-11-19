import { NextRequest, NextResponse } from "next/server"
import { requireManagerOf } from "@/lib/escalas/auth"
import { loadBlockoutsForServants } from "@/lib/escalas/availability"
import { findPeriodConflicts } from "@/lib/escalas/conflicts"
import { fetchAll } from "@/lib/supabase/fetch-all"

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

    const [{ data: events }, { data: areas }, { data: allServants }, availabilitiesResult] = await Promise.all([
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
      // Períodos de vários meses passam do limite de 1.000 linhas por consulta
      fetchAll(() => supabase.from("servant_availability").select("*").eq("period_id", periodId).order("id")),
    ])

    // Servos do ministério (área primária ou secundária)
    const servants = (allServants ?? []).filter(
      (s: any) =>
        s.area?.ministry_id === period.ministry_id ||
        s.servant_areas?.some((sa: any) => sa.area?.ministry_id === period.ministry_id)
    )

    const eventIds = (events ?? []).map((e: { id: string }) => e.id)
    const [assignmentsResult, { data: declines }, conflicts, blockouts] = await Promise.all([
      eventIds.length
        ? fetchAll<any>(() =>
            supabase
              .from("schedule_assignments")
              .select("*, servant:servants(*), area:areas(*)")
              .in("schedule_event_id", eventIds)
              .order("id")
          )
        : Promise.resolve({ data: [] as any[], error: null }),
      eventIds.length
        ? supabase
            .from("schedule_assignment_declines")
            .select("assignment_id, reason, schedule_assignments!inner(schedule_event_id)")
            .in("schedule_assignments.schedule_event_id", eventIds)
        : Promise.resolve({ data: [] as any[] }),
      eventIds.length ? findPeriodConflicts(supabase, periodId) : Promise.resolve([]),
      loadBlockoutsForServants(supabase, servants, period.start_date, period.end_date),
    ])

    // Sem a lista completa, a tela mostraria vagas e respostas faltando
    const failed = [availabilitiesResult, assignmentsResult].find((r) => r.error)
    if (failed) {
      console.error("Erro ao carregar dados da montagem:", failed.error)
      return NextResponse.json({ error: "Erro ao carregar os dados da escala" }, { status: 500 })
    }
    const availabilities = availabilitiesResult.data!
    const assignments = assignmentsResult.data!

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
