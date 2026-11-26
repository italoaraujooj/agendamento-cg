import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { isPluggyConfigured } from "@/lib/pluggy/client"
import { eventIsOver } from "@/lib/confraternizacao/config"
import { reconcilePayments } from "@/lib/confraternizacao/reconcile"

export const maxDuration = 60

// GET - Cron de hora em hora (vercel.json): confere os PIX da confraternização.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (eventIsOver() || !isPluggyConfigured()) {
    return NextResponse.json({ skipped: true })
  }

  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })

  try {
    const result = await reconcilePayments(supabase)
    // As sugestões ficam para o painel; o cron só confirma
    return NextResponse.json({ confirmed: result.confirmed, checked: result.checked, review: result.suggestions.length })
  } catch (err) {
    console.error("Cron confraternização:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
