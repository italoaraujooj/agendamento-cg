import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { canManageMinistry, requireAuthenticated } from "@/lib/escalas/auth"
import { areaBelongsTo, normalizeArea } from "@/lib/escalas/manual-server"

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    // O gestor pode ajustar o texto e o lugar antes de aprovar
    title: z.string().trim().min(1).max(200).optional(),
    details: z.string().trim().max(2000).optional().nullable(),
    section: z.string().trim().max(60).optional().nullable(),
    area_id: z.union([z.string().uuid(), z.literal("general"), z.null()]).optional(),
  }),
  z.object({
    action: z.literal("reject"),
    note: z.string().trim().max(500).optional().nullable(),
  }),
])

/** POST /api/escalas/manual/suggestions/[id] — aprova (vira passo do checklist) ou rejeita */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthenticated()
  if (!auth.ok) return auth.response
  const { supabase, caller } = auth
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
  const body = parsed.data

  const { data: suggestion } = await supabase
    .from("manual_checklist_suggestions")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (!suggestion) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
  if (!canManageMinistry(caller, suggestion.ministry_id)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  }
  if (suggestion.status !== "pending") {
    return NextResponse.json({ error: "Esta sugestão já foi analisada" }, { status: 409 })
  }

  const reviewed = { reviewed_by: caller.userId, reviewed_at: new Date().toISOString() }

  if (body.action === "reject") {
    const { error } = await supabase
      .from("manual_checklist_suggestions")
      .update({ status: "rejected", review_note: body.note || null, ...reviewed })
      .eq("id", id)
      .eq("status", "pending")
    if (error) return NextResponse.json({ error: "Erro ao rejeitar" }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const areaId = body.area_id !== undefined ? normalizeArea(body.area_id) : suggestion.area_id
  if (!(await areaBelongsTo(supabase, suggestion.ministry_id, areaId))) {
    return NextResponse.json({ error: "Área inválida" }, { status: 400 })
  }

  // Entra no fim do checklist daquele escopo
  let last = supabase
    .from("manual_checklist_items")
    .select("order_index")
    .eq("ministry_id", suggestion.ministry_id)
    .order("order_index", { ascending: false })
    .limit(1)
  last = areaId ? last.eq("area_id", areaId) : last.is("area_id", null)
  const { data: lastRow } = await last.maybeSingle()

  const { data: item, error } = await supabase
    .from("manual_checklist_items")
    .insert({
      ministry_id: suggestion.ministry_id,
      area_id: areaId,
      section: (body.section !== undefined ? body.section : suggestion.section) || null,
      title: body.title ?? suggestion.title,
      details: (body.details !== undefined ? body.details : suggestion.details) || null,
      order_index: (lastRow?.order_index ?? -1) + 1,
      created_by: suggestion.suggested_by,
    })
    .select()
    .single()
  if (error) {
    console.error("Erro ao aprovar sugestão:", error)
    return NextResponse.json({ error: "Erro ao aprovar" }, { status: 500 })
  }

  await supabase
    .from("manual_checklist_suggestions")
    .update({ status: "approved", created_item_id: item.id, ...reviewed })
    .eq("id", id)

  return NextResponse.json(item)
}
