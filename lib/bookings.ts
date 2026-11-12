/**
 * Reserva da igreja inteira: uma linha em `bookings` com
 * blocks_all_environments = true e environment_id NULL, que ocupa todos os
 * ambientes no horário (migração 027).
 */
export const WHOLE_CHURCH_LABEL = "Igreja inteira"
export const WHOLE_CHURCH_DESCRIPTION = "Todos os espaços: salão principal e salas"

type EnvRow = { id?: string | number; name: string; capacity?: number }
type EnvJoin = EnvRow | EnvRow[] | null | undefined

/**
 * Normaliza o ambiente de uma reserva vinda do Supabase (join pode vir como
 * objeto, lista ou null). Para a igreja inteira devolve um ambiente virtual
 * com id "all", para as telas exibirem "Igreja inteira" sem caso especial.
 */
export function bookingEnvironment(booking: { blocks_all_environments?: boolean | null; environments?: EnvJoin }) {
  if (booking.blocks_all_environments) {
    return { id: "all", name: WHOLE_CHURCH_LABEL, capacity: 0 }
  }
  const env = Array.isArray(booking.environments) ? booking.environments[0] : booking.environments
  return env ? { ...env, id: String(env.id ?? ""), capacity: env.capacity ?? 0 } : { id: "", name: "", capacity: 0 }
}

/** Nome do lugar de uma reserva, para títulos, e-mails e agenda */
export function bookingPlaceName(booking: { blocks_all_environments?: boolean | null; environments?: EnvJoin }) {
  return bookingEnvironment(booking).name || "Ambiente"
}

/** Filtro PostgREST: reservas de um ambiente OU da igreja inteira */
export function environmentOrWholeChurchFilter(envIds: Array<string | number>) {
  return `environment_id.in.(${envIds.join(",")}),blocks_all_environments.eq.true`
}
