"use client"

import { useState } from "react"
import { CalendarDays, ChevronDown, ChevronRight, Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface EventSettings {
  title: string
  date: string | null
  time: string | null
  location: string | null
  mapUrl: string | null
  deadline: string | null
}

const ymdBR = (ymd: string) => ymd.split("-").reverse().join("/")

/** Dados do evento exibidos na página pública: data, horário, local e prazo das inscrições. */
export function ConfraternizacaoEvento({ event, onSaved }: { event: EventSettings; onSaved: () => Promise<void> | void }) {
  const [open, setOpen] = useState(!event.date)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: event.title,
    date: event.date ?? "",
    time: event.time ?? "",
    location: event.location ?? "",
    mapUrl: event.mapUrl ?? "",
    deadline: event.deadline ?? "",
  })
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch("/api/confraternizacao/admin/evento", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          date: form.date || null,
          deadline: form.deadline || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Erro ao salvar")
      toast.success("Dados do evento salvos")
      await onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar o evento")
    } finally {
      setSaving(false)
    }
  }

  const summary = [
    event.date && ymdBR(event.date),
    event.time,
    event.location,
    event.deadline && `inscrições até ${ymdBR(event.deadline)}`,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <Card>
      <CardHeader className="cursor-pointer select-none" onClick={() => setOpen((o) => !o)}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5 text-primary" /> Dados do evento
            </CardTitle>
            <CardDescription className="truncate">{summary || "Data, horário e local ainda não definidos"}</CardDescription>
          </div>
          <Button variant="ghost" size="icon" aria-expanded={open} aria-label={open ? "Fechar dados do evento" : "Editar dados do evento"}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent>
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ev-title">Nome do evento</Label>
              <Input id="ev-title" value={form.title} onChange={set("title")} maxLength={120} placeholder="Confraternização de Fim de Ano" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-date">Data</Label>
              <Input id="ev-date" type="date" value={form.date} onChange={set("date")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-time">Horário</Label>
              <Input id="ev-time" value={form.time} onChange={set("time")} maxLength={40} placeholder="Ex.: 16h" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-location">Local</Label>
              <Input id="ev-location" value={form.location} onChange={set("location")} maxLength={160} placeholder="Ex.: Jardim da Vila Forró" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-deadline">Inscrições até (inclusive)</Label>
              <Input id="ev-deadline" type="date" value={form.deadline} onChange={set("deadline")} max={form.date || undefined} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ev-map">Link do local no Google Maps</Label>
              <Input id="ev-map" type="url" value={form.mapUrl} onChange={set("mapUrl")} placeholder="https://maps.app.goo.gl/..." />
              <p className="text-xs text-muted-foreground">
                Deixe o prazo das inscrições vazio para mantê-las sempre abertas. Depois do dia do evento, a conferência automática de PIX para.
              </p>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar
              </Button>
            </div>
          </form>
        </CardContent>
      )}
    </Card>
  )
}
