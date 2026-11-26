import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { confirmCharge } from "@/lib/confraternizacao/reconcile"
import { requireConfraManager } from "@/lib/confraternizacao/server"

const pixSchema = z.object({
  id: z.string().min(1),
  amount: z.number().positive(),
  payer_name: z.string().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const schema = z.discriminatedUnion("action", [
  // Baixa manual; com `pix`, liga a um PIX sugerido pela conferência
  z.object({ action: z.literal("mark_paid"), pix: pixSchema.optional() }),
  z.object({ action: z.literal("cancel") }),
  // Volta uma inscrição cancelada (ou paga por engano) para "aguardando pagamento"
  z.object({ action: z.literal("reopen") }),
])

// PATCH - Ações de gestão sobre uma inscrição
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireConfraManager()
  if (!auth.ok) return auth.response
  const { supabase, userId } = auth
  const { id } = await params

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Ação inválida" }, { status: 400 })
  const body = parsed.data

  const { data: reg, error } = await supabase
    .from("confra_registrations")
    .select("id, status, cannot_pay, total_expected")
    .eq("id", id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: "Erro ao carregar inscrição" }, { status: 500 })
  if (!reg) return NextResponse.json({ error: "Inscrição não encontrada" }, { status: 404 })

  try {
    if (body.action === "mark_paid") {
      if (reg.status !== "pending_payment") {
        return NextResponse.json({ error: "A inscrição não está aguardando pagamento" }, { status: 409 })
      }
      const ok = await confirmCharge(supabase, "registration", id, {
        pluggy_tx_id: body.pix?.id ?? null,
        amount: body.pix?.amount ?? Number(reg.total_expected),
        payer_name: body.pix?.payer_name ?? null,
        tx_date: body.pix?.date ?? null,
        match: "manual",
        confirmed_by: userId,
      })
      if (!ok) {
        return NextResponse.json(
          { error: "Este PIX já foi usado em outra confirmação, ou a inscrição mudou" },
          { status: 409 }
        )
      }
    } else if (body.action === "cancel") {
      const { error: upError } = await supabase
        .from("confra_registrations")
        .update({ status: "cancelled" })
        .eq("id", id)
      if (upError) throw upError
      // Libera o PIX para confirmar outra inscrição, se for o caso
      await supabase.from("confra_payments").delete().eq("registration_id", id)
    } else {
      const status = reg.cannot_pay
        ? "sponsored"
        : Number(reg.total_expected) === 0
          ? "paid"
          : "pending_payment"
      const { error: upError } = await supabase
        .from("confra_registrations")
        .update({ status, paid_at: status === "paid" ? new Date().toISOString() : null })
        .eq("id", id)
      if (upError) throw upError
      await supabase.from("confra_payments").delete().eq("registration_id", id)
    }
  } catch (err) {
    console.error("Confraternização: erro na ação", body.action, err)
    return NextResponse.json({ error: "Erro ao atualizar inscrição" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
