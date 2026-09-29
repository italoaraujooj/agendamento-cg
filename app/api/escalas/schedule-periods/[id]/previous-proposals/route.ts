import { NextRequest, NextResponse } from "next/server"
import { requireManagerOf } from "@/lib/escalas/auth"
import { findMinistryServants } from "@/lib/escalas/availability"

/**
 * GET - Propõe copiar a escala do mês anterior do mesmo ministério.
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
      .select("id, ministry_id, month, year")
      .eq("id", periodId)
      .single()
    if (!period) return NextResponse.json({ error: "Período não encontrado" }, { status: 404 })

    const prevMonth = period.month === 1 ? 12 : period.month - 1
    const prevYear = period.month === 1 ? period.year - 1 : period.year
    const { data: previous } = await supabase
      .from("schedule_periods")
      .select("id, month, year")
      .eq("ministry_id", period.ministry_id)
      .eq("month", prevMonth)
      .eq("year", prevYear)
      .maybeSingle()

    if (!previous) {
      return NextResponse.json({ error: "Não há escala do mês anterior neste ministério" }, { status: 404 })
    }

    const [{ data: prevEvents }, { data: curEvents }, servants, { data: availability }] = await Promise.all([
      supabase.from("schedule_events").select("id, event_date, event_time, title").eq("period_id", previous.id),
      supabase.from("schedule_events").select("id, event_date, event_time, title").eq("period_id", periodId),
      findMinistryServants(supabase, period.ministry_id),
      supabase.from("servant_availability").select("servant_id, event_id, is_available").eq("period_id", periodId),
    ])

    const curBySlot = new Map<string, EventRow>()
    for (const e of (curEvents ?? []) as EventRow[]) {
      if (!curBySlot.has(slotKey(e))) curBySlot.set(slotKey(e), e)
    }
    const prevToCur = new Map<string, EventRow>()
    for (const e of (prevEvents ?? []) as EventRow[]) {
      const match = curBySlot.get(slotKey(e))
      if (match) prevToCur.set(e.id, match)
    }

    const prevEventIds = (prevEvents ?? []).map((e: EventRow) => e.id)
    const curEventIds = (curEvents ?? []).map((e: EventRow) => e.id)
    const [{ data: prevAssignments }, { data: curAssignments }, { data: memberships }] = await Promise.all([
      prevEventIds.length
        ? supabase.from("schedule_assignments").select("schedule_event_id, servant_id, area_id, status").in("schedule_event_id", prevEventIds)
        : Promise.resolve({ data: [] as any[] }),
      curEventIds.length
        ? supabase.from("schedule_assignments").select("schedule_event_id, servant_id").in("schedule_event_id", curEventIds)
        : Promise.resolve({ data: [] as any[] }),
      supabase.from("servant_areas").select("servant_id, area_id"),
    ])

    const active = new Set(servants.filter((s) => s.is_active).map((s) => s.id))
    const inArea = new Set((memberships ?? []).map((m: any) => `${m.servant_id}-${m.area_id}`))
    const unavailable = new Set(
      (availability ?? []).filter((a: any) => !a.is_available).map((a: any) => `${a.servant_id}-${a.event_id}`)
    )
    const responded = new Set((availability ?? []).map((a: any) => a.servant_id))
    const taken = new Set((curAssignments ?? []).map((a: any) => `${a.servant_id}-${a.schedule_event_id}`))

    const proposals: { event_id: string; area_id: string; servant_id: string; notes: string[] }[] = []
    const skipped = { unmatchedEvent: 0, inactiveOrLeftArea: 0, unavailable: 0, alreadyAssigned: 0 }

    for (const a of (prevAssignments ?? []) as any[]) {
      if (a.status === "declined") continue
      const cur = prevToCur.get(a.schedule_event_id)
      if (!cur) { skipped.unmatchedEvent++; continue }
      if (!active.has(a.servant_id) || !inArea.has(`${a.servant_id}-${a.area_id}`)) { skipped.inactiveOrLeftArea++; continue }
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

    return NextResponse.json({
      previous: { month: previous.month, year: previous.year },
      matchedEvents: new Set([...prevToCur.values()].map((e) => e.id)).size,
      proposals,
      skipped,
    })
  } catch (error) {
    console.error("Erro ao propor cópia do mês anterior:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
