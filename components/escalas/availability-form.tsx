"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle, Calendar, Clock, AlertCircle } from "lucide-react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"
import type { ScheduleEvent, Servant, Ministry } from "@/types/escalas"

interface AvailabilityFormProps {
  period: {
    id: string
    month: number
    year: number
    availability_deadline: string | null
    ministry: Pick<Ministry, 'id' | 'name' | 'color'> | null
  }
  events: ScheduleEvent[]
  servants: Servant[]
}

export function AvailabilityForm({ period, events, servants }: AvailabilityFormProps) {
  const [step, setStep] = useState<"identify" | "availability" | "success">("identify")
  const [email, setEmail] = useState("")
  const [selectedServant, setSelectedServant] = useState<Servant | null>(null)
  const [availabilities, setAvailabilities] = useState<Record<string, boolean>>(() => {
    // Por padrão, todos disponíveis
    const initial: Record<string, boolean> = {}
    events.forEach((e) => {
      initial[e.id] = true
    })
    return initial
  })
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Agrupar eventos por data
  const eventsByDate = events.reduce((acc, event) => {
    const date = event.event_date
    if (!acc[date]) acc[date] = []
    acc[date].push(event)
    return acc
  }, {} as Record<string, ScheduleEvent[]>)

  const handleIdentify = (e: React.FormEvent) => {
    e.preventDefault()
    
    const servant = servants.find(
      (s) => s.email?.toLowerCase() === email.toLowerCase().trim()
    )

    if (!servant) {
      toast.error("Email não encontrado. Verifique se você está cadastrado no ministério.")
      return
    }

    setSelectedServant(servant)
    setStep("availability")
  }

  const handleSubmit = async () => {
    if (!selectedServant) return
    
    // Validar que eventos indisponíveis tenham motivo preenchido
    const unavailableEvents = Object.entries(availabilities).filter(([_, isAvailable]) => !isAvailable)
    const missingReasons = unavailableEvents.filter(([eventId]) => !notes[eventId]?.trim())
    
    if (missingReasons.length > 0) {
      toast.error("Por favor, informe o motivo da indisponibilidade para todos os eventos que você não poderá comparecer.")
      return
    }
    
    setIsSubmitting(true)

    try {
      const submission = {
        servant_id: selectedServant.id,
        period_id: period.id,
        availabilities: Object.entries(availabilities).map(([eventId, isAvailable]) => ({
          event_id: eventId,
          is_available: isAvailable,
          notes: notes[eventId]?.trim() || null,
        })),
      }

      const response = await fetch("/api/escalas/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submission),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Erro ao enviar disponibilidade")
      }

      setStep("success")
      toast.success("Disponibilidade enviada com sucesso!")
    } catch (error) {
      console.error("Erro:", error)
      toast.error(error instanceof Error ? error.message : "Erro ao enviar")
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatEventDate = (dateStr: string) => {
    return format(parseISO(dateStr), "EEEE, dd 'de' MMMM", { locale: ptBR })
  }

  const formatEventTime = (timeStr: string) => {
    return timeStr.slice(0, 5)
  }

  const availableCount = Object.values(availabilities).filter(Boolean).length
  const totalCount = events.length

  // Step 1: Identificação
  if (step === "identify") {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader className="text-center">
          <div 
            className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{ backgroundColor: period.ministry?.color || '#3b82f6' }}
          >
            <Calendar className="h-8 w-8 text-white" />
          </div>
          <CardTitle>Disponibilidade - {period.ministry?.name}</CardTitle>
          <CardDescription>
            {format(new Date(period.year, period.month - 1), "MMMM 'de' yyyy", { locale: ptBR })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleIdentify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Seu Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Use o mesmo email cadastrado no ministério
              </p>
            </div>

            {period.availability_deadline && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Prazo: {format(new Date(period.availability_deadline), "dd/MM/yyyy 'às' HH:mm")}
              </div>
            )}

            <Button type="submit" className="w-full">
              Continuar
            </Button>
          </form>
        </CardContent>
      </Card>
    )
  }

  // Step 3: Sucesso
  if (step === "success") {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="pt-8 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Enviado com Sucesso!</h2>
          <p className="text-muted-foreground mb-4">
            Sua disponibilidade foi registrada. Você será notificado quando a escala for publicada.
          </p>
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm">
              <strong>{selectedServant?.name}</strong>
            </p>
            <p className="text-sm text-muted-foreground">
              {availableCount} de {totalCount} eventos disponível
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Step 2: Formulário de Disponibilidade
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">{selectedServant?.name}</h2>
              <p className="text-sm text-muted-foreground">
                {period.ministry?.name} - {format(new Date(period.year, period.month - 1), "MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
            <Badge variant="outline">
              {availableCount}/{totalCount} disponível
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Instruções */}
      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100">
                Como preencher
              </p>
              <p className="text-blue-700 dark:text-blue-300">
                Marque os eventos em que você <strong>estará disponível</strong> para servir.
                Desmarque os que você não poderá comparecer.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Eventos por Data */}
      {Object.entries(eventsByDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, dateEvents]) => (
          <Card key={date}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base capitalize">
                {formatEventDate(date)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {dateEvents
                .sort((a, b) => a.event_time.localeCompare(b.event_time))
                .map((event) => (
                  <div 
                    key={event.id} 
                    className={`p-3 rounded-lg border transition-colors ${
                      availabilities[event.id] 
                        ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800" 
                        : "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={event.id}
                        checked={availabilities[event.id]}
                        onCheckedChange={(checked) =>
                          setAvailabilities((prev) => ({
                            ...prev,
                            [event.id]: !!checked,
                          }))
                        }
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <Label 
                          htmlFor={event.id} 
                          className="font-medium cursor-pointer flex items-center gap-2"
                        >
                          <span className="font-mono text-sm">
                            {formatEventTime(event.event_time)}
                          </span>
                          <span>{event.title}</span>
                        </Label>
                        {event.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {event.description}
                          </p>
                        )}
                        {!availabilities[event.id] && (
                          <div className="mt-2">
                            <Textarea
                              placeholder="Motivo da indisponibilidade *"
                              className="h-16 text-sm"
                              value={notes[event.id] || ""}
                              required
                              onChange={(e) =>
                                setNotes((prev) => ({
                                  ...prev,
                                  [event.id]: e.target.value,
                                }))
                              }
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        ))}

      {/* Botão de Envio */}
      <div className="sticky bottom-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm">
                <span className="font-medium">{availableCount}</span> de{" "}
                <span className="font-medium">{totalCount}</span> eventos disponível
              </div>
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting}
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar Disponibilidade"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
