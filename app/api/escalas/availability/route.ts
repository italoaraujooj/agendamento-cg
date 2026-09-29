import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { z } from "zod"
import { verifyAvailabilityToken } from "@/lib/escalas/availability-token"
import { checkPeriodOpen, findMinistryServants, samePersonIds } from "@/lib/escalas/availability"

const availabilitySubmissionSchema = z.object({
  servant_id: z.string().uuid(),
  period_id: z.string().uuid(),
  access_token: z.string().min(1),
  availabilities: z.array(z.object({
    event_id: z.string().uuid(),
    is_available: z.boolean(),
    notes: z.string().max(200).optional().nullable(),
  })),
})

// POST - Enviar ou editar disponibilidade
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

    const { servant_id, period_id, access_token, availabilities } = validationResult.data

    // O token pessoal é emitido ao se identificar no link do período
    if (!verifyAvailabilityToken(servant_id, period_id, access_token)) {
      return NextResponse.json(
        { error: "Sessão inválida. Abra o link novamente e informe seu email." },
        { status: 403 }
      )
    }

    const { data: period, error: periodError } = await supabase
      .from("schedule_periods")
      .select("status, availability_deadline, ministry_id")
      .eq("id", period_id)
      .single()

    if (periodError || !period) {
      return NextResponse.json({ error: "Período não encontrado" }, { status: 404 })
    }

    if (!checkPeriodOpen(period).open) {
      return NextResponse.json(
        { error: "O prazo para informar disponibilidade já encerrou" },
        { status: 400 }
      )
    }

    // Aceitar apenas eventos deste período
    const { data: periodEvents } = await supabase
      .from("schedule_events")
      .select("id")
      .eq("period_id", period_id)
    const validEventIds = new Set((periodEvents ?? []).map((e: { id: string }) => e.id))
    const answers = availabilities.filter((a) => validEventIds.has(a.event_id))

    // Aplicar a resposta a todos os registros da mesma pessoa no ministério
    // (o cadastro atual cria um registro de servo por área)
    const servants = await findMinistryServants(supabase, period.ministry_id)
    const servant = servants.find((s) => s.id === servant_id)
    if (!servant) {
      return NextResponse.json({ error: "Servo não encontrado" }, { status: 404 })
    }
    const personIds = samePersonIds(servants, servant)

    const submittedAt = new Date().toISOString()
    const records = personIds.flatMap((id) =>
      answers.map((a) => ({
        servant_id: id,
        period_id,
        event_id: a.event_id,
        is_available: a.is_available,
        notes: a.notes?.trim() || null,
        submitted_at: submittedAt,
      }))
    )

    // Upsert evita perder a resposta anterior caso a gravação falhe no meio
    const { error: upsertError } = await supabase
      .from("servant_availability")
      .upsert(records, { onConflict: "servant_id,period_id,event_id" })

    if (upsertError) {
      console.error("Erro ao salvar disponibilidade:", upsertError)
      return NextResponse.json({ error: "Erro ao salvar disponibilidade" }, { status: 500 })
    }

    // Reativar o servo automaticamente: se estava marcado como inativo
    // (ex: férias/afastamento) e respondeu ao formulário, ele volta a
    // aparecer normalmente nas próximas coletas de disponibilidade
    await supabase
      .from("servants")
      .update({ is_active: true })
      .eq("id", servant_id)
      .eq("is_active", false)

    return NextResponse.json({
      success: true,
      message: "Disponibilidade registrada com sucesso!",
      count: answers.length,
      submitted_at: submittedAt,
    })
  } catch (error) {
    console.error("Erro na API de disponibilidade:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
