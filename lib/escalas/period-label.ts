import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

/** O que basta para nomear um período: mês inicial e, se houver, a data final. */
export interface PeriodRange {
  month: number
  year: number
  end_date?: string | null
}

/** Mês/ano final do período (igual ao inicial quando não há end_date). */
export function periodEndMonth(p: PeriodRange): { month: number; year: number } {
  if (!p.end_date) return { month: p.month, year: p.year }
  const [y, m] = p.end_date.split("-").map(Number)
  return { month: m, year: y }
}

export function isMultiMonth(p: PeriodRange): boolean {
  const end = periodEndMonth(p)
  return end.month !== p.month || end.year !== p.year
}

/**
 * Nome do período em português:
 * - "full":  "dezembro de 2026" · "novembro a dezembro de 2026" · "dezembro de 2026 a janeiro de 2027"
 * - "short": "dezembro" · "dezembro a janeiro"
 * - "slug":  "dezembro-2026" · "dezembro-2026-a-janeiro-2027" (nomes de arquivo)
 */
export function periodLabel(p: PeriodRange, variant: "full" | "short" | "slug" = "full"): string {
  const start = new Date(p.year, p.month - 1)
  const endM = periodEndMonth(p)
  const end = new Date(endM.year, endM.month - 1)
  const fmt = (d: Date, f: string) => format(d, f, { locale: ptBR })

  if (!isMultiMonth(p)) {
    if (variant === "short") return fmt(start, "MMMM")
    if (variant === "slug") return fmt(start, "MMMM-yyyy")
    return fmt(start, "MMMM 'de' yyyy")
  }

  if (variant === "short") return `${fmt(start, "MMMM")} a ${fmt(end, "MMMM")}`
  if (variant === "slug") return `${fmt(start, "MMMM-yyyy")}-a-${fmt(end, "MMMM-yyyy")}`
  if (endM.year === p.year) return `${fmt(start, "MMMM")} a ${fmt(end, "MMMM 'de' yyyy")}`
  return `${fmt(start, "MMMM 'de' yyyy")} a ${fmt(end, "MMMM 'de' yyyy")}`
}

/** Primeiro e último dia (YYYY-MM-DD) de um intervalo de meses. */
export function monthRangeDates(
  startMonth: number,
  startYear: number,
  endMonth: number,
  endYear: number
): { start_date: string; end_date: string } {
  const pad = (n: number) => String(n).padStart(2, "0")
  const lastDay = new Date(Date.UTC(endYear, endMonth, 0)).getUTCDate()
  return {
    start_date: `${startYear}-${pad(startMonth)}-01`,
    end_date: `${endYear}-${pad(endMonth)}-${pad(lastDay)}`,
  }
}

/** Quantos meses o intervalo cobre (1 = mesmo mês). */
export function monthSpan(startMonth: number, startYear: number, endMonth: number, endYear: number) {
  return (endYear - startYear) * 12 + (endMonth - startMonth) + 1
}

export const MAX_PERIOD_MONTHS = 3
