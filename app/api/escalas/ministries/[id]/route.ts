import { NextRequest, NextResponse } from "next/server"
import { createAdminClient, createServerClient } from "@/lib/supabase/server"
import { z } from "zod"

const ministryUpdateSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida").optional(),
  is_active: z.boolean().optional(),
  leader_id: z.string().uuid().optional().nullable(),
  co_leader_id: z.string().uuid().optional().nullable(),
})

// GET - Buscar ministério por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    // Try with leader/co_leader joins first; fall back if columns don't exist yet
    let result = await supabase
      .from("ministries")
      .select(`
        *,
        leader:servants!ministries_leader_id_fkey (
          id,
          name
        ),
        co_leader:servants!ministries_co_leader_id_fkey (
          id,
          name
        ),
        areas (
          *,
          servants (
            id,
            name,
            email,
            is_active,
            is_leader
          )
        )
      `)
      .eq("id", id)
      .single()

    // Fallback: if query failed (e.g. columns not yet created), retry without leader joins
    if (result.error && result.error.code !== "PGRST116") {
      result = await supabase
        .from("ministries")
        .select(`
          *,
          areas (
            *,
            servants (
              id,
              name,
              email,
              is_active,
              is_leader
            )
          )
        `)
        .eq("id", id)
        .single()
    }

    if (result.error) {
      if (result.error.code === "PGRST116") {
        return NextResponse.json({ error: "Ministério não encontrado" }, { status: 404 })
      }
      console.error("Erro ao buscar ministério:", result.error)
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    return NextResponse.json(result.data)
  } catch (error) {
    console.error("Erro na API de ministérios:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

// PUT - Atualizar ministério
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    const body = await request.json()
    const validationResult = ministryUpdateSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const updateData = validationResult.data

    // Buscar estado anterior para comparar líderes
    const { data: previousMinistry } = await supabase
      .from("ministries")
      .select("leader_id, co_leader_id")
      .eq("id", id)
      .single()

    const { data, error } = await supabase
      .from("ministries")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Ministério não encontrado" }, { status: 404 })
      }
      console.error("Erro ao atualizar ministério:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Sincronizar permissões quando líder/co-líder muda
    if ("leader_id" in updateData || "co_leader_id" in updateData) {
      await syncMinistryRoles(supabase, id, previousMinistry, {
        leader_id: data.leader_id,
        co_leader_id: data.co_leader_id,
      })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Erro na API de ministérios:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

/**
 * Sincroniza user_ministry_roles e profiles.role quando líder/co-líder muda.
 * Busca o email do servo → encontra o profile correspondente → upsert/delete roles.
 */
async function syncMinistryRoles(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  ministryId: string,
  previous: { leader_id: string | null; co_leader_id: string | null } | null,
  current: { leader_id: string | null; co_leader_id: string | null }
) {
  try {
    // Coletar todos os servant IDs envolvidos (antigos + novos)
    const servantIds = new Set<string>()
    if (previous?.leader_id) servantIds.add(previous.leader_id)
    if (previous?.co_leader_id) servantIds.add(previous.co_leader_id)
    if (current.leader_id) servantIds.add(current.leader_id)
    if (current.co_leader_id) servantIds.add(current.co_leader_id)

    if (servantIds.size === 0) return

    // Buscar emails dos servos envolvidos
    const { data: servants } = await supabase
      .from("servants")
      .select("id, email, user_id")
      .in("id", Array.from(servantIds))

    if (!servants || servants.length === 0) return

    // Para cada servo, encontrar o profile correspondente por email
    const servantToUser = new Map<string, string>()
    for (const servant of servants) {
      if (servant.user_id) {
        servantToUser.set(servant.id, servant.user_id)
        continue
      }
      if (!servant.email) continue

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", servant.email)
        .single()

      if (profile) {
        servantToUser.set(servant.id, profile.id)
        // Vincular servant.user_id ao profile encontrado
        await supabase
          .from("servants")
          .update({ user_id: profile.id })
          .eq("id", servant.id)
      }
    }

    // Remover roles antigos para este ministério (líderes que foram trocados/removidos)
    const oldServantIds = [previous?.leader_id, previous?.co_leader_id].filter(Boolean) as string[]
    for (const servantId of oldServantIds) {
      const userId = servantToUser.get(servantId)
      if (!userId) continue

      // Só remove se não é mais líder nem co-líder neste ministério
      const isStillLeader = current.leader_id === servantId
      const isStillCoLeader = current.co_leader_id === servantId
      if (isStillLeader || isStillCoLeader) continue

      await supabase
        .from("user_ministry_roles")
        .delete()
        .eq("user_id", userId)
        .eq("ministry_id", ministryId)

      // Se não lidera mais nenhum ministério, resetar role para 'user'
      const { data: remainingRoles } = await supabase
        .from("user_ministry_roles")
        .select("id")
        .eq("user_id", userId)
        .limit(1)

      if (!remainingRoles || remainingRoles.length === 0) {
        await supabase
          .from("profiles")
          .update({ role: "user" })
          .eq("id", userId)
          .neq("role", "admin") // Não rebaixar admins globais
      }
    }

    // Upsert roles para novos líderes/co-líderes
    const newLeaders: { servantId: string; role: "leader" | "coordinator" }[] = []
    if (current.leader_id) newLeaders.push({ servantId: current.leader_id, role: "leader" })
    if (current.co_leader_id) newLeaders.push({ servantId: current.co_leader_id, role: "coordinator" })

    for (const { servantId, role } of newLeaders) {
      const userId = servantToUser.get(servantId)
      if (!userId) continue

      await supabase
        .from("user_ministry_roles")
        .upsert(
          { user_id: userId, ministry_id: ministryId, role },
          { onConflict: "user_id,ministry_id" }
        )

      // Atualizar profiles.role para ministry_leader (se ainda for 'user')
      await supabase
        .from("profiles")
        .update({ role: "ministry_leader" })
        .eq("id", userId)
        .eq("role", "user")
    }
  } catch (err) {
    // Log mas não falha a request principal
    console.error("Erro ao sincronizar roles de ministério:", err)
  }
}

// DELETE - Desativar ministério (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    // Soft delete - apenas desativa
    const { error } = await supabase
      .from("ministries")
      .update({ is_active: false })
      .eq("id", id)

    if (error) {
      console.error("Erro ao desativar ministério:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro na API de ministérios:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
