import { NextRequest, NextResponse } from "next/server"
import { createAdminClient, createServerClient } from "@/lib/supabase/server"
import { z } from "zod"

const areaUpdateSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  min_servants: z.number().int().min(0).optional(),
  max_servants: z.number().int().min(1).optional().nullable(),
  order_index: z.number().int().optional(),
  is_active: z.boolean().optional(),
})

// GET - Buscar área por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    const { data, error } = await supabase
      .from("areas")
      .select(`
        *,
        ministry:ministries(*),
        servants (*)
      `)
      .eq("id", id)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Área não encontrada" }, { status: 404 })
      }
      console.error("Erro ao buscar área:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Erro na API de áreas:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

// PUT - Atualizar área
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
    const validationResult = areaUpdateSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const updateData = validationResult.data

    const { data, error } = await supabase
      .from("areas")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Área não encontrada" }, { status: 404 })
      }
      console.error("Erro ao atualizar área:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Erro na API de áreas:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

// DELETE - Desativar área (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    const { error } = await supabase
      .from("areas")
      .update({ is_active: false })
      .eq("id", id)

    if (error) {
      console.error("Erro ao desativar área:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro na API de áreas:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
