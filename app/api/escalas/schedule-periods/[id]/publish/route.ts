import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// POST - Publicar escala
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: periodId } = await params
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    // Verificar se o período existe e tem eventos
    const { data: period, error: fetchError } = await supabase
      .from("schedule_periods")
      .select(`
        *,
        events:schedule_events(
          id,
          assignments:schedule_assignments(id)
        )
      `)
      .eq("id", periodId)
      .single()

    if (fetchError || !period) {
      return NextResponse.json({ error: "Período não encontrado" }, { status: 404 })
    }

    if (period.status === "published") {
      return NextResponse.json(
        { error: "Este período já está publicado" },
        { status: 400 }
      )
    }

    // Verificar se há eventos e se todos têm atribuições
    const events = period.events || []
    if (events.length === 0) {
      return NextResponse.json(
        { error: "Não há eventos neste período para publicar" },
        { status: 400 }
      )
    }

    const eventsWithoutAssignments = events.filter(
      (e: { assignments: unknown[] }) => !e.assignments || e.assignments.length === 0
    )
    
    if (eventsWithoutAssignments.length > 0) {
      return NextResponse.json(
        { 
          error: `Existem ${eventsWithoutAssignments.length} evento(s) sem atribuições. Monte a escala completa antes de publicar.`,
          eventsWithoutAssignments: eventsWithoutAssignments.length
        },
        { status: 400 }
      )
    }

    // Publicar o período
    const { data, error } = await supabase
      .from("schedule_periods")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
      })
      .eq("id", periodId)
      .select()
      .single()

    if (error) {
      console.error("Erro ao publicar período:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      period: data,
      message: "Escala publicada com sucesso!",
    })
  } catch (error) {
    console.error("Erro na API de publicação:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
