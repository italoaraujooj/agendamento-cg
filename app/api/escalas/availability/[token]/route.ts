import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/server"
import { getEscalasCaller } from "@/lib/escalas/auth"
import { signAvailabilityToken, verifyAvailabilityToken } from "@/lib/escalas/availability-token"
import {
  findMinistryServants,
  findOpenPeriodByToken,
  loadSavedAnswers,
  loadBlockoutsForServants,
  type MinistryServant,
  type OpenPeriod,
  type PeriodLookup,
} from "@/lib/escalas/availability"
import type { SupabaseClient } from "@supabase/supabase-js"

function lookupError(lookup: Exclude<PeriodLookup, { ok: true }>) {
  return NextResponse.json(
    { error: lookup.error, status: lookup.periodStatus, deadline: lookup.deadline },
    { status: lookup.status }
  )
}

/** Dados do servo identificado + token pessoal + respostas já salvas. */
async function identifiedPayload(
  supabase: SupabaseClient,
  period: OpenPeriod,
  servant: MinistryServant
) {
  const monthStart = `${period.year}-${String(period.month).padStart(2, "0")}-01`
  const monthEnd = new Date(Date.UTC(period.year, period.month, 0)).toISOString().slice(0, 10)
  const [saved, blockouts] = await Promise.all([
    loadSavedAnswers(supabase, period.id, servant.id),
    loadBlockoutsForServants(supabase, [servant], monthStart, monthEnd),
  ])
  return {
    servant: { id: servant.id, name: servant.name },
    access_token: signAvailabilityToken(servant.id, period.id),
    answers: saved.answers,
    submitted_at: saved.submitted_at,
    // Datas bloqueadas da pessoa neste mês: o formulário já marca "Não posso"
    blockouts: blockouts[servant.id] ?? [],
  }
}

// GET - Dados públicos do período (sem lista de servos).
// Se o usuário estiver logado e vinculado a um servo do ministério, já
// retorna a identificação dele.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    const lookup = await findOpenPeriodByToken(supabase, token)
    if (!lookup.ok) return lookupError(lookup)
    const { period, late } = lookup

    const { data: events, error: eventsError } = await supabase
      .from("schedule_events")
      .select("id, event_date, event_time, title, description")
      .eq("period_id", period.id)
      .order("event_date")
      .order("event_time")

    if (eventsError) {
      console.error("Erro ao buscar eventos:", eventsError)
      return NextResponse.json({ error: "Erro ao carregar eventos" }, { status: 500 })
    }

    let me = null
    const caller = await getEscalasCaller()
    if (caller && period.ministry) {
      const servants = await findMinistryServants(supabase, period.ministry.id)
      const mine = servants.find((s) => s.user_id === caller.userId)
      if (mine) me = await identifiedPayload(supabase, period, mine)
    }

    return NextResponse.json({
      period: {
        id: period.id,
        month: period.month,
        year: period.year,
        availability_deadline: period.availability_deadline,
        ministry: period.ministry,
        late,
      },
      events: events || [],
      me,
    })
  } catch (error) {
    console.error("Erro na API de disponibilidade:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

const identifySchema = z.union([
  z.object({ email: z.string().trim().email() }),
  z.object({ servant_id: z.string().uuid(), access_token: z.string().min(1) }),
])

// POST - Identificar o servo (por e-mail ou por token salvo no dispositivo)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    const parsed = identifySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
    }

    const lookup = await findOpenPeriodByToken(supabase, token)
    if (!lookup.ok) return lookupError(lookup)
    const { period } = lookup
    if (!period.ministry) {
      return NextResponse.json({ error: "Período sem ministério" }, { status: 400 })
    }

    const servants = await findMinistryServants(supabase, period.ministry.id)
    const body = parsed.data

    let servant: MinistryServant | undefined
    if ("email" in body) {
      const email = body.email.toLowerCase()
      servant = servants.find((s) => s.email?.toLowerCase().trim() === email)
    } else if (verifyAvailabilityToken(body.servant_id, period.id, body.access_token)) {
      servant = servants.find((s) => s.id === body.servant_id)
    }

    if (!servant) {
      return NextResponse.json(
        { error: "Email não encontrado. Verifique se você está cadastrado no ministério." },
        { status: 404 }
      )
    }

    return NextResponse.json(await identifiedPayload(supabase, period, servant))
  } catch (error) {
    console.error("Erro ao identificar servo:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
