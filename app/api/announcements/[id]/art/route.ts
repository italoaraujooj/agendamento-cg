import { NextRequest, NextResponse } from "next/server"
import { createAdminClient, createServerClient } from "@/lib/supabase/server"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/quicktime", "video/webm"]
const MAX_SIZE = 52_428_800 // 50 MB

export async function POST(
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
      .select("submitted_by, art_storage_path")
      .eq("id", id)
      .single()

    if (!announcement) return NextResponse.json({ error: "Aviso não encontrado" }, { status: 404 })
    if (announcement.submitted_by !== user.id) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 })

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Tipo de arquivo não permitido. Use imagem ou vídeo." }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Arquivo muito grande. Máximo: 50 MB." }, { status: 400 })
    }

    // Remover arte anterior se existir
    if (announcement.art_storage_path) {
      await admin.storage.from("announcement-art").remove([announcement.art_storage_path])
    }

    const ext = file.name.split(".").pop() ?? "bin"
    const storagePath = `${user.id}/${id}.${ext}`
    const arrayBuffer = await file.arrayBuffer()

    const { error: uploadError } = await admin.storage
      .from("announcement-art")
      .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: true })

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    const { data: { publicUrl } } = admin.storage.from("announcement-art").getPublicUrl(storagePath)

    const { error: updateError } = await admin
      .from("church_announcements")
      .update({ has_art: true, art_url: publicUrl, art_storage_path: storagePath, updated_at: new Date().toISOString() })
      .eq("id", id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    return NextResponse.json({ art_url: publicUrl, art_storage_path: storagePath })
  } catch (err) {
    console.error("POST /api/announcements/[id]/art:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
