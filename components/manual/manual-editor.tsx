"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { ManualData, ManualKind } from "@/lib/escalas/manual"

type Row = Record<string, any> & { id: string; is_active: boolean }

interface FieldDef {
  name: string
  label: string
  placeholder?: string
  textarea?: boolean
  required?: boolean
  max: number
  type?: string
}

const CONFIG: Record<ManualKind, { noun: string; fields: FieldDef[]; titleOf: (r: Row) => string; subtitleOf: (r: Row) => string | null }> = {
  checklist: {
    noun: "passo",
    fields: [
      { name: "title", label: "Passo", placeholder: "Ex.: Ligar a mesa de som", required: true, max: 200 },
      { name: "details", label: "Detalhes (opcional)", placeholder: "Como fazer, onde fica, cuidados...", textarea: true, max: 2000 },
      { name: "section", label: "Momento (opcional)", placeholder: "Ex.: Antes do culto", max: 60 },
    ],
    titleOf: (r) => r.title,
    subtitleOf: (r) => r.section,
  },
  troubleshooting: {
    noun: "problema",
    fields: [
      { name: "problem", label: "Problema", placeholder: "Ex.: Microfone sem som", required: true, max: 200 },
      { name: "solution", label: "Solução", placeholder: "O que verificar e como resolver, passo a passo", textarea: true, required: true, max: 4000 },
    ],
    titleOf: (r) => r.problem,
    subtitleOf: () => null,
  },
  videos: {
    noun: "vídeo",
    fields: [
      { name: "title", label: "Título", placeholder: "Ex.: Como operar a mesa de som", required: true, max: 200 },
      { name: "url", label: "Link", placeholder: "https://www.youtube.com/watch?v=...", required: true, max: 500, type: "url" },
      { name: "description", label: "Descrição (opcional)", textarea: true, max: 1000 },
    ],
    titleOf: (r) => r.title,
    subtitleOf: (r) => r.url,
  },
}

const DATA_KEY: Record<ManualKind, keyof Pick<ManualData, "checklist" | "troubleshooting" | "videos">> = {
  checklist: "checklist",
  troubleshooting: "troubleshooting",
  videos: "videos",
}

/** Lista editável de um tipo de conteúdo do manual, no escopo exato (área ou geral) */
export function ManualEditor({ kind, ministryId, areaId, scopeLabel }: { kind: ManualKind; ministryId: string; areaId: string; scopeLabel: string }) {
  const config = CONFIG[kind]
  const [rows, setRows] = useState<Row[] | null>(null)
  const [editing, setEditing] = useState<Row | "new" | null>(null)
  const [deleting, setDeleting] = useState<Row | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/escalas/manual?ministry_id=${ministryId}&area_id=${areaId}&exact=1&include_inactive=1`)
    const json = await res.json()
    if (!res.ok) {
      toast.error(json.error || "Erro ao carregar")
      setRows([])
      return
    }
    setRows(json[DATA_KEY[kind]])
  }, [ministryId, areaId, kind])

  useEffect(() => {
    setRows(null)
    load()
  }, [load])

  const call = async (method: string, query: string, body?: unknown) => {
    const res = await fetch(`/api/escalas/manual/content/${kind}${query}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error || "Erro ao salvar")
    return json
  }

  const act = async (key: string, fn: () => Promise<unknown>, success?: string) => {
    setBusy(key)
    try {
      await fn()
      if (success) toast.success(success)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar")
    } finally {
      setBusy(null)
    }
  }

  if (!rows) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {scopeLabel} · {rows.length === 1 ? `1 ${config.noun}` : `${rows.length} ${config.noun === "problema" ? "problemas" : config.noun === "vídeo" ? "vídeos" : "passos"}`}
        </p>
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" />
          Adicionar {config.noun}
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nada cadastrado aqui ainda. Use “Adicionar {config.noun}”.
        </p>
      ) : (
        <ol className="space-y-2">
          {rows.map((row, i) => {
            const subtitle = config.subtitleOf(row)
            return (
              <li key={row.id} className={cn("flex items-start gap-2 rounded-lg border bg-card p-3", !row.is_active && "opacity-60")}>
                <span className="mt-0.5 w-6 shrink-0 text-xs font-medium text-muted-foreground tabular-nums">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium break-words">{config.titleOf(row)}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    {subtitle && <span className="text-xs text-muted-foreground break-all">{subtitle}</span>}
                    {!row.is_active && <Badge variant="outline" className="text-xs">Oculto</Badge>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center">
                  <Button variant="ghost" size="icon" className="h-8 w-8" disabled={i === 0 || !!busy} onClick={() => act(`up-${row.id}`, () => call("PATCH", `?id=${row.id}`, { move: "up" }))} aria-label="Subir">
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" disabled={i === rows.length - 1 || !!busy} onClick={() => act(`down-${row.id}`, () => call("PATCH", `?id=${row.id}`, { move: "down" }))} aria-label="Descer">
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={!!busy}
                    onClick={() => act(`vis-${row.id}`, () => call("PATCH", `?id=${row.id}`, { is_active: !row.is_active }))}
                    aria-label={row.is_active ? "Ocultar dos servos" : "Mostrar aos servos"}
                    title={row.is_active ? "Ocultar dos servos" : "Mostrar aos servos"}
                  >
                    {row.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(row)} aria-label="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleting(row)} aria-label="Remover">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      <ItemDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === "new" ? `Adicionar ${config.noun}` : `Editar ${config.noun}`}
        description={scopeLabel}
        fields={config.fields}
        initial={editing && editing !== "new" ? editing : {}}
        onSubmit={async (values) => {
          if (editing === "new") await call("POST", "", { ...values, ministry_id: ministryId, area_id: areaId })
          else if (editing) await call("PATCH", `?id=${editing.id}`, values)
          setEditing(null)
          toast.success("Salvo")
          await load()
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {config.noun}?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting ? config.titleOf(deleting) : ""}” será removido do manual. Para só esconder dos servos, use o botão de ocultar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleting && act(`del-${deleting.id}`, () => call("DELETE", `?id=${deleting.id}`), "Removido")}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Salvando" />}
    </div>
  )
}

interface ItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  fields: FieldDef[]
  initial: Record<string, any>
  submitLabel?: string
  onSubmit: (values: Record<string, string>) => Promise<void>
}

/** Formulário em diálogo, montado a partir da lista de campos */
export function ItemDialog({ open, onOpenChange, title, description, fields, initial, submitLabel = "Salvar", onSubmit }: ItemDialogProps) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setValues(Object.fromEntries(fields.map((f) => [f.name, initial[f.name] ?? ""])))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSubmit(values)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {fields.map((f) => (
            <div key={f.name} className="space-y-1.5">
              <Label htmlFor={`f-${f.name}`}>{f.label}</Label>
              {f.textarea ? (
                <Textarea id={`f-${f.name}`} value={values[f.name] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} placeholder={f.placeholder} maxLength={f.max} required={f.required} rows={4} />
              ) : (
                <Input id={`f-${f.name}`} type={f.type ?? "text"} value={values[f.name] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} placeholder={f.placeholder} maxLength={f.max} required={f.required} />
              )}
            </div>
          ))}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export const CHECKLIST_FIELDS = CONFIG.checklist.fields
