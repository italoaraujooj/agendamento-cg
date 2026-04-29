import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { z } from "zod"

const availabilitySubmissionSchema = z.object({
  servant_id: z.string().uuid(),
  period_id: z.string().uuid(),
  availabilities: z.array(z.object({
    event_id: z.string().uuid(),
    is_available: z.boolean(),
    notes: z.string().max(200).optional().nullable(),
  })),
})

// POST - Submeter disponibilidade
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    const body = await request.json()
    const validationResult = availabilitySubmissionSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const { servant_id, period_id, availabilities } = validationResult.data

    // Verificar se o período existe e está coletando disponibilidade
    const { data: period, error: periodError } = await supabase
      .from("schedule_periods")
      .select("status, availability_deadline")
      .eq("id", period_id)
      .single()

    if (periodError || !period) {
      return NextResponse.json({ error: "Período não encontrado" }, { status: 404 })
    }

    if (period.status !== "collecting") {
      return NextResponse.json(
        { error: "O prazo para informar disponibilidade já encerrou" },
        { status: 400 }
      )
    }

    // Verificar prazo
    if (period.availability_deadline) {
      const deadline = new Date(period.availability_deadline)
      if (new Date() > deadline) {
        return NextResponse.json(
          { error: "O prazo para informar disponibilidade já encerrou" },
          { status: 400 }
        )
      }
    }

    // Deletar disponibilidades anteriores deste servo para este período
    await supabase
      .from("servant_availability")
      .delete()
      .eq("servant_id", servant_id)
      .eq("period_id", period_id)

    // Inserir novas disponibilidades
    const availabilityRecords = availabilities.map((a) => ({
      servant_id,
      period_id,
      event_id: a.event_id,
      is_available: a.is_available,
      notes: a.notes || null,
      submitted_at: new Date().toISOString(),
    }))

    const { error: insertError } = await supabase
      .from("servant_availability")
      .insert(availabilityRecords)

    if (insertError) {
      console.error("Erro ao salvar disponibilidade:", insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Propagar disponibilidade para outros servos com mesmo nome no mesmo ministério
    const { data: periodData } = await supabase
      .from("schedule_periods")
      .select("ministry_id")
      .eq("id", period_id)
      .single()

    const { data: servantData } = await supabase
      .from("servants")
      .select("name")
      .eq("id", servant_id)
      .single()

    if (periodData && servantData) {
      const { data: areas } = await supabase
        .from("areas")
        .select("id")
        .eq("ministry_id", periodData.ministry_id)

      const areaIds = (areas ?? []).map((a: { id: string }) => a.id)

      if (areaIds.length > 0) {
        // Servos com mesmo nome pela área primária
        const { data: byPrimary } = await supabase
          .from("servants")
          .select("id")
          .ilike("name", servantData.name)
          .in("area_id", areaIds)
          .neq("id", servant_id)
          .eq("is_active", true)

        // Servos com mesmo nome via servant_areas (área secundária)
        const { data: bySecondary } = await supabase
          .from("servant_areas")
          .select("servant_id, servant:servants!servant_areas_servant_id_fkey(id, name, is_active)")
          .in("area_id", areaIds)

        const secondaryIds = (bySecondary ?? [])
          .filter(
            (sa: any) =>
              sa.servant?.is_active &&
              sa.servant_id !== servant_id &&
              sa.servant?.name?.toLowerCase().trim() === servantData.name.toLowerCase().trim()
          )
          .map((sa: any) => sa.servant_id as string)

        const allDuplicateIds = [
          ...new Set([
            ...(byPrimary ?? []).map((s: { id: string }) => s.id),
            ...secondaryIds,
          ]),
        ]

        if (allDuplicateIds.length > 0) {
          const { data: existing } = await supabase
            .from("servant_availability")
            .select("servant_id")
            .in("servant_id", allDuplicateIds)
            .eq("period_id", period_id)

          const alreadyAnswered = new Set(
            (existing ?? []).map((r: { servant_id: string }) => r.servant_id)
          )
          const pendingDuplicates = allDuplicateIds.filter((id) => !alreadyAnswered.has(id))

          if (pendingDuplicates.length > 0) {
            const propagated = pendingDuplicates.flatMap((dup_id) =>
              availabilities.map((a) => ({
                servant_id: dup_id,
                period_id,
                event_id: a.event_id,
                is_available: a.is_available,
                notes: a.notes || null,
                submitted_at: new Date().toISOString(),
              }))
            )
            await supabase.from("servant_availability").insert(propagated)
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Disponibilidade registrada com sucesso!",
      count: availabilities.length,
    })
  } catch (error) {
    console.error("Erro na API de disponibilidade:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
