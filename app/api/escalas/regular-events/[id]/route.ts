import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { z } from "zod"

const regularEventUpdateSchema = z.object({
  title: z.string().min(2, "Título deve ter pelo menos 2 caracteres").max(100).optional(),
  day_of_week: z.number().int().min(0).max(6).optional(),
  time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Horário inválido").optional(),
  week_of_month: z.number().int().min(1).max(5).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  is_active: z.boolean().optional(),
})

// PUT - Atualizar evento regular
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
    const validationResult = regularEventUpdateSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const updateData = { ...validationResult.data }
    
    // Normalizar horário se presente
    if (updateData.time && updateData.time.length === 5) {
      updateData.time = `${updateData.time}:00`
    }

    const { data, error } = await supabase
      .from("regular_events")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 })
      }
      console.error("Erro ao atualizar evento regular:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Erro na API de eventos regulares:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

// DELETE - Desativar evento regular (soft delete)
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
      .from("regular_events")
      .update({ is_active: false })
      .eq("id", id)

    if (error) {
      console.error("Erro ao desativar evento regular:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro na API de eventos regulares:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
