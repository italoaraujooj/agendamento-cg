import { createHmac, timingSafeEqual } from "crypto"

/**
 * Token pessoal de disponibilidade.
 *
 * Após o servo se identificar no link público do período, o servidor emite
 * um token assinado (HMAC) vinculado ao par servo+período. O envio e a
 * edição da disponibilidade exigem esse token, impedindo que alguém com o
 * link do período altere as respostas de outra pessoa.
 */

function secret(): string {
  const key = process.env.AVAILABILITY_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error("AVAILABILITY_TOKEN_SECRET/SUPABASE_SERVICE_ROLE_KEY não configurada")
  return key
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url")
}

function safeEqual(expected: string, token: string | null | undefined): boolean {
  if (!token) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(token)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function signAvailabilityToken(servantId: string, periodId: string): string {
  return sign(`availability:${servantId}:${periodId}`)
}

export function verifyAvailabilityToken(
  servantId: string,
  periodId: string,
  token: string | null | undefined
): boolean {
  return safeEqual(signAvailabilityToken(servantId, periodId), token)
}

/** Link pessoal da escala publicada (aceitar / recusar) */
export function signScheduleToken(servantId: string, periodId: string): string {
  return sign(`schedule:${servantId}:${periodId}`)
}

export function verifyScheduleToken(
  servantId: string,
  periodId: string,
  token: string | null | undefined
): boolean {
  return safeEqual(signScheduleToken(servantId, periodId), token)
}

/** Feed de calendário (ICS) da pessoa: `${servantId}.${assinatura}` */
export function signCalendarToken(servantId: string): string {
  return `${servantId}.${sign(`ics:${servantId}`)}`
}

export function verifyCalendarToken(token: string): string | null {
  const [servantId, sig] = token.split(".")
  if (!servantId || !sig) return null
  return safeEqual(sign(`ics:${servantId}`), sig) ? servantId : null
}
