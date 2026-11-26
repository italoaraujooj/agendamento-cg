import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { PRICE_PER_PERSON, eventInfo, pixReceiver } from "@/lib/confraternizacao/config"
import { pixPayload } from "@/lib/confraternizacao/pix"

// GET - Status da inscrição pelo link pessoal (público)
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })

  const { data: reg, error } = await supabase
    .from("confra_registrations")
    .select(
      "id, contact_name, payer_name, cannot_pay, payers_count, free_count, amount_due, donation_amount, total_expected, status, paid_at, created_at, confra_participants(name, age, is_child, position)"
    )
    .eq("access_token", token)
    .maybeSingle()

  if (error) {
    console.error("Confraternização: erro ao buscar inscrição:", error)
    return NextResponse.json({ error: "Erro ao carregar inscrição" }, { status: 500 })
  }
  if (!reg) return NextResponse.json({ error: "Inscrição não encontrada" }, { status: 404 })

  const receiver = pixReceiver()
  const total = Number(reg.total_expected)
  const pix =
    reg.status === "pending_payment" && receiver && total > 0
      ? {
          payload: pixPayload(receiver, total, { description: "Confraternizacao" }),
          receiver_name: receiver.name,
          key: receiver.key,
        }
      : null

  const participants = [...(reg.confra_participants ?? [])]
    .sort((a, b) => a.position - b.position)
    .map(({ name, age, is_child }) => ({ name, age, is_child }))

  return NextResponse.json({
    event: await eventInfo(),
    price: PRICE_PER_PERSON,
    registration: {
      contact_name: reg.contact_name,
      payer_name: reg.payer_name,
      cannot_pay: reg.cannot_pay,
      payers_count: reg.payers_count,
      free_count: reg.free_count,
      amount_due: Number(reg.amount_due),
      donation_amount: Number(reg.donation_amount),
      total_expected: total,
      status: reg.status,
      paid_at: reg.paid_at,
      created_at: reg.created_at,
      participants,
    },
    pix,
  })
}
