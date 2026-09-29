import { NextRequest, NextResponse } from "next/server"
import { requireManagerOf } from "@/lib/escalas/auth"

// GET - Motivos de recusa das atribuições do período ({ [assignment_id]: motivo })
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: periodId } = await params
    const auth = await requireManagerOf("period", periodId)
    if (!auth.ok) return auth.response

    const { data } = await auth.supabase
      .from("schedule_assignment_declines")
      .select("assignment_id, reason, schedule_assignments!inner(schedule_events!inner(period_id))")
      .eq("schedule_assignments.schedule_events.period_id", periodId)

    const reasons: Record<string, string | null> = {}
    for (const row of (data ?? []) as { assignment_id: string; reason: string | null }[]) {
      reasons[row.assignment_id] = row.reason
    }
    return NextResponse.json(reasons)
  } catch (error) {
    console.error("Erro ao buscar recusas:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
