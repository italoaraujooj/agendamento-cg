"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle, Calendar, Clock, AlertCircle, AlertTriangle, Pencil, Check, X } from "lucide-react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"
import type { Ministry } from "@/types/escalas"
import { blockoutFor, type Blockout } from "@/lib/escalas/blockouts"

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
  /** Datas bloqueadas da pessoa no mês (pré-marcam "Não posso" nos eventos sem resposta) */
  blockouts?: Blockout[]
}

interface AvailabilityFormProps {
  periodToken: string
  period: {
    id: string
    month: number
    year: number
    availability_deadline: string | null
    ministry: Pick<Ministry, 'id' | 'name' | 'color'> | null
    /** Prazo encerrado ou escala em montagem: resposta é aceita, mas avisa o líder */
    late?: boolean
  }
  events: AvailabilityEvent[]
  /** Identificação automática (usuário logado vinculado a um servo) */
  initialIdentity?: IdentifiedServant | null
}

const REASON_CHIPS = ["Viagem", "Trabalho", "Saúde", "Compromisso familiar"]

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

/** Link pessoal (?s=&k=) enviado por e-mail; removido da barra de endereço após ler */
function readPersonalLinkParams(): { servant_id: string; access_token: string } | null {
  const params = new URLSearchParams(window.location.search)
  const s = params.get("s")
  const k = params.get("k")
  if (!s || !k) return null
  window.history.replaceState(null, "", window.location.pathname)
  return { servant_id: s, access_token: k }
}

export function AvailabilityForm({ periodToken, period, events, initialIdentity }: AvailabilityFormProps) {
  const [step, setStep] = useState<"identify" | "availability" | "success">("identify")
  const [email, setEmail] = useState("")
  const [identity, setIdentity] = useState<IdentifiedServant | null>(null)
  // undefined = ainda não respondeu este evento
  const [availabilities, setAvailabilities] = useState<Record<string, boolean | undefined>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [isIdentifying, setIsIdentifying] = useState(false)
  const [isRestoring, setIsRestoring] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const applyIdentity = (data: IdentifiedServant) => {
    const saved = new Map(data.answers.map((a) => [a.event_id, a]))
    const nextAvailability: Record<string, boolean | undefined> = {}
    const nextNotes: Record<string, string> = {}
    events.forEach((e) => {
      const answer = saved.get(e.id)
      nextAvailability[e.id] = answer?.is_available
      if (answer?.notes) nextNotes[e.id] = answer.notes
      // Sem resposta e dentro de uma data bloqueada: já vem como "Não posso"
      const blocked = !answer ? blockoutFor(e.event_date, data.blockouts ?? []) : undefined
      if (blocked) {
        nextAvailability[e.id] = false
        nextNotes[e.id] = blocked.reason ?? "Data bloqueada"
      }
    })
    setAvailabilities(nextAvailability)
    setNotes(nextNotes)
    setIdentity(data)
    storeIdentity(periodToken, data)
    setStep("availability")
  }

  // Retomar identificação: link pessoal, usuário logado ou token salvo neste dispositivo
  useEffect(() => {
    const fromLink = readPersonalLinkParams()
    if (!fromLink && initialIdentity) {
      applyIdentity(initialIdentity)
      setIsRestoring(false)
      return
    }

    const stored = fromLink ?? readStoredIdentity(periodToken)
    if (!stored) {
      setIsRestoring(false)
      return
    }

    identify(stored)
      .then((data) => {
        if (data) applyIdentity(data)
        else {
          clearStoredIdentity(periodToken)
          if (fromLink) toast.error("Link pessoal inválido. Informe seu email para continuar.")
        }
      })
      .catch(() => toast.error("Erro ao conectar com o servidor"))
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

  const setAnswer = (eventId: string, value: boolean) =>
    setAvailabilities((prev) => ({ ...prev, [eventId]: value }))

  const setAll = (value: boolean) => {
    const next: Record<string, boolean> = {}
    events.forEach((e) => (next[e.id] = value))
    setAvailabilities(next)
  }

  const toggleReasonChip = (eventId: string, chip: string) =>
    setNotes((prev) => ({ ...prev, [eventId]: prev[eventId] === chip ? "" : chip }))

  const isEditing = !!identity?.submitted_at
  const answeredCount = events.filter((e) => availabilities[e.id] !== undefined).length
  const availableCount = events.filter((e) => availabilities[e.id] === true).length
  const totalCount = events.length
  const missingCount = totalCount - answeredCount

  const handleSubmit = async () => {
    if (!identity) return

    if (missingCount > 0) {
      toast.error(
        missingCount === 1
          ? "Falta responder 1 evento."
          : `Faltam responder ${missingCount} eventos.`
      )
      return
    }

    setIsSubmitting(true)

    try {
      const submission = {
        servant_id: identity.servant.id,
        period_id: period.id,
        access_token: identity.access_token,
        availabilities: events.map((e) => ({
          event_id: e.id,
          is_available: availabilities[e.id] === true,
          notes: availabilities[e.id] ? null : notes[e.id]?.trim() || null,
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

  const lateNotice = period.late && (
    <Card className="bg-warning/10 border-warning/30">
      <CardContent className="pt-4">
        <div className="flex gap-3">
          <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
          <p className="text-sm text-warning">
            O prazo para responder já encerrou. Você ainda pode enviar ou alterar sua
            disponibilidade, e o líder do ministério será avisado da mudança.
          </p>
        </div>
      </CardContent>
    </Card>
  )

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
      <div className="max-w-md mx-auto space-y-4">
        {lateNotice}
        <Card>
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
      </div>
    )
  }

  // Step 3: Sucesso
  if (step === "success") {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="pt-8 text-center">
          <CheckCircle className="h-16 w-16 text-success mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Enviado com Sucesso!</h2>
          <p className="text-muted-foreground mb-4">
            {period.late
              ? "Sua disponibilidade foi registrada e o líder do ministério foi avisado."
              : "Sua disponibilidade foi registrada. Você pode voltar a este link e editar suas respostas até o prazo."}
          </p>
          <div className="p-4 rounded-lg bg-muted/50 mb-4">
            <p className="text-sm">
              <strong>{identity?.servant.name}</strong>
            </p>
            <p className="text-sm text-muted-foreground">
              Disponível em {availableCount} de {totalCount} eventos
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
            {period.availability_deadline && !period.late && (
              <Badge variant="outline" className="flex-shrink-0 gap-1">
                <Clock className="h-3 w-3" />
                até {format(new Date(period.availability_deadline), "dd/MM HH:mm")}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {lateNotice}

      {/* Instruções + ações em lote */}
      <Card className="bg-info/10 border-info/30">
        <CardContent className="pt-4 space-y-3">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-info flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-info">
                {isEditing ? "Editando sua resposta" : "Como preencher"}
              </p>
              <p className="text-info">
                {isEditing && identity?.submitted_at && (
                  <>Última atualização em {formatSubmittedAt(identity.submitted_at)}. </>
                )}
                Para cada evento, marque <strong>Posso</strong> ou <strong>Não posso</strong>.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pl-8">
            <Button type="button" size="sm" variant="outline" className="bg-background" onClick={() => setAll(true)}>
              <Check className="mr-1.5 h-3.5 w-3.5 text-success" />
              Posso em todos
            </Button>
            <Button type="button" size="sm" variant="outline" className="bg-background" onClick={() => setAll(false)}>
              <X className="mr-1.5 h-3.5 w-3.5 text-destructive" />
              Não posso em nenhum
            </Button>
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
                .map((event) => {
                  const answer = availabilities[event.id]
                  return (
                    <div
                      key={event.id}
                      className={`p-3 rounded-lg border transition-colors ${
                        answer === true
                          ? "bg-success/10 border-success/30"
                          : answer === false
                            ? "bg-destructive/10 border-destructive/30"
                            : "bg-background"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium flex items-center gap-2">
                            <span className="font-mono text-sm">{formatEventTime(event.event_time)}</span>
                            <span>{event.title}</span>
                          </p>
                          {event.description && (
                            <p className="text-xs text-muted-foreground mt-1">{event.description}</p>
                          )}
                        </div>
                        <div className="flex gap-2 flex-shrink-0" role="radiogroup" aria-label={`Disponibilidade em ${event.title}`}>
                          <Button
                            type="button"
                            size="sm"
                            role="radio"
                            aria-checked={answer === true}
                            variant={answer === true ? "default" : "outline"}
                            className={answer === true ? "bg-success hover:bg-success/90 text-success-foreground" : ""}
                            onClick={() => setAnswer(event.id, true)}
                          >
                            <Check className="mr-1 h-3.5 w-3.5" />
                            Posso
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            role="radio"
                            aria-checked={answer === false}
                            variant={answer === false ? "default" : "outline"}
                            className={answer === false ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" : ""}
                            onClick={() => setAnswer(event.id, false)}
                          >
                            <X className="mr-1 h-3.5 w-3.5" />
                            Não posso
                          </Button>
                        </div>
                      </div>

                      {answer === false && (
                        <div className="mt-3 space-y-2">
                          <div className="flex flex-wrap gap-1.5">
                            {REASON_CHIPS.map((chip) => (
                              <button
                                key={chip}
                                type="button"
                                onClick={() => toggleReasonChip(event.id, chip)}
                                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                  notes[event.id] === chip
                                    ? "bg-destructive border-destructive/60 text-destructive-foreground"
                                    : "bg-background hover:bg-muted"
                                }`}
                              >
                                {chip}
                              </button>
                            ))}
                          </div>
                          <Textarea
                            placeholder="Motivo (opcional) — ajuda o líder a montar a escala"
                            className="h-14 text-sm"
                            maxLength={200}
                            value={notes[event.id] || ""}
                            onChange={(e) =>
                              setNotes((prev) => ({ ...prev, [event.id]: e.target.value }))
                            }
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
            </CardContent>
          </Card>
        ))}

      {/* Botão de Envio */}
      <div className="sticky bottom-[calc(var(--bottom-nav-h)+1rem)]">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm">
                {missingCount > 0 ? (
                  <span className="text-warning">
                    <span className="font-medium">{answeredCount}</span> de{" "}
                    <span className="font-medium">{totalCount}</span> respondidos
                  </span>
                ) : (
                  <span>
                    Disponível em <span className="font-medium">{availableCount}</span> de{" "}
                    <span className="font-medium">{totalCount}</span>
                  </span>
                )}
              </div>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || missingCount > 0}
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
