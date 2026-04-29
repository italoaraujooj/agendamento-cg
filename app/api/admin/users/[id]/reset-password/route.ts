import { NextRequest, NextResponse } from "next/server"
import { createAdminClient, createServerClient } from "@/lib/supabase/server"

// POST - Gera link de recuperação de senha para um usuário
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const serverClient = await createServerClient()
    if (!serverClient) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    const { data: { user: caller } } = await serverClient.auth.getUser()
    if (!caller) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const adminClient = createAdminClient()
    if (!adminClient) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("is_admin")
      .eq("id", caller.id)
      .single()

    if (!callerProfile?.is_admin) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }

    // Buscar dados do usuário alvo
    const { data: targetData, error: targetError } = await adminClient.auth.admin.getUserById(id)
    if (targetError || !targetData.user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }

    const email = targetData.user.email
    if (!email) {
      return NextResponse.json({ error: "Usuário não possui email cadastrado" }, { status: 400 })
    }

    // Gerar link de recuperação
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
    })

    if (linkError || !linkData) {
      console.error("Erro ao gerar link de recuperação:", linkError)
      return NextResponse.json({ error: "Erro ao gerar link de recuperação" }, { status: 500 })
    }

    return NextResponse.json({
      link: linkData.properties?.action_link ?? null,
      email,
    })
  } catch (error) {
    console.error("Erro ao resetar senha:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
