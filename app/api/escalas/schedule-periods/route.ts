import { NextRequest, NextResponse } from "next/server"
import { createAdminClient, createServerClient } from "@/lib/supabase/server"
import { z } from "zod"

const schedulePeriodSchema = z.object({
  ministry_id: z.string().uuid("Ministério inválido"),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2024),
  availability_deadline: z.string().datetime().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
})

// GET - Listar períodos de escala
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const ministryId = searchParams.get("ministry_id")
    const status = searchParams.get("status")

    let query = supabase
      .from("schedule_periods")
      .select(`
        *,
        ministry:ministries(id, name, color)
      `)
      .order("year", { ascending: false })
      .order("month", { ascending: false })

    if (ministryId) {
      query = query.eq("ministry_id", ministryId)
    }

    if (status) {
      query = query.eq("status", status)
    }

    const { data, error } = await query

    if (error) {
      console.error("Erro ao buscar períodos:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Erro na API de períodos:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

// POST - Criar período de escala
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    const body = await request.json()
    const validationResult = schedulePeriodSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const { ministry_id, month, year, availability_deadline, notes } = validationResult.data

    // Calcular datas de início e fim do período
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0) // Último dia do mês

    const { data, error } = await supabase
      .from("schedule_periods")
      .insert({
        ministry_id,
        month,
        year,
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
        availability_deadline: availability_deadline || null,
        notes: notes || null,
        status: "draft",
      })
      .select(`
        *,
        ministry:ministries(id, name, color)
      `)
      .single()

    if (error) {
      console.error("Erro ao criar período:", error)
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Já existe um período para este mês/ano neste ministério" },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Gerar automaticamente os eventos a partir do calendário regular
    const { error: rpcError } = await supabase.rpc("generate_regular_events_for_period", {
      p_period_id: data.id,
    })

    if (rpcError) {
      console.error("Erro ao gerar eventos regulares (período já criado):", rpcError)
      // Não falha a criação do período; os eventos podem ser gerados depois manualmente
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("Erro na API de períodos:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
