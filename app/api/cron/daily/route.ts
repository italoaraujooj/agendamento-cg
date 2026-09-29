import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { remindPendingAvailability } from "@/lib/escalas/availability"
import { sendAssignmentReminders } from "@/lib/escalas/schedule-notifications"

// GET - Cron diário (vercel.json, 9h de Brasília):
// 1. lembra quem não respondeu a disponibilidade ~1 dia antes do prazo
// 2. lembra quem está escalado 3 dias e 1 dia antes do evento
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
  }

  // Tarefas independentes: a falha de uma não impede a outra
  const [availability, assignments] = await Promise.allSettled([
    remindPendingAvailability(supabase),
    sendAssignmentReminders(supabase),
  ])

  const summarize = (r: PromiseSettledResult<unknown>) =>
    r.status === "fulfilled" ? r.value : { error: String(r.reason) }
  if (availability.status === "rejected") console.error("Cron: lembretes de disponibilidade:", availability.reason)
  if (assignments.status === "rejected") console.error("Cron: lembretes de escala:", assignments.reason)

  return NextResponse.json({
    availabilityReminders: summarize(availability),
    assignmentReminders: summarize(assignments),
  })
}
