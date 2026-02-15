import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// GET - Buscar dados do período pelo token de disponibilidade
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    // Buscar período pelo token
    const { data: period, error: periodError } = await supabase
      .from("schedule_periods")
      .select(`
        id,
        month,
        year,
        status,
        availability_deadline,
        ministry:ministries(id, name, color)
      `)
      .eq("availability_token", token)
      .single()

    if (periodError || !period) {
      return NextResponse.json(
        { error: "Link inválido ou expirado" },
        { status: 404 }
      )
    }

    // Verificar se ainda está coletando disponibilidade
    if (period.status !== "collecting") {
      return NextResponse.json({
        error: "O prazo para informar disponibilidade já encerrou",
        status: period.status,
      }, { status: 400 })
    }

    // Verificar prazo
    if (period.availability_deadline) {
      const deadline = new Date(period.availability_deadline)
      if (new Date() > deadline) {
        return NextResponse.json({
          error: "O prazo para informar disponibilidade já encerrou",
          deadline: period.availability_deadline,
        }, { status: 400 })
      }
    }

    // Buscar eventos do período
    const { data: events, error: eventsError } = await supabase
      .from("schedule_events")
      .select("*")
      .eq("period_id", period.id)
      .order("event_date")
      .order("event_time")

    if (eventsError) {
      console.error("Erro ao buscar eventos:", eventsError)
      return NextResponse.json({ error: "Erro ao carregar eventos" }, { status: 500 })
    }

    // Buscar servos do ministério
    const { data: servants, error: servantsError } = await supabase
      .from("servants")
      .select(`
        id,
        name,
        email,
        is_leader,
        area:areas(
          id,
          name,
          ministry_id
        )
      `)
      .eq("is_active", true)

    if (servantsError) {
      console.error("Erro ao buscar servos:", servantsError)
      return NextResponse.json({ error: "Erro ao carregar servos" }, { status: 500 })
    }

    // Filtrar servos do ministério
    const ministryServants = servants?.filter(
      (s) => s.area?.ministry_id === period.ministry?.id
    ) || []

    return NextResponse.json({
      period: {
        id: period.id,
        month: period.month,
        year: period.year,
        availability_deadline: period.availability_deadline,
        ministry: period.ministry,
      },
      events: events || [],
      servants: ministryServants,
    })
  } catch (error) {
    console.error("Erro na API de disponibilidade:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
