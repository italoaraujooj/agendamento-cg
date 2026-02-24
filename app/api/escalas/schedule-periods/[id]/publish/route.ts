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

    // Verificar se o período existe
    const { data: period, error: fetchError } = await supabase
      .from("schedule_periods")
      .select("*, events:schedule_events(id, requires_areas, assignments:schedule_assignments(area_id))")
      .eq("id", periodId)
      .single()

    if (fetchError || !period) {
      return NextResponse.json({ error: "Período não encontrado" }, { status: 404 })
    }

    const events: { id: string; requires_areas: string[] | null; assignments: { area_id: string }[] }[] =
      period.events || []

    if (events.length === 0) {
      return NextResponse.json(
        { error: "Não há eventos neste período para publicar" },
        { status: 400 }
      )
    }

    // Buscar áreas ativas do ministério para saber quais são obrigatórias por padrão
    const { data: allAreas } = await supabase
      .from("areas")
      .select("id")
      .eq("ministry_id", period.ministry_id)
      .eq("is_active", true)

    const allAreaIds = (allAreas ?? []).map((a: { id: string }) => a.id)

    // Validar que todas as áreas obrigatórias de cada evento têm atribuição
    const incompleteEvents = events.filter((event) => {
      const requiredAreaIds =
        event.requires_areas && event.requires_areas.length > 0
          ? event.requires_areas
          : allAreaIds
      const assignedAreaIds = new Set((event.assignments ?? []).map((a) => a.area_id))
      return requiredAreaIds.some((areaId) => !assignedAreaIds.has(areaId))
    })

    if (incompleteEvents.length > 0) {
      return NextResponse.json(
        {
          error: `Existem ${incompleteEvents.length} evento(s) com áreas obrigatórias sem atribuição. Monte a escala completa antes de publicar.`,
          incompleteEvents: incompleteEvents.length,
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
