"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Check, Inbox, Loader2, X } from "lucide-react"
import { toast } from "sonner"
import { format, parseISO } from "date-fns"
import type { ManualSuggestion } from "@/lib/escalas/manual"
import { CHECKLIST_FIELDS, ItemDialog } from "./manual-editor"
import { EmptyState } from "./empty-state"

/** Sugestões de passos aguardando aprovação no ministério */
export function SuggestionsPanel({ ministryId, onCountChange }: { ministryId: string; onCountChange?: (n: number) => void }) {
  const [items, setItems] = useState<ManualSuggestion[] | null>(null)
  const [approving, setApproving] = useState<ManualSuggestion | null>(null)
  const [rejecting, setRejecting] = useState<ManualSuggestion | null>(null)
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/escalas/manual/suggestions?ministry_id=${ministryId}`)
    const json = await res.json()
    const list = res.ok ? (json as ManualSuggestion[]) : []
    setItems(list)
    onCountChange?.(list.length)
  }, [ministryId, onCountChange])

  useEffect(() => {
    setItems(null)
    load()
  }, [load])

  const review = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/escalas/manual/suggestions/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error || "Erro ao salvar")
  }

  if (!items) return <Skeleton className="h-24 w-full" />
  if (items.length === 0) {
    return <EmptyState icon={Inbox} title="Nenhuma sugestão pendente" description="Quando um servo sugerir um passo para o checklist, ele aparece aqui para você aprovar." />
  }

  return (
    <div className="space-y-3">
      {items.map((s) => (
        <div key={s.id} className="rounded-lg border bg-card p-4 space-y-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{s.area_name ?? "Geral do ministério"}</Badge>
              {s.section && <Badge variant="secondary">{s.section}</Badge>}
            </div>
            <p className="font-medium break-words">{s.title}</p>
            {s.details && <p className="text-sm text-muted-foreground whitespace-pre-line break-words">{s.details}</p>}
            <p className="text-xs text-muted-foreground">
              Sugerido por {s.suggested_by_name ?? "um servo"} em {format(parseISO(s.created_at), "dd/MM/yyyy")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="success" onClick={() => setApproving(s)}>
              <Check className="h-4 w-4" />
              Aprovar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setNote("")
                setRejecting(s)
              }}
            >
              <X className="h-4 w-4" />
              Recusar
            </Button>
          </div>
        </div>
      ))}

      <ItemDialog
        open={!!approving}
        onOpenChange={(o) => !o && setApproving(null)}
        title="Aprovar sugestão"
        description="Ajuste o texto se precisar. O passo entra no fim do checklist da área."
        fields={CHECKLIST_FIELDS}
        initial={approving ?? {}}
        submitLabel="Aprovar e incluir"
        onSubmit={async (values) => {
          if (!approving) return
          await review(approving.id, { action: "approve", ...values })
          setApproving(null)
          toast.success("Passo incluído no checklist")
          await load()
        }}
      />

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recusar sugestão</DialogTitle>
            <DialogDescription className="break-words">“{rejecting?.title}”</DialogDescription>
          </DialogHeader>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Motivo (opcional)" maxLength={500} rows={3} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={saving}
              onClick={async () => {
                if (!rejecting) return
                setSaving(true)
                try {
                  await review(rejecting.id, { action: "reject", note })
                  setRejecting(null)
                  toast.success("Sugestão recusada")
                  await load()
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Erro ao salvar")
                } finally {
                  setSaving(false)
                }
              }}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Recusar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
