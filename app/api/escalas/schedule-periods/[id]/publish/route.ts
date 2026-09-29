import { NextRequest, NextResponse } from "next/server"
import { requireManagerOf } from "@/lib/escalas/auth"
import { countByEventArea, eventCompletion } from "@/lib/escalas/staffing"
import { notifyPublishedChanges } from "@/lib/escalas/schedule-notifications"
import { isEmailConfigured } from "@/lib/escalas/email"

// POST - Publicar escala
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: periodId } = await params
    const body = await request.json().catch(() => ({}))
    const force = body?.force === true
    // Avisar os servos por e-mail (padrão: sim)
    const notify = body?.notify !== false
    const auth = await requireManagerOf("period", periodId)
    if (!auth.ok) return auth.response
    const { supabase } = auth

    // Verificar se o período existe
    const { data: period, error: fetchError } = await supabase
      .from("schedule_periods")
      .select("*, events:schedule_events(id, requires_areas, assignments:schedule_assignments(area_id, status))")
      .eq("id", periodId)
      .single()

    if (fetchError || !period) {
      return NextResponse.json({ error: "Período não encontrado" }, { status: 404 })
    }

    const events: { id: string; requires_areas: string[] | null; assignments: { area_id: string; status: string }[] }[] =
      period.events || []

    if (events.length === 0) {
      return NextResponse.json(
        { error: "Não há eventos neste período para publicar" },
        { status: 400 }
      )
    }

    // Áreas ativas do ministério (obrigatórias por padrão) com o mínimo de pessoas de cada uma
    const { data: allAreas } = await supabase
      .from("areas")
      .select("id, min_servants, max_servants")
      .eq("ministry_id", period.ministry_id)
      .eq("is_active", true)

    // Cada área exigida precisa do mínimo de pessoas; quem recusou não ocupa a vaga
    const counts = countByEventArea(
      events.flatMap((e) => (e.assignments ?? []).map((a) => ({ ...a, schedule_event_id: e.id })))
    )
    const incompleteEvents = events.filter(
      (event) => !eventCompletion(event, allAreas ?? [], counts).complete
    )

    if (incompleteEvents.length > 0 && !force) {
      return NextResponse.json(
        {
          error: `Existem ${incompleteEvents.length} evento(s) com áreas abaixo do mínimo de pessoas.`,
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

    // Envia a cada servo só o que mudou desde o último aviso
    let notification = null
    if (notify && isEmailConfigured()) {
      try {
        notification = await notifyPublishedChanges(supabase, periodId)
      } catch (notifyError) {
        console.error("Erro ao avisar servos da escala publicada:", notifyError)
      }
    }

    return NextResponse.json({
      success: true,
      period: data,
      notification,
      message: "Escala publicada com sucesso!",
    })
  } catch (error) {
    console.error("Erro na API de publicação:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
