import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/server"
import { MAX_DONATION, registrationsOpen } from "@/lib/confraternizacao/config"
import { newAccessToken } from "@/lib/confraternizacao/server"

const schema = z.object({
  payer_name: z
    .string()
    .trim()
    .min(3, "Informe seu nome")
    .max(120)
    .refine((v) => v.split(/\s+/).filter(Boolean).length >= 2, "Informe nome e sobrenome"),
  amount: z.number().min(1, "Valor mínimo de R$ 1,00").max(MAX_DONATION),
  website: z.string().optional(),
})

// POST - Doação avulsa para custear inscrições (público, sem login)
export async function POST(request: NextRequest) {
  if (!registrationsOpen()) {
    return NextResponse.json({ error: "As inscrições e doações estão encerradas" }, { status: 410 })
  }

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 })
  }

  if (parsed.data.website) {
    return NextResponse.json({ access_token: newAccessToken() }, { status: 201 })
  }

  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })

  const accessToken = newAccessToken()
  const { error } = await supabase.from("confra_donations").insert({
    access_token: accessToken,
    payer_name: parsed.data.payer_name,
    amount: Math.round(parsed.data.amount * 100) / 100,
  })
  if (error) {
    console.error("Confraternização: erro ao criar doação:", error)
    return NextResponse.json({ error: "Erro ao registrar doação" }, { status: 500 })
  }

  return NextResponse.json({ access_token: accessToken }, { status: 201 })
}
