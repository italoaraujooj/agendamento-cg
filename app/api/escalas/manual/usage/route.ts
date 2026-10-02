import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireMinistryManager } from "@/lib/escalas/auth"

/**
 * GET /api/escalas/manual/usage?ministry_id=&days=90
 * Quem usa o manual do ministério: último acesso e em quantos dias usou.
 * Não expõe quais passos cada pessoa marcou (o checklist é um auxílio, não fiscalização).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const ministryId = params.get("ministry_id")
  if (!z.string().uuid().safeParse(ministryId).success) {
    return NextResponse.json({ error: "Ministério inválido" }, { status: 400 })
  }
  const auth = await requireMinistryManager(ministryId)
  if (!auth.ok) return auth.response
  const { supabase } = auth

  const days = Math.min(Math.max(Number(params.get("days")) || 90, 1), 365)
  const since = new Date(Date.now() - 3 * 3600 * 1000 - days * 86400000).toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from("manual_usage")
    .select("user_id, used_on, area:areas(name)")
    .eq("ministry_id", ministryId!)
    .gte("used_on", since)
  if (error) {
    console.error("Erro ao buscar uso do manual:", error)
    return NextResponse.json({ error: "Erro ao buscar uso" }, { status: 500 })
  }

  const byUser = new Map<string, { days: Set<string>; last: string; areas: Set<string> }>()
  for (const row of (data ?? []) as any[]) {
    const entry = byUser.get(row.user_id) ?? { days: new Set<string>(), last: row.used_on, areas: new Set<string>() }
    entry.days.add(row.used_on)
    if (row.used_on > entry.last) entry.last = row.used_on
    entry.areas.add(row.area?.name ?? "Geral")
    byUser.set(row.user_id, entry)
  }

  const userIds = [...byUser.keys()]
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
    : { data: [] }
  const profileOf = new Map((profiles ?? []).map((p: any) => [p.id, p]))

  const people = userIds
    .map((id) => {
      const e = byUser.get(id)!
      const p: any = profileOf.get(id)
      return {
        user_id: id,
        name: p?.full_name || p?.email || "Usuário",
        last_used_on: e.last,
        days_used: e.days.size,
        areas: [...e.areas].sort(),
      }
    })
    .sort((a, b) => b.last_used_on.localeCompare(a.last_used_on) || b.days_used - a.days_used)

  return NextResponse.json({ days, people })
}
