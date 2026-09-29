import { NextRequest, NextResponse } from "next/server"
import { requireEscalasAccess, requireManagerOf } from "@/lib/escalas/auth"
import { z } from "zod"

const servantSchema = z.object({
  area_id: z.string().uuid("Área inválida"),
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  email: z.string().email("Email inválido").optional().nullable().or(z.literal("")),
  phone: z.string().max(20).optional().nullable(),
  is_leader: z.boolean().default(false),
  notes: z.string().max(500).optional().nullable(),
})

// GET - Listar servos (opcionalmente filtrar por área)
export async function GET(request: NextRequest) {
  try {
    const auth = await requireEscalasAccess()
    if (!auth.ok) return auth.response
    const { supabase } = auth

    const { searchParams } = new URL(request.url)
    const areaId = searchParams.get("area_id")
    const ministryId = searchParams.get("ministry_id")

    let query = supabase
      .from("servants")
      .select(`
        *,
        area:areas!servants_area_id_fkey(
          id,
          name,
          ministry:ministries(id, name, color)
        ),
        servant_areas(area_id, area:areas(id, name, ministry_id))
      `)
      .eq("is_active", true)
      .order("is_leader", { ascending: false })
      .order("name")

    if (areaId) {
      query = query.eq("area_id", areaId)
    }

    const { data: allData, error } = await query

    if (error) {
      console.error("Erro ao buscar servos:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (ministryId) {
      const filtered = (allData ?? []).filter((s: any) => {
        const primaryMatch = s.area?.ministry?.id === ministryId
        const secondaryMatch = s.servant_areas?.some(
          (sa: any) => sa.area?.ministry_id === ministryId
        )
        return primaryMatch || secondaryMatch
      })
      return NextResponse.json(filtered)
    }

    return NextResponse.json(allData)
  } catch (error) {
    console.error("Erro na API de servos:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

// POST - Criar servo
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validationResult = servantSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const { area_id, name, email, phone, is_leader, notes } = validationResult.data

    const auth = await requireManagerOf("area", area_id)
    if (!auth.ok) return auth.response
    const { supabase } = auth

    // Uma pessoa = um registro por ministério. Se já existe alguém com este
    // e-mail no ministério, a área é adicionada a esse registro.
    if (email) {
      const { data: area } = await supabase.from("areas").select("ministry_id").eq("id", area_id).single()
      const { data: sameEmail } = await supabase
        .from("servants")
        .select("*, area:areas!servants_area_id_fkey(ministry_id)")
        .ilike("email", email.trim())
      const existing = (sameEmail ?? []).find(
        (s: any) =>
          s.area?.ministry_id === area?.ministry_id &&
          s.email?.toLowerCase().trim() === email.toLowerCase().trim()
      )
      if (existing) {
        await supabase
          .from("servant_areas")
          .upsert({ servant_id: existing.id, area_id }, { onConflict: "servant_id,area_id", ignoreDuplicates: true })
          .throwOnError()
        const { area: _area, ...servant } = existing
        return NextResponse.json({ ...servant, merged: true }, { status: 200 })
      }
    }

    const { data, error } = await supabase
      .from("servants")
      .insert({
        area_id,
        name,
        email: email || null,
        phone: phone || null,
        is_leader,
        notes: notes || null,
      })
      .select()
      .single()

    if (error) {
      console.error("Erro ao criar servo:", error)
      if (error.code === "23505") {
        return NextResponse.json({ error: "Já existe um servo com este e-mail neste ministério" }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Inserir na tabela junction servant_areas
    await supabase
      .from("servant_areas")
      .insert({ servant_id: data.id, area_id })
      .throwOnError()

    // Auto-vincular ou convidar usuário pelo email
    if (email) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .ilike("email", email)
        .single()

      if (profile) {
        // Perfil existe → vincular servant ao usuário
        await supabase
          .from("servants")
          .update({ user_id: profile.id })
          .eq("id", data.id)
      } else {
        // Sem conta → enviar convite pelo Supabase Auth
        const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://agendamento-cg.vercel.app"
        try {
          await supabase.auth.admin.inviteUserByEmail(email, {
            redirectTo: `${APP_URL}/completar-cadastro`,
          })
        } catch (inviteErr) {
          // Não bloqueia a criação do servo; apenas loga o erro
          console.error("Erro ao enviar convite:", inviteErr)
        }
      }
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("Erro na API de servos:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
