"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronDown, Lightbulb, ListChecks, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { groupBySection, type ManualChecklistItem, type ManualSuggestion } from "@/lib/escalas/manual"
import { SuggestStepDialog } from "./suggest-step-dialog"
import { EmptyState } from "./empty-state"

interface ChecklistTabProps {
  items: ManualChecklistItem[]
  doneToday: string[]
  mySuggestions: ManualSuggestion[]
  ministryId: string
  areaId: string
  onDoneChange: (done: string[]) => void
  onSuggested: (s: ManualSuggestion) => void
}

/**
 * Sequência de passos da área. As marcações são só do servo e valem para o
 * dia de hoje — é um auxílio durante o serviço, não uma fiscalização.
 */
export function ChecklistTab({ items, doneToday, mySuggestions, ministryId, areaId, onDoneChange, onSuggested }: ChecklistTabProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const done = new Set(doneToday)
  const doneCount = items.filter((i) => done.has(i.id)).length
  const percent = items.length ? Math.round((doneCount / items.length) * 100) : 0

  const save = async (itemIds: string[], value: boolean, previous: string[]) => {
    try {
      const res = await fetch("/api/escalas/manual/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_ids: itemIds, done: value }),
      })
      if (!res.ok) throw new Error()
    } catch {
      onDoneChange(previous)
      toast.error("Não foi possível salvar. Verifique a conexão.")
    }
  }

  const toggle = (id: string) => {
    const previous = [...doneToday]
    const value = !done.has(id)
    onDoneChange(value ? [...doneToday, id] : doneToday.filter((x) => x !== id))
    save([id], value, previous)
  }

  const restart = () => {
    const previous = [...doneToday]
    const ids = items.map((i) => i.id).filter((id) => done.has(id))
    if (!ids.length) return
    onDoneChange([])
    save(ids, false, previous)
  }

  const toggleDetails = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const suggestButton = (
    <SuggestStepDialog ministryId={ministryId} areaId={areaId} sections={[...new Set(items.map((i) => i.section).filter(Boolean) as string[])]} onSuggested={onSuggested}>
      <Button variant="outline" size="sm">
        <Lightbulb className="h-4 w-4" />
        Sugerir um passo
      </Button>
    </SuggestStepDialog>
  )

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState icon={ListChecks} title="Este manual ainda não tem passos" description="Conhece a sequência de trabalho desta área? Sugira os passos para o líder aprovar." action={suggestButton} />
        <PendingSuggestions suggestions={mySuggestions} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Progresso do dia */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">
              {doneCount === items.length ? "Tudo pronto por hoje!" : `${doneCount} de ${items.length} passos feitos hoje`}
            </p>
            <p className="text-xs text-muted-foreground">Só você vê suas marcações. Elas recomeçam a cada dia.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={restart} disabled={doneCount === 0}>
            <RotateCcw className="h-4 w-4" />
            Recomeçar
          </Button>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <div className={cn("h-full rounded-full transition-all", doneCount === items.length ? "bg-success" : "bg-brand")} style={{ width: `${percent}%` }} />
        </div>
      </div>

      {groupBySection(items).map((group, gi) => (
        <section key={group.section ?? `sem-secao-${gi}`} className="space-y-2">
          {group.section && <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.section}</h3>}
          <ol className="space-y-2">
            {group.items.map((item) => {
              const checked = done.has(item.id)
              const open = expanded.has(item.id)
              return (
                <li key={item.id} className={cn("rounded-lg border bg-card transition-colors", checked && "bg-success/5 border-success/30")}>
                  <div className="flex items-start gap-3 p-3">
                    <Checkbox
                      id={`step-${item.id}`}
                      checked={checked}
                      onCheckedChange={() => toggle(item.id)}
                      className="mt-0.5 h-6 w-6 rounded-md"
                    />
                    <label htmlFor={`step-${item.id}`} className={cn("flex-1 text-sm font-medium leading-6 cursor-pointer select-none", checked && "text-muted-foreground line-through")}>
                      {item.title}
                    </label>
                    {item.details && (
                      <button
                        type="button"
                        onClick={() => toggleDetails(item.id)}
                        className="p-1 -m-1 text-muted-foreground hover:text-foreground"
                        aria-expanded={open}
                        aria-label={open ? "Esconder detalhes" : "Ver detalhes"}
                      >
                        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
                      </button>
                    )}
                  </div>
                  {item.details && open && (
                    <p className="px-3 pb-3 pl-12 text-sm text-muted-foreground whitespace-pre-line break-words">{item.details}</p>
                  )}
                </li>
              )
            })}
          </ol>
        </section>
      ))}

      <div className="flex justify-center pt-2">{suggestButton}</div>
      <PendingSuggestions suggestions={mySuggestions} />
    </div>
  )
}

function PendingSuggestions({ suggestions }: { suggestions: ManualSuggestion[] }) {
  if (!suggestions.length) return null
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Suas sugestões</h3>
      {suggestions.map((s) => (
        <div key={s.id} className="flex items-start justify-between gap-3 rounded-lg border border-dashed p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium break-words">{s.title}</p>
            {s.section && <p className="text-xs text-muted-foreground">{s.section}</p>}
          </div>
          <Badge variant="warning" className="shrink-0">Aguardando aprovação</Badge>
        </div>
      ))}
    </div>
  )
}
