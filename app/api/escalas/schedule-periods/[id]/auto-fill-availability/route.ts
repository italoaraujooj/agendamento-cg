import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// POST - Preenche automaticamente como disponível os servos que não responderam
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: periodId } = await params
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    // Buscar eventos do período
    const { data: events, error: eventsError } = await supabase
      .from("schedule_events")
      .select("id")
      .eq("period_id", periodId)

    if (eventsError) {
      return NextResponse.json({ error: eventsError.message }, { status: 500 })
    }

    if (!events || events.length === 0) {
      return NextResponse.json({ filled: 0 })
    }

    // Buscar ministry_id do período
    const { data: period, error: periodError } = await supabase
      .from("schedule_periods")
      .select("ministry_id")
      .eq("id", periodId)
      .single()

    if (periodError || !period) {
      return NextResponse.json({ error: "Período não encontrado" }, { status: 404 })
    }

    // Buscar áreas do ministério
    const { data: areas } = await supabase
      .from("areas")
      .select("id")
      .eq("ministry_id", period.ministry_id)

    const areaIds = (areas ?? []).map((a: { id: string }) => a.id)
    if (areaIds.length === 0) {
      return NextResponse.json({ filled: 0 })
    }

    // Buscar servos ativos do ministério
    const { data: servants } = await supabase
      .from("servants")
      .select("id, name")
      .in("area_id", areaIds)
      .eq("is_active", true)

    if (!servants || servants.length === 0) {
      return NextResponse.json({ filled: 0 })
    }

    // Buscar quem já tem qualquer registro de disponibilidade para este período
    const { data: existingRecords } = await supabase
      .from("servant_availability")
      .select("servant_id")
      .eq("period_id", periodId)

    const respondedIds = new Set((existingRecords ?? []).map((r: { servant_id: string }) => r.servant_id))

    // Buscar nomes de quem respondeu (para desduplicar servos em múltiplas áreas)
    const respondedNames = new Set<string>()
    if (respondedIds.size > 0) {
      const { data: respondedServants } = await supabase
        .from("servants")
        .select("name")
        .in("id", Array.from(respondedIds))
      respondedServants?.forEach((s: { name: string }) =>
        respondedNames.add(s.name.toLowerCase().trim())
      )
    }

    // Filtrar pendentes, desduplicando por nome
    const seenNames = new Set<string>()
    const pendingServants = servants.filter((s: { id: string; name: string }) => {
      if (respondedIds.has(s.id)) return false
      const nameLower = s.name.toLowerCase().trim()
      if (respondedNames.has(nameLower)) return false
      if (seenNames.has(nameLower)) return false
      seenNames.add(nameLower)
      return true
    })

    if (pendingServants.length === 0) {
      return NextResponse.json({ filled: 0 })
    }

    // Criar registros de disponibilidade automática
    const now = new Date().toISOString()
    const records = pendingServants.flatMap((servant: { id: string }) =>
      events.map((event: { id: string }) => ({
        servant_id: servant.id,
        period_id: periodId,
        event_id: event.id,
        is_available: true,
        notes: "Disponibilidade assumida automaticamente (sem resposta até o prazo)",
        submitted_at: now,
      }))
    )

    const { error: insertError } = await supabase
      .from("servant_availability")
      .insert(records)

    if (insertError) {
      console.error("Erro ao inserir disponibilidades automáticas:", insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ filled: pendingServants.length })
  } catch (error) {
    console.error("Erro ao auto-preencher disponibilidade:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
