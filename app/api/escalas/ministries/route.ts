import { NextRequest, NextResponse } from "next/server"
import { createAdminClient, createServerClient } from "@/lib/supabase/server"
import { z } from "zod"

const ministrySchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  description: z.string().max(500).optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida").default("#3b82f6"),
})

// GET - Listar ministérios
export async function GET() {
  try {
    const supabase = await createServerClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    const { data, error } = await supabase
      .from("ministries")
      .select(`
        *,
        areas (
          id,
          name,
          is_active
        )
      `)
      .eq("is_active", true)
      .order("name")

    if (error) {
      console.error("Erro ao buscar ministérios:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Erro na API de ministérios:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

// POST - Criar ministério
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    const body = await request.json()
    const validationResult = ministrySchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const { name, description, color } = validationResult.data

    const { data, error } = await supabase
      .from("ministries")
      .insert({
        name,
        description: description || null,
        color,
      })
      .select()
      .single()

    if (error) {
      console.error("Erro ao criar ministério:", error)
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Já existe um ministério com este nome" },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("Erro na API de ministérios:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
