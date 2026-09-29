"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Check, Loader2, Minus, Plus, X } from "lucide-react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { AssignmentLogAction, AssignmentLogEntry, ScheduleEvent } from "@/types/escalas"

const ACTION_META: Record<AssignmentLogAction, { label: string; icon: typeof Plus; className: string }> = {
  added: { label: "escalou", icon: Plus, className: "text-success" },
  removed: { label: "removeu", icon: Minus, className: "text-muted-foreground" },
  accepted: { label: "confirmou", icon: Check, className: "text-success" },
  declined: { label: "recusou", icon: X, className: "text-destructive" },
}

interface HistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  periodId: string
  events: ScheduleEvent[]
}

/** Histórico de alterações da escala do período (mais recentes primeiro). */
export function HistoryDialog({ open, onOpenChange, periodId, events }: HistoryDialogProps) {
  const [entries, setEntries] = useState<AssignmentLogEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setEntries(null)
    setError(null)
    fetch(`/api/escalas/schedule-periods/${periodId}/history`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Erro ao carregar histórico")
        setEntries(data)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar histórico"))
  }, [open, periodId])

  const eventLabel = useMemo(() => {
    const map = new Map(events.map((e) => [e.id, e]))
    return (id: string | null) => {
      const e = id ? map.get(id) : null
      return e ? `${format(parseISO(e.event_date), "EEE dd/MM", { locale: ptBR })} ${e.event_time.slice(0, 5)} — ${e.title}` : "evento removido"
    }
  }, [events])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Histórico da escala</DialogTitle>
          <DialogDescription>Quem entrou, saiu, confirmou ou recusou — e quem fez a alteração.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {error && <p className="text-sm text-destructive py-6 text-center">{error}</p>}
          {!error && entries === null && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {entries?.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma alteração registrada ainda.</p>
          )}
          <ul className="space-y-2">
            {entries?.map((entry) => {
              const meta = ACTION_META[entry.action]
              const Icon = meta.icon
              return (
                <li key={entry.id} className="flex gap-3 text-sm border-b pb-2 last:border-0">
                  <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${meta.className}`} />
                  <div className="min-w-0 flex-1">
                    <p>
                      <span className="font-medium">{entry.actor_label ?? "Alguém"}</span>{" "}
                      {meta.label}{" "}
                      {entry.action === "added" || entry.action === "removed" ? (
                        <span className="font-medium">{entry.servant_name ?? "—"}</span>
                      ) : null}
                      {entry.area_name && <span className="text-muted-foreground"> · {entry.area_name}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground first-letter:uppercase">
                      {eventLabel(entry.schedule_event_id)}
                      {entry.details && <span className="normal-case"> · {entry.details}</span>}
                    </p>
                  </div>
                  <time className="text-xs text-muted-foreground whitespace-nowrap" dateTime={entry.created_at}>
                    {format(new Date(entry.created_at), "dd/MM HH:mm")}
                  </time>
                </li>
              )
            })}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  )
}
