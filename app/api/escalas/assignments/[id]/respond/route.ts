import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/server"
import { getEscalasCaller } from "@/lib/escalas/auth"
import { verifyScheduleToken } from "@/lib/escalas/availability-token"
import { respondToAssignment } from "@/lib/escalas/schedule-notifications"

const schema = z.object({
  status: z.enum(["accepted", "declined"]),
  reason: z.string().max(200).optional().nullable(),
  /** Link pessoal da escala (e-mail); sem ele, usa a sessão do usuário logado */
  token: z.string().optional(),
})

// POST - Servo aceita ou recusa uma atribuição de escala publicada
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
    }
    const { status, reason, token } = parsed.data

    const { data: assignment } = await supabase
      .from("schedule_assignments")
      .select(`
        id, servant_id,
        servant:servants(user_id, email),
        event:schedule_events(event_date, period:schedule_periods(id, status))
      `)
      .eq("id", id)
      .maybeSingle()

    const a = assignment as any
    if (!a) {
      return NextResponse.json({ error: "Escala não encontrada" }, { status: 404 })
    }

    // Autorização: link pessoal assinado ou o próprio servo logado
    let allowed = !!token && verifyScheduleToken(a.servant_id, a.event?.period?.id, token)
    if (!allowed && !token) {
      const caller = await getEscalasCaller()
      if (caller) {
        if (a.servant?.user_id === caller.userId) {
          allowed = true
        } else if (a.servant?.email) {
          const { data: profile } = await supabase.from("profiles").select("email").eq("id", caller.userId).maybeSingle()
          allowed = profile?.email?.toLowerCase().trim() === a.servant.email.toLowerCase().trim()
        }
      }
    }
    if (!allowed) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }

    if (a.event?.period?.status !== "published") {
      return NextResponse.json({ error: "Esta escala ainda não foi publicada" }, { status: 400 })
    }
    const today = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)
    if (a.event.event_date < today) {
      return NextResponse.json({ error: "Este evento já aconteceu" }, { status: 400 })
    }

    await respondToAssignment(supabase, id, status, reason ?? null)
    return NextResponse.json({ success: true, status })
  } catch (error) {
    console.error("Erro ao responder escala:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
