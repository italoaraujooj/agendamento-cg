import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// GET - Buscar agendamentos aprovados do salão principal no período
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: periodId } = await params
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    // Buscar o período para obter as datas
    const { data: period, error: periodError } = await supabase
      .from("schedule_periods")
      .select("start_date, end_date")
      .eq("id", periodId)
      .single()

    if (periodError || !period) {
      return NextResponse.json({ error: "Período não encontrado" }, { status: 404 })
    }

    // Buscar agendamentos aprovados no intervalo do período
    // Filtra pelo salão principal por padrão
    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("id, booking_date, start_time, end_time, occasion, responsible_person, name, environment_id, environments(id, name)")
      .eq("status", "approved")
      .gte("booking_date", period.start_date)
      .lte("booking_date", period.end_date)
      .order("booking_date", { ascending: true })
      .order("start_time", { ascending: true })

    if (bookingsError) {
      console.error("Erro ao buscar bookings:", bookingsError)
      return NextResponse.json({ error: bookingsError.message }, { status: 500 })
    }

    // Buscar IDs de bookings já importados neste período
    const { data: existingEvents } = await supabase
      .from("schedule_events")
      .select("external_id")
      .eq("period_id", periodId)
      .eq("source", "booking_system")
      .not("external_id", "is", null)

    const importedIds = new Set((existingEvents || []).map((e) => e.external_id))

    const result = (bookings || []).map((b) => ({
      ...b,
      already_imported: importedIds.has(String(b.id)),
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error("Erro na API de importação:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

// POST - Importar agendamentos selecionados para o período
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

    const body = await request.json().catch(() => ({}))
    const bookingIds: string[] = body.booking_ids

    if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
      return NextResponse.json({ error: "Nenhum agendamento selecionado" }, { status: 400 })
    }

    // Buscar os agendamentos selecionados
    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("id, booking_date, start_time, occasion, responsible_person, name, environments(name)")
      .in("id", bookingIds)
      .eq("status", "approved")

    if (bookingsError) {
      console.error("Erro ao buscar bookings:", bookingsError)
      return NextResponse.json({ error: bookingsError.message }, { status: 500 })
    }

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ error: "Nenhum agendamento válido encontrado" }, { status: 404 })
    }

    // Inserir como eventos no período
    const events = bookings.map((b) => ({
      period_id: periodId,
      event_date: b.booking_date,
      event_time: b.start_time,
      event_type: "imported" as const,
      title: b.occasion || "Evento importado",
      description: `Reserva: ${b.occasion} | Responsável: ${b.responsible_person} | Local: ${(b.environments as any)?.name || "N/A"}`,
      source: "booking_system" as const,
      external_id: String(b.id),
    }))

    const { error: insertError } = await supabase
      .from("schedule_events")
      .insert(events)

    if (insertError) {
      console.error("Erro ao inserir eventos:", insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      imported: events.length,
      message: `${events.length} evento(s) importado(s) do sistema de agendamentos`,
    })
  } catch (error) {
    console.error("Erro na API de importação:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
