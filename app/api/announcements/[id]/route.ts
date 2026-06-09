import { NextRequest, NextResponse } from "next/server"
import { createAdminClient, createServerClient } from "@/lib/supabase/server"
import { z } from "zod"

const reviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  review_notes: z.string().max(500).optional(),
})

async function getCallerPermissions(userId: string) {
  const admin = createAdminClient()
  if (!admin) return { isAdmin: false, canManage: false }
  const [profileRes, permRes] = await Promise.all([
    admin.from("profiles").select("is_admin").eq("id", userId).single(),
    admin.from("user_permissions").select("permission").eq("user_id", userId).eq("permission", "manage_avisos"),
  ])
  const isAdmin = profileRes.data?.is_admin ?? false
  const canManage = isAdmin || (permRes.data && permRes.data.length > 0)
  return { isAdmin, canManage }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerClient()
    if (!supabase) return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

    const { canManage } = await getCallerPermissions(user.id)
    if (!canManage) return NextResponse.json({ error: "Acesso negado" }, { status: 403 })

    const body = await request.json()
    const parsed = reviewSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos", details: parsed.error.errors }, { status: 400 })
    }

    const admin = createAdminClient()!
    const { data, error } = await admin
      .from("church_announcements")
      .update({
        status: parsed.data.action === "approve" ? "approved" : "rejected",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: parsed.data.review_notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      if (error.code === "PGRST116") return NextResponse.json({ error: "Aviso não encontrado" }, { status: 404 })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://agendamento-cg.vercel.app"
    fetch(`${appUrl}/api/announcements/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "announcement_reviewed", announcementId: id }),
    }).catch(() => {})

    return NextResponse.json({ announcement: data })
  } catch (err) {
    console.error("PATCH /api/announcements/[id]:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerClient()
    if (!supabase) return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })

    const { data: announcement } = await admin
      .from("church_announcements")
      .select("submitted_by, status, art_storage_path")
      .eq("id", id)
      .single()

    if (!announcement) return NextResponse.json({ error: "Aviso não encontrado" }, { status: 404 })

    const { canManage } = await getCallerPermissions(user.id)
    const isOwnerPending = announcement.submitted_by === user.id && announcement.status === "pending"

    if (!canManage && !isOwnerPending) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }

    if (announcement.art_storage_path) {
      await admin.storage.from("announcement-art").remove([announcement.art_storage_path])
    }

    const { error } = await admin.from("church_announcements").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/announcements/[id]:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
