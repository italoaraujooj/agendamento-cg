import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { z } from "zod"

const createEventSchema = z.object({
  period_id: z.string().uuid("Período inválido"),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  event_time: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Horário inválido"),
  title: z.string().min(2, "Título muito curto").max(120),
  description: z.string().max(500).optional().nullable(),
})

// POST - Criar evento avulso em um período
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    const body = await request.json()
    const validation = createEventSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.errors },
        { status: 400 },
      )
    }

    const { period_id, event_date, event_time, title, description } = validation.data

    const normalizedTime = event_time.length === 5 ? `${event_time}:00` : event_time

    const { data, error } = await supabase
      .from("schedule_events")
      .insert({
        period_id,
        event_date,
        event_time: normalizedTime,
        event_type: "special",
        title,
        description: description || null,
        source: "manual",
      })
      .select("*")
      .single()

    if (error) {
      console.error("Erro ao criar evento:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("Erro na API de eventos:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

