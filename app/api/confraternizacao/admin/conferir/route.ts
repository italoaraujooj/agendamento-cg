import { NextResponse } from "next/server"
import { reconcilePayments } from "@/lib/confraternizacao/reconcile"
import { requireConfraManager } from "@/lib/confraternizacao/server"

export const maxDuration = 60

// POST - "Conferir pagamentos agora": lê os PIX no Pluggy e confirma os que
// casam; devolve as sugestões para revisão manual.
export async function POST() {
  const auth = await requireConfraManager()
  if (!auth.ok) return auth.response

  try {
    const result = await reconcilePayments(auth.supabase)
    return NextResponse.json(result)
  } catch (err) {
    console.error("Confraternização: erro ao conferir pagamentos:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao conferir pagamentos" },
      { status: 502 }
    )
  }
}
