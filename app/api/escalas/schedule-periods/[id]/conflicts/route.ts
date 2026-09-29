import { NextRequest, NextResponse } from "next/server"
import { requireManagerOf } from "@/lib/escalas/auth"
import { findPeriodConflicts } from "@/lib/escalas/conflicts"

// GET - Pessoas do ministério escaladas em outro evento no mesmo dia/horário
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: periodId } = await params
    const auth = await requireManagerOf("period", periodId)
    if (!auth.ok) return auth.response

    return NextResponse.json(await findPeriodConflicts(auth.supabase, periodId))
  } catch (error) {
    console.error("Erro ao calcular conflitos de escala:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
