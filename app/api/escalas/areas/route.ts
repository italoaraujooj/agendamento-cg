import { NextRequest, NextResponse } from "next/server"
import { createAdminClient, createServerClient } from "@/lib/supabase/server"
import { z } from "zod"

const areaSchema = z.object({
  ministry_id: z.string().uuid("Ministério inválido"),
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  description: z.string().max(500).optional().nullable(),
  min_servants: z.number().int().min(0, "Mínimo não pode ser negativo").default(0),
  max_servants: z.number().int().min(1).optional().nullable(),
  order_index: z.number().int().default(0),
})

// GET - Listar áreas (opcionalmente filtrar por ministério)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const ministryId = searchParams.get("ministry_id")

    let query = supabase
      .from("areas")
      .select(`
        *,
        ministry:ministries(id, name, color),
        servants (
          id,
          name,
          is_active
        )
      `)
      .eq("is_active", true)
      .order("order_index")
      .order("name")

    if (ministryId) {
      query = query.eq("ministry_id", ministryId)
    }

    const { data, error } = await query

    if (error) {
      console.error("Erro ao buscar áreas:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Erro na API de áreas:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

// POST - Criar área
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    const body = await request.json()
    const validationResult = areaSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const { ministry_id, name, description, min_servants, max_servants, order_index } = validationResult.data

    const { data, error } = await supabase
      .from("areas")
      .insert({
        ministry_id,
        name,
        description: description || null,
        min_servants,
        max_servants: max_servants || null,
        order_index,
      })
      .select()
      .single()

    if (error) {
      console.error("Erro ao criar área:", error)
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Já existe uma área com este nome neste ministério" },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("Erro na API de áreas:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
