"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { MINISTRY_COLORS } from "@/types/escalas"
import type { Ministry } from "@/types/escalas"

interface MinistryFormProps {
  ministry?: Ministry
  onSuccess?: () => void
}

export function MinistryForm({ ministry, onSuccess }: MinistryFormProps) {
  const router = useRouter()
  const isEditing = !!ministry

  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: ministry?.name || "",
    description: ministry?.description || "",
    color: ministry?.color || MINISTRY_COLORS[0],
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = isEditing 
        ? `/api/escalas/ministries/${ministry.id}`
        : "/api/escalas/ministries"
      
      const response = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Erro ao salvar ministério")
      }

      toast.success(isEditing ? "Ministério atualizado!" : "Ministério criado!")
      
      if (onSuccess) {
        onSuccess()
      } else {
        router.push(`/ministerios/${data.id}`)
      }
    } catch (error) {
      console.error("Erro ao salvar ministério:", error)
      toast.error(error instanceof Error ? error.message : "Erro ao salvar ministério")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? "Editar Ministério" : "Novo Ministério"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              placeholder="Ex: Multimídia"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              placeholder="Descrição do ministério (opcional)"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              maxLength={500}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Cor de Identificação</Label>
            <div className="flex flex-wrap gap-2">
              {MINISTRY_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    formData.color === color
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setFormData({ ...formData, color })}
                  title={color}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Label htmlFor="custom-color" className="text-sm">Cor personalizada:</Label>
              <Input
                id="custom-color"
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-12 h-8 p-0 border-0"
              />
              <span className="text-sm text-muted-foreground">{formData.color}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading || !formData.name.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Salvar Alterações" : "Criar Ministério"}
            </Button>
            <Button 
              type="button" 
              variant="outline"
              onClick={() => router.back()}
            >
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
