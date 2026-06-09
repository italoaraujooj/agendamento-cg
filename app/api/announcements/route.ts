import { NextRequest, NextResponse } from "next/server"
import { createAdminClient, createServerClient } from "@/lib/supabase/server"
import { getNextEligibleSunday, getLastSundayBeforeDate, addWeeks } from "@/lib/announcements"
import { z } from "zod"

const announcementSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("event"),
    title: z.string().min(3).max(200),
    description: z.string().max(1000).optional(),
    ministry_id: z.string().uuid().optional().nullable(),
    location: z.string().min(2).max(200),
    event_time: z.string().min(1).max(20),
    event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    registration_type: z.enum(["free", "paid"]),
    registration_value: z.number().positive().optional().nullable(),
    registration_where: z.string().max(300).optional().nullable(),
  }),
  z.object({
    type: z.literal("general"),
    title: z.string().min(3).max(200),
    description: z.string().min(5).max(1000),
    ministry_id: z.string().uuid().optional().nullable(),
    repeat_weeks: z.number().int().min(1).max(4).default(1),
  }),
  z.object({
    type: z.literal("ministry"),
    title: z.string().min(3).max(200),
    description: z.string().min(5).max(1000),
    ministry_id: z.string().uuid(),
    repeat_weeks: z.number().int().min(1).max(4).default(1),
  }),
])

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    if (!supabase) return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })

    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get("status")
    const sundayFilter = searchParams.get("sunday")

    // Verificar se é admin ou tem manage_avisos
    const [profileRes, permRes] = await Promise.all([
      admin.from("profiles").select("is_admin").eq("id", user.id).single(),
      admin.from("user_permissions").select("permission").eq("user_id", user.id).eq("permission", "manage_avisos"),
    ])
    const canManage = profileRes.data?.is_admin || (permRes.data && permRes.data.length > 0)

    let query = admin
      .from("church_announcements")
      .select(`
        *,
        ministry:ministries(id, name, color),
        submitter:profiles!church_announcements_submitted_by_fkey(id, full_name, email)
      `)
      .order("created_at", { ascending: false })

    if (!canManage) {
      query = query.eq("submitted_by", user.id)
    }

    if (statusFilter) query = query.eq("status", statusFilter)
    if (sundayFilter) {
      query = query.lte("first_sunday", sundayFilter).gte("last_sunday", sundayFilter)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ announcements: data ?? [] })
  } catch (err) {
    console.error("GET /api/announcements:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    if (!supabase) return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

    const body = await request.json()
    const parsed = announcementSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos", details: parsed.error.errors }, { status: 400 })
    }

    const data = parsed.data
    const now = new Date()
    const firstSunday = getNextEligibleSunday(now)

    let lastSunday: Date
    if (data.type === "event") {
      const eventDate = new Date(data.event_date + "T12:00:00")
      lastSunday = getLastSundayBeforeDate(eventDate)
      if (lastSunday < firstSunday) {
        return NextResponse.json(
          { error: "A data do evento é muito próxima. Não há domingos disponíveis para o aviso." },
          { status: 400 }
        )
      }
    } else {
      const repeatWeeks = (data as { repeat_weeks?: number }).repeat_weeks ?? 1
      lastSunday = addWeeks(firstSunday, repeatWeeks - 1)
    }

    const insertData: Record<string, unknown> = {
      type: data.type,
      title: data.title,
      description: "description" in data ? data.description : null,
      ministry_id: "ministry_id" in data ? data.ministry_id : null,
      first_sunday: firstSunday.toISOString().slice(0, 10),
      last_sunday: lastSunday.toISOString().slice(0, 10),
      submitted_by: user.id,
    }

    if (data.type === "event") {
      insertData.location = data.location
      insertData.event_time = data.event_time
      insertData.event_date = data.event_date
      insertData.registration_type = data.registration_type
      insertData.registration_value = data.registration_value ?? null
      insertData.registration_where = data.registration_where ?? null
    }

    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })

    const { data: created, error } = await admin
      .from("church_announcements")
      .insert(insertData)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Notificar admins/manage_avisos em background
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://agendamento-cg.vercel.app"
    fetch(`${appUrl}/api/announcements/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "new_announcement", announcementId: created.id }),
    }).catch(() => {})

    return NextResponse.json({ announcement: created }, { status: 201 })
  } catch (err) {
    console.error("POST /api/announcements:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
