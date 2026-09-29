import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuthenticated } from "@/lib/escalas/auth"
import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Datas bloqueadas da pessoa logada (férias, viagens). Valem em todos os
 * ministérios em que ela serve: coletas de disponibilidade já vêm marcadas e
 * a sugestão automática não a escala nessas datas.
 */

async function callerEmail(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from("profiles").select("email").eq("id", userId).maybeSingle()
  return data?.email?.toLowerCase().trim() ?? null
}

const today = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)

// GET - Bloqueios vigentes ou futuros
export async function GET() {
  const auth = await requireAuthenticated()
  if (!auth.ok) return auth.response
  const email = await callerEmail(auth.supabase, auth.caller.userId)
  if (!email) return NextResponse.json([])

  const { data, error } = await auth.supabase
    .from("servant_blockouts")
    .select("id, starts_on, ends_on, reason")
    .eq("email", email)
    .gte("ends_on", today())
    .order("starts_on")
  if (error) {
    console.error("Erro ao buscar datas bloqueadas:", error)
    return NextResponse.json({ error: "Erro ao buscar datas bloqueadas" }, { status: 500 })
  }
  return NextResponse.json(data ?? [])
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const postSchema = z
  .object({
    starts_on: dateSchema,
    ends_on: dateSchema,
    reason: z.string().trim().max(100).optional().nullable(),
  })
  .refine((v) => v.ends_on >= v.starts_on, "A data final precisa ser igual ou depois da inicial")
  .refine(
    (v) => (new Date(v.ends_on).getTime() - new Date(v.starts_on).getTime()) / 86400000 <= 366,
    "O período pode ter no máximo 1 ano"
  )

// POST - Adiciona um período bloqueado
export async function POST(request: NextRequest) {
  const auth = await requireAuthenticated()
  if (!auth.ok) return auth.response

  const parsed = postSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Dados inválidos" }, { status: 400 })
  }
  if (parsed.data.ends_on < today()) {
    return NextResponse.json({ error: "O período já passou" }, { status: 400 })
  }

  const email = await callerEmail(auth.supabase, auth.caller.userId)
  if (!email) return NextResponse.json({ error: "Seu perfil não tem e-mail" }, { status: 400 })

  const { data, error } = await auth.supabase
    .from("servant_blockouts")
    .insert({
      email,
      user_id: auth.caller.userId,
      starts_on: parsed.data.starts_on,
      ends_on: parsed.data.ends_on,
      reason: parsed.data.reason || null,
    })
    .select("id, starts_on, ends_on, reason")
    .single()
  if (error) {
    console.error("Erro ao salvar data bloqueada:", error)
    return NextResponse.json({ error: "Erro ao salvar" }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}

// DELETE - Remove um período bloqueado (só os próprios)
export async function DELETE(request: NextRequest) {
  const auth = await requireAuthenticated()
  if (!auth.ok) return auth.response

  const id = request.nextUrl.searchParams.get("id")
  if (!id || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "id obrigatório" }, { status: 400 })
  }
  const email = await callerEmail(auth.supabase, auth.caller.userId)
  const { data, error } = await auth.supabase
    .from("servant_blockouts")
    .delete()
    .eq("id", id)
    .eq("email", email ?? "")
    .select("id")
  if (error) return NextResponse.json({ error: "Erro ao remover" }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
  return NextResponse.json({ success: true })
}
