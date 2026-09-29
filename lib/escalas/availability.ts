import type { SupabaseClient } from "@supabase/supabase-js"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { signAvailabilityToken } from "@/lib/escalas/availability-token"
import { sendPushBatch, sendPushToEmails } from "@/lib/push"
import {
  APP_URL,
  availabilityInviteEmail,
  lateAvailabilityChangeEmail,
  sendEmails,
  type EmailMessage,
} from "@/lib/escalas/email"
import type { Blockout } from "@/lib/escalas/blockouts"

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

/**
 * Datas bloqueadas (férias, viagens) dos servos que caem no intervalo,
 * agrupadas por servo. A ligação servo ↔ bloqueio é pelo e-mail da pessoa.
 */
export async function loadBlockoutsForServants(
  supabase: SupabaseClient,
  servants: { id: string; email: string | null }[],
  from: string,
  to: string
): Promise<Record<string, Blockout[]>> {
  const byEmail = new Map<string, string[]>()
  for (const s of servants) {
    const email = s.email?.toLowerCase().trim()
    if (email) byEmail.set(email, [...(byEmail.get(email) ?? []), s.id])
  }
  if (byEmail.size === 0) return {}

  const { data } = await supabase
    .from("servant_blockouts")
    .select("id, email, starts_on, ends_on, reason")
    .in("email", Array.from(byEmail.keys()))
    .lte("starts_on", to)
    .gte("ends_on", from)

  const result: Record<string, Blockout[]> = {}
  for (const b of (data ?? []) as (Blockout & { email: string })[]) {
    for (const servantId of byEmail.get(b.email) ?? []) {
      ;(result[servantId] ??= []).push({ id: b.id, starts_on: b.starts_on, ends_on: b.ends_on, reason: b.reason })
    }
  }
  return result
}

export interface SavedAnswers {
  answers: { event_id: string; is_available: boolean; notes: string | null }[]
  submitted_at: string | null
}

/** Respostas salvas do servo no período (um registro de servo por pessoa/ministério). */
export async function loadSavedAnswers(
  supabase: SupabaseClient,
  periodId: string,
  servantId: string
): Promise<SavedAnswers> {
  const { data } = await supabase
    .from("servant_availability")
    .select("event_id, is_available, notes, submitted_at")
    .eq("period_id", periodId)
    .eq("servant_id", servantId)
    .order("submitted_at", { ascending: false })

  const rows = data ?? []
  return {
    answers: rows.map((r: any) => ({ event_id: r.event_id, is_available: r.is_available, notes: r.notes })),
    submitted_at: rows[0]?.submitted_at ?? null,
  }
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

  let servants = (await findMinistryServants(supabase, ministry.id)).filter((s) => s.is_active)

  if (mode === "pending") {
    const { data: rows } = await supabase
      .from("servant_availability")
      .select("servant_id")
      .eq("period_id", periodId)
    const responded = new Set((rows ?? []).map((r: { servant_id: string }) => r.servant_id))
    servants = servants.filter((s) => !responded.has(s.id))
  }

  const withoutEmail = servants.filter((s) => !s.email).map((s) => s.name)
  const month = monthLabel(period.month, period.year)
  const deadline = deadlineLabel(period.availability_deadline)
  const withEmail = servants.filter((s) => s.email)
  const messages: EmailMessage[] = withEmail.map((s) => {
    const { subject, html } = availabilityInviteEmail({
      name: s.name,
      ministryName: ministry.name,
      monthLabel: month,
      deadlineLabel: deadline,
      link: personalAvailabilityLink(period.availability_token, s.id, period.id),
      reminder: mode === "pending",
    })
    return { to: s.email!, subject, html }
  })
  const pushes = withEmail.map((s) => ({
    email: s.email!,
    payload: {
      title: mode === "pending" ? "Lembrete: informe sua disponibilidade" : "Informe sua disponibilidade",
      body: `${ministry.name} · ${month}${deadline ? ` — até ${deadline}` : ""}`,
      url: personalAvailabilityLink(period.availability_token, s.id, period.id),
      tag: `disponibilidade-${period.id}`,
    },
  }))

  const [result] = await Promise.all([sendEmails(messages), sendPushBatch(supabase, pushes)])
  return { ...result, withoutEmail, recipients: messages.length }
}

/**
 * Lembrete automático (cron diário): quem ainda não respondeu a disponibilidade
 * quando falta ~1 dia para o prazo. A janela de 24h garante um único lembrete por período.
 */
export async function remindPendingAvailability(supabase: SupabaseClient) {
  const now = Date.now()
  const { data: periods, error } = await supabase
    .from("schedule_periods")
    .select("id")
    .eq("status", "collecting")
    .gt("availability_deadline", new Date(now + 24 * 3600 * 1000).toISOString())
    .lte("availability_deadline", new Date(now + 48 * 3600 * 1000).toISOString())
  if (error) throw error

  const results: { periodId: string; sent: number; failed: number }[] = []
  for (const period of periods ?? []) {
    try {
      const result = await sendAvailabilityInvites(supabase, period.id, "pending")
      results.push({ periodId: period.id, sent: result.sent, failed: result.failed })
    } catch (err) {
      console.error(`Erro ao lembrar pendentes do período ${period.id}:`, err)
      results.push({ periodId: period.id, sent: 0, failed: -1 })
    }
  }
  return results
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

  await Promise.all([
    sendEmails(recipients.map((to) => ({ to, subject, html }))),
    sendPushToEmails(supabase, recipients, {
      title: `${params.servantName} alterou a disponibilidade`,
      body: `${ministry.name} · ${changes.length} evento(s) alterado(s) após o prazo`,
      url: `${APP_URL}/admin-escalas/montar/${period.id}`,
    }),
  ])
}
