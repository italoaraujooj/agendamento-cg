"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CalendarOff, Loader2, Plus, Trash2 } from "lucide-react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"
import type { Blockout } from "@/lib/escalas/blockouts"

const todayBr = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)

/**
 * Datas bloqueadas da pessoa logada (férias, viagens). Valem em todos os
 * ministérios: a coleta de disponibilidade já vem marcada e a sugestão
 * automática não escala nessas datas.
 */
export function BlockoutsCard() {
  const [items, setItems] = useState<Blockout[] | null>(null)
  const [startsOn, setStartsOn] = useState("")
  const [endsOn, setEndsOn] = useState("")
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/escalas/blockouts")
      .then((r) => (r.ok ? r.json() : []))
      .then(setItems)
      .catch(() => setItems([]))
  }, [])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!startsOn) return
    setSaving(true)
    try {
      const res = await fetch("/api/escalas/blockouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starts_on: startsOn, ends_on: endsOn || startsOn, reason: reason.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao salvar")
      setItems((prev) => [...(prev ?? []), data].sort((a, b) => a.starts_on.localeCompare(b.starts_on)))
      setStartsOn("")
      setEndsOn("")
      setReason("")
      toast.success("Período bloqueado")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar")
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    setRemoving(id)
    try {
      const res = await fetch(`/api/escalas/blockouts?id=${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setItems((prev) => (prev ?? []).filter((b) => b.id !== id))
    } catch {
      toast.error("Erro ao remover")
    } finally {
      setRemoving(null)
    }
  }

  const label = (b: Blockout) => {
    const start = format(parseISO(b.starts_on), "dd/MM/yyyy", { locale: ptBR })
    if (b.starts_on === b.ends_on) return start
    return `${start} a ${format(parseISO(b.ends_on), "dd/MM/yyyy", { locale: ptBR })}`
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarOff className="h-4 w-4 text-primary" />
          Minhas datas bloqueadas
        </CardTitle>
        <CardDescription>
          Férias, viagens: você não é escalado nessas datas e as coletas de disponibilidade já vêm marcadas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items === null ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma data bloqueada.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                <span className="text-sm">
                  <span className="font-medium">{label(b)}</span>
                  {b.reason && <span className="text-muted-foreground"> · {b.reason}</span>}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => remove(b.id)}
                  disabled={removing === b.id}
                  aria-label="Remover período bloqueado"
                >
                  {removing === b.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={add} className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1.4fr_auto] gap-2 items-end">
          <div className="space-y-1">
            <Label htmlFor="blk-start" className="text-xs">De</Label>
            <Input id="blk-start" type="date" min={todayBr()} value={startsOn} onChange={(e) => setStartsOn(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="blk-end" className="text-xs">Até</Label>
            <Input id="blk-end" type="date" min={startsOn || todayBr()} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
          </div>
          <div className="space-y-1 col-span-2 sm:col-span-1">
            <Label htmlFor="blk-reason" className="text-xs">Motivo (opcional)</Label>
            <Input id="blk-reason" placeholder="Ex.: Férias" maxLength={100} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <Button type="submit" disabled={saving || !startsOn} className="col-span-2 sm:col-span-1">
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
            Bloquear
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
