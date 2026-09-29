import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { requireAuthenticated, requireManagerOf } from "@/lib/escalas/auth"
import { recordRemovalIfNotified } from "@/lib/escalas/schedule-notifications"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

const REMOVED_FIELDS = "servant_id, schedule_event_id, area_id, notified_at"

// Quem já tinha sido avisado da escala recebe o aviso de remoção no próximo "Atualizar"
async function recordRemovals(
  supabase: SupabaseClient,
  rows: { servant_id: string; schedule_event_id: string; area_id: string; notified_at: string | null }[] | null
) {
  for (const row of rows ?? []) await recordRemovalIfNotified(supabase, row)
}

const assignmentSchema = z.object({
  schedule_event_id: z.string().uuid(),
  servant_id: z.string().uuid(),
  area_id: z.string().uuid(),
  notes: z.string().max(500).optional().nullable(),
  mode: z.enum(["replace", "add"]).optional().default("replace"),
})

// GET - Listar atribuições (por período ou evento)
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthenticated()
    if (!auth.ok) return auth.response

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
    const body = await request.json()
    const validationResult = assignmentSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const { schedule_event_id, servant_id, area_id, notes, mode } = validationResult.data

    const auth = await requireManagerOf("event", schedule_event_id)
    if (!auth.ok) return auth.response
    const { supabase } = auth

    // No modo "replace", remove a atribuição existente antes de inserir
    if (mode !== "add") {
      const { data: replaced } = await supabase
        .from("schedule_assignments")
        .delete()
        .eq("schedule_event_id", schedule_event_id)
        .eq("area_id", area_id)
        .select(REMOVED_FIELDS)
      await recordRemovals(supabase, replaced)
    }

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
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    const eventId = searchParams.get("event_id")
    const areaId = searchParams.get("area_id")

    const auth = id
      ? await requireManagerOf("assignment", id)
      : eventId
        ? await requireManagerOf("event", eventId)
        : null
    if (!auth) {
      return NextResponse.json(
        { error: "ID ou event_id + area_id são obrigatórios" },
        { status: 400 }
      )
    }
    if (!auth.ok) return auth.response
    const { supabase } = auth

    if (id) {
      // Deletar por ID
      const { data: removed, error } = await supabase
        .from("schedule_assignments")
        .delete()
        .eq("id", id)
        .select(REMOVED_FIELDS)

      if (error) {
        console.error("Erro ao remover atribuição:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      await recordRemovals(supabase, removed)
    } else if (eventId && areaId) {
      // Deletar por evento + área
      const { data: removed, error } = await supabase
        .from("schedule_assignments")
        .delete()
        .eq("schedule_event_id", eventId)
        .eq("area_id", areaId)
        .select(REMOVED_FIELDS)

      if (error) {
        console.error("Erro ao remover atribuição:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      await recordRemovals(supabase, removed)
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
