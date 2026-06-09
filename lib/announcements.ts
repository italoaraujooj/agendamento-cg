export function getNextEligibleSunday(from: Date): Date {
  const day = from.getDay() // 0=Dom, 5=Sex, 6=Sáb
  // Sáb ou Dom: perdeu o deadline desta semana → domingo da semana seguinte
  let daysToAdd: number
  if (day === 0) {
    daysToAdd = 7
  } else if (day === 6) {
    daysToAdd = 8
  } else {
    daysToAdd = 7 - day
  }
  const d = new Date(from)
  d.setDate(from.getDate() + daysToAdd)
  d.setHours(0, 0, 0, 0)
  return d
}

export function getLastSundayBeforeDate(eventDate: Date): Date {
  const day = eventDate.getDay()
  const d = new Date(eventDate)
  d.setDate(eventDate.getDate() - (day === 0 ? 7 : day))
  d.setHours(0, 0, 0, 0)
  return d
}

export function sundaysBetween(first: Date, last: Date): Date[] {
  const result: Date[] = []
  const cur = new Date(first)
  cur.setHours(0, 0, 0, 0)
  const end = new Date(last)
  end.setHours(0, 0, 0, 0)
  while (cur <= end) {
    result.push(new Date(cur))
    cur.setDate(cur.getDate() + 7)
  }
  return result
}

export function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + weeks * 7)
  return d
}

export function formatSunday(date: Date): string {
  return date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })
}
