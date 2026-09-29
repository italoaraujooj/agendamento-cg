import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireManagerOf } from "@/lib/escalas/auth"
import { sendAvailabilityInvites } from "@/lib/escalas/availability"
import { isEmailConfigured } from "@/lib/escalas/email"

const schema = z.object({
  mode: z.enum(["all", "pending"]),
})

// POST - Envia o link pessoal de disponibilidade por e-mail
// mode "all": convite para todos os servos ativos; "pending": lembrete para quem não respondeu
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

    if (!isEmailConfigured()) {
      return NextResponse.json({ error: "Envio de e-mails não configurado (RESEND_API_KEY)" }, { status: 500 })
    }

    const { data: period } = await supabase
      .from("schedule_periods")
      .select("status")
      .eq("id", periodId)
      .single()

    if (!period || (period.status !== "collecting" && period.status !== "scheduling")) {
      return NextResponse.json(
        { error: "Só é possível enviar convites com a coleta de disponibilidade aberta" },
        { status: 400 }
      )
    }

    const result = await sendAvailabilityInvites(supabase, periodId, parsed.data.mode)
    return NextResponse.json(result)
  } catch (error) {
    console.error("Erro ao enviar convites de disponibilidade:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
