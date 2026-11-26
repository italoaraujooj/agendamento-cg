import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import {
  FREE_MAX_AGE,
  MAX_PARTICIPANTS,
  PRICE_PER_PERSON,
  eventInfo,
  pixReceiver,
  registrationsOpen,
} from "@/lib/confraternizacao/config"
import { sponsorshipSummary } from "@/lib/confraternizacao/server"

export const dynamic = "force-dynamic"

// GET - Dados públicos da página de inscrição: evento, preço e agregados de
// doação (sem nenhum nome).
export async function GET() {
  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })

  let sponsorship = null
  try {
    sponsorship = await sponsorshipSummary(supabase)
  } catch (err) {
    // O contador é um extra: a página funciona sem ele
    console.error("Confraternização: erro no resumo de doações:", err)
  }

  return NextResponse.json({
    event: eventInfo(),
    open: registrationsOpen(),
    price: PRICE_PER_PERSON,
    free_max_age: FREE_MAX_AGE,
    max_participants: MAX_PARTICIPANTS,
    pix_configured: !!pixReceiver(),
    sponsorship,
  })
}
