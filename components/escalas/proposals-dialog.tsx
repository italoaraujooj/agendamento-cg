"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertTriangle, Loader2 } from "lucide-react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"
import type { Area, ScheduleEvent, Servant } from "@/types/escalas"
import { plural } from "@/lib/plural"

export interface AssignmentProposal {
  event_id: string
  area_id: string
  servant_id: string
  notes: string[]
}

interface ProposalsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  periodId: string
  proposals: AssignmentProposal[]
  /** Vagas que ficaram sem candidato (só na sugestão automática) */
  unfilled?: { event_id: string; area_id: string; missing: number }[]
  events: ScheduleEvent[]
  areas: Area[]
  servants: Servant[]
  /** Origem das propostas, registrada no histórico */
  source?: "suggest" | "copy"
  onApplied: () => void
}

const keyOf = (p: AssignmentProposal) => `${p.event_id}|${p.area_id}|${p.servant_id}`

/** Revisão de atribuições propostas: o líder desmarca o que não quer e aplica. */
export function ProposalsDialog({
  open,
  onOpenChange,
  title,
  description,
  periodId,
  proposals,
  unfilled = [],
  events,
  areas,
  servants,
  source,
  onApplied,
}: ProposalsDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    if (open) setSelected(new Set(proposals.map(keyOf)))
  }, [open, proposals])

  const eventById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events])
  const areaName = useMemo(() => new Map(areas.map((a) => [a.id, a.name])), [areas])
  const servantName = useMemo(() => new Map(servants.map((s) => [s.id, s.name])), [servants])

  const byEvent = useMemo(() => {
    const groups = new Map<string, AssignmentProposal[]>()
    for (const p of proposals) groups.set(p.event_id, [...(groups.get(p.event_id) ?? []), p])
    return [...groups.entries()].sort(([a], [b]) => {
      const ea = eventById.get(a)
      const eb = eventById.get(b)
      return `${ea?.event_date}${ea?.event_time}`.localeCompare(`${eb?.event_date}${eb?.event_time}`)
    })
  }, [proposals, eventById])

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const apply = async () => {
    const chosen = proposals.filter((p) => selected.has(keyOf(p)))
    if (chosen.length === 0) return
    setApplying(true)
    try {
      const res = await fetch(`/api/escalas/schedule-periods/${periodId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignments: chosen.map((p) => ({ schedule_event_id: p.event_id, servant_id: p.servant_id, area_id: p.area_id })),
          source,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao aplicar")
      toast.success(plural(data.created, "atribuição criada", "atribuições criadas"), {
        description: data.skipped?.length
          ? `${plural(data.skipped.length, "ignorada", "ignoradas")}: ${[...new Set(data.skipped.map((s: { reason: string }) => s.reason))].join(", ")}`
          : undefined,
      })
      onOpenChange(false)
      onApplied()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao aplicar")
    } finally {
      setApplying(false)
    }
  }

  const eventLabel = (id: string) => {
    const e = eventById.get(id)
    return e ? `${format(parseISO(e.event_date), "EEE, dd/MM", { locale: ptBR })} · ${e.event_time.slice(0, 5)} — ${e.title}` : "—"
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto space-y-4 pr-1">
          {proposals.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma atribuição a propor.</p>
          )}
          {byEvent.map(([eventId, items]) => (
            <div key={eventId} className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {eventLabel(eventId)}
              </p>
              {items.map((p) => {
                const key = keyOf(p)
                return (
                  <label
                    key={key}
                    className="flex items-start gap-2.5 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50"
                  >
                    <Checkbox checked={selected.has(key)} onCheckedChange={() => toggle(key)} className="mt-0.5" />
                    <span className="text-sm flex-1 min-w-0">
                      <span className="font-medium">{servantName.get(p.servant_id) ?? "—"}</span>
                      <span className="text-muted-foreground"> · {areaName.get(p.area_id) ?? "—"}</span>
                      {p.notes.length > 0 && (
                        <span className="block text-xs text-warning">{p.notes.join(" · ")}</span>
                      )}
                    </span>
                  </label>
                )
              })}
            </div>
          ))}

          {unfilled.length > 0 && (
            <div className="rounded-md border border-warning/30 bg-warning/10 p-3 space-y-1">
              <p className="text-sm font-medium flex items-center gap-1.5 text-warning">
                <AlertTriangle className="h-4 w-4" />
                Vagas sem candidato disponível
              </p>
              {unfilled.map((u) => (
                <p key={`${u.event_id}-${u.area_id}`} className="text-xs text-warning">
                  {eventLabel(u.event_id)} · {areaName.get(u.area_id)} (faltam {u.missing})
                </p>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>
            Cancelar
          </Button>
          <Button onClick={apply} disabled={applying || selected.size === 0}>
            {applying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Aplicar {selected.size}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
