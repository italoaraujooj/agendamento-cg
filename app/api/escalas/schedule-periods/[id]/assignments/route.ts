import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireManagerOf } from "@/lib/escalas/auth"
import { findMinistryServants } from "@/lib/escalas/availability"
import { areaCapacity, countByEventArea } from "@/lib/escalas/staffing"

const schema = z.object({
  assignments: z
    .array(
      z.object({
        schedule_event_id: z.string().uuid(),
        servant_id: z.string().uuid(),
        area_id: z.string().uuid(),
      })
    )
    .min(1)
    .max(500),
})

// POST - Cria várias atribuições do período de uma vez (sugestão / cópia do mês anterior).
// Itens inválidos são ignorados e devolvidos em `skipped` com o motivo.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: periodId } = await params
    const auth = await requireManagerOf("period", periodId)
    if (!auth.ok) return auth.response
    const { supabase } = auth

    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
    }

    const { data: period } = await supabase.from("schedule_periods").select("ministry_id").eq("id", periodId).single()
    if (!period) return NextResponse.json({ error: "Período não encontrado" }, { status: 404 })

    const [{ data: events }, { data: areas }, servants] = await Promise.all([
      supabase.from("schedule_events").select("id").eq("period_id", periodId),
      supabase.from("areas").select("id, name, min_servants, max_servants").eq("ministry_id", period.ministry_id).eq("is_active", true),
      findMinistryServants(supabase, period.ministry_id),
    ])
    const eventIds = new Set((events ?? []).map((e: { id: string }) => e.id))
    const areaById = new Map((areas ?? []).map((a: any) => [a.id, a]))
    const activeServants = new Set(servants.filter((s) => s.is_active).map((s) => s.id))

    const { data: existing } = await supabase
      .from("schedule_assignments")
      .select("schedule_event_id, servant_id, area_id, status")
      .in("schedule_event_id", Array.from(eventIds))
    const counts = countByEventArea(existing ?? [])
    const taken = new Set((existing ?? []).map((a: any) => `${a.servant_id}-${a.schedule_event_id}`))

    const toInsert: { schedule_event_id: string; servant_id: string; area_id: string }[] = []
    const skipped: { schedule_event_id: string; servant_id: string; area_id: string; reason: string }[] = []

    for (const item of parsed.data.assignments) {
      const area = areaById.get(item.area_id)
      const key = `${item.schedule_event_id}-${item.area_id}`
      const reason = !eventIds.has(item.schedule_event_id)
        ? "evento não pertence ao período"
        : !area
          ? "área inativa ou de outro ministério"
          : !activeServants.has(item.servant_id)
            ? "servo inativo ou de outro ministério"
            : taken.has(`${item.servant_id}-${item.schedule_event_id}`)
              ? "já escalado neste evento"
              : areaCapacity(area) !== null && (counts.get(key) ?? 0) >= areaCapacity(area)!
                ? "área já está no máximo"
                : null
      if (reason) {
        skipped.push({ ...item, reason })
        continue
      }
      toInsert.push(item)
      taken.add(`${item.servant_id}-${item.schedule_event_id}`)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }

    if (toInsert.length > 0) {
      const { error } = await supabase.from("schedule_assignments").insert(toInsert)
      if (error) {
        console.error("Erro ao criar atribuições em lote:", error)
        return NextResponse.json({ error: "Erro ao salvar atribuições" }, { status: 500 })
      }
    }

    return NextResponse.json({ created: toInsert.length, skipped })
  } catch (error) {
    console.error("Erro na criação em lote de atribuições:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
