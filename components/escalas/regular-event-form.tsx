"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase/client"
import type { RegularEvent, Ministry } from "@/types/escalas"
import { DAY_OF_WEEK_LABELS, WEEK_OF_MONTH_LABELS } from "@/types/escalas"

interface RegularEventFormProps {
  event?: RegularEvent
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function RegularEventForm({ event, open, onOpenChange, onSuccess }: RegularEventFormProps) {
  const isEditing = !!event

  const [loading, setLoading] = useState(false)
  const [ministries, setMinistries] = useState<Ministry[]>([])
  const [loadingMinistries, setLoadingMinistries] = useState(true)
  const initializedRef = useRef(false)
  
  const [formData, setFormData] = useState({
    ministry_ids: event ? [event.ministry_id] : [] as string[],
    title: event?.title || "",
    day_of_week: event?.day_of_week?.toString() || "0",
    time: event?.time?.slice(0, 5) || "10:00",
    week_of_month: event?.week_of_month?.toString() || "all",
    notes: event?.notes || "",
  })

  // Buscar ministérios
  useEffect(() => {
    if (!open) return

    async function fetchMinistries() {
      try {
        const { data, error } = await supabase
          .from("ministries")
          .select("*")
          .eq("is_active", true)
          .order("name")

        if (error) throw error
        setMinistries(data || [])
      } catch (error) {
        console.error("Erro ao buscar ministérios:", error)
        toast.error("Erro ao carregar ministérios")
      } finally {
        setLoadingMinistries(false)
      }
    }

    setLoadingMinistries(true)
    fetchMinistries()
  }, [open])

  // Carregar ministérios associados ao evento ao editar
  useEffect(() => {
    if (!open || !event) return

    async function loadEventMinistries() {
      try {
        const response = await fetch(`/api/escalas/regular-events/${event.id}/ministries`)
        if (!response.ok) {
          // Se falhar, usar ministry_id legado como fallback
          if (event.ministry_id) {
            setFormData(prev => ({
              ...prev,
              ministry_ids: [event.ministry_id],
            }))
          }
          return
        }
        const data = await response.json()
        const ministryIds = data.map((item: { ministry_id: string }) => item.ministry_id)
        
        if (ministryIds.length > 0) {
          setFormData(prev => ({
            ...prev,
            ministry_ids: ministryIds,
          }))
        } else if (event.ministry_id) {
          // Fallback para dados legados
          setFormData(prev => ({
            ...prev,
            ministry_ids: [event.ministry_id],
          }))
        }
      } catch (error) {
        console.error("Erro ao carregar ministérios do evento:", error)
        // Fallback para ministry_id legado
        if (event.ministry_id) {
          setFormData(prev => ({
            ...prev,
            ministry_ids: [event.ministry_id],
          }))
        }
      }
    }

    loadEventMinistries()
  }, [open, event])

  // Reset form quando abrir para editar
  useEffect(() => {
    if (!open || !event) return

    setFormData({
      ministry_ids: event.ministry_id ? [event.ministry_id] : [],
      title: event.title || "",
      day_of_week: event.day_of_week?.toString() || "0",
      time: event.time?.slice(0, 5) || "10:00",
      week_of_month: event.week_of_month?.toString() || "all",
      notes: event.notes || "",
    })
  }, [open, event])

  // Reset form quando abrir para criar novo
  useEffect(() => {
    if (!open || event) {
      initializedRef.current = false
      return
    }

    if (ministries.length > 0 && !initializedRef.current) {
      // Criar novo: inicializar quando ministérios estiverem carregados (apenas uma vez)
      initializedRef.current = true
      setFormData({
        ministry_ids: [ministries[0].id],
        title: "",
        day_of_week: "0",
        time: "10:00",
        week_of_month: "all",
        notes: "",
      })
    }
  }, [open, event, ministries])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.ministry_ids.length === 0) {
      toast.error("Selecione pelo menos um ministério")
      return
    }
    
    setLoading(true)

    try {
      if (isEditing) {
        // Edição: atualizar dados do evento e ministérios associados
        const eventPayload = {
          title: formData.title,
          day_of_week: parseInt(formData.day_of_week),
          time: formData.time,
          week_of_month: formData.week_of_month === "all" ? null : parseInt(formData.week_of_month),
          notes: formData.notes || null,
        }

        // Atualizar dados do evento
        const eventResponse = await fetch(`/api/escalas/regular-events/${event.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(eventPayload),
        })

        if (!eventResponse.ok) {
          const data = await eventResponse.json()
          throw new Error(data.error || "Erro ao atualizar evento")
        }

        // Atualizar ministérios associados
        const ministriesResponse = await fetch(`/api/escalas/regular-events/${event.id}/ministries`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ministry_ids: formData.ministry_ids }),
        })

        if (!ministriesResponse.ok) {
          const data = await ministriesResponse.json()
          throw new Error(data.error || "Erro ao atualizar ministérios")
        }

        toast.success("Evento atualizado!")
        onOpenChange(false)
        onSuccess()
      } else {
        // Criação: cria um evento para cada ministério selecionado
        const payload = {
          ministry_ids: formData.ministry_ids,
          title: formData.title,
          day_of_week: parseInt(formData.day_of_week),
          time: formData.time,
          week_of_month: formData.week_of_month === "all" ? null : parseInt(formData.week_of_month),
          notes: formData.notes || null,
        }

        const response = await fetch("/api/escalas/regular-events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Erro ao criar eventos")
        }

        toast.success(`Evento criado e associado a ${formData.ministry_ids.length} ministério(s)!`)
        onOpenChange(false)
        onSuccess()
      }
    } catch (error) {
      console.error("Erro ao salvar evento:", error)
      toast.error(error instanceof Error ? error.message : "Erro ao salvar evento")
    } finally {
      setLoading(false)
    }
  }

  const toggleMinistry = (ministryId: string) => {
    setFormData((prev) => {
      const current = prev.ministry_ids
      if (current.includes(ministryId)) {
        return { ...prev, ministry_ids: current.filter((id) => id !== ministryId) }
      } else {
        return { ...prev, ministry_ids: [...current, ministryId] }
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Evento Regular" : "Novo Evento Regular"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Ministérios *</Label>
              {loadingMinistries ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando...
                </div>
              ) : (
                <div className="border rounded-md p-3 max-h-48 overflow-auto">
                  <ScrollArea className="max-h-40">
                    <div className="space-y-2">
                      {ministries.map((ministry) => (
                        <div
                          key={ministry.id}
                          className="flex items-center space-x-2 p-2 rounded"
                        >
                          <Checkbox
                            id={`ministry-${ministry.id}`}
                            checked={formData.ministry_ids.includes(ministry.id)}
                            onCheckedChange={() => toggleMinistry(ministry.id)}
                          />
                          <Label
                            htmlFor={`ministry-${ministry.id}`}
                            className="flex items-center gap-2 cursor-pointer flex-1"
                          >
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: ministry.color }}
                            />
                            {ministry.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  {formData.ministry_ids.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {formData.ministry_ids.length} ministério(s) selecionado(s)
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Título do Evento *</Label>
              <Input
                id="title"
                placeholder="Ex: Culto de Domingo - Manhã"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                maxLength={100}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="day_of_week">Dia da Semana *</Label>
                <Select
                  value={formData.day_of_week}
                  onValueChange={(value) => setFormData({ ...formData, day_of_week: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DAY_OF_WEEK_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="time">Horário *</Label>
                <Input
                  id="time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="week_of_month">Semana do Mês</Label>
              <Select
                value={formData.week_of_month}
                onValueChange={(value) => setFormData({ ...formData, week_of_month: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as semanas</SelectItem>
                  {Object.entries(WEEK_OF_MONTH_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Indica qual ocorrência do dia da semana no mês (ex.: 1ª ocorrência = 1º sábado do mês).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                placeholder="Informações adicionais (opcional)"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                maxLength={500}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !formData.title.trim() || formData.ministry_ids.length === 0}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Salvar" : `Criar Evento`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
