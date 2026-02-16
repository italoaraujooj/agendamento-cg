import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// DELETE - Remover um evento do período
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    // Verificar se o evento existe e se o período está em draft
    const { data: event, error: fetchError } = await supabase
      .from("schedule_events")
      .select("id, period_id, schedule_periods(status)")
      .eq("id", eventId)
      .single()

    if (fetchError || !event) {
      return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 })
    }

    const periodStatus = (event.schedule_periods as any)?.status
    if (periodStatus && periodStatus !== "draft") {
      return NextResponse.json(
        { error: "Só é possível remover eventos de períodos em rascunho" },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from("schedule_events")
      .delete()
      .eq("id", eventId)

    if (error) {
      console.error("Erro ao excluir evento:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro na API de eventos:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
