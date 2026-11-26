import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { confirmCharge } from "@/lib/confraternizacao/reconcile"
import { requireConfraManager } from "@/lib/confraternizacao/server"

const schema = z.object({
  pix: z.object({
    id: z.string().min(1),
    amount: z.number().positive(),
    payer_name: z.string().nullable(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
})

// POST - Confirma um PIX sugerido como doação avulsa. As doações são
// anônimas no painel: liga à doação pendente mais antiga com o mesmo valor.
export async function POST(request: NextRequest) {
  const auth = await requireConfraManager()
  if (!auth.ok) return auth.response
  const { supabase, userId } = auth

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
  const { pix } = parsed.data

  const { data: pending, error } = await supabase
    .from("confra_donations")
    .select("id")
    .eq("status", "pending")
    .eq("amount", pix.amount)
    .order("created_at")
    .limit(1)
  if (error) return NextResponse.json({ error: "Erro ao buscar doações" }, { status: 500 })
  if (!pending?.length) {
    return NextResponse.json({ error: "Nenhuma doação pendente com este valor" }, { status: 404 })
  }

  try {
    const ok = await confirmCharge(supabase, "donation", pending[0].id, {
      pluggy_tx_id: pix.id,
      amount: pix.amount,
      payer_name: pix.payer_name,
      tx_date: pix.date,
      match: "manual",
      confirmed_by: userId,
    })
    if (!ok) return NextResponse.json({ error: "Este PIX já foi usado" }, { status: 409 })
  } catch (err) {
    console.error("Confraternização: erro ao confirmar doação:", err)
    return NextResponse.json({ error: "Erro ao confirmar doação" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
