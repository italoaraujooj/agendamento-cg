import { NextResponse } from "next/server"
import { isPluggyConfigured } from "@/lib/pluggy/client"
import { PRICE_PER_PERSON, eventInfo, pixReceiver } from "@/lib/confraternizacao/config"
import { fetchAll, requireConfraManager, sponsorshipSummary } from "@/lib/confraternizacao/server"

export const dynamic = "force-dynamic"

interface RegistrationRow {
  id: string
  contact_name: string
  contact_phone: string
  payer_name: string | null
  cannot_pay: boolean
  payers_count: number
  free_count: number
  amount_due: number
  donation_amount: number
  total_expected: number
  status: "pending_payment" | "paid" | "sponsored" | "cancelled"
  paid_at: string | null
  created_at: string
  confra_participants: { name: string; age: number; phone: string | null; is_child: boolean; position: number }[]
  confra_payments: { match: "auto" | "manual"; payer_name: string | null; tx_date: string | null; amount: number }[]
}

// GET - Lista de inscrições e estatísticas (gestão)
export async function GET() {
  const auth = await requireConfraManager()
  if (!auth.ok) return auth.response
  const { supabase } = auth

  const [regs, dons] = await Promise.all([
    fetchAll<RegistrationRow>(() =>
      supabase
        .from("confra_registrations")
        .select(
          "id, contact_name, contact_phone, payer_name, cannot_pay, payers_count, free_count, amount_due, donation_amount, total_expected, status, paid_at, created_at, confra_participants(name, age, phone, is_child, position), confra_payments(match, payer_name, tx_date, amount)"
        )
        .order("created_at", { ascending: false })
        .order("id")
    ),
    // Doações avulsas: só valores e status, sem nome (são anônimas)
    fetchAll<{ id: string; amount: number; status: string }>(() =>
      supabase.from("confra_donations").select("id, amount, status").order("id")
    ),
  ])
  if (regs.error || dons.error) {
    console.error("Confraternização: erro ao listar:", regs.error ?? dons.error)
    return NextResponse.json({ error: "Erro ao carregar inscrições" }, { status: 500 })
  }

  let sponsorship = null
  try {
    sponsorship = await sponsorshipSummary(supabase)
  } catch (err) {
    console.error("Confraternização: erro no resumo de doações:", err)
  }

  const registrations = regs.data!.map((r) => ({
    ...r,
    amount_due: Number(r.amount_due),
    donation_amount: Number(r.donation_amount),
    total_expected: Number(r.total_expected),
    confra_participants: [...r.confra_participants].sort((a, b) => a.position - b.position),
    payment: r.confra_payments[0]
      ? { ...r.confra_payments[0], amount: Number(r.confra_payments[0].amount) }
      : null,
  }))

  const active = registrations.filter((r) => r.status !== "cancelled")
  const sum = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) * 100) / 100
  const paid = active.filter((r) => r.status === "paid")
  const donationRows = dons.data!

  const stats = {
    registrations: active.length,
    participants: active.reduce((s, r) => s + r.confra_participants.length, 0),
    payers: active.filter((r) => r.status !== "sponsored").reduce((s, r) => s + r.payers_count, 0),
    children: active.reduce((s, r) => s + r.free_count, 0),
    sponsored_people: active.filter((r) => r.status === "sponsored").reduce((s, r) => s + r.payers_count, 0),
    pending_count: active.filter((r) => r.status === "pending_payment").length,
    pending_amount: sum(active.filter((r) => r.status === "pending_payment").map((r) => r.total_expected)),
    paid_registrations_amount: sum(paid.map((r) => r.amount_due)),
    donations_with_registration: sum(paid.map((r) => r.donation_amount)),
    standalone_donations_paid: sum(donationRows.filter((d) => d.status === "paid").map((d) => Number(d.amount))),
    standalone_donations_pending: donationRows.filter((d) => d.status === "pending").length,
  }

  return NextResponse.json({
    event: eventInfo(),
    price: PRICE_PER_PERSON,
    pluggy_configured: isPluggyConfigured(),
    pix_configured: !!pixReceiver(),
    stats,
    sponsorship,
    registrations: registrations.map(({ confra_payments: _p, ...r }) => r),
  })
}
