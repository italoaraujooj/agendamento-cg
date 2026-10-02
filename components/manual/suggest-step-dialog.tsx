"use client"

import { useState, type ReactNode } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { ManualSuggestion } from "@/lib/escalas/manual"

interface SuggestStepDialogProps {
  ministryId: string
  areaId: string
  sections: string[]
  onSuggested: (s: ManualSuggestion) => void
  children: ReactNode
}

/** O servo sugere um passo; ele só entra no checklist depois da aprovação do líder */
export function SuggestStepDialog({ ministryId, areaId, sections, onSuggested, children }: SuggestStepDialogProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [details, setDetails] = useState("")
  const [section, setSection] = useState("")
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch("/api/escalas/manual/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ministry_id: ministryId, area_id: areaId, title, details, section }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao enviar")
      onSuggested(data)
      toast.success("Sugestão enviada", { description: "Ela entra no checklist depois que o líder aprovar." })
      setTitle("")
      setDetails("")
      setSection("")
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sugerir um passo</DialogTitle>
          <DialogDescription>Sua sugestão vai para o líder, que pode aprová-la e incluí-la no checklist.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sug-title">Passo</Label>
            <Input id="sug-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Testar os microfones sem fio" maxLength={200} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sug-details">Detalhes (opcional)</Label>
            <Textarea id="sug-details" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Como fazer, onde fica, cuidados..." maxLength={2000} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sug-section">Momento (opcional)</Label>
            <Input id="sug-section" value={section} onChange={(e) => setSection(e.target.value)} placeholder="Ex.: Antes do culto" maxLength={60} list="sug-sections" />
            <datalist id="sug-sections">
              {sections.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || title.trim().length < 3}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Enviar sugestão
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
