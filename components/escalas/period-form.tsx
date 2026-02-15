"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase/client"
import type { Ministry, SchedulePeriod } from "@/types/escalas"
import { format, addDays } from "date-fns"
import { ptBR } from "date-fns/locale"

interface PeriodFormProps {
  period?: SchedulePeriod
  onSuccess?: () => void
}

const MONTHS = [
  { value: "1", label: "Janeiro" },
  { value: "2", label: "Fevereiro" },
  { value: "3", label: "Março" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Maio" },
  { value: "6", label: "Junho" },
  { value: "7", label: "Julho" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
]

export function PeriodForm({ period, onSuccess }: PeriodFormProps) {
  const router = useRouter()
  const isEditing = !!period

  const [loading, setLoading] = useState(false)
  const [ministries, setMinistries] = useState<Ministry[]>([])
  const [loadingMinistries, setLoadingMinistries] = useState(true)
  
  const currentDate = new Date()
  const nextMonth = currentDate.getMonth() + 2 // getMonth is 0-indexed, we want next month
  const defaultMonth = nextMonth > 12 ? 1 : nextMonth
  const defaultYear = nextMonth > 12 ? currentDate.getFullYear() + 1 : currentDate.getFullYear()
  
  // Default deadline: 5 days before the month starts
  const defaultDeadlineDate = new Date(defaultYear, defaultMonth - 1, 1)
  defaultDeadlineDate.setDate(defaultDeadlineDate.getDate() - 5)
  
  const [formData, setFormData] = useState({
    ministry_id: period?.ministry_id || "",
    month: period?.month?.toString() || defaultMonth.toString(),
    year: period?.year?.toString() || defaultYear.toString(),
    availability_deadline: period?.availability_deadline 
      ? format(new Date(period.availability_deadline), "yyyy-MM-dd'T'HH:mm")
      : format(defaultDeadlineDate, "yyyy-MM-dd'T'HH:mm"),
    notes: period?.notes || "",
  })

  useEffect(() => {
    async function fetchMinistries() {
      try {
        const { data, error } = await supabase
          .from("ministries")
          .select("*")
          .eq("is_active", true)
          .order("name")

        if (error) throw error
        setMinistries(data || [])
        
        if (!formData.ministry_id && data && data.length > 0) {
          setFormData(prev => ({ ...prev, ministry_id: data[0].id }))
        }
      } catch (error) {
        console.error("Erro ao buscar ministérios:", error)
        toast.error("Erro ao carregar ministérios")
      } finally {
        setLoadingMinistries(false)
      }
    }

    fetchMinistries()
  }, [formData.ministry_id])

  // Atualizar deadline sugerido quando mês/ano mudar
  useEffect(() => {
    if (!isEditing && formData.month && formData.year) {
      const newDeadlineDate = new Date(
        parseInt(formData.year), 
        parseInt(formData.month) - 1, 
        1
      )
      newDeadlineDate.setDate(newDeadlineDate.getDate() - 5)
      setFormData(prev => ({
        ...prev,
        availability_deadline: format(newDeadlineDate, "yyyy-MM-dd'T'HH:mm")
      }))
    }
  }, [formData.month, formData.year, isEditing])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = isEditing 
        ? `/api/escalas/schedule-periods/${period.id}`
        : "/api/escalas/schedule-periods"
      
      const payload = isEditing 
        ? {
            availability_deadline: formData.availability_deadline 
              ? new Date(formData.availability_deadline).toISOString()
              : null,
            notes: formData.notes || null,
          }
        : {
            ministry_id: formData.ministry_id,
            month: parseInt(formData.month),
            year: parseInt(formData.year),
            availability_deadline: formData.availability_deadline 
              ? new Date(formData.availability_deadline).toISOString()
              : null,
            notes: formData.notes || null,
          }

      const response = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Erro ao salvar período")
      }

      toast.success(isEditing ? "Período atualizado!" : "Período criado!")
      
      if (onSuccess) {
        onSuccess()
      } else {
        router.push(`/admin-escalas/periodos/${data.id}`)
      }
    } catch (error) {
      console.error("Erro ao salvar período:", error)
      toast.error(error instanceof Error ? error.message : "Erro ao salvar período")
    } finally {
      setLoading(false)
    }
  }

  const selectedMinistry = ministries.find(m => m.id === formData.ministry_id)
  const monthName = MONTHS.find(m => m.value === formData.month)?.label

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? "Editar Período" : "Novo Período de Escala"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isEditing && (
            <>
              <div className="space-y-2">
                <Label htmlFor="ministry">Ministério *</Label>
                {loadingMinistries ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando...
                  </div>
                ) : (
                  <Select
                    value={formData.ministry_id}
                    onValueChange={(value) => setFormData({ ...formData, ministry_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o ministério" />
                    </SelectTrigger>
                    <SelectContent>
                      {ministries.map((ministry) => (
                        <SelectItem key={ministry.id} value={ministry.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: ministry.color }}
                            />
                            {ministry.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="month">Mês *</Label>
                  <Select
                    value={formData.month}
                    onValueChange={(value) => setFormData({ ...formData, month: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((month) => (
                        <SelectItem key={month.value} value={month.value}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="year">Ano *</Label>
                  <Select
                    value={formData.year}
                    onValueChange={(value) => setFormData({ ...formData, year: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[currentDate.getFullYear(), currentDate.getFullYear() + 1].map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {isEditing && (
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <div 
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: period.ministry?.color || '#888' }}
                />
                <div>
                  <p className="font-medium">{period.ministry?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(period.year, period.month - 1), "MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="deadline">Prazo para Disponibilidade</Label>
            <Input
              id="deadline"
              type="datetime-local"
              value={formData.availability_deadline}
              onChange={(e) => setFormData({ ...formData, availability_deadline: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Data limite para os servos informarem sua disponibilidade
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Informações adicionais sobre este período (opcional)"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              maxLength={1000}
              rows={3}
            />
          </div>

          {!isEditing && selectedMinistry && (
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm">
                <strong>Resumo:</strong> Criar escala de <strong>{monthName} de {formData.year}</strong> para o ministério{" "}
                <strong>{selectedMinistry.name}</strong>
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button 
              type="submit" 
              disabled={loading || (!isEditing && (!formData.ministry_id || !formData.month || !formData.year))}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Salvar Alterações" : "Criar Período"}
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
