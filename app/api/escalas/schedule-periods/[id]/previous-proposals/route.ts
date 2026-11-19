import { NextRequest, NextResponse } from "next/server"
import { requireManagerOf } from "@/lib/escalas/auth"
import { findMinistryServants, loadBlockoutsForServants } from "@/lib/escalas/availability"
import { isDateBlocked } from "@/lib/escalas/blockouts"
import { fetchAll } from "@/lib/supabase/fetch-all"

/**
 * GET - Propõe copiar a escala do mês anterior do mesmo ministério.
 *
 * O mês copiado é o último mês do período anterior (que pode ter mais de um
 * mês). Se o período atual cobre vários meses, a escala copiada é proposta
 * em cada um deles.
 *
 * Os eventos são pareados por "Nª ocorrência do dia da semana + horário"
 * (ex.: 1º domingo 19:00), a mesma lógica do calendário regular. Só propõe:
 * quem está inativo, saiu da área, marcou indisponível no mês atual ou já
 * está escalado no evento fica de fora (e é contado em `skipped`).
 */

interface EventRow {
  id: string
  event_date: string
  event_time: string
  title: string
}

function slotKey(e: EventRow) {
  const date = new Date(`${e.event_date}T12:00:00`)
  const nth = Math.ceil(date.getDate() / 7)
  return `${date.getDay()}-${nth}-${e.event_time.slice(0, 5)}`
}

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
      .select("id, ministry_id, start_date")
      .eq("id", periodId)
      .single()
    if (!period) return NextResponse.json({ error: "Período não encontrado" }, { status: 404 })

    // Período imediatamente anterior: termina na véspera do início deste
    const dayBefore = new Date(`${period.start_date}T12:00:00Z`)
    dayBefore.setUTCDate(dayBefore.getUTCDate() - 1)
    const { data: previous } = await supabase
      .from("schedule_periods")
      .select("id, end_date")
      .eq("ministry_id", period.ministry_id)
      .eq("end_date", dayBefore.toISOString().slice(0, 10))
      .maybeSingle()

    if (!previous) {
      return NextResponse.json({ error: "Não há escala do mês anterior neste ministério" }, { status: 404 })
    }

    const [{ data: prevEvents }, { data: curEvents }, servants, availabilityResult] = await Promise.all([
      // Só o último mês do período anterior
      supabase
        .from("schedule_events")
        .select("id, event_date, event_time, title")
        .eq("period_id", previous.id)
        .gte("event_date", `${previous.end_date.slice(0, 7)}-01`),
      supabase.from("schedule_events").select("id, event_date, event_time, title").eq("period_id", periodId),
      findMinistryServants(supabase, period.ministry_id),
      fetchAll(() =>
        supabase
          .from("servant_availability")
          .select("servant_id, event_id, is_available")
          .eq("period_id", periodId)
          .order("id")
      ),
    ])

    // Um evento por slot em cada mês do período atual
    const curBySlot = new Map<string, EventRow[]>()
    const seen = new Set<string>()
    for (const e of (curEvents ?? []) as EventRow[]) {
      const key = slotKey(e)
      const perMonth = `${e.event_date.slice(0, 7)}|${key}`
      if (seen.has(perMonth)) continue
      seen.add(perMonth)
      curBySlot.set(key, [...(curBySlot.get(key) ?? []), e])
    }
    const prevToCur = new Map<string, EventRow[]>()
    for (const e of (prevEvents ?? []) as EventRow[]) {
      const matches = curBySlot.get(slotKey(e))
      if (matches) prevToCur.set(e.id, matches)
    }

    const prevEventIds = (prevEvents ?? []).map((e: EventRow) => e.id)
    const curEventIds = (curEvents ?? []).map((e: EventRow) => e.id)
    const noRows = Promise.resolve({ data: [] as any[], error: null })
    const [prevAssignmentsResult, curAssignmentsResult, membershipsResult] = await Promise.all([
      prevEventIds.length
        ? fetchAll<any>(() =>
            supabase
              .from("schedule_assignments")
              .select("schedule_event_id, servant_id, area_id, status")
              .in("schedule_event_id", prevEventIds)
              .order("id")
          )
        : noRows,
      curEventIds.length
        ? fetchAll<any>(() =>
            supabase
              .from("schedule_assignments")
              .select("schedule_event_id, servant_id")
              .in("schedule_event_id", curEventIds)
              .order("id")
          )
        : noRows,
      fetchAll<any>(() =>
        supabase.from("servant_areas").select("servant_id, area_id").order("servant_id").order("area_id")
      ),
    ])

    // Sem todas as respostas e escalações, a proposta poderia incluir quem
    // marcou indisponível: melhor falhar do que propor com dados parciais
    const failed = [availabilityResult, prevAssignmentsResult, curAssignmentsResult, membershipsResult].find((r) => r.error)
    if (failed) {
      console.error("Erro ao carregar dados para copiar a escala:", failed.error)
      return NextResponse.json({ error: "Erro ao carregar os dados da escala" }, { status: 500 })
    }
    const availability = availabilityResult.data!
    const prevAssignments = prevAssignmentsResult.data!
    const curAssignments = curAssignmentsResult.data!
    const memberships = membershipsResult.data!

    const active = new Set(servants.filter((s) => s.is_active).map((s) => s.id))
    const inArea = new Set((memberships ?? []).map((m: any) => `${m.servant_id}-${m.area_id}`))
    const unavailable = new Set(
      (availability ?? []).filter((a: any) => !a.is_available).map((a: any) => `${a.servant_id}-${a.event_id}`)
    )
    // Datas bloqueadas (férias, viagens) valem quando não há resposta explícita no evento
    const answered = new Set((availability ?? []).map((a: any) => `${a.servant_id}-${a.event_id}`))
    const curDates = (curEvents ?? []).map((e: EventRow) => e.event_date).sort()
    if (curDates.length) {
      const blockouts = await loadBlockoutsForServants(supabase, servants, curDates[0], curDates[curDates.length - 1])
      for (const [servantId, list] of Object.entries(blockouts)) {
        for (const e of (curEvents ?? []) as EventRow[]) {
          const key = `${servantId}-${e.id}`
          if (!answered.has(key) && isDateBlocked(e.event_date, list)) unavailable.add(key)
        }
      }
    }
    const responded = new Set((availability ?? []).map((a: any) => a.servant_id))
    const taken = new Set((curAssignments ?? []).map((a: any) => `${a.servant_id}-${a.schedule_event_id}`))

    const proposals: { event_id: string; area_id: string; servant_id: string; notes: string[] }[] = []
    const skipped = { unmatchedEvent: 0, inactiveOrLeftArea: 0, unavailable: 0, alreadyAssigned: 0 }

    for (const a of (prevAssignments ?? []) as any[]) {
      if (a.status === "declined") continue
      const matches = prevToCur.get(a.schedule_event_id)
      if (!matches) { skipped.unmatchedEvent++; continue }
      if (!active.has(a.servant_id) || !inArea.has(`${a.servant_id}-${a.area_id}`)) { skipped.inactiveOrLeftArea++; continue }
      for (const cur of matches) {
        if (unavailable.has(`${a.servant_id}-${cur.id}`)) { skipped.unavailable++; continue }
        if (taken.has(`${a.servant_id}-${cur.id}`)) { skipped.alreadyAssigned++; continue }
        taken.add(`${a.servant_id}-${cur.id}`)
        proposals.push({
          event_id: cur.id,
          area_id: a.area_id,
          servant_id: a.servant_id,
          notes: responded.has(a.servant_id) ? [] : ["não respondeu a disponibilidade"],
        })
      }
    }

    return NextResponse.json({
      // Mês de onde a escala foi copiada (último mês do período anterior)
      previous: {
        month: Number(previous.end_date.slice(5, 7)),
        year: Number(previous.end_date.slice(0, 4)),
      },
      matchedEvents: new Set([...prevToCur.values()].flat().map((e) => e.id)).size,
      proposals,
      skipped,
    })
  } catch (error) {
    console.error("Erro ao propor cópia do mês anterior:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
