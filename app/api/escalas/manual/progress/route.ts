import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuthenticated } from "@/lib/escalas/auth"
import { todayBr } from "@/lib/escalas/manual"
import { recordUsage } from "@/lib/escalas/manual-server"

const schema = z.object({
  item_ids: z.array(z.string().uuid()).min(1).max(200),
  done: z.boolean(),
})

/**
 * POST /api/escalas/manual/progress
 * Marca/desmarca passos do checklist no dia de hoje. As marcações são só do
 * próprio usuário — ninguém mais as vê. "Recomeçar" = desmarcar todos.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuthenticated()
  if (!auth.ok) return auth.response
  const { supabase, caller } = auth

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
  const { item_ids, done } = parsed.data
  const today = todayBr()

  if (!done) {
    const { error } = await supabase
      .from("manual_checklist_progress")
      .delete()
      .eq("user_id", caller.userId)
      .eq("done_on", today)
      .in("item_id", item_ids)
    if (error) return NextResponse.json({ error: "Erro ao desmarcar" }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const { data: items } = await supabase
    .from("manual_checklist_items")
    .select("id, ministry_id, area_id")
    .in("id", item_ids)
    .eq("is_active", true)
  if (!items?.length) return NextResponse.json({ error: "Passo não encontrado" }, { status: 404 })

  const { error } = await supabase.from("manual_checklist_progress").upsert(
    items.map((i) => ({ user_id: caller.userId, item_id: i.id, done_on: today })),
    { onConflict: "user_id,item_id,done_on", ignoreDuplicates: true }
  )
  if (error) {
    console.error("Erro ao marcar passo:", error)
    return NextResponse.json({ error: "Erro ao marcar" }, { status: 500 })
  }
  await recordUsage(supabase, caller.userId, items[0].ministry_id, items[0].area_id)
  return NextResponse.json({ ok: true })
}
