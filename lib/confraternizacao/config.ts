/**
 * Configuração da confraternização de fim de ano (página temporária).
 *
 * Dados do evento e do recebedor do PIX vêm do ambiente, para trocar sem
 * deploy de código. Só é lido no servidor: a página recebe o que precisa
 * pela API (/api/confraternizacao/resumo).
 */

/** Valor da inscrição por pessoa pagante, em reais. */
export const PRICE_PER_PERSON = 15

/** Crianças até esta idade (inclusive) não pagam. */
export const FREE_MAX_AGE = 9

/** Máximo de participantes numa inscrição (evita abuso do formulário público). */
export const MAX_PARTICIPANTS = 20

/** Maior doação aceita num PIX (evita valores digitados errado). */
export const MAX_DONATION = 5000

export function isFreeAge(age: number) {
  return age <= FREE_MAX_AGE
}

export function eventInfo() {
  return {
    title: process.env.CONFRA_EVENTO_TITULO || "Confraternização de Fim de Ano",
    /** AAAA-MM-DD */
    date: process.env.CONFRA_EVENTO_DATA || null,
    time: process.env.CONFRA_EVENTO_HORARIO || null,
    location: process.env.CONFRA_EVENTO_LOCAL || null,
    /** AAAA-MM-DD: último dia de inscrição (inclusive, horário de Brasília) */
    deadline: process.env.CONFRA_INSCRICOES_ATE || null,
  }
}

/** Hoje em Brasília, AAAA-MM-DD. */
export function todaySP() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date())
}

/** Inscrições abertas até o fim do dia do prazo (sem prazo = sempre abertas). */
export function registrationsOpen() {
  const { deadline } = eventInfo()
  return !deadline || todaySP() <= deadline
}

/** Já passou do dia do evento: não precisa mais conferir pagamentos. */
export function eventIsOver() {
  const { date } = eventInfo()
  return !!date && todaySP() > date
}

export interface PixReceiver {
  key: string
  name: string
  city: string
}

export function pixReceiver(): PixReceiver | null {
  const key = process.env.CONFRA_PIX_KEY?.trim()
  const name = process.env.CONFRA_PIX_NAME?.trim()
  const city = process.env.CONFRA_PIX_CITY?.trim()
  if (!key || !name || !city) return null
  return { key, name, city }
}
