import { NextResponse } from "next/server"
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/server"
import { getEscalasCaller } from "@/lib/escalas/auth"
import { PRICE_PER_PERSON } from "./config"

/**
 * Busca todas as linhas, página por página (o Supabase limita a 1.000 por
 * consulta). `build` cria a consulta do zero e ordena por chave única.
 */
export async function fetchAll<T>(
  build: () => {
    range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>
  }
): Promise<{ data: T[] | null; error: PostgrestError | null }> {
  const rows: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999)
    if (error) return { data: null, error }
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) return { data: rows, error: null }
  }
}

export const CONFRA_PERMISSION = "manage_confraternizacao"

type GuardResult =
  | { ok: true; userId: string; supabase: SupabaseClient }
  | { ok: false; response: NextResponse }

/** Rotas de gestão: admin ou permissão manage_confraternizacao. */
export async function requireConfraManager(): Promise<GuardResult> {
  const supabase = createAdminClient()
  if (!supabase) {
    return { ok: false, response: NextResponse.json({ error: "Erro de configuração" }, { status: 500 }) }
  }
  const caller = await getEscalasCaller()
  if (!caller) {
    return { ok: false, response: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) }
  }
  if (!caller.isAdmin && !caller.permissions.includes(CONFRA_PERMISSION)) {
    return { ok: false, response: NextResponse.json({ error: "Acesso negado" }, { status: 403 }) }
  }
  return { ok: true, userId: caller.userId, supabase }
}

/** Token aleatório para o link pessoal da inscrição/doação. */
export function newAccessToken() {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString("base64url")
}

/** Data AAAA-MM-DD em Brasília de um timestamp. */
export function toSPDate(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso))
}

export interface SponsorshipSummary {
  /** Pessoas (em idade pagante) que pediram para participar sem pagar */
  requested: number
  /** Inscrições que as doações confirmadas já cobrem */
  covered: number
  /** Total doado e confirmado, em reais */
  donated: number
}

/** Agregados de doação/ajuda: públicos, sem nenhum nome. */
export async function sponsorshipSummary(supabase: SupabaseClient): Promise<SponsorshipSummary> {
  const [sponsored, regDonations, donations] = await Promise.all([
    fetchAll<{ id: string; payers_count: number }>(() =>
      supabase.from("confra_registrations").select("id, payers_count").eq("status", "sponsored").order("id")
    ),
    fetchAll<{ id: string; donation_amount: number }>(() =>
      supabase
        .from("confra_registrations")
        .select("id, donation_amount")
        .eq("status", "paid")
        .gt("donation_amount", 0)
        .order("id")
    ),
    fetchAll<{ id: string; amount: number }>(() =>
      supabase.from("confra_donations").select("id, amount").eq("status", "paid").order("id")
    ),
  ])
  if (sponsored.error || regDonations.error || donations.error) {
    throw new Error(
      (sponsored.error ?? regDonations.error ?? donations.error)?.message ?? "Erro ao calcular doações"
    )
  }

  const requested = sponsored.data!.reduce((s, r) => s + r.payers_count, 0)
  const donated =
    regDonations.data!.reduce((s, r) => s + Number(r.donation_amount), 0) +
    donations.data!.reduce((s, d) => s + Number(d.amount), 0)

  return {
    requested,
    covered: Math.floor(donated / PRICE_PER_PERSON + 1e-9),
    donated: Math.round(donated * 100) / 100,
  }
}
