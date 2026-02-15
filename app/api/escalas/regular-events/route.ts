import { NextRequest, NextResponse } from "next/server"
import { createAdminClient, createServerClient } from "@/lib/supabase/server"
import { z } from "zod"

const regularEventSchema = z.object({
  ministry_id: z.string().uuid("Ministério inválido").optional(),
  ministry_ids: z.array(z.string().uuid("Ministério inválido")).min(1, "Selecione pelo menos um ministério").optional(),
  title: z.string().min(2, "Título deve ter pelo menos 2 caracteres").max(100),
  day_of_week: z.number().int().min(0).max(6),
  time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Horário inválido"),
  week_of_month: z.number().int().min(1).max(5).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
}).refine(
  (data) => data.ministry_id || (data.ministry_ids && data.ministry_ids.length > 0),
  { message: "Selecione pelo menos um ministério" }
)

// GET - Listar eventos regulares
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const ministryId = searchParams.get("ministry_id")

    let query = supabase
      .from("regular_events")
      .select(`
        *,
        ministries:regular_event_ministries(
          ministry_id,
          ministry:ministries(id, name, color)
        ),
        ministry:ministries(id, name, color)
      `)
      .eq("is_active", true)
      .order("day_of_week")
      .order("time")

    const { data, error } = await query

    // Filtrar por ministry_id se fornecido (busca em relacionamento many-to-many ou ministry_id legado)
    let filteredData = data
    if (ministryId && data) {
      filteredData = data.filter((event) => {
        // Verificar relacionamento many-to-many
        const hasMinistryInRelation = event.ministries?.some(
          (rel: { ministry_id: string }) => rel.ministry_id === ministryId
        )
        // Verificar ministry_id legado
        const hasLegacyMinistry = event.ministry_id === ministryId
        return hasMinistryInRelation || hasLegacyMinistry
      })
    }

    if (error) {
      console.error("Erro ao buscar eventos regulares:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(filteredData || [])
  } catch (error) {
    console.error("Erro na API de eventos regulares:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

// POST - Criar evento regular
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    const body = await request.json()
    const validationResult = regularEventSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const { ministry_id, ministry_ids, title, day_of_week, time, week_of_month, notes } = validationResult.data

    // Normalizar horário para HH:mm:ss
    const normalizedTime = time.length === 5 ? `${time}:00` : time

    // Determinar lista de ministérios: usar ministry_ids se fornecido, senão usar ministry_id único
    const ministriesToCreate = ministry_ids && ministry_ids.length > 0 
      ? ministry_ids 
      : ministry_id 
        ? [ministry_id] 
        : []

    if (ministriesToCreate.length === 0) {
      return NextResponse.json(
        { error: "Selecione pelo menos um ministério" },
        { status: 400 }
      )
    }

    // Criar um único evento e associar aos ministérios selecionados
    const { data: eventData, error: eventError } = await supabase
      .from("regular_events")
      .insert({
        ministry_id: null, // Não mais obrigatório, usa relacionamento
        title,
        day_of_week,
        time: normalizedTime,
        week_of_month: week_of_month || null,
        notes: notes || null,
      })
      .select()
      .single()

    if (eventError) {
      console.error("Erro ao criar evento regular:", eventError)
      return NextResponse.json({ error: eventError.message }, { status: 500 })
    }

    // Criar relacionamentos com os ministérios
    const relationships = ministriesToCreate.map((mId) => ({
      regular_event_id: eventData.id,
      ministry_id: mId,
    }))

    const { error: relError } = await supabase
      .from("regular_event_ministries")
      .insert(relationships)

    if (relError) {
      console.error("Erro ao criar relacionamentos:", relError)
      // Rollback: deletar evento criado
      await supabase.from("regular_events").delete().eq("id", eventData.id)
      return NextResponse.json({ error: relError.message }, { status: 500 })
    }

    return NextResponse.json(
      { 
        event: eventData,
        ministries: ministriesToCreate.length,
        message: `Evento criado e associado a ${ministriesToCreate.length} ministério(s)`
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Erro na API de eventos regulares:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
