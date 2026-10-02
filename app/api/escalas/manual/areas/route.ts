import { NextResponse } from "next/server"
import { requireAuthenticated } from "@/lib/escalas/auth"

/**
 * GET /api/escalas/manual/areas
 * Ministérios e áreas para o seletor do manual, a área em que a pessoa serve
 * (para abrir direto nela) e os ministérios que ela gerencia.
 */
export async function GET() {
  const auth = await requireAuthenticated()
  if (!auth.ok) return auth.response
  const { supabase, caller } = auth

  const [{ data: ministries, error }, { data: servants }] = await Promise.all([
    supabase
      .from("ministries")
      .select("id, name, color, areas(id, name, order_index, is_active)")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("servants")
      .select("area_id, is_active, servant_areas(area_id)")
      .eq("user_id", caller.userId),
  ])
  if (error) {
    console.error("Erro ao buscar ministérios do manual:", error)
    return NextResponse.json({ error: "Erro ao buscar ministérios" }, { status: 500 })
  }

  interface PickerMinistry {
    id: string
    name: string
    color: string
    areas: { id: string; name: string }[]
  }
  const list: PickerMinistry[] = (ministries ?? []).map((m: any) => ({
    id: m.id as string,
    name: m.name as string,
    color: m.color as string,
    areas: (m.areas ?? [])
      .filter((a: any) => a.is_active !== false)
      .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0) || a.name.localeCompare(b.name))
      .map((a: any) => ({ id: a.id as string, name: a.name as string })),
  }))

  // Áreas em que a pessoa serve (registro principal + servant_areas)
  const myAreaIds = new Set<string>()
  for (const s of (servants ?? []) as any[]) {
    if (s.is_active === false) continue
    if (s.area_id) myAreaIds.add(s.area_id)
    s.servant_areas?.forEach((sa: { area_id: string }) => myAreaIds.add(sa.area_id))
  }
  const mine = list.flatMap((m) =>
    m.areas.filter((a) => myAreaIds.has(a.id)).map((a) => ({ ministryId: m.id, areaId: a.id }))
  )

  return NextResponse.json({
    ministries: list,
    mine,
    managed: caller.isAdmin ? list.map((m) => m.id) : caller.ministryIds,
    isAdmin: caller.isAdmin,
  })
}
