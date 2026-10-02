import { NextRequest, NextResponse } from "next/server"
import { canManageMinistry, requireAuthenticated } from "@/lib/escalas/auth"
import { MANUAL_TABLES, todayBr, type ManualData } from "@/lib/escalas/manual"
import { normalizeArea, recordUsage, scopeSchema } from "@/lib/escalas/manual-server"

/**
 * GET /api/escalas/manual?ministry_id=&area_id=
 * Conteúdo das três abas para uma área (inclui os itens gerais do ministério),
 * as marcações de hoje do usuário e as sugestões dele aguardando aprovação.
 *
 * Gestores podem pedir `exact=1` (só o escopo informado, sem misturar o geral)
 * e `include_inactive=1` para a tela de edição.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuthenticated()
  if (!auth.ok) return auth.response
  const { supabase, caller } = auth

  const params = request.nextUrl.searchParams
  const parsed = scopeSchema.safeParse({
    ministry_id: params.get("ministry_id"),
    area_id: params.get("area_id") || undefined,
  })
  if (!parsed.success) return NextResponse.json({ error: "Ministério ou área inválidos" }, { status: 400 })

  const ministryId = parsed.data.ministry_id
  const areaId = normalizeArea(parsed.data.area_id)
  const canManage = canManageMinistry(caller, ministryId)
  const exact = canManage && params.get("exact") === "1"
  const includeInactive = canManage && params.get("include_inactive") === "1"

  const scoped = (table: string) => {
    let q = supabase.from(table).select("*").eq("ministry_id", ministryId)
    if (exact) q = areaId ? q.eq("area_id", areaId) : q.is("area_id", null)
    else q = areaId ? q.or(`area_id.is.null,area_id.eq.${areaId}`) : q.is("area_id", null)
    if (!includeInactive) q = q.eq("is_active", true)
    // Itens gerais do ministério primeiro, depois os da área
    return q.order("area_id", { ascending: true, nullsFirst: true }).order("order_index").order("created_at")
  }

  const [checklist, troubleshooting, videos, mySuggestions] = await Promise.all([
    scoped(MANUAL_TABLES.checklist),
    scoped(MANUAL_TABLES.troubleshooting),
    scoped(MANUAL_TABLES.videos),
    supabase
      .from("manual_checklist_suggestions")
      .select("id, ministry_id, area_id, section, title, details, status, review_note, created_at")
      .eq("ministry_id", ministryId)
      .eq("suggested_by", caller.userId)
      .eq("status", "pending")
      .order("created_at"),
  ])

  const failed = [checklist, troubleshooting, videos, mySuggestions].find((r) => r.error)
  if (failed?.error) {
    console.error("Erro ao carregar o manual:", failed.error)
    return NextResponse.json({ error: "Erro ao carregar o manual" }, { status: 500 })
  }

  const itemIds = (checklist.data ?? []).map((i: { id: string }) => i.id)
  const { data: done } = itemIds.length
    ? await supabase
        .from("manual_checklist_progress")
        .select("item_id")
        .eq("user_id", caller.userId)
        .eq("done_on", todayBr())
        .in("item_id", itemIds)
    : { data: [] }

  // A tela de edição não conta como uso do manual
  if (!exact) await recordUsage(supabase, caller.userId, ministryId, areaId)

  const body: ManualData = {
    checklist: checklist.data ?? [],
    troubleshooting: troubleshooting.data ?? [],
    videos: videos.data ?? [],
    doneToday: (done ?? []).map((d: { item_id: string }) => d.item_id),
    mySuggestions: (mySuggestions.data ?? []).filter((s: { area_id: string | null }) =>
      areaId ? s.area_id === areaId || s.area_id === null : s.area_id === null
    ),
    canManage,
  }
  return NextResponse.json(body)
}
