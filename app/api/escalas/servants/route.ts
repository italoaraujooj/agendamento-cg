import { NextRequest, NextResponse } from "next/server"
import { createAdminClient, createServerClient } from "@/lib/supabase/server"
import { z } from "zod"

const servantSchema = z.object({
  area_id: z.string().uuid("Área inválida"),
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  email: z.string().email("Email inválido").optional().nullable().or(z.literal("")),
  phone: z.string().max(20).optional().nullable(),
  is_leader: z.boolean().default(false),
  notes: z.string().max(500).optional().nullable(),
})

// GET - Listar servos (opcionalmente filtrar por área)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const areaId = searchParams.get("area_id")
    const ministryId = searchParams.get("ministry_id")

    let query = supabase
      .from("servants")
      .select(`
        *,
        area:areas(
          id,
          name,
          ministry:ministries(id, name, color)
        )
      `)
      .eq("is_active", true)
      .order("is_leader", { ascending: false })
      .order("name")

    if (areaId) {
      query = query.eq("area_id", areaId)
    }

    if (ministryId) {
      query = query.eq("area.ministry_id", ministryId)
    }

    const { data, error } = await query

    if (error) {
      console.error("Erro ao buscar servos:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Erro na API de servos:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

// POST - Criar servo
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    const body = await request.json()
    const validationResult = servantSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const { area_id, name, email, phone, is_leader, notes } = validationResult.data

    const { data, error } = await supabase
      .from("servants")
      .insert({
        area_id,
        name,
        email: email || null,
        phone: phone || null,
        is_leader,
        notes: notes || null,
      })
      .select()
      .single()

    if (error) {
      console.error("Erro ao criar servo:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("Erro na API de servos:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
