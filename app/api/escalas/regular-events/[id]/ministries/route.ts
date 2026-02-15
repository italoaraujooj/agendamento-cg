import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { z } from "zod"

const updateMinistriesSchema = z.object({
  ministry_ids: z.array(z.string().uuid("Ministério inválido")).min(1, "Selecione pelo menos um ministério"),
})

// GET - Buscar ministérios associados ao evento
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    const { data, error } = await supabase
      .from("regular_event_ministries")
      .select(`
        ministry_id,
        ministry:ministries(id, name, color)
      `)
      .eq("regular_event_id", id)

    if (error) {
      console.error("Erro ao buscar ministérios do evento:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error("Erro na API:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

// PUT - Atualizar ministérios associados ao evento
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    const body = await request.json()
    const validationResult = updateMinistriesSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const { ministry_ids } = validationResult.data

    // Remover relacionamentos existentes
    const { error: deleteError } = await supabase
      .from("regular_event_ministries")
      .delete()
      .eq("regular_event_id", id)

    if (deleteError) {
      console.error("Erro ao remover relacionamentos:", deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // Criar novos relacionamentos
    const relationships = ministry_ids.map((mId) => ({
      regular_event_id: id,
      ministry_id: mId,
    }))

    const { data, error: insertError } = await supabase
      .from("regular_event_ministries")
      .insert(relationships)
      .select(`
        ministry_id,
        ministry:ministries(id, name, color)
      `)

    if (insertError) {
      console.error("Erro ao criar relacionamentos:", insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      ministries: data,
      count: data.length,
    })
  } catch (error) {
    console.error("Erro na API:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
