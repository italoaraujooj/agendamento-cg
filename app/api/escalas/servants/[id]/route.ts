import { NextRequest, NextResponse } from "next/server"
import { createAdminClient, createServerClient } from "@/lib/supabase/server"
import { z } from "zod"

const servantUpdateSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100).optional(),
  email: z.string().email("Email inválido").optional().nullable().or(z.literal("")),
  phone: z.string().max(20).optional().nullable(),
  is_leader: z.boolean().optional(),
  notes: z.string().max(500).optional().nullable(),
  is_active: z.boolean().optional(),
  area_id: z.string().uuid().optional(),
})

// GET - Buscar servo por ID
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
      .from("servants")
      .select(`
        *,
        area:areas(
          *,
          ministry:ministries(*)
        )
      `)
      .eq("id", id)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Servo não encontrado" }, { status: 404 })
      }
      console.error("Erro ao buscar servo:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Erro na API de servos:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

// PUT - Atualizar servo
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
    const validationResult = servantUpdateSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const updateData = { ...validationResult.data }
    // Converter string vazia para null no email
    if (updateData.email === "") {
      updateData.email = null
    }

    const { data, error } = await supabase
      .from("servants")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Servo não encontrado" }, { status: 404 })
      }
      console.error("Erro ao atualizar servo:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Erro na API de servos:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

// DELETE - Desativar servo (soft delete)
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
      .from("servants")
      .update({ is_active: false })
      .eq("id", id)

    if (error) {
      console.error("Erro ao desativar servo:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro na API de servos:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
