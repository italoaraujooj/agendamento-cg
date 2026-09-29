"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, Search, CalendarCheck, Crown, ChevronDown, ChevronUp, Bell } from "lucide-react"
import Link from "next/link"
import { AssignmentResponse, AssignmentStatusBadge } from "@/components/escalas/assignment-response"
import { Skeleton } from "@/components/ui/skeleton"
import { CalendarSubscribe } from "@/components/escalas/calendar-subscribe"
import { PushOptIn } from "@/components/pwa/push-opt-in"
import { BlockoutsCard } from "@/components/escalas/blockouts-card"
import type { AssignmentStatus } from "@/types/escalas"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { supabase } from "@/lib/supabase/client"

/** Hoje no fuso de Brasília (YYYY-MM-DD) */
const todayBr = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)

interface Assignment {
  servantName: string
  areaName: string
  isMe: boolean
  status: AssignmentStatus
  /** Presente só nas próprias atribuições, quando logado */
  assignmentId?: string
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
  calendarToken: string | null
}

/** Coleta de disponibilidade aberta para o usuário logado */
interface OpenCollection {
  id: string
  month: number
  year: number
  ministry: { name: string; color: string }
  availability_deadline: string | null
  late: boolean
  submitted_at: string | null
  link: string
}

export default function MinhaEscalaPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [autoLoading, setAutoLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [collapsedPeriods, setCollapsedPeriods] = useState<Set<string>>(new Set())
  const [loggedInUser, setLoggedInUser] = useState<{ id: string; name: string | null } | null>(null)
  const [openCollections, setOpenCollections] = useState<OpenCollection[]>([])

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

        // Coletas de disponibilidade abertas (independente de já haver escala publicada)
        fetch("/api/escalas/minha-disponibilidade")
          .then((r) => (r.ok ? r.json() : { periods: [] }))
          .then((d) => setOpenCollections(d.periods ?? []))
          .catch(() => {})

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

  const updateMyStatus = (assignmentId: string, status: AssignmentStatus) =>
    setData((prev) =>
      prev
        ? {
            ...prev,
            periods: prev.periods.map((p) => ({
              ...p,
              events: p.events.map((e) => ({
                ...e,
                assignments: e.assignments.map((a) => (a.assignmentId === assignmentId ? { ...a, status } : a)),
              })),
            })),
          }
        : prev
    )

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
      <div className="container max-w-5xl mx-auto px-4 py-8 space-y-6" aria-busy="true" aria-label="Carregando">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    )
  }

  // Minhas próximas escalas, de todos os ministérios, em ordem de data
  const today = todayBr()
  const upcoming = (data?.periods ?? [])
    .flatMap((period) =>
      period.events
        .filter((e) => e.isMyEvent && e.event_date >= today)
        .map((event) => ({ period, event }))
    )
    .sort((a, b) =>
      (a.event.event_date + a.event.event_time).localeCompare(b.event.event_date + b.event.event_time)
    )

  const hasSide = openCollections.length > 0 || !!loggedInUser || !!data?.calendarToken
  // No celular vira uma coluna só, nesta ordem; no desktop, duas colunas
  const ORDER = ["", "order-1", "order-2", "order-3", "order-4", "order-5"]
  const orderClass = (n: number) => `${ORDER[n]} lg:order-none`

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="container max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Minha Escala</h1>
          <p className="text-muted-foreground text-sm">
            {data
              ? `Olá, ${data.servantName}!`
              : "Digite seu email cadastrado para ver os eventos em que você está escalado."}
          </p>
        </div>

        {/* Formulário — oculto quando já carregou automaticamente */}
        {!(loggedInUser && data) && (
          <Card className="max-w-2xl">
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

        <div
          className={
            hasSide
              ? "flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start"
              : "flex flex-col gap-6"
          }
        >
          {/* Coluna principal */}
          <div className="contents lg:flex lg:flex-col lg:gap-6">
            {/* Próximas escalas: o que a pessoa precisa saber primeiro */}
            {data && (
              <Card className={orderClass(1)}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CalendarCheck className="h-4 w-4 text-primary" />
                    Próximas escalas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {upcoming.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Você não está escalado em nenhum evento futuro.
                    </p>
                  ) : (
                    upcoming.map(({ period, event }) => {
                      const mine = event.assignments.filter((a) => a.isMe)
                      const date = parseISO(event.event_date)
                      return (
                        <div key={event.id} className="flex gap-3 rounded-lg border p-3">
                          <div className="flex flex-col items-center justify-center rounded-md bg-brand/15 text-primary w-12 shrink-0 py-1.5 self-start">
                            <span className="text-lg font-bold leading-none">{format(date, "dd")}</span>
                            <span className="text-[11px] font-medium uppercase mt-0.5">
                              {format(date, "EEEE", { locale: ptBR }).slice(0, 3)}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 space-y-2">
                            <div>
                              <p className="text-sm font-semibold">{event.title}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                                <span>{event.event_time.slice(0, 5)}</span>
                                <span aria-hidden>·</span>
                                <span
                                  className="inline-block w-2 h-2 rounded-full"
                                  style={{ backgroundColor: period.ministry.color }}
                                />
                                <span>{period.ministry.name}</span>
                                {mine.length > 0 && (
                                  <>
                                    <span aria-hidden>·</span>
                                    <span className="font-medium text-foreground">
                                      {mine.map((a) => a.areaName).join(", ")}
                                    </span>
                                  </>
                                )}
                              </p>
                            </div>
                            {mine
                              .filter((a) => a.assignmentId)
                              .map((a) => (
                                <AssignmentResponse
                                  key={a.assignmentId}
                                  assignmentId={a.assignmentId!}
                                  status={a.status}
                                  eventDate={event.event_date}
                                  onChange={(status) => updateMyStatus(a.assignmentId!, status)}
                                />
                              ))}
                          </div>
                        </div>
                      )
                    })
                  )}
                </CardContent>
              </Card>
            )}

            {/* Escala completa de cada período publicado */}
            {data && data.periods.length > 0 && (
              <div className={`space-y-4 ${orderClass(3)}`}>
                <h2 className="text-sm font-semibold text-muted-foreground">Escala completa</h2>
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
                        aria-expanded={!isCollapsed}
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

                                    {/* Situação das próprias escalas (a resposta fica em "Próximas escalas") */}
                                    {event.assignments
                                      .filter((a) => a.isMe && a.assignmentId)
                                      .map((a) => (
                                        <div key={a.assignmentId} className="mt-3 pt-3 border-t">
                                          <AssignmentStatusBadge status={a.status} />
                                        </div>
                                      ))}
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

          {/* Coluna lateral: ações e preferências */}
          {hasSide && (
            <div className="contents lg:flex lg:flex-col lg:gap-6">
              {/* Minha disponibilidade — coletas abertas para o usuário logado */}
              {openCollections.length > 0 && (
                <Card className={orderClass(2)}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CalendarCheck className="h-4 w-4 text-primary" />
                      Minha disponibilidade
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {openCollections.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between gap-3 rounded-lg border p-3"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                            style={{ backgroundColor: c.ministry.color }}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {c.ministry.name} ·{" "}
                              <span className="capitalize">
                                {format(new Date(c.year, c.month - 1), "MMMM", { locale: ptBR })}
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {c.submitted_at ? (
                                <>Respondida em {format(new Date(c.submitted_at), "dd/MM 'às' HH:mm")}</>
                              ) : (
                                <span className="text-warning font-medium">Pendente</span>
                              )}
                              {c.availability_deadline && !c.late && (
                                <> · prazo {format(new Date(c.availability_deadline), "dd/MM HH:mm")}</>
                              )}
                              {c.late && <> · prazo encerrado</>}
                            </p>
                          </div>
                        </div>
                        <Button size="sm" variant={c.submitted_at ? "outline" : "default"} asChild>
                          <Link href={c.link}>{c.submitted_at ? "Editar" : "Responder"}</Link>
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Avisos no celular e calendário */}
              {data?.calendarToken && (
                <Card className={orderClass(4)}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Bell className="h-4 w-4 text-primary" />
                      Avisos e calendário
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <PushOptIn />
                    <div className="space-y-3 border-t pt-4">
                      <p className="text-sm text-muted-foreground">
                        Receba suas escalas no calendário do celular:
                      </p>
                      <CalendarSubscribe calendarToken={data.calendarToken} />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Datas bloqueadas (férias, viagens) — só para quem está logado */}
              {loggedInUser && (
                <div className={orderClass(5)}>
                  <BlockoutsCard />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
