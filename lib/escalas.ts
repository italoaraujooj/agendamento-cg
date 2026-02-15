/**
 * Gera os eventos da programação fixa da igreja para um período (mês).
 * - Cultos dominicais: 10h e 18h
 * - Culto de oração: quartas-feiras 19h
 * - Primeira semana do mês: culto de jejum e oração, seg-sex 19h30
 */

const CHURCH_FIXED_EVENTS = {
  sunday: [
    { time: "10:00:00", title: "Culto Dominical - Manhã" },
    { time: "18:00:00", title: "Culto Dominical - Noite" },
  ],
  wednesday: [{ time: "19:00:00", title: "Culto de Oração" }],
  firstWeekWeekdays: { time: "19:30:00", title: "Culto de Jejum e Oração" },
} as const

export interface ChurchFixedEventRow {
  period_id: string
  event_date: string
  event_time: string
  title: string
  event_type: "regular"
  source: "regular_calendar"
}

/**
 * Gera a lista de eventos da programação fixa para o intervalo de datas.
 */
export function buildChurchFixedEvents(
  periodId: string,
  startDate: string,
  endDate: string
): ChurchFixedEventRow[] {
  const events: ChurchFixedEventRow[] = []
  const start = new Date(startDate + "T12:00:00")
  const end = new Date(endDate + "T12:00:00")

  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10)
    const dayOfWeek = d.getDay()
    const dayOfMonth = d.getDate()

    // Domingos (0): 10h e 18h
    if (dayOfWeek === 0) {
      for (const ev of CHURCH_FIXED_EVENTS.sunday) {
        events.push({
          period_id: periodId,
          event_date: dateStr,
          event_time: ev.time,
          title: ev.title,
          event_type: "regular",
          source: "regular_calendar",
        })
      }
    }

    // Quartas-feiras (3): 19h — exceto na primeira semana (jejum: só 19h30)
    if (dayOfWeek === 3 && dayOfMonth > 7) {
      for (const ev of CHURCH_FIXED_EVENTS.wednesday) {
        events.push({
          period_id: periodId,
          event_date: dateStr,
          event_time: ev.time,
          title: ev.title,
          event_type: "regular",
          source: "regular_calendar",
        })
      }
    }

    // Primeira semana (dias 1 a 7), segunda a sexta: 19h30
    if (dayOfMonth <= 7 && dayOfWeek >= 1 && dayOfWeek <= 5) {
      events.push({
        period_id: periodId,
        event_date: dateStr,
        event_time: CHURCH_FIXED_EVENTS.firstWeekWeekdays.time,
        title: CHURCH_FIXED_EVENTS.firstWeekWeekdays.title,
        event_type: "regular",
        source: "regular_calendar",
      })
    }
  }

  return events
}
