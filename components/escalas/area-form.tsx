"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { Area } from "@/types/escalas"

interface AreaFormProps {
  ministryId: string
  area?: Area
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function AreaForm({ ministryId, area, open, onOpenChange, onSuccess }: AreaFormProps) {
  const isEditing = !!area

  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: area?.name || "",
    description: area?.description || "",
    min_servants: area?.min_servants ?? 0,
    max_servants: area?.max_servants || "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = isEditing 
        ? `/api/escalas/areas/${area.id}`
        : "/api/escalas/areas"
      
      const payload = {
        ministry_id: ministryId,
        name: formData.name,
        description: formData.description || null,
        min_servants: Number(formData.min_servants) ?? 0,
        max_servants: formData.max_servants ? Number(formData.max_servants) : null,
      }

      const response = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Erro ao salvar área")
      }

      toast.success(isEditing ? "Área atualizada!" : "Área criada!")
      onOpenChange(false)
      onSuccess()
      
      // Reset form
      if (!isEditing) {
        setFormData({
          name: "",
          description: "",
          min_servants: 0,
          max_servants: "",
        })
      }
    } catch (error) {
      console.error("Erro ao salvar área:", error)
      toast.error(error instanceof Error ? error.message : "Erro ao salvar área")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Área" : "Nova Área"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="area-name">Nome *</Label>
              <Input
                id="area-name"
                placeholder="Ex: Projeção, Mesa de Som"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="area-description">Descrição</Label>
              <Textarea
                id="area-description"
                placeholder="Descrição da área (opcional)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                maxLength={500}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min-servants">Mín. Servos</Label>
                <Input
                  id="min-servants"
                  type="number"
                  min={0}
                  value={formData.min_servants}
                  onChange={(e) => setFormData({ ...formData, min_servants: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                />
                <p className="text-xs text-muted-foreground">
                  Mínimo necessário por evento (0 = opcional)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-servants">Máx. Servos</Label>
                <Input
                  id="max-servants"
                  type="number"
                  min={1}
                  placeholder="Sem limite"
                  value={formData.max_servants}
                  onChange={(e) => setFormData({ ...formData, max_servants: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Deixe vazio para sem limite
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !formData.name.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Salvar" : "Criar Área"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
