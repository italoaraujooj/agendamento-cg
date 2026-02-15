import { NextResponse } from "next/server"
import { createAdminClient, createServerClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    // Verificar autenticação e se é admin
    const supabase = await createServerClient()
    if (!supabase) {
      return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }

    // Usar admin client para buscar dados completos
    const adminClient = createAdminClient()
    if (!adminClient) {
      return NextResponse.json({ error: "Service role não configurada" }, { status: 500 })
    }

    // Buscar todos os usuários do auth.users
    const { data: { users: authUsers }, error: authError } = await adminClient.auth.admin.listUsers()
    if (authError) throw authError

    // Buscar perfis
    const { data: profiles, error: profilesError } = await adminClient
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })

    if (profilesError) throw profilesError

    // Buscar ministry roles
    const { data: rolesData } = await adminClient
      .from("user_ministry_roles")
      .select("*, ministry:ministries(id, name, color)")

    // Combinar dados: perfil + metadados do auth
    const authUsersMap = new Map(authUsers.map(u => [u.id, u]))

    const usersWithNames = (profiles || []).map(p => {
      const authUser = authUsersMap.get(p.id)
      const fullName = p.full_name
        || authUser?.user_metadata?.full_name
        || authUser?.user_metadata?.name
        || null

      return {
        ...p,
        full_name: fullName,
        avatar_url: p.avatar_url || authUser?.user_metadata?.avatar_url || null,
        role: p.role || "user",
        ministry_roles: (rolesData || []).filter(r => r.user_id === p.id),
      }
    })

    return NextResponse.json(usersWithNames)
  } catch (error: any) {
    console.error("Erro ao buscar usuários:", error)
    return NextResponse.json({ error: error.message || "Erro interno" }, { status: 500 })
  }
}
