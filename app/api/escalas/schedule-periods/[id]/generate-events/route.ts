import { NextRequest, NextResponse } from "next/server"
import { requireManagerOf } from "@/lib/escalas/auth"

// POST - Gerar eventos do calendário regular para o período
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: periodId } = await params
    const auth = await requireManagerOf("period", periodId)
    if (!auth.ok) return auth.response
    const { supabase } = auth

    // Chamar a função do banco de dados
    const { data, error } = await supabase
      .rpc("generate_regular_events_for_period", {
        p_period_id: periodId,
      })

    if (error) {
      console.error("Erro ao gerar eventos:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      generated: data,
      message: `${data} evento(s) gerado(s) a partir do calendário regular`,
    })
  } catch (error) {
    console.error("Erro na API de geração de eventos:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
