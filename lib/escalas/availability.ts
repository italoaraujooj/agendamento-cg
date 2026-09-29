import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Helpers do fluxo público de disponibilidade (/disponibilidade/[token]).
 */

export interface MinistryServant {
  id: string
  name: string
  email: string | null
  user_id: string | null
  is_active: boolean
}

export interface OpenPeriod {
  id: string
  month: number
  year: number
  status: string
  availability_deadline: string | null
  ministry: { id: string; name: string; color: string } | null
}

export type PeriodLookup =
  | { ok: true; period: OpenPeriod }
  | { ok: false; status: number; error: string; periodStatus?: string; deadline?: string }

/** Verifica se o período está aceitando respostas (status + prazo). */
export function checkPeriodOpen(period: {
  status: string
  availability_deadline: string | null
}): { open: true } | { open: false; reason: "status" | "deadline" } {
  if (period.status !== "collecting") return { open: false, reason: "status" }
  if (period.availability_deadline && new Date() > new Date(period.availability_deadline)) {
    return { open: false, reason: "deadline" }
  }
  return { open: true }
}

export async function findOpenPeriodByToken(
  supabase: SupabaseClient,
  token: string
): Promise<PeriodLookup> {
  const { data: period, error } = await supabase
    .from("schedule_periods")
    .select("id, month, year, status, availability_deadline, ministry:ministries(id, name, color)")
    .eq("availability_token", token)
    .maybeSingle()

  if (error || !period) {
    return { ok: false, status: 404, error: "Link inválido ou expirado" }
  }

  const open = checkPeriodOpen(period)
  if (!open.open) {
    return {
      ok: false,
      status: 400,
      error: "O prazo para informar disponibilidade já encerrou",
      periodStatus: period.status,
      deadline: period.availability_deadline ?? undefined,
    }
  }

  return { ok: true, period: period as unknown as OpenPeriod }
}

/**
 * Servos do ministério (área primária ou secundária via servant_areas).
 * Inclui inativos: um servo afastado temporariamente ainda pode responder.
 */
export async function findMinistryServants(
  supabase: SupabaseClient,
  ministryId: string
): Promise<MinistryServant[]> {
  const { data } = await supabase
    .from("servants")
    .select(`
      id, name, email, user_id, is_active,
      area:areas!servants_area_id_fkey(ministry_id),
      servant_areas(area:areas(ministry_id))
    `)

  return (data ?? [])
    .filter((s: any) =>
      s.area?.ministry_id === ministryId ||
      s.servant_areas?.some((sa: any) => sa.area?.ministry_id === ministryId)
    )
    .map((s: any) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      user_id: s.user_id,
      is_active: s.is_active,
    }))
}

const norm = (v: string | null | undefined) => (v ?? "").toLowerCase().trim()

/**
 * Todos os registros de servo que representam a mesma pessoa no ministério
 * (o cadastro atual cria uma linha por área). Casa por user_id, e-mail ou nome.
 */
export function samePersonIds(servants: MinistryServant[], target: MinistryServant): string[] {
  return servants
    .filter(
      (s) =>
        s.id === target.id ||
        (target.user_id && s.user_id === target.user_id) ||
        (norm(target.email) && norm(s.email) === norm(target.email)) ||
        norm(s.name) === norm(target.name)
    )
    .map((s) => s.id)
}

export interface SavedAnswers {
  answers: { event_id: string; is_available: boolean; notes: string | null }[]
  submitted_at: string | null
}

/** Última resposta registrada entre os registros da mesma pessoa. */
export async function loadSavedAnswers(
  supabase: SupabaseClient,
  periodId: string,
  servantIds: string[]
): Promise<SavedAnswers> {
  const { data } = await supabase
    .from("servant_availability")
    .select("servant_id, event_id, is_available, notes, submitted_at")
    .eq("period_id", periodId)
    .in("servant_id", servantIds)
    .order("submitted_at", { ascending: false })

  const rows = data ?? []
  if (rows.length === 0) return { answers: [], submitted_at: null }

  // Usa o conjunto de respostas do registro enviado mais recentemente
  const latestServant = rows[0].servant_id
  const answers = rows
    .filter((r: any) => r.servant_id === latestServant)
    .map((r: any) => ({ event_id: r.event_id, is_available: r.is_available, notes: r.notes }))

  return { answers, submitted_at: rows[0].submitted_at }
}
