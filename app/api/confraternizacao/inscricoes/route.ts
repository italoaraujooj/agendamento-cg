import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/server"
import {
  MAX_DONATION,
  MAX_PARTICIPANTS,
  PRICE_PER_PERSON,
  isFreeAge,
  registrationsOpen,
} from "@/lib/confraternizacao/config"
import { newAccessToken } from "@/lib/confraternizacao/server"

const fullName = z
  .string()
  .trim()
  .min(3, "Informe o nome")
  .max(120)
  .refine((v) => v.split(/\s+/).filter(Boolean).length >= 2, "Informe nome e sobrenome")

const phone = z
  .string()
  .trim()
  .refine((v) => /^\d{10,11}$/.test(v.replace(/\D/g, "")), "Telefone inválido")

const schema = z.object({
  participants: z
    .array(
      z.object({
        name: fullName,
        age: z.number().int().min(0).max(120),
        phone: z.string().trim().max(20).optional().nullable(),
      })
    )
    .min(1, "Adicione pelo menos um participante")
    .max(MAX_PARTICIPANTS, `No máximo ${MAX_PARTICIPANTS} participantes por inscrição`),
  contact_phone: phone,
  payer_name: z.string().trim().max(120).optional().nullable(),
  cannot_pay: z.boolean().default(false),
  donation_amount: z.number().min(0).max(MAX_DONATION).default(0),
  // Honeypot: campo escondido que só robô preenche
  website: z.string().optional(),
})

// POST - Nova inscrição (público, sem login)
export async function POST(request: NextRequest) {
  try {
    if (!registrationsOpen()) {
      return NextResponse.json({ error: "As inscrições estão encerradas" }, { status: 410 })
    }

    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      )
    }
    const body = parsed.data

    const supabase = createAdminClient()
    if (!supabase) return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })

    if (body.website) {
      // Robô: finge sucesso sem gravar
      return NextResponse.json({ access_token: newAccessToken() }, { status: 201 })
    }

    const payers = body.participants.filter((p) => !isFreeAge(p.age)).length
    const free = body.participants.length - payers
    const amountDue = payers * PRICE_PER_PERSON
    const donation = body.cannot_pay ? 0 : Math.round(body.donation_amount * 100) / 100
    const total = body.cannot_pay ? 0 : amountDue + donation

    const status = body.cannot_pay
      ? "sponsored"
      : total === 0
        ? "paid" // só crianças: nada a pagar
        : "pending_payment"

    const payerName = body.payer_name?.trim() || null
    if (payerName && payerName.split(/\s+/).length < 2) {
      return NextResponse.json(
        { error: "Informe nome e sobrenome de quem vai fazer o PIX" },
        { status: 400 }
      )
    }

    const accessToken = newAccessToken()
    const { data: reg, error } = await supabase
      .from("confra_registrations")
      .insert({
        access_token: accessToken,
        contact_name: body.participants[0].name,
        contact_phone: body.contact_phone.replace(/\D/g, ""),
        payer_name: body.cannot_pay ? null : payerName,
        cannot_pay: body.cannot_pay,
        payers_count: payers,
        free_count: free,
        amount_due: amountDue,
        donation_amount: donation,
        total_expected: total,
        status,
        paid_at: status === "paid" ? new Date().toISOString() : null,
      })
      .select("id")
      .single()
    if (error || !reg) {
      console.error("Confraternização: erro ao criar inscrição:", error)
      return NextResponse.json({ error: "Erro ao salvar inscrição" }, { status: 500 })
    }

    const { error: partError } = await supabase.from("confra_participants").insert(
      body.participants.map((p, i) => ({
        registration_id: reg.id,
        position: i,
        name: p.name,
        age: p.age,
        phone: i === 0 ? body.contact_phone.replace(/\D/g, "") : p.phone?.replace(/\D/g, "") || null,
      }))
    )
    if (partError) {
      console.error("Confraternização: erro ao salvar participantes:", partError)
      await supabase.from("confra_registrations").delete().eq("id", reg.id)
      return NextResponse.json({ error: "Erro ao salvar inscrição" }, { status: 500 })
    }

    return NextResponse.json({ access_token: accessToken }, { status: 201 })
  } catch (err) {
    console.error("Confraternização: erro inesperado:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
