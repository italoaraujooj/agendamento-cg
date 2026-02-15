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
