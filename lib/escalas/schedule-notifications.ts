import type { SupabaseClient } from "@supabase/supabase-js"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { signScheduleToken } from "@/lib/escalas/availability-token"
import { findMinistryManagerEmails, monthLabel } from "@/lib/escalas/availability"
import {
  APP_URL,
  assignmentDeclinedEmail,
  assignmentReminderEmail,
  byChronology,
  schedulePublishedEmail,
  sendEmails,
  type EmailMessage,
  type ScheduleEmailItem,
} from "@/lib/escalas/email"

/**
 * Avisos da escala publicada: e-mail com as mudanças de cada servo ao
 * publicar/atualizar, aviso ao líder quando alguém recusa e lembretes
 * antes do evento.
 */

interface EventRow {
  id: string
  event_date: string
  event_time: string
  title: string
}

export const eventLabel = (e: Pick<EventRow, "event_date" | "event_time" | "title">) =>
  `${format(new Date(`${e.event_date}T12:00:00`), "EEE, dd/MM", { locale: ptBR })} às ${e.event_time.slice(0, 5)} — ${e.title}`

const eventSortKey = (e: Pick<EventRow, "event_date" | "event_time">) =>
  `${e.event_date}T${e.event_time.slice(0, 5)}`

/** Página pessoal da escala publicada (aceitar / recusar) */
export function personalScheduleLink(periodToken: string, servantId: string, periodId: string) {
  return `${APP_URL}/escala/${periodToken}?s=${servantId}&k=${signScheduleToken(servantId, periodId)}`
}

/**
 * Envia a cada servo só o que mudou desde o último aviso: atribuições novas
 * (notified_at nulo) e remoções de escalas já comunicadas.
 */
export async function notifyPublishedChanges(
  supabase: SupabaseClient,
  periodId: string
): Promise<{ sent: number; failed: number; recipients: number; withoutEmail: string[] }> {
  const empty = { sent: 0, failed: 0, recipients: 0, withoutEmail: [] as string[] }

  const { data: period } = await supabase
    .from("schedule_periods")
    .select("id, month, year, availability_token, ministry:ministries(name)")
    .eq("id", periodId)
    .single()
  if (!period) return empty
  const ministryName = (period.ministry as unknown as { name: string } | null)?.name ?? ""

  const { data: events } = await supabase
    .from("schedule_events")
    .select("id, event_date, event_time, title")
    .eq("period_id", periodId)
  const eventById = new Map((events ?? []).map((e: EventRow) => [e.id, e]))
  const eventIds = [...eventById.keys()]
  if (eventIds.length === 0) return empty

  const [{ data: added }, { data: removed }, { data: current }] = await Promise.all([
    supabase
      .from("schedule_assignments")
      .select("id, servant_id, schedule_event_id, servant:servants(name, email), area:areas(name)")
      .in("schedule_event_id", eventIds)
      .is("notified_at", null)
      .neq("status", "declined"),
    supabase
      .from("schedule_assignment_removals")
      .select("id, servant_id, schedule_event_id, servant:servants(name, email), area:areas(name)")
      .in("schedule_event_id", eventIds)
      .is("notified_at", null),
    supabase.from("schedule_assignments").select("servant_id, schedule_event_id").in("schedule_event_id", eventIds),
  ])

  // Removido e escalado de novo no mesmo evento: não é remoção
  const stillAssigned = new Set((current ?? []).map((a: any) => `${a.servant_id}|${a.schedule_event_id}`))
  const realRemovals = (removed ?? []).filter((r: any) => !stillAssigned.has(`${r.servant_id}|${r.schedule_event_id}`))

  type Change = { name: string; email: string | null; added: ScheduleEmailItem[]; removed: ScheduleEmailItem[] }
  const byServant = new Map<string, Change>()
  const touch = (row: any): Change => {
    if (!byServant.has(row.servant_id)) {
      byServant.set(row.servant_id, { name: row.servant?.name ?? "", email: row.servant?.email ?? null, added: [], removed: [] })
    }
    return byServant.get(row.servant_id)!
  }
  for (const a of (added ?? []) as any[]) {
    const e = eventById.get(a.schedule_event_id)
    if (e) touch(a).added.push({ label: eventLabel(e), area: a.area?.name ?? "", sortKey: eventSortKey(e) })
  }
  for (const r of realRemovals as any[]) {
    const e = eventById.get(r.schedule_event_id)
    if (e) touch(r).removed.push({ label: eventLabel(e), area: r.area?.name ?? "", sortKey: eventSortKey(e) })
  }

  const withoutEmail: string[] = []
  const messages: EmailMessage[] = []
  for (const [servantId, change] of byServant) {
    if (!change.email) {
      withoutEmail.push(change.name)
      continue
    }
    change.added.sort(byChronology)
    change.removed.sort(byChronology)
    const { subject, html } = schedulePublishedEmail({
      name: change.name,
      ministryName,
      monthLabel: monthLabel(period.month, period.year),
      added: change.added,
      removed: change.removed,
      link: personalScheduleLink(period.availability_token, servantId, period.id),
    })
    messages.push({ to: change.email, subject, html })
  }

  const result = await sendEmails(messages)

  // Só marca como avisado quando o envio deu certo (senão tenta de novo no próximo "Atualizar")
  if (result.failed === 0) {
    const now = new Date().toISOString()
    const addedIds = (added ?? []).map((a: { id: string }) => a.id)
    const removalIds = (removed ?? []).map((r: { id: string }) => r.id)
    if (addedIds.length) await supabase.from("schedule_assignments").update({ notified_at: now }).in("id", addedIds)
    if (removalIds.length) await supabase.from("schedule_assignment_removals").update({ notified_at: now }).in("id", removalIds)
  }

  return { ...result, recipients: messages.length, withoutEmail }
}

/** Remoção de uma atribuição já comunicada ao servo: guarda para avisar no próximo envio. */
export async function recordRemovalIfNotified(
  supabase: SupabaseClient,
  assignment: { servant_id: string; schedule_event_id: string; area_id: string; notified_at: string | null }
) {
  if (!assignment.notified_at) return
  await supabase.from("schedule_assignment_removals").insert({
    servant_id: assignment.servant_id,
    schedule_event_id: assignment.schedule_event_id,
    area_id: assignment.area_id,
  })
}

/** Servo aceita ou recusa uma atribuição. Recusa avisa os líderes do ministério. */
export async function respondToAssignment(
  supabase: SupabaseClient,
  assignmentId: string,
  status: "accepted" | "declined",
  reason: string | null
) {
  const now = new Date().toISOString()
  const { data: assignment, error } = await supabase
    .from("schedule_assignments")
    .update({ status, responded_at: now, confirmed: status === "accepted", confirmed_at: status === "accepted" ? now : null })
    .eq("id", assignmentId)
    .select(`
      id, servant:servants(name), area:areas(name),
      event:schedule_events(event_date, event_time, title, period:schedule_periods(id, ministry_id, ministry:ministries(name)))
    `)
    .single()
  if (error || !assignment) throw error ?? new Error("Atribuição não encontrada")

  if (status === "accepted") {
    await supabase.from("schedule_assignment_declines").delete().eq("assignment_id", assignmentId)
    return
  }

  await supabase
    .from("schedule_assignment_declines")
    .upsert({ assignment_id: assignmentId, reason: reason?.trim() || null, created_at: now })

  const a = assignment as any
  const period = a.event?.period
  if (!period) return
  const recipients = await findMinistryManagerEmails(supabase, period.ministry_id)
  if (recipients.length === 0) return

  const { subject, html } = assignmentDeclinedEmail({
    servantName: a.servant?.name ?? "Um servo",
    ministryName: period.ministry?.name ?? "",
    item: { label: eventLabel(a.event), area: a.area?.name ?? "" },
    reason: reason?.trim() || null,
    link: `${APP_URL}/admin-escalas/montar/${period.id}`,
  })
  await sendEmails(recipients.map((to) => ({ to, subject, html })))
}

/** Data de hoje no fuso de Brasília (UTC-3, sem horário de verão desde 2019) */
function brDate(offsetDays: number) {
  return new Date(Date.now() - 3 * 3600 * 1000 + offsetDays * 24 * 3600 * 1000).toISOString().slice(0, 10)
}

/**
 * Lembretes de escala: 3 dias e 1 dia antes do evento, para quem está escalado
 * (pendente ou confirmado) em escalas publicadas. Um e-mail por pessoa por dia.
 */
export async function sendAssignmentReminders(
  supabase: SupabaseClient
): Promise<{ sent: number; failed: number; recipients: number }> {
  const targets: { date: string; whenLabel: string }[] = [
    { date: brDate(1), whenLabel: "amanhã" },
    { date: brDate(3), whenLabel: "em 3 dias" },
  ]

  const messages: EmailMessage[] = []
  for (const target of targets) {
    const { data: rows } = await supabase
      .from("schedule_assignments")
      .select(`
        status, servant_id, servant:servants(name, email), area:areas(name),
        schedule_events!inner(event_date, event_time, title,
          schedule_periods!inner(id, status, availability_token, ministries(name)))
      `)
      .eq("schedule_events.event_date", target.date)
      .eq("schedule_events.schedule_periods.status", "published")
      .neq("status", "declined")

    // Agrupa por e-mail: a mesma pessoa pode servir em mais de um ministério no dia
    const byEmail = new Map<string, { name: string; items: Parameters<typeof assignmentReminderEmail>[0]["items"] }>()
    for (const r of (rows ?? []) as any[]) {
      const email = r.servant?.email?.toLowerCase().trim()
      const ev = r.schedule_events
      const period = ev?.schedule_periods
      if (!email || !ev || !period) continue
      if (!byEmail.has(email)) byEmail.set(email, { name: r.servant.name, items: [] })
      byEmail.get(email)!.items.push({
        label: eventLabel(ev),
        sortKey: eventSortKey(ev),
        area: r.area?.name ?? "",
        ministry: period.ministries?.name ?? "",
        pending: r.status === "pending",
        link: personalScheduleLink(period.availability_token, r.servant_id, period.id),
      })
    }

    for (const [email, person] of byEmail) {
      person.items.sort(byChronology)
      const { subject, html } = assignmentReminderEmail({ name: person.name, whenLabel: target.whenLabel, items: person.items })
      messages.push({ to: email, subject, html })
    }
  }

  const result = await sendEmails(messages)
  return { ...result, recipients: messages.length }
}
