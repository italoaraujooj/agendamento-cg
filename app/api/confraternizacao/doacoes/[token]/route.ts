import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { PRICE_PER_PERSON, eventInfo, pixReceiver } from "@/lib/confraternizacao/config"
import { pixPayload } from "@/lib/confraternizacao/pix"

// GET - Status da doação avulsa pelo link pessoal (público)
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })

  const { data: don, error } = await supabase
    .from("confra_donations")
    .select("amount, status, paid_at, created_at")
    .eq("access_token", token)
    .maybeSingle()

  if (error) {
    console.error("Confraternização: erro ao buscar doação:", error)
    return NextResponse.json({ error: "Erro ao carregar doação" }, { status: 500 })
  }
  if (!don) return NextResponse.json({ error: "Doação não encontrada" }, { status: 404 })

  const receiver = pixReceiver()
  const amount = Number(don.amount)
  const pix =
    don.status === "pending" && receiver
      ? {
          payload: pixPayload(receiver, amount, { description: "Doacao Confraternizacao" }),
          receiver_name: receiver.name,
          key: receiver.key,
        }
      : null

  return NextResponse.json({
    event: await eventInfo(),
    price: PRICE_PER_PERSON,
    donation: { amount, status: don.status, paid_at: don.paid_at, created_at: don.created_at },
    pix,
  })
}
