import { NextRequest, NextResponse } from "next/server"
import { createAdminClient, createServerClient } from "@/lib/supabase/server"

// GET - Lista todos os usuários com dados de auth (último login, provedores, status de ban)
export async function GET(_request: NextRequest) {
  try {
    const serverClient = await createServerClient()
    if (!serverClient) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    // Verificar se o caller é admin
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

    // Buscar perfis com ministry_roles
    const { data: profiles, error: profilesError } = await adminClient
      .from("profiles")
      .select("id, email, full_name, phone, role, is_admin, profile_completed, created_at")
      .order("created_at", { ascending: false })

    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 500 })
    }

    // Buscar ministry_roles
    const { data: ministryRoles } = await adminClient
      .from("user_ministry_roles")
      .select("id, user_id, ministry_id, role, ministry:ministries(id, name, color)")

    // Buscar dados de auth (último login, provedores, status de ban)
    const { data: authData, error: authError } = await adminClient.auth.admin.listUsers({
      perPage: 1000,
    })

    if (authError) {
      console.error("Erro ao buscar dados de auth:", authError)
    }

    const authMap = new Map(
      (authData?.users ?? []).map((u) => [
        u.id,
        {
          last_sign_in_at: u.last_sign_in_at ?? null,
          email_confirmed_at: u.email_confirmed_at ?? null,
          banned_until: (u as any).banned_until ?? null,
          providers: (u.identities ?? []).map((i) => i.provider),
        },
      ])
    )

    const users = (profiles ?? []).map((p) => ({
      ...p,
      ministry_roles: (ministryRoles ?? []).filter((r) => r.user_id === p.id),
      ...(authMap.get(p.id) ?? {
        last_sign_in_at: null,
        email_confirmed_at: null,
        banned_until: null,
        providers: [],
      }),
    }))

    return NextResponse.json({ users })
  } catch (error) {
    console.error("Erro ao listar usuários:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
