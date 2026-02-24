import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// GET - Cron job: auto-preenche disponibilidade para períodos com prazo vencido
// Configurado em vercel.json para rodar diariamente
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    const now = new Date().toISOString()

    // Buscar períodos em coleta com prazo já encerrado
    const { data: periods, error: periodsError } = await supabase
      .from("schedule_periods")
      .select("id, ministry_id")
      .eq("status", "collecting")
      .not("availability_deadline", "is", null)
      .lt("availability_deadline", now)

    if (periodsError) {
      return NextResponse.json({ error: periodsError.message }, { status: 500 })
    }

    if (!periods || periods.length === 0) {
      return NextResponse.json({ processed: 0, totalFilled: 0 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://agendamento-cg.vercel.app"
    let totalFilled = 0
    const results: { periodId: string; filled: number }[] = []

    for (const period of periods) {
      try {
        const res = await fetch(
          `${appUrl}/api/escalas/schedule-periods/${period.id}/auto-fill-availability`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          }
        )
        if (res.ok) {
          const data = await res.json()
          if (data.filled > 0) {
            totalFilled += data.filled
            results.push({ periodId: period.id, filled: data.filled })
          }
        }
      } catch (err) {
        console.error(`Erro ao auto-preencher período ${period.id}:`, err)
      }
    }

    return NextResponse.json({ processed: periods.length, totalFilled, results })
  } catch (error) {
    console.error("Erro no cron de auto-preenchimento:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
