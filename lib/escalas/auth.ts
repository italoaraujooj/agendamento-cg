import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient, createServerClient } from "@/lib/supabase/server"

/**
 * Autorização das rotas de /api/escalas.
 *
 * As rotas usam o cliente service role (bypassa RLS), então a verificação
 * de quem está chamando precisa acontecer aqui, no servidor.
 */

export interface EscalasCaller {
  userId: string
  isAdmin: boolean
  /** Ministérios que o usuário lidera/coordena (user_ministry_roles) */
  ministryIds: string[]
  permissions: string[]
}

type GuardResult =
  | { ok: true; caller: EscalasCaller; supabase: SupabaseClient }
  | { ok: false; response: NextResponse }

const unauthorized = () =>
  NextResponse.json({ error: "Não autenticado" }, { status: 401 })
const forbidden = () =>
  NextResponse.json({ error: "Acesso negado" }, { status: 403 })
const configError = () =>
  NextResponse.json({ error: "Erro de configuração" }, { status: 500 })

/** Retorna o usuário autenticado e seus papéis, ou null se não houver sessão. */
export async function getEscalasCaller(): Promise<EscalasCaller | null> {
  const serverClient = await createServerClient()
  if (!serverClient) return null

  const {
    data: { user },
  } = await serverClient.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  if (!admin) return null

  const [{ data: profile }, { data: roles }, { data: perms }] = await Promise.all([
    admin.from("profiles").select("is_admin").eq("id", user.id).maybeSingle(),
    admin.from("user_ministry_roles").select("ministry_id").eq("user_id", user.id),
    admin.from("user_permissions").select("permission").eq("user_id", user.id),
  ])

  return {
    userId: user.id,
    isAdmin: profile?.is_admin === true,
    ministryIds: (roles ?? []).map((r: { ministry_id: string }) => r.ministry_id),
    permissions: (perms ?? []).map((p: { permission: string }) => p.permission),
  }
}

export function canManageMinistry(caller: EscalasCaller, ministryId: string | null | undefined) {
  if (caller.isAdmin) return true
  return !!ministryId && caller.ministryIds.includes(ministryId)
}

export function canAccessEscalas(caller: EscalasCaller) {
  return (
    caller.isAdmin ||
    caller.ministryIds.length > 0 ||
    caller.permissions.includes("access_escalas")
  )
}

async function guard(check: (caller: EscalasCaller) => boolean): Promise<GuardResult> {
  const supabase = createAdminClient()
  if (!supabase) return { ok: false, response: configError() }

  const caller = await getEscalasCaller()
  if (!caller) return { ok: false, response: unauthorized() }
  if (!check(caller)) return { ok: false, response: forbidden() }

  return { ok: true, caller, supabase }
}

/** Qualquer usuário autenticado. */
export const requireAuthenticated = () => guard(() => true)

/** Admin, líder de algum ministério ou quem tem a permissão access_escalas. */
export const requireEscalasAccess = () => guard(canAccessEscalas)

/** Apenas administradores globais. */
export const requireEscalasAdmin = () => guard((c) => c.isAdmin)

/** Admin ou líder/coordenador do ministério informado. */
export const requireMinistryManager = (ministryId: string | null | undefined) =>
  guard((c) => canManageMinistry(c, ministryId))

type Entity = "period" | "event" | "area" | "servant" | "assignment"

/**
 * Admin ou líder do ministério ao qual a entidade pertence.
 * Autentica antes de consultar o banco; entidade inexistente → 404.
 */
export async function requireManagerOf(entity: Entity, id: string): Promise<GuardResult> {
  const supabase = createAdminClient()
  if (!supabase) return { ok: false, response: configError() }

  const caller = await getEscalasCaller()
  if (!caller) return { ok: false, response: unauthorized() }

  if (!caller.isAdmin) {
    const ministryId = await ministryIdFrom(supabase, entity, id)
    if (!ministryId) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Não encontrado" }, { status: 404 }),
      }
    }
    if (!canManageMinistry(caller, ministryId)) return { ok: false, response: forbidden() }
  }

  return { ok: true, caller, supabase }
}

/**
 * Resolve o ministry_id a partir de outras entidades do módulo, para que
 * as rotas possam aplicar requireMinistryManager.
 */
export async function ministryIdFrom(
  supabase: SupabaseClient,
  entity: Entity,
  id: string
): Promise<string | null> {
  switch (entity) {
    case "period": {
      const { data } = await supabase
        .from("schedule_periods")
        .select("ministry_id")
        .eq("id", id)
        .maybeSingle()
      return data?.ministry_id ?? null
    }
    case "event": {
      const { data } = await supabase
        .from("schedule_events")
        .select("period:schedule_periods(ministry_id)")
        .eq("id", id)
        .maybeSingle()
      return (data?.period as unknown as { ministry_id: string } | null)?.ministry_id ?? null
    }
    case "area": {
      const { data } = await supabase
        .from("areas")
        .select("ministry_id")
        .eq("id", id)
        .maybeSingle()
      return data?.ministry_id ?? null
    }
    case "servant": {
      const { data } = await supabase
        .from("servants")
        .select("area:areas!servants_area_id_fkey(ministry_id)")
        .eq("id", id)
        .maybeSingle()
      return (data?.area as unknown as { ministry_id: string } | null)?.ministry_id ?? null
    }
    case "assignment": {
      const { data } = await supabase
        .from("schedule_assignments")
        .select("schedule_event_id")
        .eq("id", id)
        .maybeSingle()
      return data ? ministryIdFrom(supabase, "event", data.schedule_event_id) : null
    }
  }
}
