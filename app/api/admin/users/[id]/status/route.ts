import { NextRequest, NextResponse } from "next/server"
import { createAdminClient, createServerClient } from "@/lib/supabase/server"
import { z } from "zod"

const statusSchema = z.object({
  active: z.boolean(),
})

// PATCH - Ativa ou desativa um usuário
export async function PATCH(
  request: NextRequest,
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

    // Não pode alterar o próprio status
    if (caller.id === id) {
      return NextResponse.json({ error: "Não é possível alterar o próprio status" }, { status: 403 })
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

    // Não pode desativar outro admin
    const { data: targetProfile } = await adminClient
      .from("profiles")
      .select("is_admin, full_name")
      .eq("id", id)
      .single()

    if (targetProfile?.is_admin) {
      return NextResponse.json(
        { error: "Não é possível desativar uma conta de administrador" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const result = statusSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
    }

    const { active } = result.data

    // Aplicar ban ou desban via Supabase Admin SDK
    const { error: updateError } = await adminClient.auth.admin.updateUserById(id, {
      ban_duration: active ? "none" : "876000h",
    })

    if (updateError) {
      console.error("Erro ao atualizar status do usuário:", updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      active,
      message: active ? "Usuário reativado com sucesso" : "Usuário desativado com sucesso",
    })
  } catch (error) {
    console.error("Erro ao alterar status do usuário:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
