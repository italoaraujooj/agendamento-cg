import { NextRequest, NextResponse } from "next/server"
import { createAdminClient, createServerClient } from "@/lib/supabase/server"
import { z } from "zod"

const schedulePeriodUpdateSchema = z.object({
  availability_deadline: z.string().datetime().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  status: z.enum(["draft", "collecting", "scheduling", "published", "closed"]).optional(),
})

// GET - Buscar período por ID
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
      .from("schedule_periods")
      .select(`
        *,
        ministry:ministries(*),
        events:schedule_events(
          *,
          assignments:schedule_assignments(
            *,
            servant:servants(*),
            area:areas(*)
          )
        )
      `)
      .eq("id", id)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Período não encontrado" }, { status: 404 })
      }
      console.error("Erro ao buscar período:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Erro na API de períodos:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

// PUT - Atualizar período
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
    const validationResult = schedulePeriodUpdateSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = { ...validationResult.data }
    
    // Se está publicando, registrar data de publicação
    if (updateData.status === "published") {
      updateData.published_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from("schedule_periods")
      .update(updateData)
      .eq("id", id)
      .select(`
        *,
        ministry:ministries(id, name, color)
      `)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Período não encontrado" }, { status: 404 })
      }
      console.error("Erro ao atualizar período:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Erro na API de períodos:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

// DELETE - Excluir período (e seus eventos)
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

    // Verificar se o período existe e seu status
    const { data: period, error: fetchError } = await supabase
      .from("schedule_periods")
      .select("status")
      .eq("id", id)
      .single()

    if (fetchError || !period) {
      return NextResponse.json({ error: "Período não encontrado" }, { status: 404 })
    }

    // Não permitir excluir períodos publicados
    if (period.status === "published") {
      return NextResponse.json(
        { error: "Não é possível excluir um período já publicado" },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from("schedule_periods")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Erro ao excluir período:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro na API de períodos:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
