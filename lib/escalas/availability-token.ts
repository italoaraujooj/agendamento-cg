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

export function signAvailabilityToken(servantId: string, periodId: string): string {
  return createHmac("sha256", secret())
    .update(`availability:${servantId}:${periodId}`)
    .digest("base64url")
}

export function verifyAvailabilityToken(
  servantId: string,
  periodId: string,
  token: string | null | undefined
): boolean {
  if (!token) return false
  const expected = Buffer.from(signAvailabilityToken(servantId, periodId))
  const received = Buffer.from(token)
  return expected.length === received.length && timingSafeEqual(expected, received)
}
