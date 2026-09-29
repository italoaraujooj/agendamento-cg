import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { sendAvailabilityInvites } from "@/lib/escalas/availability"

// GET - Cron diário (vercel.json): lembra quem ainda não respondeu a
// disponibilidade quando falta cerca de 1 dia para o prazo.
// A janela de 24h garante que cada período recebe um único lembrete automático.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    const now = Date.now()
    const windowStart = new Date(now + 24 * 60 * 60 * 1000).toISOString()
    const windowEnd = new Date(now + 48 * 60 * 60 * 1000).toISOString()

    const { data: periods, error } = await supabase
      .from("schedule_periods")
      .select("id")
      .eq("status", "collecting")
      .gt("availability_deadline", windowStart)
      .lte("availability_deadline", windowEnd)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const results = []
    for (const period of periods ?? []) {
      try {
        const result = await sendAvailabilityInvites(supabase, period.id, "pending")
        results.push({ periodId: period.id, sent: result.sent, failed: result.failed })
      } catch (err) {
        console.error(`Erro ao lembrar pendentes do período ${period.id}:`, err)
        results.push({ periodId: period.id, sent: 0, failed: -1 })
      }
    }

    return NextResponse.json({ processed: results.length, results })
  } catch (error) {
    console.error("Erro no cron de lembretes de disponibilidade:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
