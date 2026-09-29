import type { SupabaseClient } from "@supabase/supabase-js"
import { findMinistryServants } from "@/lib/escalas/availability"
import type { ServantConflict } from "@/types/escalas"

/**
 * Conflitos de escala: a mesma pessoa escalada em outro evento no mesmo dia e
 * horário — em outro evento do período ou em outro ministério.
 *
 * Cada ministério tem seu próprio registro de servo; entre ministérios, a
 * pessoa é identificada pela conta (user_id) ou pelo e-mail.
 */

const norm = (v: string | null | undefined) => (v ?? "").toLowerCase().trim()

export async function findPeriodConflicts(
  supabase: SupabaseClient,
  periodId: string
): Promise<ServantConflict[]> {
  const { data: period } = await supabase
    .from("schedule_periods")
    .select("id, ministry_id")
    .eq("id", periodId)
    .single()
  if (!period) return []

  const { data: events } = await supabase
    .from("schedule_events")
    .select("id, event_date, event_time")
    .eq("period_id", periodId)
  if (!events || events.length === 0) return []

  const servants = await findMinistryServants(supabase, period.ministry_id)
  const byUser = new Map<string, string[]>()
  const byEmail = new Map<string, string[]>()
  const ours = new Set<string>()
  for (const s of servants) {
    ours.add(s.id)
    if (s.user_id) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s.id])
    if (norm(s.email)) byEmail.set(norm(s.email), [...(byEmail.get(norm(s.email)) ?? []), s.id])
  }

  const dates = [...new Set(events.map((e: { event_date: string }) => e.event_date))]
  const { data: assignments } = await supabase
    .from("schedule_assignments")
    .select(`
      schedule_event_id,
      servant:servants(id, user_id, email),
      area:areas(name),
      schedule_events!inner(id, event_date, event_time, title, schedule_periods(ministry_id, ministries(name)))
    `)
    .in("schedule_events.event_date", dates)

  const eventsBySlot = new Map<string, string[]>()
  for (const e of events as { id: string; event_date: string; event_time: string }[]) {
    const slot = `${e.event_date}T${e.event_time.slice(0, 5)}`
    eventsBySlot.set(slot, [...(eventsBySlot.get(slot) ?? []), e.id])
  }

  const conflicts: ServantConflict[] = []
  const seen = new Set<string>()

  for (const a of (assignments ?? []) as any[]) {
    const ev = a.schedule_events
    const servant = a.servant
    if (!ev || !servant) continue

    const ourIds = new Set<string>([
      ...(ours.has(servant.id) ? [servant.id] : []),
      ...(servant.user_id ? byUser.get(servant.user_id) ?? [] : []),
      ...(norm(servant.email) ? byEmail.get(norm(servant.email)) ?? [] : []),
    ])
    if (ourIds.size === 0) continue

    const sameSlotEvents = eventsBySlot.get(`${ev.event_date}T${ev.event_time.slice(0, 5)}`) ?? []
    for (const eventId of sameSlotEvents) {
      if (eventId === ev.id) continue // mesmo evento: tratado pela UNIQUE(evento, servo)
      for (const servantId of ourIds) {
        const key = `${servantId}|${eventId}|${ev.id}`
        if (seen.has(key)) continue
        seen.add(key)
        conflicts.push({
          servant_id: servantId,
          event_id: eventId,
          other: {
            event_id: ev.id,
            title: ev.title,
            date: ev.event_date,
            time: ev.event_time.slice(0, 5),
            ministry: ev.schedule_periods?.ministries?.name ?? "",
            area: a.area?.name ?? null,
            same_ministry: ev.schedule_periods?.ministry_id === period.ministry_id,
          },
        })
      }
    }
  }

  return conflicts
}
