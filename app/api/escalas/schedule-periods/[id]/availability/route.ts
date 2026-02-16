import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// GET - Buscar respostas de disponibilidade do período
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: periodId } = await params
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    // Buscar todas as respostas de disponibilidade do período com dados do servo e evento
    const { data, error } = await supabase
      .from("servant_availability")
      .select(`
        id,
        servant_id,
        event_id,
        is_available,
        notes,
        submitted_at,
        servant:servants(id, name, area:areas(id, name))
      `)
      .eq("period_id", periodId)
      .order("submitted_at", { ascending: false })

    if (error) {
      console.error("Erro ao buscar disponibilidades:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error("Erro na API de disponibilidade:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
