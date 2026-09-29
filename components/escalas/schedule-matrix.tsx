"use client"

import { useMemo } from "react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { AlertTriangle, CheckCheck, Clock, X } from "lucide-react"
import type { Area, ScheduleAssignment, ScheduleEvent } from "@/types/escalas"
import { areaCapacity, areaNeed, isFilling } from "@/lib/escalas/staffing"
import { plural } from "@/lib/plural"

interface ScheduleMatrixProps {
  events: ScheduleEvent[]
  areas: Area[]
  assignments: ScheduleAssignment[]
  /** `${servant_id}-${event_id}` com conflito de horário */
  conflictKeys: Set<string>
  selectedEventId: string | null
  onSelectCell: (eventId: string) => void
}

/**
 * Visão do mês em grade: áreas nas linhas, eventos nas colunas.
 * Verde = mínimo atingido, âmbar = faltando gente, riscado = área não se aplica.
 */
export function ScheduleMatrix({
  events,
  areas,
  assignments,
  conflictKeys,
  selectedEventId,
  onSelectCell,
}: ScheduleMatrixProps) {
  const byCell = useMemo(() => {
    const map = new Map<string, ScheduleAssignment[]>()
    for (const a of assignments) {
      const key = `${a.schedule_event_id}-${a.area_id}`
      map.set(key, [...(map.get(key) ?? []), a])
    }
    return map
  }, [assignments])

  const sorted = useMemo(
    () => [...events].sort((a, b) => `${a.event_date}${a.event_time}`.localeCompare(`${b.event_date}${b.event_time}`)),
    [events]
  )

  const firstName = (a: ScheduleAssignment) =>
    ((a.servant as { name?: string } | null)?.name ?? "—").split(" ").slice(0, 2).join(" ")

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="text-sm border-collapse">
        <thead>
          <tr className="bg-muted/50">
            <th className="sticky left-0 z-10 bg-muted text-left font-medium px-3 py-2 min-w-[120px] border-b border-r">
              Área
            </th>
            {sorted.map((e) => (
              <th
                key={e.id}
                className={`font-medium px-2 py-2 min-w-[130px] border-b text-left align-bottom ${
                  e.id === selectedEventId ? "bg-primary/10" : ""
                }`}
              >
                <button type="button" onClick={() => onSelectCell(e.id)} className="text-left hover:underline">
                  <span className="block first-letter:uppercase">
                    {format(parseISO(e.event_date), "EEE dd/MM", { locale: ptBR })}
                  </span>
                  <span className="block text-xs text-muted-foreground font-normal truncate max-w-[130px]">
                    {e.event_time.slice(0, 5)} · {e.title}
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {areas.map((area) => {
            const need = areaNeed(area)
            const cap = areaCapacity(area)
            return (
              <tr key={area.id}>
                <th className="sticky left-0 z-10 bg-background text-left font-medium px-3 py-2 border-b border-r align-top">
                  {area.name}
                  <span className="block text-xs text-muted-foreground font-normal">
                    {cap !== null ? (need === cap ? plural(need, "pessoa", "pessoas") : `${need} a ${cap} pessoas`) : need > 1 ? `mín. ${need}` : ""}
                  </span>
                </th>
                {sorted.map((e) => {
                  const applies = !e.requires_areas || e.requires_areas.length === 0 || e.requires_areas.includes(area.id)
                  const list = byCell.get(`${e.id}-${area.id}`) ?? []
                  const filled = list.filter(isFilling).length
                  const complete = filled >= need
                  return (
                    <td
                      key={e.id}
                      onClick={() => onSelectCell(e.id)}
                      className={`border-b px-2 py-1.5 align-top cursor-pointer transition-colors ${
                        !applies
                          ? "bg-muted/40 text-muted-foreground"
                          : complete
                            ? "bg-success/10 hover:bg-success/15"
                            : "bg-warning/10 hover:bg-warning/15"
                      } ${e.id === selectedEventId ? "ring-1 ring-inset ring-primary/40" : ""}`}
                    >
                      {!applies ? (
                        <span className="text-xs italic">n/a</span>
                      ) : (
                        <div className="space-y-0.5">
                          {list.map((a) => {
                            const declined = a.status === "declined"
                            const conflict = !declined && conflictKeys.has(`${a.servant_id}-${a.schedule_event_id}`)
                            return (
                              <div key={a.id} className="flex items-center gap-1 text-xs">
                                {declined ? (
                                  <X className="h-3 w-3 text-destructive flex-shrink-0" />
                                ) : a.status === "accepted" ? (
                                  <CheckCheck className="h-3 w-3 text-success flex-shrink-0" />
                                ) : a.notified_at ? (
                                  <Clock className="h-3 w-3 text-warning flex-shrink-0" />
                                ) : null}
                                {conflict && <AlertTriangle className="h-3 w-3 text-warning flex-shrink-0" />}
                                <span className={`truncate max-w-[110px] ${declined ? "line-through text-muted-foreground" : ""}`}>
                                  {firstName(a)}
                                </span>
                              </div>
                            )
                          })}
                          {!complete && (
                            <span className="block text-xs text-warning">
                              {filled}/{need}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
