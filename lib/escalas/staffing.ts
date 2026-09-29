/**
 * Regras de preenchimento de vagas, compartilhadas entre a tela de montagem e
 * a API de publicação (sem dependências de servidor).
 *
 * - Área exigida precisa de pelo menos max(1, min_servants) pessoas.
 * - max_servants (quando definido) limita quantas podem ser escaladas.
 * - Quem recusou não ocupa a vaga.
 */

export interface StaffingArea {
  id: string
  min_servants?: number | null
  max_servants?: number | null
}

export interface StaffingEvent {
  id: string
  requires_areas: string[] | null
}

export interface StaffingAssignment {
  schedule_event_id: string
  area_id: string
  status?: string | null
}

type AreaLimits = Pick<StaffingArea, "min_servants" | "max_servants">

/** Quantas pessoas a área precisa em cada evento */
export const areaNeed = (area: AreaLimits) => Math.max(1, area.min_servants ?? 0)

/** Limite de pessoas na área (null = sem limite) */
export const areaCapacity = (area: AreaLimits) =>
  area.max_servants && area.max_servants > 0 ? Math.max(area.max_servants, areaNeed(area)) : null

export const isFilling = (a: StaffingAssignment) => a.status !== "declined"

export function requiredAreas<A extends StaffingArea>(event: StaffingEvent, areas: A[]): A[] {
  if (!event.requires_areas || event.requires_areas.length === 0) return areas
  return areas.filter((a) => event.requires_areas!.includes(a.id))
}

/** Contagem de pessoas que ocupam vaga, por evento+área */
export function countByEventArea(assignments: StaffingAssignment[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const a of assignments) {
    if (!isFilling(a)) continue
    const key = `${a.schedule_event_id}-${a.area_id}`
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

export interface EventCompletion {
  /** Áreas exigidas que já atingiram o mínimo */
  filledAreas: number
  requiredAreas: number
  /** Vagas que faltam somando todas as áreas exigidas */
  missingSlots: number
  complete: boolean
}

export function eventCompletion(
  event: StaffingEvent,
  areas: StaffingArea[],
  counts: Map<string, number>
): EventCompletion {
  const required = requiredAreas(event, areas)
  let filledAreas = 0
  let missingSlots = 0
  for (const area of required) {
    const have = counts.get(`${event.id}-${area.id}`) ?? 0
    const need = areaNeed(area)
    if (have >= need) filledAreas++
    else missingSlots += need - have
  }
  return { filledAreas, requiredAreas: required.length, missingSlots, complete: missingSlots === 0 }
}
