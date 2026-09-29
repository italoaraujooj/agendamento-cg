import webpush from "web-push"
import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Notificações push do PWA (Web Push / VAPID).
 *
 * As inscrições ficam em push_subscriptions, por e-mail da pessoa. O envio
 * nunca derruba o fluxo que o chamou: erros são registrados e inscrições
 * expiradas (404/410) são removidas.
 */

export interface PushPayload {
  title: string
  body: string
  /** Página aberta ao tocar na notificação */
  url: string
  /** Notificações com a mesma tag se substituem em vez de acumular */
  tag?: string
}

let configured: boolean | null = null

export function isPushConfigured(): boolean {
  if (configured !== null) return configured
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    configured = false
    return false
  }
  const subject =
    process.env.VAPID_SUBJECT || `mailto:${process.env.RESEND_FROM_EMAIL || "agendamento@icvcg.com.br"}`
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
  return true
}

const norm = (email: string) => email.toLowerCase().trim()

/** Envia a mesma notificação para todos os dispositivos das pessoas indicadas. */
export async function sendPushToEmails(
  supabase: SupabaseClient,
  emails: string[],
  payload: PushPayload
): Promise<{ sent: number; removed: number }> {
  return sendPushBatch(supabase, emails.map((email) => ({ email, payload })))
}

/** Envia notificações diferentes por pessoa (ex.: cada servo com sua escala). */
export async function sendPushBatch(
  supabase: SupabaseClient,
  items: { email: string; payload: PushPayload }[]
): Promise<{ sent: number; removed: number }> {
  const result = { sent: 0, removed: 0 }
  if (items.length === 0 || !isPushConfigured()) return result

  try {
    const byEmail = new Map(items.map((i) => [norm(i.email), i.payload]))
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, email")
      .in("email", Array.from(byEmail.keys()))

    const expired: string[] = []
    const delivered: string[] = []

    await Promise.all(
      (subs ?? []).map(async (s: { id: string; endpoint: string; p256dh: string; auth: string; email: string }) => {
        const payload = byEmail.get(s.email)
        if (!payload) return
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(payload),
            { TTL: 24 * 3600 }
          )
          delivered.push(s.id)
        } catch (error: unknown) {
          const status = (error as { statusCode?: number }).statusCode
          if (status === 404 || status === 410) expired.push(s.id)
          else console.error("Erro ao enviar push:", status, (error as Error).message)
        }
      })
    )

    if (expired.length) await supabase.from("push_subscriptions").delete().in("id", expired)
    if (delivered.length) {
      await supabase.from("push_subscriptions").update({ last_success_at: new Date().toISOString() }).in("id", delivered)
    }
    result.sent = delivered.length
    result.removed = expired.length
  } catch (error) {
    console.error("Erro ao enviar notificações push:", error)
  }
  return result
}
