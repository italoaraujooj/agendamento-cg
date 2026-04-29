"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, Search, Calendar, Crown, ChevronDown, ChevronUp } from "lucide-react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { supabase } from "@/lib/supabase/client"

interface Assignment {
  servantName: string
  areaName: string
  isMe: boolean
}

interface EventData {
  id: string
  event_date: string
  event_time: string
  title: string
  requires_areas: string[] | null
  isMyEvent: boolean
  assignments: Assignment[]
}

interface PeriodData {
  id: string
  month: number
  year: number
  ministry: { name: string; color: string }
  events: EventData[]
}

interface ApiResponse {
  servantName: string
  periods: PeriodData[]
}

export default function MinhaEscalaPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [autoLoading, setAutoLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [collapsedPeriods, setCollapsedPeriods] = useState<Set<string>>(new Set())
  const [loggedInUser, setLoggedInUser] = useState<{ id: string; name: string | null } | null>(null)

  // Auto-carregar escala se o usuário estiver logado
  useEffect(() => {
    async function tryAutoLoad() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          setAutoLoading(false)
          return
        }

        const userId = session.user.id

        const res = await fetch(`/api/escalas/minha-escala?user_id=${encodeURIComponent(userId)}`)
        const json = await res.json()

        if (res.ok) {
          setLoggedInUser({ id: userId, name: json.servantName })
          setData(json)
          if (json.periods.length > 1) {
            const toCollapse = new Set<string>(json.periods.slice(1).map((p: PeriodData) => p.id))
            setCollapsedPeriods(toCollapse)
          }
        } else {
          // Usuário logado mas sem servo vinculado — deixa formulário de email visível
          setLoggedInUser({ id: userId, name: null })
        }
      } catch {
        // Silencioso — fallback para formulário manual
      } finally {
        setAutoLoading(false)
      }
    }

    tryAutoLoad()
  }, [])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    setError(null)
    setData(null)

    try {
      const res = await fetch(
        `/api/escalas/minha-escala?email=${encodeURIComponent(email.trim())}`
      )
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? "Erro ao buscar escala")
        return
      }

      setData(json)
      // Abrir o período mais recente por padrão, colapsar os demais
      if (json.periods.length > 1) {
        const toCollapse = new Set<string>(json.periods.slice(1).map((p: PeriodData) => p.id))
        setCollapsedPeriods(toCollapse)
      }
    } catch {
      setError("Erro ao conectar com o servidor")
    } finally {
      setLoading(false)
    }
  }

  const togglePeriod = (id: string) => {
    setCollapsedPeriods((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Agrupar eventos por data
  const groupByDate = (events: EventData[]) => {
    const groups = new Map<string, EventData[]>()
    events.forEach((event) => {
      if (!groups.has(event.event_date)) groups.set(event.event_date, [])
      groups.get(event.event_date)!.push(event)
    })
    return groups
  }

  if (autoLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="container max-w-2xl mx-auto px-4 py-10 space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Calendar className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Minha Escala</h1>
          <p className="text-muted-foreground text-sm">
            {loggedInUser && data
              ? `Olá, ${data.servantName}! Aqui está sua escala.`
              : "Digite seu email cadastrado para ver os eventos em que você está escalado."}
          </p>
        </div>

        {/* Formulário — oculto quando já carregou automaticamente */}
        {!(loggedInUser && data) && (
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSearch} className="flex gap-2">
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1"
                  autoFocus
                />
                <Button type="submit" disabled={loading || !email.trim()}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  <span className="ml-2 hidden sm:inline">Buscar</span>
                </Button>
              </form>

              {loggedInUser && !data && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Você está logado, mas ainda não há um servo vinculado à sua conta. Busque pelo seu email cadastrado.
                </p>
              )}

              {error && (
                <p className="mt-3 text-sm text-destructive">{error}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Resultados */}
        {data && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Olá, <span className="font-semibold text-foreground">{data.servantName}</span>!
              {" "}Encontramos {data.periods.length} escala(s) publicada(s).
            </p>

            {data.periods.map((period) => {
              const isCollapsed = collapsedPeriods.has(period.id)
              const monthLabel = format(
                new Date(period.year, period.month - 1),
                "MMMM 'de' yyyy",
                { locale: ptBR }
              )
              const myEventsCount = period.events.filter((e) => e.isMyEvent).length
              const dateGroups = groupByDate(period.events)

              return (
                <Card key={period.id} className="overflow-hidden">
                  {/* Cabeçalho do período */}
                  <button
                    onClick={() => togglePeriod(period.id)}
                    className="w-full text-left"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: period.ministry.color }}
                          />
                          <div>
                            <CardTitle className="text-base capitalize">{monthLabel}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {period.ministry.name}
                              {myEventsCount > 0 && (
                                <span className="ml-2 text-primary font-medium">
                                  · você está em {myEventsCount} evento(s)
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        {isCollapsed ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </CardHeader>
                  </button>

                  {/* Conteúdo dos eventos */}
                  {!isCollapsed && (
                    <CardContent className="pt-0 space-y-5">
                      {Array.from(dateGroups.entries()).map(([date, dayEvents]) => (
                        <div key={date} className="space-y-2">
                          {/* Cabeçalho do dia */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                              {format(parseISO(date), "EEEE, dd/MM", { locale: ptBR })}
                            </span>
                            <div className="flex-1 h-px bg-border" />
                          </div>

                          {/* Eventos */}
                          <div className="space-y-2">
                            {dayEvents.map((event) => (
                              <div
                                key={event.id}
                                className={`rounded-lg border p-3 transition-colors ${
                                  event.isMyEvent
                                    ? "border-primary/40 bg-primary/5"
                                    : "bg-muted/30"
                                }`}
                              >
                                {/* Título do evento */}
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xs font-mono text-muted-foreground bg-background border rounded px-1.5 py-0.5">
                                    {event.event_time.slice(0, 5)}
                                  </span>
                                  <span className="text-sm font-semibold">{event.title}</span>
                                  {event.isMyEvent && (
                                    <Badge className="text-xs ml-auto flex-shrink-0">
                                      Você está aqui
                                    </Badge>
                                  )}
                                </div>

                                {/* Atribuições agrupadas por área */}
                                {event.assignments.length > 0 ? (
                                  <div className="space-y-1 pl-1">
                                    {Object.entries(
                                      event.assignments.reduce<Record<string, Assignment[]>>(
                                        (acc, a) => {
                                          if (!acc[a.areaName]) acc[a.areaName] = []
                                          acc[a.areaName].push(a)
                                          return acc
                                        },
                                        {}
                                      )
                                    ).map(([areaName, areaAssignments]) => {
                                      const hasMe = areaAssignments.some((a) => a.isMe)
                                      return (
                                        <div
                                          key={areaName}
                                          className={`flex items-start gap-2 text-sm ${
                                            hasMe ? "font-semibold text-primary" : "text-muted-foreground"
                                          }`}
                                        >
                                          {hasMe && (
                                            <Crown className="h-3 w-3 text-primary flex-shrink-0 mt-0.5" />
                                          )}
                                          <span className={`text-xs flex-shrink-0 mt-0.5 ${hasMe ? "text-primary/70" : "text-muted-foreground/70"}`}>
                                            {areaName}:
                                          </span>
                                          <span className="flex flex-wrap gap-x-1">
                                            {areaAssignments.map((a, i) => (
                                              <span
                                                key={i}
                                                className={a.isMe ? "text-primary" : ""}
                                              >
                                                {a.servantName}
                                                {i < areaAssignments.length - 1 && ","}
                                              </span>
                                            ))}
                                          </span>
                                        </div>
                                      )
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground pl-1">
                                    Sem atribuições registradas
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
