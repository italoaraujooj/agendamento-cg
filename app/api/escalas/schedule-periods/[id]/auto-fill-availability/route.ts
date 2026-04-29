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

    // Mapear nome → servant_id de quem respondeu (para desduplicar servos em múltiplas áreas)
    const nameToRespondedId = new Map<string, string>()
    if (respondedIds.size > 0) {
      const { data: respondedServants } = await supabase
        .from("servants")
        .select("id, name")
        .in("id", Array.from(respondedIds))
      respondedServants?.forEach((s: { id: string; name: string }) =>
        nameToRespondedId.set(s.name.toLowerCase().trim(), s.id)
      )
    }

    // Separar em dois grupos:
    // - pendingServants: não responderam e não são duplicatas (recebem is_available=true)
    // - duplicatesToCopy: não responderam mas são duplicatas de quem respondeu (recebem cópia das respostas)
    const seenNames = new Set<string>()
    const pendingServants: { id: string }[] = []
    const duplicatesToCopy: { duplicateId: string; sourceId: string }[] = []

    servants.forEach((s: { id: string; name: string }) => {
      if (respondedIds.has(s.id)) return
      const nameLower = s.name.toLowerCase().trim()

      if (nameToRespondedId.has(nameLower)) {
        duplicatesToCopy.push({ duplicateId: s.id, sourceId: nameToRespondedId.get(nameLower)! })
        return
      }
      if (seenNames.has(nameLower)) return
      seenNames.add(nameLower)
      pendingServants.push(s)
    })

    if (pendingServants.length === 0 && duplicatesToCopy.length === 0) {
      return NextResponse.json({ filled: 0 })
    }

    const now = new Date().toISOString()
    let totalFilled = 0

    // 1. Auto-fill is_available=true para servos sem resposta e sem duplicata
    if (pendingServants.length > 0) {
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
      totalFilled += pendingServants.length
    }

    // 2. Copiar respostas reais para servos duplicados (mesmo nome, não responderam)
    if (duplicatesToCopy.length > 0) {
      const sourceIds = [...new Set(duplicatesToCopy.map((d) => d.sourceId))]

      const { data: sourceRecords } = await supabase
        .from("servant_availability")
        .select("servant_id, event_id, is_available, notes")
        .in("servant_id", sourceIds)
        .eq("period_id", periodId)

      if (sourceRecords && sourceRecords.length > 0) {
        const copyRecords = duplicatesToCopy.flatMap(({ duplicateId, sourceId }) =>
          sourceRecords
            .filter((r: any) => r.servant_id === sourceId)
            .map((r: any) => ({
              servant_id: duplicateId,
              period_id: periodId,
              event_id: r.event_id,
              is_available: r.is_available,
              notes: r.notes,
              submitted_at: now,
            }))
        )
        if (copyRecords.length > 0) {
          await supabase.from("servant_availability").insert(copyRecords)
          totalFilled += duplicatesToCopy.length
        }
      }
    }

    return NextResponse.json({ filled: totalFilled })
  } catch (error) {
    console.error("Erro ao auto-preencher disponibilidade:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
