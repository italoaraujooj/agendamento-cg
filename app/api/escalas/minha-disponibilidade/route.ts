import { NextResponse } from "next/server"
import { requireAuthenticated } from "@/lib/escalas/auth"
import { signAvailabilityToken } from "@/lib/escalas/availability-token"
import { checkPeriodOpen, findMinistryServants, samePersonIds } from "@/lib/escalas/availability"

// GET - Coletas de disponibilidade abertas para o usuário logado
export async function GET() {
  try {
    const auth = await requireAuthenticated()
    if (!auth.ok) return auth.response
    const { supabase, caller } = auth

    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", caller.userId)
      .maybeSingle()

    // Servos vinculados à conta (ou com o mesmo e-mail, ainda não vinculados)
    const servantSelect = `
      id, email,
      area:areas!servants_area_id_fkey(ministry_id),
      servant_areas(area:areas(ministry_id))
    `
    const email = profile?.email?.toLowerCase().trim()
    const [{ data: byUser }, { data: byEmail }] = await Promise.all([
      supabase.from("servants").select(servantSelect).eq("user_id", caller.userId),
      email
        ? supabase.from("servants").select(servantSelect).ilike("email", email)
        : Promise.resolve({ data: [] as any[] }),
    ])
    const myServants = [
      ...(byUser ?? []),
      // ilike trata "_" como curinga; confirma o e-mail exato
      ...(byEmail ?? []).filter((s: any) => s.email?.toLowerCase().trim() === email),
    ]

    const ministryIds = new Set<string>()
    for (const s of (myServants ?? []) as any[]) {
      if (s.area?.ministry_id) ministryIds.add(s.area.ministry_id)
      s.servant_areas?.forEach((sa: any) => sa.area?.ministry_id && ministryIds.add(sa.area.ministry_id))
    }
    if (ministryIds.size === 0) return NextResponse.json({ periods: [] })

    const { data: periods } = await supabase
      .from("schedule_periods")
      .select("id, month, year, status, availability_deadline, availability_token, ministry:ministries(id, name, color)")
      .in("ministry_id", Array.from(ministryIds))
      .in("status", ["collecting", "scheduling"])
      .order("year")
      .order("month")

    const myIds = new Set((myServants ?? []).map((s: { id: string }) => s.id))
    const result = []

    for (const period of (periods ?? []) as any[]) {
      const servants = await findMinistryServants(supabase, period.ministry.id)
      const me = servants.find((s) => myIds.has(s.id))
      if (!me) continue
      const personIds = samePersonIds(servants, me)

      const { data: last } = await supabase
        .from("servant_availability")
        .select("submitted_at")
        .eq("period_id", period.id)
        .in("servant_id", personIds)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      const open = checkPeriodOpen(period)
      result.push({
        id: period.id,
        month: period.month,
        year: period.year,
        status: period.status,
        ministry: period.ministry,
        availability_deadline: period.availability_deadline,
        late: open.open && open.late,
        submitted_at: last?.submitted_at ?? null,
        link: `/disponibilidade/${period.availability_token}?s=${me.id}&k=${signAvailabilityToken(me.id, period.id)}`,
      })
    }

    return NextResponse.json({ periods: result })
  } catch (error) {
    console.error("Erro ao buscar coletas do usuário:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
