import { NextRequest, NextResponse } from "next/server"
import { requireManagerOf } from "@/lib/escalas/auth"

// GET - Histórico de alterações da escala do período (mais recentes primeiro)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: periodId } = await params
    const auth = await requireManagerOf("period", periodId)
    if (!auth.ok) return auth.response

    const { data, error } = await auth.supabase
      .from("schedule_assignment_log")
      .select("id, schedule_event_id, servant_id, area_id, action, actor_label, servant_name, area_name, details, created_at")
      .eq("period_id", periodId)
      .order("created_at", { ascending: false })
      .limit(500)

    if (error) {
      console.error("Erro ao buscar histórico:", error)
      return NextResponse.json({ error: "Erro ao buscar histórico" }, { status: 500 })
    }
    return NextResponse.json(data ?? [])
  } catch (error) {
    console.error("Erro ao buscar histórico:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
