import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuthenticated, canManageMinistry } from "@/lib/escalas/auth"
import { MANUAL_TABLES, type ManualKind } from "@/lib/escalas/manual"
import { areaBelongsTo, normalizeArea } from "@/lib/escalas/manual-server"

/**
 * Edição do Manual de Serviço (admin e líderes do ministério):
 *   POST   /api/escalas/manual/content/{checklist|troubleshooting|videos}   cria
 *   PATCH  ...?id=                                                          edita / ativa / move
 *   DELETE ...?id=                                                          remove
 */

const areaField = z.union([z.string().uuid(), z.literal("general"), z.null()]).optional()
const optText = (max: number) => z.string().trim().max(max).optional().nullable()

const fields: Record<ManualKind, z.ZodObject<z.ZodRawShape>> = {
  checklist: z.object({
    section: optText(60),
    title: z.string().trim().min(1, "Informe o passo").max(200),
    details: optText(2000),
  }),
  troubleshooting: z.object({
    problem: z.string().trim().min(1, "Descreva o problema").max(200),
    solution: z.string().trim().min(1, "Descreva a solução").max(4000),
  }),
  videos: z.object({
    title: z.string().trim().min(1, "Informe o título").max(200),
    url: z.string().trim().url("Link inválido").regex(/^https?:\/\//i, "Use um link http(s)").max(500),
    description: optText(1000),
  }),
}

const isKind = (k: string): k is ManualKind => k in MANUAL_TABLES
const emptyToNull = (obj: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === "" ? null : v]))

async function loadRow(supabase: any, table: string, id: string | null) {
  if (!id || !z.string().uuid().safeParse(id).success) return null
  const { data } = await supabase.from(table).select("*").eq("id", id).maybeSingle()
  return data
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params
  if (!isKind(kind)) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
  const auth = await requireAuthenticated()
  if (!auth.ok) return auth.response
  const { supabase, caller } = auth

  const raw = await request.json().catch(() => null)
  const scope = z.object({ ministry_id: z.string().uuid(), area_id: areaField }).safeParse(raw)
  const parsed = fields[kind].safeParse(raw)
  if (!scope.success || !parsed.success) {
    const message = !parsed.success ? parsed.error.errors[0]?.message : "Ministério ou área inválidos"
    return NextResponse.json({ error: message ?? "Dados inválidos" }, { status: 400 })
  }
  const ministryId = scope.data.ministry_id
  const areaId = normalizeArea(scope.data.area_id)
  if (!canManageMinistry(caller, ministryId)) return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  if (!(await areaBelongsTo(supabase, ministryId, areaId))) {
    return NextResponse.json({ error: "Área inválida" }, { status: 400 })
  }

  const table = MANUAL_TABLES[kind]
  let last = supabase.from(table).select("order_index").eq("ministry_id", ministryId).order("order_index", { ascending: false }).limit(1)
  last = areaId ? last.eq("area_id", areaId) : last.is("area_id", null)
  const { data: lastRow } = await last.maybeSingle()

  const { data, error } = await supabase
    .from(table)
    .insert({
      ...emptyToNull(parsed.data),
      ministry_id: ministryId,
      area_id: areaId,
      order_index: (lastRow?.order_index ?? -1) + 1,
      ...(kind === "checklist" ? { created_by: caller.userId } : {}),
    })
    .select()
    .single()
  if (error) {
    console.error(`Erro ao criar item do manual (${kind}):`, error)
    return NextResponse.json({ error: "Erro ao salvar" }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params
  if (!isKind(kind)) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
  const auth = await requireAuthenticated()
  if (!auth.ok) return auth.response
  const { supabase, caller } = auth
  const table = MANUAL_TABLES[kind]

  const row = await loadRow(supabase, table, request.nextUrl.searchParams.get("id"))
  if (!row) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
  if (!canManageMinistry(caller, row.ministry_id)) return NextResponse.json({ error: "Acesso negado" }, { status: 403 })

  const raw = (await request.json().catch(() => null)) ?? {}

  // Mover para cima/baixo: troca a posição com o vizinho do mesmo escopo
  const move = z.object({ move: z.enum(["up", "down"]) }).safeParse(raw)
  if (move.success) {
    let q = supabase
      .from(table)
      .select("id, order_index, created_at")
      .eq("ministry_id", row.ministry_id)
      .order("order_index")
      .order("created_at")
    q = row.area_id ? q.eq("area_id", row.area_id) : q.is("area_id", null)
    const { data: siblings } = await q
    const list = siblings ?? []
    const idx = list.findIndex((s: { id: string }) => s.id === row.id)
    const swap = move.data.move === "up" ? idx - 1 : idx + 1
    if (idx < 0 || swap < 0 || swap >= list.length) return NextResponse.json({ ok: true })
    // Renumera o escopo inteiro (corrige posições repetidas de itens antigos)
    const ordered = [...list]
    ;[ordered[idx], ordered[swap]] = [ordered[swap], ordered[idx]]
    const results = await Promise.all(
      ordered.map((s: { id: string }, i: number) =>
        supabase.from(table).update({ order_index: i }).eq("id", s.id)
      )
    )
    if (results.some((r) => r.error)) return NextResponse.json({ error: "Erro ao reordenar" }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const parsed = fields[kind]
    .partial()
    .extend({ is_active: z.boolean().optional(), area_id: areaField })
    .safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Dados inválidos" }, { status: 400 })
  }
  const update: Record<string, unknown> = emptyToNull(parsed.data)
  if (parsed.data.area_id !== undefined) {
    const areaId = normalizeArea(parsed.data.area_id as string | null)
    if (!(await areaBelongsTo(supabase, row.ministry_id, areaId))) {
      return NextResponse.json({ error: "Área inválida" }, { status: 400 })
    }
    update.area_id = areaId
  }
  delete update.ministry_id

  const { data, error } = await supabase
    .from(table)
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("id", row.id)
    .select()
    .single()
  if (error) {
    console.error(`Erro ao editar item do manual (${kind}):`, error)
    return NextResponse.json({ error: "Erro ao salvar" }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params
  if (!isKind(kind)) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
  const auth = await requireAuthenticated()
  if (!auth.ok) return auth.response
  const { supabase, caller } = auth
  const table = MANUAL_TABLES[kind]

  const row = await loadRow(supabase, table, request.nextUrl.searchParams.get("id"))
  if (!row) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
  if (!canManageMinistry(caller, row.ministry_id)) return NextResponse.json({ error: "Acesso negado" }, { status: 403 })

  const { error } = await supabase.from(table).delete().eq("id", row.id)
  if (error) return NextResponse.json({ error: "Erro ao remover" }, { status: 500 })
  return NextResponse.json({ ok: true })
}
