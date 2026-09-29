import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/server"
import { getEscalasCaller } from "@/lib/escalas/auth"
import { verifyScheduleToken } from "@/lib/escalas/availability-token"

// Serviços de push dos navegadores (Chrome/Edge/Android, Firefox, Safari/iOS, Windows).
// Restringir evita que o servidor seja usado para fazer requisições a URLs arbitrárias.
const PUSH_SERVICE_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
  "web.push.apple.com",
  "notify.windows.com",
]

function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint)
    // Só para testes locais (servidor de push falso); nunca definir em produção
    if (process.env.PUSH_ALLOW_LOCAL_ENDPOINTS === "1" && url.hostname === "localhost") return true
    return (
      url.protocol === "https:" &&
      PUSH_SERVICE_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
    )
  } catch {
    return false
  }
}

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1000).refine(isAllowedPushEndpoint, "Serviço de push não suportado"),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
})

const postSchema = z.object({
  subscription: subscriptionSchema,
  /** Link pessoal da escala (sem login): /escala/[periodToken]?s=&k= */
  schedule: z
    .object({ periodToken: z.string().min(1), s: z.string().uuid(), k: z.string().min(1) })
    .optional(),
})

// POST - Registra este dispositivo para receber notificações da pessoa
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    const parsed = postSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
    }
    const { subscription, schedule } = parsed.data

    // Quem é a pessoa: sessão logada ou link pessoal da escala
    let email: string | null = null
    let userId: string | null = null

    const caller = await getEscalasCaller()
    if (caller) {
      const { data: profile } = await supabase.from("profiles").select("email").eq("id", caller.userId).maybeSingle()
      email = profile?.email ?? null
      userId = caller.userId
    } else if (schedule) {
      const { data: period } = await supabase
        .from("schedule_periods")
        .select("id")
        .eq("availability_token", schedule.periodToken)
        .maybeSingle()
      if (period && verifyScheduleToken(schedule.s, period.id, schedule.k)) {
        const { data: servant } = await supabase.from("servants").select("email").eq("id", schedule.s).maybeSingle()
        email = servant?.email ?? null
      }
    }

    if (!email) {
      return NextResponse.json({ error: "Não foi possível identificar você" }, { status: 403 })
    }

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        email: email.toLowerCase().trim(),
        user_id: userId,
        user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
      },
      { onConflict: "endpoint" }
    )
    if (error) {
      console.error("Erro ao salvar inscrição push:", error)
      return NextResponse.json({ error: "Erro ao ativar notificações" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro na inscrição push:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

// DELETE - Remove este dispositivo (o endpoint só é conhecido pelo próprio navegador)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }
    const parsed = z.object({ endpoint: z.string().url() }).safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
    }
    await supabase.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro ao remover inscrição push:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
