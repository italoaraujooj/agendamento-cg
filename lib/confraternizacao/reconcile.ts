import type { SupabaseClient } from "@supabase/supabase-js"
import { isPluggyConfigured, listTransactions } from "@/lib/pluggy/client"
import { findMatches, type IncomingPix, type PendingCharge } from "./match"
import { fetchAll, toSPDate } from "./server"

/** Sugestão para revisão manual, no formato que o painel mostra. */
export interface ReviewSuggestion {
  pix: { id: string; date: string; amount: number; payer_name: string | null }
  reason: "amount_only" | "ambiguous"
  /** Inscrições com o mesmo valor. Doações avulsas não entram: são anônimas. */
  registration_ids: string[]
  /** Quantas doações avulsas pendentes têm o mesmo valor */
  donation_count: number
}

export interface ReconcileResult {
  confirmed: number
  suggestions: ReviewSuggestion[]
  checked: number
}

interface PendingRegistrationRow {
  id: string
  contact_name: string
  payer_name: string | null
  total_expected: number
  created_at: string
  confra_participants: { name: string }[]
}

interface PendingDonationRow {
  id: string
  payer_name: string
  amount: number
  created_at: string
}

/**
 * Confere as entradas de PIX da conta (Pluggy) contra as inscrições e doações
 * pendentes e confirma as que casam por valor + nome.
 *
 * Só os PIX usados numa confirmação são gravados (confra_payments); o resto
 * das transações da conta não sai desta função, exceto o PIX com valor igual
 * a uma pendência, devolvido como sugestão para quem gerencia.
 */
export async function reconcilePayments(supabase: SupabaseClient): Promise<ReconcileResult> {
  if (!isPluggyConfigured()) throw new Error("Pluggy não configurado (PLUGGY_CLIENT_ID/SECRET/ACCOUNT_ID)")

  const [regs, dons] = await Promise.all([
    fetchAll<PendingRegistrationRow>(() =>
      supabase
        .from("confra_registrations")
        .select("id, contact_name, payer_name, total_expected, created_at, confra_participants(name)")
        .eq("status", "pending_payment")
        .order("id")
    ),
    fetchAll<PendingDonationRow>(() =>
      supabase
        .from("confra_donations")
        .select("id, payer_name, amount, created_at")
        .eq("status", "pending")
        .order("id")
    ),
  ])
  if (regs.error || dons.error) throw new Error((regs.error ?? dons.error)!.message)

  const pending: PendingCharge[] = [
    ...regs.data!.map((r) => ({
      kind: "registration" as const,
      id: r.id,
      amount: Number(r.total_expected),
      names: [r.contact_name, r.payer_name, ...r.confra_participants.map((p) => p.name)].filter(
        (n): n is string => !!n
      ),
      createdDate: toSPDate(r.created_at),
    })),
    ...dons.data!.map((d) => ({
      kind: "donation" as const,
      id: d.id,
      amount: Number(d.amount),
      names: [d.payer_name],
      createdDate: toSPDate(d.created_at),
    })),
  ]
  if (pending.length === 0) return { confirmed: 0, suggestions: [], checked: 0 }

  const dateFrom = pending.map((p) => p.createdDate).sort()[0]
  const txs = await listTransactions(process.env.PLUGGY_ACCOUNT_ID!, dateFrom)
  const credits = txs.filter((t) => t.type === "CREDIT" && t.amount > 0)

  // PIX que já confirmaram algo não entram de novo
  const usedIds = new Set<string>()
  const ids = credits.map((t) => t.id)
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase
      .from("confra_payments")
      .select("pluggy_tx_id")
      .in("pluggy_tx_id", ids.slice(i, i + 200))
    if (error) throw new Error(error.message)
    for (const row of data ?? []) usedIds.add(row.pluggy_tx_id)
  }

  const pixes: IncomingPix[] = credits
    .filter((t) => !usedIds.has(t.id))
    .map((t) => ({
      id: t.id,
      date: toSPDate(t.date),
      amount: Math.round(t.amount * 100) / 100,
      payerName: t.paymentData?.payer?.name ?? null,
      description: t.description ?? "",
    }))

  const { matches, suggestions } = findMatches(pixes, pending)

  let confirmed = 0
  for (const { pix, charge } of matches) {
    const ok = await confirmCharge(supabase, charge.kind, charge.id, {
      pluggy_tx_id: pix.id,
      amount: pix.amount,
      payer_name: pix.payerName,
      tx_date: pix.date,
      match: "auto",
    })
    if (ok) confirmed++
  }

  return {
    confirmed,
    checked: pixes.length,
    suggestions: suggestions.map((s) => ({
      pix: { id: s.pix.id, date: s.pix.date, amount: s.pix.amount, payer_name: s.pix.payerName },
      reason: s.reason,
      registration_ids: s.candidates.filter((c) => c.kind === "registration").map((c) => c.id),
      donation_count: s.candidates.filter((c) => c.kind === "donation").length,
    })),
  }
}

export interface PaymentRecord {
  pluggy_tx_id: string | null
  amount: number
  payer_name: string | null
  tx_date: string | null
  match: "auto" | "manual"
  confirmed_by?: string
}

/**
 * Marca a inscrição/doação como paga e registra o PIX usado.
 * O PIX é gravado antes (UNIQUE em pluggy_tx_id): se outra execução já o
 * usou, nada muda. Devolve true se confirmou.
 */
export async function confirmCharge(
  supabase: SupabaseClient,
  kind: "registration" | "donation",
  id: string,
  payment: PaymentRecord
): Promise<boolean> {
  const table = kind === "registration" ? "confra_registrations" : "confra_donations"
  const pendingStatus = kind === "registration" ? "pending_payment" : "pending"

  const { data: inserted, error: payError } = await supabase
    .from("confra_payments")
    .insert({
      ...payment,
      registration_id: kind === "registration" ? id : null,
      donation_id: kind === "donation" ? id : null,
    })
    .select("id")
    .single()
  if (payError) {
    // 23505: PIX já usado por outra confirmação
    if (payError.code === "23505") return false
    throw new Error(payError.message)
  }

  const { data: updated, error } = await supabase
    .from(table)
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", pendingStatus)
    .select("id")
  if (error || !updated?.length) {
    // Já não estava pendente (ou erro): desfaz o registro do PIX
    await supabase.from("confra_payments").delete().eq("id", inserted.id)
    if (error) throw new Error(error.message)
    return false
  }
  return true
}
