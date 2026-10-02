import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { canManageMinistry, requireAuthenticated } from "@/lib/escalas/auth"
import { areaBelongsTo, normalizeArea } from "@/lib/escalas/manual-server"
import { findMinistryManagerEmails } from "@/lib/escalas/availability"
import { sendPushToEmails } from "@/lib/push"

const MAX_PENDING_PER_USER = 10
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://agendamento.icvcg.com.br"

const postSchema = z.object({
  ministry_id: z.string().uuid(),
  area_id: z.union([z.string().uuid(), z.literal("general"), z.null()]).optional(),
  section: z.string().trim().max(60).optional().nullable(),
  title: z.string().trim().min(3, "Descreva o passo").max(200),
  details: z.string().trim().max(2000).optional().nullable(),
})

/** POST - Qualquer pessoa logada sugere um passo para o checklist */
export async function POST(request: NextRequest) {
  const auth = await requireAuthenticated()
  if (!auth.ok) return auth.response
  const { supabase, caller } = auth

  const parsed = postSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Dados inválidos" }, { status: 400 })
  }
  const { ministry_id, section, title, details } = parsed.data
  const area_id = normalizeArea(parsed.data.area_id)
  if (!(await areaBelongsTo(supabase, ministry_id, area_id))) {
    return NextResponse.json({ error: "Área inválida" }, { status: 400 })
  }

  const { count } = await supabase
    .from("manual_checklist_suggestions")
    .select("id", { count: "exact", head: true })
    .eq("suggested_by", caller.userId)
    .eq("status", "pending")
  if ((count ?? 0) >= MAX_PENDING_PER_USER) {
    return NextResponse.json(
      { error: "Você já tem várias sugestões aguardando aprovação. Aguarde a análise antes de enviar outras." },
      { status: 429 }
    )
  }

  const { data, error } = await supabase
    .from("manual_checklist_suggestions")
    .insert({ ministry_id, area_id, section: section || null, title, details: details || null, suggested_by: caller.userId })
    .select("id, ministry_id, area_id, section, title, details, status, review_note, created_at")
    .single()
  if (error) {
    console.error("Erro ao salvar sugestão:", error)
    return NextResponse.json({ error: "Erro ao salvar sugestão" }, { status: 500 })
  }

  // Avisa quem gerencia o ministério (não bloqueia a resposta em caso de falha)
  try {
    const [{ data: area }, emails] = await Promise.all([
      area_id ? supabase.from("areas").select("name").eq("id", area_id).maybeSingle() : Promise.resolve({ data: null }),
      findMinistryManagerEmails(supabase, ministry_id),
    ])
    if (emails.length) {
      await sendPushToEmails(supabase, emails, {
        title: "Nova sugestão no Manual de Serviço",
        body: `${area?.name ? `${area.name}: ` : ""}${title}`,
        url: `${APP_URL}/admin-escalas/manual?ministry_id=${ministry_id}&tab=sugestoes`,
        tag: `manual-suggestion-${ministry_id}`,
      })
    }
  } catch (e) {
    console.error("Erro ao avisar sobre sugestão do manual:", e)
  }

  return NextResponse.json(data, { status: 201 })
}

/** GET - Sugestões pendentes dos ministérios que a pessoa gerencia */
export async function GET(request: NextRequest) {
  const auth = await requireAuthenticated()
  if (!auth.ok) return auth.response
  const { supabase, caller } = auth

  const ministryId = request.nextUrl.searchParams.get("ministry_id")
  if (ministryId && !z.string().uuid().safeParse(ministryId).success) {
    return NextResponse.json({ error: "Ministério inválido" }, { status: 400 })
  }
  if (ministryId ? !canManageMinistry(caller, ministryId) : !caller.isAdmin && caller.ministryIds.length === 0) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  }

  let q = supabase
    .from("manual_checklist_suggestions")
    .select("id, ministry_id, area_id, section, title, details, status, review_note, created_at, suggested_by, area:areas(name)")
    .eq("status", "pending")
    .order("created_at")
  if (ministryId) q = q.eq("ministry_id", ministryId)
  else if (!caller.isAdmin) q = q.in("ministry_id", caller.ministryIds)

  const { data, error } = await q
  if (error) {
    console.error("Erro ao buscar sugestões:", error)
    return NextResponse.json({ error: "Erro ao buscar sugestões" }, { status: 500 })
  }

  const userIds = [...new Set((data ?? []).map((s: any) => s.suggested_by))]
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
    : { data: [] }
  const nameOf = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name || p.email]))

  return NextResponse.json(
    (data ?? []).map(({ area, ...s }: any) => ({
      ...s,
      area_name: area?.name ?? null,
      suggested_by_name: nameOf.get(s.suggested_by) ?? null,
    }))
  )
}
