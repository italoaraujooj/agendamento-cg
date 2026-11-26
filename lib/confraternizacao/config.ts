/**
 * Configuração da confraternização de fim de ano (página temporária).
 *
 * Dados do evento ficam no banco (confra_settings), editados no painel de
 * administração. O recebedor do PIX vem do ambiente. Só é lido no servidor:
 * a página recebe o que precisa pela API (/api/confraternizacao/resumo).
 */

import { createAdminClient } from "@/lib/supabase/server"

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

export interface EventInfo {
  title: string
  /** AAAA-MM-DD */
  date: string | null
  time: string | null
  location: string | null
  /** Link do local no Google Maps */
  mapUrl: string | null
  /** AAAA-MM-DD: último dia de inscrição (inclusive, horário de Brasília) */
  deadline: string | null
}

export const DEFAULT_TITLE = "Confraternização de Fim de Ano"

/** Reserva para quando o evento ainda não foi salvo no painel (antes da migração 031). */
function eventFromEnv(): EventInfo {
  return {
    title: process.env.CONFRA_EVENTO_TITULO || DEFAULT_TITLE,
    date: process.env.CONFRA_EVENTO_DATA || null,
    time: process.env.CONFRA_EVENTO_HORARIO || null,
    location: process.env.CONFRA_EVENTO_LOCAL || "Vila Forró",
    mapUrl:
      process.env.CONFRA_EVENTO_MAPA ||
      "https://www.google.com/maps/place/Vila+Forr%C3%B3/@-7.2030206,-35.8756696,3919m/data=!3m1!1e3!4m6!3m5!1s0x7ac1e5cd87fc26b:0x4184729b56c162f9!8m2!3d-7.1807429!4d-35.875771!16s%2Fg%2F1thd1_zb",
    deadline: process.env.CONFRA_INSCRICOES_ATE || null,
  }
}

interface SettingsRow {
  title: string
  event_date: string | null
  event_time: string | null
  location: string | null
  map_url: string | null
  registrations_until: string | null
}

/**
 * Dados do evento: o que foi salvo no painel (tabela confra_settings) ou,
 * enquanto nada foi salvo, as variáveis de ambiente antigas.
 */
export async function eventInfo(): Promise<EventInfo> {
  const supabase = createAdminClient()
  if (!supabase) return eventFromEnv()
  const { data, error } = await supabase
    .from("confra_settings")
    .select("title, event_date, event_time, location, map_url, registrations_until")
    .eq("id", true)
    .maybeSingle<SettingsRow>()
  if (error) {
    // tabela ainda não criada (migração 031 pendente): segue com o ambiente
    if (error.code !== "42P01" && error.code !== "PGRST205") console.error("Confraternização: erro ao ler o evento:", error)
    return eventFromEnv()
  }
  if (!data) return eventFromEnv()
  return {
    title: data.title || DEFAULT_TITLE,
    date: data.event_date,
    time: data.event_time,
    location: data.location,
    mapUrl: data.map_url,
    deadline: data.registrations_until,
  }
}

/** Hoje em Brasília, AAAA-MM-DD. */
export function todaySP() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date())
}

/** Inscrições abertas até o fim do dia do prazo (sem prazo = sempre abertas). */
export function registrationsOpen(event: EventInfo) {
  return !event.deadline || todaySP() <= event.deadline
}

/** Já passou do dia do evento: não precisa mais conferir pagamentos. */
export function eventIsOver(event: EventInfo) {
  return !!event.date && todaySP() > event.date
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
