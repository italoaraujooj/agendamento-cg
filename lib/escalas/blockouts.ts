/**
 * Datas bloqueadas do servo (férias, viagens): da pessoa, valem em todos os
 * ministérios. Uma resposta explícita de disponibilidade no evento prevalece
 * sobre o bloqueio.
 */

export interface Blockout {
  id: string
  starts_on: string // YYYY-MM-DD
  ends_on: string // YYYY-MM-DD, inclusivo
  reason: string | null
}

export const isDateBlocked = (date: string, blockouts: Pick<Blockout, "starts_on" | "ends_on">[]) =>
  blockouts.some((b) => b.starts_on <= date && date <= b.ends_on)

export const blockoutFor = <B extends Pick<Blockout, "starts_on" | "ends_on">>(date: string, blockouts: B[]) =>
  blockouts.find((b) => b.starts_on <= date && date <= b.ends_on)

export const blockoutReason = (b: Pick<Blockout, "reason">) =>
  b.reason ? `Bloqueio: ${b.reason}` : "Data bloqueada"
