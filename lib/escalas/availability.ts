import type { SupabaseClient } from "@supabase/supabase-js"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { signAvailabilityToken } from "@/lib/escalas/availability-token"
import {
  APP_URL,
  availabilityInviteEmail,
  lateAvailabilityChangeEmail,
  sendEmails,
  type EmailMessage,
} from "@/lib/escalas/email"

/**
 * Helpers do fluxo de disponibilidade (/disponibilidade/[token]).
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
  | { ok: true; period: OpenPeriod; late: boolean }
  | { ok: false; status: number; error: string; periodStatus?: string; deadline?: string }

/**
 * Respostas são aceitas enquanto a escala não foi publicada
 * (status "collecting" ou "scheduling"). Depois do prazo, ou com a escala já
 * em montagem, a resposta é tardia: continua sendo aceita, mas o líder é avisado.
 */
export function checkPeriodOpen(period: {
  status: string
  availability_deadline: string | null
}): { open: false } | { open: true; late: boolean } {
  if (period.status !== "collecting" && period.status !== "scheduling") return { open: false }
  const pastDeadline =
    !!period.availability_deadline && new Date() > new Date(period.availability_deadline)
  return { open: true, late: period.status === "scheduling" || pastDeadline }
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
      error: "A escala deste período já foi publicada. Fale com o líder do ministério para alterações.",
      periodStatus: period.status,
      deadline: period.availability_deadline ?? undefined,
    }
  }

  return { ok: true, period: period as unknown as OpenPeriod, late: open.late }
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

export interface Person {
  /** Registro usado no link pessoal (prefere ativo e com e-mail) */
  primary: MinistryServant
  ids: string[]
  email: string | null
  isActive: boolean
}

/** Agrupa os registros de servo do ministério por pessoa. */
export function groupPeople(servants: MinistryServant[]): Person[] {
  const seen = new Set<string>()
  const people: Person[] = []
  for (const s of servants) {
    if (seen.has(s.id)) continue
    const ids = samePersonIds(servants, s)
    ids.forEach((id) => seen.add(id))
    const records = servants.filter((x) => ids.includes(x.id))
    const primary =
      records.find((r) => r.is_active && r.email) ??
      records.find((r) => r.email) ??
      records.find((r) => r.is_active) ??
      records[0]
    people.push({
      primary,
      ids,
      email: records.find((r) => r.email)?.email ?? null,
      isActive: records.some((r) => r.is_active),
    })
  }
  return people
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

/** Link pessoal: abre o formulário já identificado, sem pedir e-mail. */
export function personalAvailabilityLink(periodToken: string, servantId: string, periodId: string) {
  const k = signAvailabilityToken(servantId, periodId)
  return `${APP_URL}/disponibilidade/${periodToken}?s=${servantId}&k=${k}`
}

export const monthLabel = (month: number, year: number) =>
  format(new Date(year, month - 1), "MMMM 'de' yyyy", { locale: ptBR })

export const deadlineLabel = (deadline: string | null) =>
  deadline
    ? format(new Date(deadline), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : null

/**
 * Envia o link pessoal de disponibilidade por e-mail.
 * mode "all": todos os servos ativos; "pending": só quem ainda não respondeu.
 */
export async function sendAvailabilityInvites(
  supabase: SupabaseClient,
  periodId: string,
  mode: "all" | "pending"
): Promise<{ sent: number; failed: number; withoutEmail: string[]; recipients: number }> {
  const { data: period } = await supabase
    .from("schedule_periods")
    .select("id, month, year, availability_deadline, availability_token, ministry:ministries(id, name)")
    .eq("id", periodId)
    .single()

  const ministry = period?.ministry as unknown as { id: string; name: string } | null
  if (!period || !ministry) return { sent: 0, failed: 0, withoutEmail: [], recipients: 0 }

  const servants = await findMinistryServants(supabase, ministry.id)
  let people = groupPeople(servants).filter((p) => p.isActive)

  if (mode === "pending") {
    const { data: rows } = await supabase
      .from("servant_availability")
      .select("servant_id")
      .eq("period_id", periodId)
    const responded = new Set((rows ?? []).map((r: { servant_id: string }) => r.servant_id))
    people = people.filter((p) => !p.ids.some((id) => responded.has(id)))
  }

  const withoutEmail = people.filter((p) => !p.email).map((p) => p.primary.name)
  const messages: EmailMessage[] = people
    .filter((p) => p.email)
    .map((p) => {
      const { subject, html } = availabilityInviteEmail({
        name: p.primary.name,
        ministryName: ministry.name,
        monthLabel: monthLabel(period.month, period.year),
        deadlineLabel: deadlineLabel(period.availability_deadline),
        link: personalAvailabilityLink(period.availability_token, p.primary.id, period.id),
        reminder: mode === "pending",
      })
      return { to: p.email!, subject, html }
    })

  const result = await sendEmails(messages)
  return { ...result, withoutEmail, recipients: messages.length }
}

/** E-mails de quem gerencia o ministério: líder/co-líder e user_ministry_roles. */
export async function findMinistryManagerEmails(
  supabase: SupabaseClient,
  ministryId: string
): Promise<string[]> {
  const [{ data: ministry }, { data: roles }] = await Promise.all([
    supabase
      .from("ministries")
      .select(
        "leader:servants!ministries_leader_id_fkey(email, user_id), co_leader:servants!ministries_co_leader_id_fkey(email, user_id)"
      )
      .eq("id", ministryId)
      .maybeSingle(),
    supabase.from("user_ministry_roles").select("user_id").eq("ministry_id", ministryId),
  ])

  const emails = new Set<string>()
  const userIds = new Set<string>((roles ?? []).map((r: { user_id: string }) => r.user_id))
  for (const leader of [(ministry as any)?.leader, (ministry as any)?.co_leader]) {
    if (leader?.email) emails.add(leader.email.toLowerCase())
    else if (leader?.user_id) userIds.add(leader.user_id)
  }

  if (userIds.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("email")
      .in("id", Array.from(userIds))
    profiles?.forEach((p: { email: string | null }) => p.email && emails.add(p.email.toLowerCase()))
  }

  return Array.from(emails)
}

const answerLabel = (a: { is_available: boolean; notes: string | null } | undefined) =>
  !a ? "Sem resposta" : a.is_available ? "Disponível" : a.notes ? `Indisponível (${a.notes})` : "Indisponível"

/** Avisa os líderes quando alguém altera a disponibilidade depois do prazo. */
export async function notifyLateAvailabilityChange(
  supabase: SupabaseClient,
  params: {
    periodId: string
    servantName: string
    before: SavedAnswers["answers"]
    after: SavedAnswers["answers"]
  }
): Promise<void> {
  const beforeMap = new Map(params.before.map((a) => [a.event_id, a]))
  const changedIds = params.after
    .filter((a) => {
      const prev = beforeMap.get(a.event_id)
      return !prev || prev.is_available !== a.is_available || (prev.notes ?? null) !== (a.notes ?? null)
    })
    .map((a) => a.event_id)
  if (changedIds.length === 0) return

  const { data: period } = await supabase
    .from("schedule_periods")
    .select("id, month, year, ministry:ministries(id, name)")
    .eq("id", params.periodId)
    .single()
  const ministry = period?.ministry as unknown as { id: string; name: string } | null
  if (!period || !ministry) return

  const recipients = await findMinistryManagerEmails(supabase, ministry.id)
  if (recipients.length === 0) return

  const { data: events } = await supabase
    .from("schedule_events")
    .select("id, event_date, event_time, title")
    .in("id", changedIds)
    .order("event_date")
    .order("event_time")

  const afterMap = new Map(params.after.map((a) => [a.event_id, a]))
  const changes = (events ?? []).map((e: any) => ({
    label: `${format(new Date(`${e.event_date}T12:00:00`), "dd/MM (EEE)", { locale: ptBR })} ${e.event_time.slice(0, 5)} — ${e.title}`,
    before: answerLabel(beforeMap.get(e.id)),
    after: answerLabel(afterMap.get(e.id)),
  }))

  const { subject, html } = lateAvailabilityChangeEmail({
    servantName: params.servantName,
    ministryName: ministry.name,
    monthLabel: monthLabel(period.month, period.year),
    changes,
    link: `${APP_URL}/admin-escalas/montar/${period.id}`,
  })

  await sendEmails(recipients.map((to) => ({ to, subject, html })))
}
