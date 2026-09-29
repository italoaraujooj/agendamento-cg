import {
  areaCapacity,
  areaNeed,
  countByEventArea,
  isFilling,
  requiredAreas,
  type StaffingArea,
} from "@/lib/escalas/staffing"

/**
 * Sugestão automática de escala (sem efeitos colaterais: só propõe).
 *
 * Preenche as vagas que faltam para atingir o mínimo de cada área, evento a
 * evento em ordem cronológica, escolhendo entre quem é da área, está ativo,
 * não marcou indisponibilidade e não está escalado em outro compromisso no
 * mesmo horário. Critérios, em ordem:
 *   1. não servir duas vezes no mesmo dia
 *   2. menos escalas no mês (equilíbrio de carga)
 *   3. quem respondeu a disponibilidade antes de quem não respondeu
 *   4. ordem alfabética (resultado estável)
 * Áreas com menos candidatos são preenchidas primeiro para não esgotá-los.
 */

export interface SuggestEvent {
  id: string
  event_date: string
  event_time: string
  title: string
  requires_areas: string[] | null
}

export interface SuggestArea extends StaffingArea {
  name: string
}

export interface SuggestServant {
  id: string
  name: string
  is_active: boolean
  area_id: string
  servant_areas?: { area_id: string }[]
}

export interface SuggestAssignment {
  schedule_event_id: string
  area_id: string
  servant_id: string
  status?: string | null
}

export interface Proposal {
  event_id: string
  area_id: string
  servant_id: string
  /** Observações para o líder revisar (ex.: "sem resposta de disponibilidade") */
  notes: string[]
}

export interface UnfilledSlot {
  event_id: string
  area_id: string
  missing: number
}

export function suggestAssignments(input: {
  events: SuggestEvent[]
  areas: SuggestArea[]
  servants: SuggestServant[]
  assignments: SuggestAssignment[]
  /** `${servant_id}-${event_id}` de quem marcou indisponível */
  unavailable: Set<string>
  /** Servos que responderam a disponibilidade */
  responded: Set<string>
  /** `${servant_id}-${event_id}` já escalados em outro compromisso no mesmo horário */
  conflicts: Set<string>
}): { proposals: Proposal[]; unfilled: UnfilledSlot[] } {
  const { events, areas, servants, assignments, unavailable, responded, conflicts } = input

  const eventById = new Map(events.map((e) => [e.id, e]))
  const counts = countByEventArea(assignments)
  const load = new Map<string, number>()
  const dayLoad = new Set<string>()
  const inEvent = new Set<string>()

  for (const a of assignments) {
    // Quem recusou não volta a ser sugerido no mesmo evento
    inEvent.add(`${a.servant_id}-${a.schedule_event_id}`)
    if (!isFilling(a)) continue
    load.set(a.servant_id, (load.get(a.servant_id) ?? 0) + 1)
    const ev = eventById.get(a.schedule_event_id)
    if (ev) dayLoad.add(`${a.servant_id}-${ev.event_date}`)
  }

  const areaMembers = new Map<string, SuggestServant[]>()
  for (const s of servants) {
    if (!s.is_active) continue
    for (const areaId of new Set([s.area_id, ...(s.servant_areas ?? []).map((sa) => sa.area_id)])) {
      areaMembers.set(areaId, [...(areaMembers.get(areaId) ?? []), s])
    }
  }

  const eligible = (s: SuggestServant, ev: SuggestEvent) =>
    !inEvent.has(`${s.id}-${ev.id}`) && !unavailable.has(`${s.id}-${ev.id}`) && !conflicts.has(`${s.id}-${ev.id}`)

  const proposals: Proposal[] = []
  const unfilled: UnfilledSlot[] = []

  const ordered = [...events].sort((a, b) =>
    `${a.event_date}${a.event_time}`.localeCompare(`${b.event_date}${b.event_time}`)
  )

  for (const ev of ordered) {
    const areasByScarcity = requiredAreas(ev, areas)
      .map((area) => ({ area, pool: (areaMembers.get(area.id) ?? []).filter((s) => eligible(s, ev)).length }))
      .sort((a, b) => a.pool - b.pool)
      .map((x) => x.area)

    for (const area of areasByScarcity) {
      const key = `${ev.id}-${area.id}`
      const capacity = areaCapacity(area)
      let have = counts.get(key) ?? 0
      const target = capacity !== null ? Math.min(areaNeed(area), capacity) : areaNeed(area)

      while (have < target) {
        const candidates = (areaMembers.get(area.id) ?? [])
          .filter((s) => eligible(s, ev))
          .sort((a, b) => {
            const sameDay = Number(dayLoad.has(`${a.id}-${ev.event_date}`)) - Number(dayLoad.has(`${b.id}-${ev.event_date}`))
            if (sameDay) return sameDay
            const byLoad = (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0)
            if (byLoad) return byLoad
            const byResponse = Number(!responded.has(a.id)) - Number(!responded.has(b.id))
            if (byResponse) return byResponse
            return a.name.localeCompare(b.name)
          })

        const pick = candidates[0]
        if (!pick) {
          unfilled.push({ event_id: ev.id, area_id: area.id, missing: target - have })
          break
        }

        const notes: string[] = []
        if (!responded.has(pick.id)) notes.push("não respondeu a disponibilidade")
        if (dayLoad.has(`${pick.id}-${ev.event_date}`)) notes.push("já serve neste dia")

        proposals.push({ event_id: ev.id, area_id: area.id, servant_id: pick.id, notes })
        inEvent.add(`${pick.id}-${ev.id}`)
        dayLoad.add(`${pick.id}-${ev.event_date}`)
        load.set(pick.id, (load.get(pick.id) ?? 0) + 1)
        have++
        counts.set(key, have)
      }
    }
  }

  return { proposals, unfilled }
}
