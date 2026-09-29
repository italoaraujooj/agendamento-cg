"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle, Calendar, Clock, AlertCircle, Pencil } from "lucide-react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"
import type { Ministry } from "@/types/escalas"

export interface AvailabilityEvent {
  id: string
  event_date: string
  event_time: string
  title: string
  description: string | null
}

/** Servo identificado pelo servidor, com token pessoal e respostas salvas */
export interface IdentifiedServant {
  servant: { id: string; name: string }
  access_token: string
  answers: { event_id: string; is_available: boolean; notes: string | null }[]
  submitted_at: string | null
}

interface AvailabilityFormProps {
  periodToken: string
  period: {
    id: string
    month: number
    year: number
    availability_deadline: string | null
    ministry: Pick<Ministry, 'id' | 'name' | 'color'> | null
  }
  events: AvailabilityEvent[]
  /** Identificação automática (usuário logado vinculado a um servo) */
  initialIdentity?: IdentifiedServant | null
}

const storageKey = (periodToken: string) => `disponibilidade:${periodToken}`

function readStoredIdentity(periodToken: string): { servant_id: string; access_token: string } | null {
  try {
    const raw = localStorage.getItem(storageKey(periodToken))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function storeIdentity(periodToken: string, identity: IdentifiedServant) {
  try {
    localStorage.setItem(
      storageKey(periodToken),
      JSON.stringify({ servant_id: identity.servant.id, access_token: identity.access_token })
    )
  } catch {
    // Armazenamento indisponível (modo privado etc.) — segue sem lembrar
  }
}

function clearStoredIdentity(periodToken: string) {
  try {
    localStorage.removeItem(storageKey(periodToken))
  } catch {
    // ignorar
  }
}

export function AvailabilityForm({ periodToken, period, events, initialIdentity }: AvailabilityFormProps) {
  const [step, setStep] = useState<"identify" | "availability" | "success">("identify")
  const [email, setEmail] = useState("")
  const [identity, setIdentity] = useState<IdentifiedServant | null>(null)
  const [availabilities, setAvailabilities] = useState<Record<string, boolean>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [isIdentifying, setIsIdentifying] = useState(false)
  const [isRestoring, setIsRestoring] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const applyIdentity = (data: IdentifiedServant) => {
    const saved = new Map(data.answers.map((a) => [a.event_id, a]))
    const nextAvailability: Record<string, boolean> = {}
    const nextNotes: Record<string, string> = {}
    events.forEach((e) => {
      const answer = saved.get(e.id)
      // Sem resposta salva: por padrão, disponível
      nextAvailability[e.id] = answer ? answer.is_available : true
      if (answer?.notes) nextNotes[e.id] = answer.notes
    })
    setAvailabilities(nextAvailability)
    setNotes(nextNotes)
    setIdentity(data)
    storeIdentity(periodToken, data)
    setStep("availability")
  }

  // Retomar identificação: usuário logado ou token salvo neste dispositivo
  useEffect(() => {
    if (initialIdentity) {
      applyIdentity(initialIdentity)
      setIsRestoring(false)
      return
    }

    const stored = readStoredIdentity(periodToken)
    if (!stored) {
      setIsRestoring(false)
      return
    }

    identify(stored)
      .then((data) => {
        if (data) applyIdentity(data)
        else clearStoredIdentity(periodToken)
      })
      .finally(() => setIsRestoring(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Agrupar eventos por data
  const eventsByDate = events.reduce((acc, event) => {
    const date = event.event_date
    if (!acc[date]) acc[date] = []
    acc[date].push(event)
    return acc
  }, {} as Record<string, AvailabilityEvent[]>)

  async function identify(
    body: { email: string } | { servant_id: string; access_token: string }
  ): Promise<IdentifiedServant | null> {
    const response = await fetch(`/api/escalas/availability/${periodToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      if ("email" in body) {
        const data = await response.json().catch(() => ({}))
        toast.error(data.error || "Email não encontrado. Verifique se você está cadastrado no ministério.")
      }
      return null
    }
    return response.json()
  }

  const handleIdentify = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsIdentifying(true)
    try {
      const data = await identify({ email: email.trim() })
      if (data) applyIdentity(data)
    } catch {
      toast.error("Erro ao conectar com o servidor")
    } finally {
      setIsIdentifying(false)
    }
  }

  const handleSwitchPerson = () => {
    clearStoredIdentity(periodToken)
    setIdentity(null)
    setEmail("")
    setStep("identify")
  }

  const handleSubmit = async () => {
    if (!identity) return

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
        servant_id: identity.servant.id,
        period_id: period.id,
        access_token: identity.access_token,
        availabilities: Object.entries(availabilities).map(([eventId, isAvailable]) => ({
          event_id: eventId,
          is_available: isAvailable,
          notes: isAvailable ? null : notes[eventId]?.trim() || null,
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

      setIdentity({
        ...identity,
        submitted_at: data.submitted_at,
        answers: submission.availabilities,
      })
      setStep("success")
      toast.success(isEditing ? "Disponibilidade atualizada!" : "Disponibilidade enviada com sucesso!")
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

  const formatSubmittedAt = (iso: string) =>
    format(new Date(iso), "dd/MM 'às' HH:mm", { locale: ptBR })

  const isEditing = !!identity?.submitted_at
  const availableCount = Object.values(availabilities).filter(Boolean).length
  const totalCount = events.length

  if (isRestoring) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

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
                Use o mesmo email cadastrado no ministério. Se você já respondeu,
                suas respostas serão carregadas para edição.
              </p>
            </div>

            {period.availability_deadline && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Prazo: {format(new Date(period.availability_deadline), "dd/MM/yyyy 'às' HH:mm")}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isIdentifying}>
              {isIdentifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
            Sua disponibilidade foi registrada. Você pode voltar a este link e
            editar suas respostas até o prazo.
          </p>
          <div className="p-4 rounded-lg bg-muted/50 mb-4">
            <p className="text-sm">
              <strong>{identity?.servant.name}</strong>
            </p>
            <p className="text-sm text-muted-foreground">
              {availableCount} de {totalCount} eventos disponível
            </p>
          </div>
          <Button variant="outline" onClick={() => setStep("availability")}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar respostas
          </Button>
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
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-xl font-bold">{identity?.servant.name}</h2>
              <p className="text-sm text-muted-foreground">
                {period.ministry?.name} - {format(new Date(period.year, period.month - 1), "MMMM 'de' yyyy", { locale: ptBR })}
              </p>
              <button
                type="button"
                onClick={handleSwitchPerson}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground mt-1"
              >
                Não é você?
              </button>
            </div>
            <Badge variant="outline" className="flex-shrink-0">
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
                {isEditing ? "Editando sua resposta" : "Como preencher"}
              </p>
              <p className="text-blue-700 dark:text-blue-300">
                {isEditing && identity?.submitted_at && (
                  <>Última atualização em {formatSubmittedAt(identity.submitted_at)}. </>
                )}
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
                ) : isEditing ? (
                  "Salvar Alterações"
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
