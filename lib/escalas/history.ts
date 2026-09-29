import type { SupabaseClient } from "@supabase/supabase-js"
import type { AssignmentLogAction } from "@/types/escalas"

/**
 * Histórico da escala (schedule_assignment_log): quem entrou, saiu, confirmou
 * ou recusou, por quem e quando. Gravado pelas APIs; nunca interrompe a
 * operação que está sendo registrada.
 */

export interface LogEntryInput {
  schedule_event_id: string
  servant_id: string
  area_id: string
  action: AssignmentLogAction
  details?: string | null
}

export interface LogActor {
  userId: string | null
  label: string
}

/** Nome de quem está logado (perfil), para aparecer no histórico */
export async function actorFromUser(supabase: SupabaseClient, userId: string): Promise<LogActor> {
  const { data } = await supabase.from("profiles").select("full_name, email").eq("id", userId).maybeSingle()
  return { userId, label: data?.full_name || data?.email || "Usuário" }
}

export async function logAssignmentChanges(
  supabase: SupabaseClient,
  entries: LogEntryInput[],
  actor: LogActor
): Promise<void> {
  if (entries.length === 0) return
  try {
    const eventIds = [...new Set(entries.map((e) => e.schedule_event_id))]
    const servantIds = [...new Set(entries.map((e) => e.servant_id))]
    const areaIds = [...new Set(entries.map((e) => e.area_id))]

    const [{ data: events }, { data: servants }, { data: areas }] = await Promise.all([
      supabase.from("schedule_events").select("id, period_id").in("id", eventIds),
      supabase.from("servants").select("id, name").in("id", servantIds),
      supabase.from("areas").select("id, name").in("id", areaIds),
    ])
    const periodOf = new Map((events ?? []).map((e: { id: string; period_id: string }) => [e.id, e.period_id]))
    const servantName = new Map((servants ?? []).map((s: { id: string; name: string }) => [s.id, s.name]))
    const areaName = new Map((areas ?? []).map((a: { id: string; name: string }) => [a.id, a.name]))

    const rows = entries
      .filter((e) => periodOf.has(e.schedule_event_id))
      .map((e) => ({
        period_id: periodOf.get(e.schedule_event_id)!,
        schedule_event_id: e.schedule_event_id,
        servant_id: e.servant_id,
        area_id: e.area_id,
        action: e.action,
        actor_user_id: actor.userId,
        actor_label: actor.label,
        servant_name: servantName.get(e.servant_id) ?? null,
        area_name: areaName.get(e.area_id) ?? null,
        details: e.details ?? null,
      }))

    if (rows.length) {
      const { error } = await supabase.from("schedule_assignment_log").insert(rows)
      if (error) console.error("Erro ao gravar histórico da escala:", error)
    }
  } catch (error) {
    console.error("Erro ao gravar histórico da escala:", error)
  }
}
