/**
 * Utilitários para feeds de calendário (ICS, RFC 5545), usados pela escala
 * (/api/escalas/ics) e pelas reservas (/api/reservas/ics).
 */

const BRT_OFFSET_HOURS = 3 // Brasília = UTC-3 (sem horário de verão desde 2019)

export const icsEscape = (v: string) =>
  v.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n")

/** Quebra linhas longas (RFC 5545: máx. 75 octetos por linha) */
export function fold(line: string): string {
  const out: string[] = []
  let current = ""
  for (const ch of line) {
    if (Buffer.byteLength(current + ch) > 73) {
      out.push(current)
      current = " " + ch
    } else {
      current += ch
    }
  }
  out.push(current)
  return out.join("\r\n")
}

/** Data e hora de Brasília → carimbo UTC do ICS (ex.: 20261116T210000Z) */
export function utcStamp(date: string, time: string, plusHours = 0): string {
  const [y, m, d] = date.split("-").map(Number)
  const [hh, mm] = time.split(":").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, hh + BRT_OFFSET_HOURS + plusHours, mm))
  return dt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
}

/** Carimbo UTC de agora, para DTSTAMP */
export function nowStamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
}

/** Resposta HTTP do feed */
export function icsResponse(lines: string[], filename: string): Response {
  return new Response(lines.map(fold).join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "public, max-age=900",
    },
  })
}
