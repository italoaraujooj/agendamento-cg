import { NextRequest, NextResponse } from "next/server"
import { createAdminClient, createServerClient } from "@/lib/supabase/server"
import { z } from "zod"

const assignmentSchema = z.object({
  schedule_event_id: z.string().uuid(),
  servant_id: z.string().uuid(),
  area_id: z.string().uuid(),
  notes: z.string().max(500).optional().nullable(),
})

// GET - Listar atribuições (por período ou evento)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const periodId = searchParams.get("period_id")
    const eventId = searchParams.get("event_id")

    let query = supabase
      .from("schedule_assignments")
      .select(`
        *,
        servant:servants(*),
        area:areas(*),
        event:schedule_events(*)
      `)
      .order("created_at")

    if (eventId) {
      query = query.eq("schedule_event_id", eventId)
    } else if (periodId) {
      query = query.eq("event.period_id", periodId)
    }

    const { data, error } = await query

    if (error) {
      console.error("Erro ao buscar atribuições:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Erro na API de atribuições:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

// POST - Criar atribuição
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    const body = await request.json()
    const validationResult = assignmentSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const { schedule_event_id, servant_id, area_id, notes } = validationResult.data

    // Remover atribuição existente para este evento e área (se houver)
    await supabase
      .from("schedule_assignments")
      .delete()
      .eq("schedule_event_id", schedule_event_id)
      .eq("area_id", area_id)

    // Criar nova atribuição
    const { data, error } = await supabase
      .from("schedule_assignments")
      .insert({
        schedule_event_id,
        servant_id,
        area_id,
        notes: notes || null,
      })
      .select(`
        *,
        servant:servants(*),
        area:areas(*)
      `)
      .single()

    if (error) {
      console.error("Erro ao criar atribuição:", error)
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Este servo já está escalado para este evento" },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("Erro na API de atribuições:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

// DELETE - Remover atribuição
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    const eventId = searchParams.get("event_id")
    const areaId = searchParams.get("area_id")

    if (id) {
      // Deletar por ID
      const { error } = await supabase
        .from("schedule_assignments")
        .delete()
        .eq("id", id)

      if (error) {
        console.error("Erro ao remover atribuição:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    } else if (eventId && areaId) {
      // Deletar por evento + área
      const { error } = await supabase
        .from("schedule_assignments")
        .delete()
        .eq("schedule_event_id", eventId)
        .eq("area_id", areaId)

      if (error) {
        console.error("Erro ao remover atribuição:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    } else {
      return NextResponse.json(
        { error: "ID ou event_id + area_id são obrigatórios" },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro na API de atribuições:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
