import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { DEFAULT_TITLE } from "@/lib/confraternizacao/config"
import { requireConfraManager } from "@/lib/confraternizacao/server"

const ymd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
  .nullable()
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable()

const schema = z
  .object({
    title: z.string().trim().max(120).transform((v) => v || DEFAULT_TITLE),
    date: ymd,
    time: text(40),
    location: text(160),
    mapUrl: z
      .string()
      .trim()
      .max(2000)
      .transform((v) => v || null)
      .nullable()
      .refine((v) => v === null || /^https:\/\//i.test(v), "O link do mapa deve começar com https://"),
    deadline: ymd,
  })
  .refine((e) => !e.date || !e.deadline || e.deadline <= e.date, {
    message: "O fim das inscrições não pode ser depois do dia do evento",
    path: ["deadline"],
  })

// PUT - Salva os dados do evento (gestão)
export async function PUT(request: NextRequest) {
  const auth = await requireConfraManager()
  if (!auth.ok) return auth.response
  const { supabase, userId } = auth

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 })
  }
  const e = parsed.data

  const { error } = await supabase.from("confra_settings").upsert({
    id: true,
    title: e.title,
    event_date: e.date,
    event_time: e.time,
    location: e.location,
    map_url: e.mapUrl,
    registrations_until: e.deadline,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  })
  if (error) {
    console.error("Confraternização: erro ao salvar o evento:", error)
    const missing = error.code === "42P01" || error.code === "PGRST205"
    return NextResponse.json(
      { error: missing ? "Tabela confra_settings não existe: rode o script 031 no Supabase" : "Erro ao salvar o evento" },
      { status: 500 }
    )
  }
  return NextResponse.json({ ok: true })
}
