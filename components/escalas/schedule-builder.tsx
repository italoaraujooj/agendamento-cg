"use client"

import { useState, useMemo, useRef } from "react"
import { toPng } from "html-to-image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Check,
  X,
  AlertCircle,
  Loader2,
  Crown,
  Calendar,
  Clock,
  Users,
  Eye,
  CircleMinus,
  CirclePlus,
  ImageDown,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  HelpCircle,
  Clock3,
  AlertTriangle,
  CheckCheck,
} from "lucide-react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"
import type {
  ScheduleEvent,
  Servant,
  Area,
  ServantAvailability,
  ScheduleAssignment,
  ServantConflict,
} from "@/types/escalas"

interface ScheduleBuilderProps {
  periodId: string
  periodLabel?: string
  /** Respostas enviadas depois deste momento são marcadas como tardias */
  availabilityDeadline?: string | null
  /** Mesma pessoa escalada em outro evento no mesmo horário (inclusive outros ministérios) */
  conflicts?: ServantConflict[]
  /** Motivo de recusa por atribuição (visível só para quem gerencia) */
  declineReasons?: Record<string, string | null>
  events: ScheduleEvent[]
  areas: Area[]
  servants: Servant[]
  availabilities: ServantAvailability[]
  assignments: ScheduleAssignment[]
  onAssignmentChange: () => void
}

export function ScheduleBuilder({
  periodId,
  periodLabel,
  availabilityDeadline,
  conflicts = [],
  declineReasons = {},
  events,
  areas,
  servants,
  availabilities,
  assignments,
  onAssignmentChange,
}: ScheduleBuilderProps) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    events.length > 0 ? events[0].id : null
  )
  const [loading, setLoading] = useState<string | null>(null)
  const [addingAreaId, setAddingAreaId] = useState<string | null>(null)
  const [summarySort, setSummarySort] = useState<"name" | "available" | "area">("name")
  const [filteredServantId, setFilteredServantId] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  // Mapa de indisponíveis: servant_id-event_id → false
  const unavailableSet = useMemo(() => {
    const set = new Set<string>()
    availabilities.forEach((a) => {
      if (!a.is_available) set.add(`${a.servant_id}-${a.event_id}`)
    })
    return set
  }, [availabilities])

  const isServantAvailable = (servantId: string, eventId: string) =>
    !unavailableSet.has(`${servantId}-${eventId}`)

  // Quem respondeu, quem alterou depois do prazo e o motivo de cada indisponibilidade.
  // Sem resposta = considerado disponível, mas sinalizado com "?"
  const { respondedSet, lateSet, unavailableReason } = useMemo(() => {
    const responded = new Set<string>()
    const late = new Set<string>()
    const reasons = new Map<string, string>()
    const deadline = availabilityDeadline ? new Date(availabilityDeadline) : null
    availabilities.forEach((a) => {
      responded.add(a.servant_id)
      // Registros legados de auto-preenchimento não contam como alteração tardia
      const autoFilled = !!a.notes?.includes("automaticamente")
      if (deadline && !autoFilled && new Date(a.submitted_at) > deadline) late.add(a.servant_id)
      if (!a.is_available && a.notes) reasons.set(`${a.servant_id}-${a.event_id}`, a.notes)
    })
    return { respondedSet: responded, lateSet: late, unavailableReason: reasons }
  }, [availabilities, availabilityDeadline])

  // Conflitos por servo+evento: "Ministério · Evento (Área)" já escalado no mesmo horário
  const conflictMap = useMemo(() => {
    const map = new Map<string, ServantConflict["other"][]>()
    conflicts.forEach((c) => {
      const key = `${c.servant_id}-${c.event_id}`
      map.set(key, [...(map.get(key) ?? []), c.other])
    })
    return map
  }, [conflicts])

  const describeConflicts = (others: ServantConflict["other"][]) =>
    others
      .map((o) => `${o.same_ministry ? "" : `${o.ministry} · `}${o.title}${o.area ? ` (${o.area})` : ""}`)
      .join("; ")

  // Quem recusou continua visível (para o líder substituir), mas não preenche a vaga
  const filledAssignments = useMemo(
    () => assignments.filter((a) => a.status !== "declined"),
    [assignments]
  )
  const declinedCount = assignments.length - filledAssignments.length
  // Avisados por e-mail e ainda sem resposta
  const awaitingCount = assignments.filter((a) => a.status === "pending" && a.notified_at).length

  // Atribuições já feitas que batem com outro compromisso no mesmo horário
  const assignedConflictCount = useMemo(
    () => filledAssignments.filter((a) => conflictMap.has(`${a.servant_id}-${a.schedule_event_id}`)).length,
    [filledAssignments, conflictMap]
  )

  const groupByEvent = (list: ScheduleAssignment[]) => {
    const assignmentMap = new Map<string, ScheduleAssignment[]>()
    list.forEach((a) => {
      const key = a.schedule_event_id
      if (!assignmentMap.has(key)) assignmentMap.set(key, [])
      assignmentMap.get(key)!.push(a)
    })
    return (eventId: string) => assignmentMap.get(eventId) || []
  }
  // Todas (inclui recusadas) — para exibir os chips
  const getEventAssignments = useMemo(() => groupByEvent(assignments), [assignments])
  // Só as que preenchem a vaga — para completude
  const getFilledEventAssignments = useMemo(() => groupByEvent(filledAssignments), [filledAssignments])

  const getAreaServants = useMemo(() => {
    const servantMap = new Map<string, Servant[]>()
    servants.forEach((s) => {
      if (!s.is_active) return
      // Collect all area IDs this servant belongs to (primary + servant_areas)
      const areaIds = new Set<string>([s.area_id])
      s.servant_areas?.forEach((sa) => areaIds.add(sa.area_id))
      areaIds.forEach((areaId) => {
        if (!servantMap.has(areaId)) servantMap.set(areaId, [])
        if (!servantMap.get(areaId)!.some((x) => x.id === s.id)) {
          servantMap.get(areaId)!.push(s)
        }
      })
    })
    return (areaId: string) => servantMap.get(areaId) || []
  }, [servants])

  // Contador de atribuições por servo
  const servantAssignmentCount = useMemo(() => {
    const countMap = new Map<string, number>()
    filledAssignments.forEach((a) => {
      countMap.set(a.servant_id, (countMap.get(a.servant_id) || 0) + 1)
    })
    return countMap
  }, [filledAssignments])

  // Quantidade de eventos em que cada servo está disponível
  const servantAvailableEventCount = useMemo(() => {
    const countMap = new Map<string, number>()
    servants.forEach((s) => {
      const count = events.filter((e) => !unavailableSet.has(`${s.id}-${e.id}`)).length
      countMap.set(s.id, count)
    })
    return countMap
  }, [servants, events, unavailableSet])

  // Quantidade de servos disponíveis por evento (total do ministério)
  const eventAvailableServantCount = useMemo(() => {
    const countMap = new Map<string, number>()
    events.forEach((e) => {
      const count = servants.filter((s) => !unavailableSet.has(`${s.id}-${e.id}`)).length
      countMap.set(e.id, count)
    })
    return countMap
  }, [servants, events, unavailableSet])

  // Resumo por servo (um registro por pessoa no ministério) para o painel de visão geral
  const servantSummary = useMemo(() => {
    const areaNameById = new Map(areas.map((a) => [a.id, a.name]))
    return servants
      .map((s) => {
        const areaIds = new Set([s.area_id, ...(s.servant_areas ?? []).map((sa) => sa.area_id)])
        return {
          id: s.id,
          name: s.name,
          areas: [...areaIds].map((id) => areaNameById.get(id)).filter((n): n is string => !!n),
          isLeader: !!s.is_leader,
          availCount: servantAvailableEventCount.get(s.id) ?? 0,
          assignCount: servantAssignmentCount.get(s.id) ?? 0,
          responded: respondedSet.has(s.id),
          late: lateSet.has(s.id),
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name)) // ordenação base sempre por nome
  }, [servants, areas, servantAvailableEventCount, servantAssignmentCount, respondedSet, lateSet])

  const filteredServantName = servantSummary.find((s) => s.id === filteredServantId)?.name ?? null

  const sortedSummary = useMemo(() => {
    const copy = [...servantSummary]
    if (summarySort === "available") {
      copy.sort((a, b) => b.availCount - a.availCount || a.name.localeCompare(b.name))
    } else if (summarySort === "area") {
      copy.sort((a, b) => {
        const aArea = a.areas[0] || ""
        const bArea = b.areas[0] || ""
        return aArea.localeCompare(bArea) || a.name.localeCompare(b.name)
      })
    }
    // "name" já está em ordem pela base
    return copy
  }, [servantSummary, summarySort])

  const filteredEvents = useMemo(() => {
    if (!filteredServantId) return events
    return events.filter((e) => !unavailableSet.has(`${filteredServantId}-${e.id}`))
  }, [filteredServantId, events, unavailableSet])

  const sortedFilteredEvents = useMemo(
    () =>
      [...filteredEvents].sort((a, b) => {
        const dc = a.event_date.localeCompare(b.event_date)
        return dc !== 0 ? dc : a.event_time.localeCompare(b.event_time)
      }),
    [filteredEvents]
  )

  const currentFilteredIndex = sortedFilteredEvents.findIndex((e) => e.id === selectedEventId)

  const goToPrev = () => {
    if (currentFilteredIndex > 0) {
      setSelectedEventId(sortedFilteredEvents[currentFilteredIndex - 1].id)
    }
  }

  const goToNext = () => {
    if (currentFilteredIndex < sortedFilteredEvents.length - 1) {
      setSelectedEventId(sortedFilteredEvents[currentFilteredIndex + 1].id)
    }
  }

  const handleServantFilter = (servantId: string) => {
    if (filteredServantId === servantId) {
      setFilteredServantId(null)
    } else {
      setFilteredServantId(servantId)
      const available = events
        .filter((e) => !unavailableSet.has(`${servantId}-${e.id}`))
        .sort((a, b) => {
          const dc = a.event_date.localeCompare(b.event_date)
          return dc !== 0 ? dc : a.event_time.localeCompare(b.event_time)
        })
      if (!selectedEventId || !available.some((e) => e.id === selectedEventId)) {
        setSelectedEventId(available.length > 0 ? available[0].id : null)
      }
    }
  }

  const handleExportImage = async () => {
    if (!exportRef.current) return
    setExporting(true)
    try {
      const dataUrl = await toPng(exportRef.current, {
        cacheBust: true,
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      })
      const link = document.createElement("a")
      const filename = periodLabel
        ? `escala-${periodLabel.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.png`
        : "escala.png"
      link.download = filename
      link.href = dataUrl
      link.click()
    } catch {
      toast.error("Erro ao gerar imagem")
    } finally {
      setExporting(false)
    }
  }

  const selectedEvent = events.find((e) => e.id === selectedEventId)
  const eventAssignments = selectedEventId ? getEventAssignments(selectedEventId) : []

  const handleAddAssignment = async (eventId: string, servantId: string, areaId: string) => {
    setLoading(`${eventId}-${areaId}`)
    try {
      const response = await fetch("/api/escalas/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schedule_event_id: eventId,
          servant_id: servantId,
          area_id: areaId,
          mode: "add",
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Erro ao atribuir")
      }

      onAssignmentChange()
    } catch (error) {
      console.error("Erro:", error)
      toast.error(error instanceof Error ? error.message : "Erro ao atribuir")
    } finally {
      setLoading(null)
    }
  }

  // Conflito de horário: pede confirmação antes de escalar
  const [pendingConflict, setPendingConflict] = useState<{
    eventId: string
    servantId: string
    areaId: string
    servantName: string
    others: ServantConflict["other"][]
  } | null>(null)

  const requestAssignment = (eventId: string, servantId: string, areaId: string) => {
    const others = conflictMap.get(`${servantId}-${eventId}`)
    if (others?.length) {
      const servantName = servants.find((s) => s.id === servantId)?.name ?? "Este servo"
      setPendingConflict({ eventId, servantId, areaId, servantName, others })
      return
    }
    handleAddAssignment(eventId, servantId, areaId)
  }

  const handleRemoveAssignmentById = async (assignmentId: string) => {
    setLoading(`remove-${assignmentId}`)
    try {
      const response = await fetch(
        `/api/escalas/assignments?id=${assignmentId}`,
        { method: "DELETE" }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Erro ao remover")
      }

      onAssignmentChange()
    } catch (error) {
      console.error("Erro:", error)
      toast.error(error instanceof Error ? error.message : "Erro ao remover")
    } finally {
      setLoading(null)
    }
  }

  const formatEventDate = (dateStr: string) =>
    format(parseISO(dateStr), "EEE, dd/MM", { locale: ptBR })

  // Retorna as áreas exigidas para um evento (null/vazio → todas)
  const getRequiredAreas = (event: ScheduleEvent) => {
    if (!event.requires_areas || event.requires_areas.length === 0) return areas
    return areas.filter((a) => event.requires_areas!.includes(a.id))
  }

  const handleToggleAreaRequirement = async (event: ScheduleEvent, areaId: string) => {
    const allAreaIds = areas.map((a) => a.id)
    const currentRequired = event.requires_areas ?? allAreaIds
    const isRequired = currentRequired.includes(areaId)

    const updated = isRequired
      ? currentRequired.filter((id) => id !== areaId)
      : [...currentRequired, areaId]

    // Se todas as áreas estiverem incluídas, usar null (= todas obrigatórias)
    const newRequired = updated.length >= allAreaIds.length ? null : updated

    setLoading(`area-req-${event.id}-${areaId}`)
    try {
      const res = await fetch(`/api/escalas/schedule-events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requires_areas: newRequired }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Erro ao atualizar")
      }
      onAssignmentChange()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar área")
    } finally {
      setLoading(null)
    }
  }

  const completedEvents = events.filter((event) => {
    const eventAssigns = getFilledEventAssignments(event.id)
    return getRequiredAreas(event).every((area) => eventAssigns.some((a) => a.area_id === area.id))
  }).length

  // Pré-computar mapa de atribuições por evento+área para a prévia (múltiplos por área)
  const assignmentsByEventArea = useMemo(() => {
    const map = new Map<string, ScheduleAssignment[]>()
    filledAssignments.forEach((a) => {
      const key = `${a.schedule_event_id}-${a.area_id}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(a)
    })
    return map
  }, [filledAssignments])

  const sortedEvents = useMemo(
    () =>
      [...events].sort((a, b) => {
        const dc = a.event_date.localeCompare(b.event_date)
        return dc !== 0 ? dc : a.event_time.localeCompare(b.event_time)
      }),
    [events]
  )

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {declinedCount > 0 && (
          <Badge
            variant="outline"
            className="border-red-300 text-red-700 dark:text-red-400 gap-1"
            title="Servos que recusaram — a vaga precisa de substituto"
          >
            <X className="h-3 w-3" />
            {declinedCount} recusa(s)
          </Badge>
        )}
        {awaitingCount > 0 && (
          <Badge variant="outline" className="gap-1 text-muted-foreground" title="Avisados por e-mail, ainda sem resposta">
            <Clock className="h-3 w-3" />
            {awaitingCount} aguardando confirmação
          </Badge>
        )}
        {assignedConflictCount > 0 && (
          <Badge
            variant="outline"
            className="border-amber-400 text-amber-700 dark:text-amber-400 gap-1"
            title="Pessoas escaladas em outro evento no mesmo horário (inclusive em outros ministérios)"
          >
            <AlertTriangle className="h-3 w-3" />
            {assignedConflictCount} conflito(s) de horário
          </Badge>
        )}
        <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
          <Eye className="mr-2 h-4 w-4" />
          Ver Prévia da Escala
        </Button>
      </div>

      {/* Mobile: Event Navigator */}
      <div className="lg:hidden">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 flex-shrink-0"
                onClick={goToPrev}
                disabled={currentFilteredIndex <= 0}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>

              <div className="flex-1 text-center min-w-0">
                {selectedEvent ? (
                  <>
                    <div className="flex items-center justify-center gap-2">
                      <p className="text-sm font-semibold capitalize">
                        {format(parseISO(selectedEvent.event_date), "EEE, dd/MM", { locale: ptBR })}
                      </p>
                      {(() => {
                        const assigns = getFilledEventAssignments(selectedEvent.id)
                        const required = getRequiredAreas(selectedEvent)
                        const done = new Set(
                          assigns.filter((a) => required.some((r) => r.id === a.area_id)).map((a) => a.area_id)
                        ).size
                        return done === required.length ? (
                          <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <Badge variant="outline" className="text-xs flex-shrink-0">
                            {done}/{required.length}
                          </Badge>
                        )
                      })()}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {selectedEvent.event_time.slice(0, 5)} — {selectedEvent.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {currentFilteredIndex + 1} / {sortedFilteredEvents.length}
                      {filteredServantName && (
                        <span className="ml-1.5 text-primary font-medium">
                          · {filteredServantName.split(" ")[0]}
                          <button
                            onClick={(e) => { e.stopPropagation(); setFilteredServantId(null) }}
                            className="ml-1 hover:opacity-70"
                          >
                            <X className="inline h-3 w-3" />
                          </button>
                        </span>
                      )}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum evento</p>
                )}
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 flex-shrink-0"
                onClick={goToNext}
                disabled={currentFilteredIndex >= sortedFilteredEvents.length - 1}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Eventos — desktop only */}
        <div className="hidden lg:block lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Eventos</CardTitle>
                <div className="flex items-center gap-1">
                  {filteredServantName && (
                    <Badge variant="secondary" className="text-xs flex items-center gap-1 max-w-[110px]">
                      <span className="truncate">{filteredServantName.split(" ")[0]}</span>
                      <button
                        onClick={() => setFilteredServantId(null)}
                        className="flex-shrink-0 hover:opacity-70"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  <Badge variant="outline">
                    {completedEvents}/{events.length}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="space-y-1 p-2">
                  {sortedFilteredEvents.length === 0 && filteredServantName ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhum evento disponível para {filteredServantName.split(" ")[0]}
                    </p>
                  ) : null}
                  {sortedFilteredEvents.map((event) => {
                    const assigns = getFilledEventAssignments(event.id)
                    const required = getRequiredAreas(event)
                    const assignedAreaIds = new Set(
                      assigns.filter((a) => required.some((r) => r.id === a.area_id)).map((a) => a.area_id)
                    )
                    const assignedRequired = assignedAreaIds.size
                    const isComplete = assignedRequired === required.length
                    const availableCount = eventAvailableServantCount.get(event.id) ?? 0
                    const isSelected = selectedEventId === event.id

                    return (
                      <button
                        key={event.id}
                        onClick={() => setSelectedEventId(event.id)}
                        className={`w-full text-left p-3 rounded-lg transition-colors ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">
                              {formatEventDate(event.event_date)}
                            </p>
                            <p className="text-xs opacity-80">
                              {event.event_time.slice(0, 5)} — {event.title}
                            </p>
                            <p className={`text-xs mt-0.5 ${isSelected ? "opacity-70" : "text-muted-foreground"}`}>
                              <Users className="inline h-3 w-3 mr-0.5" />
                              {availableCount} disponív.
                            </p>
                          </div>
                          {isComplete ? (
                            <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                          ) : (
                            <Badge variant="outline" className="text-xs flex-shrink-0">
                              {assignedRequired}/{required.length}
                            </Badge>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Painel de Atribuição */}
        <div className="col-span-1 lg:col-span-2">
          {selectedEvent ? (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle>
                      {format(parseISO(selectedEvent.event_date), "EEEE, dd 'de' MMMM", {
                        locale: ptBR,
                      })}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                      <Clock className="h-4 w-4" />
                      {selectedEvent.event_time.slice(0, 5)} — {selectedEvent.title}
                      <span className="ml-1 text-xs">
                        · {eventAvailableServantCount.get(selectedEvent.id) ?? 0} servo(s) disponível(is)
                      </span>
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {areas.map((area) => {
                  const areaServants = getAreaServants(area.id)
                  const areaAssignments = eventAssignments.filter((a) => a.area_id === area.id)
                  const assignedServantIds = new Set(areaAssignments.map((a) => a.servant_id))
                  const isAdding = addingAreaId === area.id
                  const isAreaLoading = loading === `${selectedEvent.id}-${area.id}`
                  const isToggling = loading === `area-req-${selectedEvent.id}-${area.id}`
                  const isRequired =
                    !selectedEvent.requires_areas ||
                    selectedEvent.requires_areas.includes(area.id)

                  return (
                    <div
                      key={area.id}
                      className={`space-y-2 transition-opacity ${!isRequired ? "opacity-50" : ""}`}
                    >
                      {/* Cabeçalho da área */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h4 className={`font-medium ${!isRequired ? "line-through text-muted-foreground" : ""}`}>
                            {area.name}
                          </h4>
                          {!isRequired && (
                            <Badge variant="outline" className="text-xs">Não aplicável</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Adicionar servo */}
                          {isRequired && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              title="Adicionar servo"
                              onClick={() => setAddingAreaId(isAdding ? null : area.id)}
                              disabled={isToggling || !!loading}
                            >
                              <Plus className="h-3.5 w-3.5 text-emerald-600" />
                            </Button>
                          )}
                          {/* Excluir/restaurar área */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title={isRequired ? "Excluir área deste evento" : "Restaurar área neste evento"}
                            onClick={() => handleToggleAreaRequirement(selectedEvent, area.id)}
                            disabled={isToggling || !!loading}
                          >
                            {isToggling ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : isRequired ? (
                              <CircleMinus className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <CirclePlus className="h-3.5 w-3.5 text-emerald-600" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {!isRequired ? (
                        <p className="text-xs text-muted-foreground">
                          Esta área não é necessária neste evento.
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {/* Chips de servos atribuídos */}
                          {areaAssignments.map((assignment) => {
                            const isRemoving = loading === `remove-${assignment.id}`
                            const declined = assignment.status === "declined"
                            const chipConflicts = declined
                              ? undefined
                              : conflictMap.get(`${assignment.servant_id}-${assignment.schedule_event_id}`)
                            const declineReason = declineReasons[assignment.id]
                            return (
                              <div
                                key={assignment.id}
                                className={`flex items-center justify-between px-2.5 py-1.5 rounded-md border ${
                                  declined
                                    ? "border-red-300 bg-red-50 dark:bg-red-950"
                                    : chipConflicts
                                      ? "border-amber-400 bg-amber-50 dark:bg-amber-950"
                                      : "border-green-500 bg-green-50 dark:bg-green-950"
                                }`}
                                title={
                                  declined
                                    ? `Recusou${declineReason ? `: ${declineReason}` : ""} — remova e escale um substituto`
                                    : chipConflicts
                                      ? `Mesmo horário: ${describeConflicts(chipConflicts)}`
                                      : undefined
                                }
                              >
                                <div className="flex items-center gap-1.5 text-sm min-w-0">
                                  {declined ? (
                                    <X className="h-3 w-3 text-red-500 flex-shrink-0" />
                                  ) : assignment.status === "accepted" ? (
                                    <CheckCheck className="h-3 w-3 text-green-600 flex-shrink-0" aria-label="Confirmou" />
                                  ) : assignment.notified_at ? (
                                    <Clock className="h-3 w-3 text-amber-500 flex-shrink-0" aria-label="Aguardando confirmação" />
                                  ) : null}
                                  {chipConflicts && (
                                    <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0" />
                                  )}
                                  {(assignment.servant as { is_leader?: boolean } | null)?.is_leader && (
                                    <Crown className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                                  )}
                                  <span className={`font-medium truncate ${declined ? "line-through text-muted-foreground" : ""}`}>
                                    {(assignment.servant as { name?: string } | null)?.name ?? "—"}
                                  </span>
                                  {declined && (
                                    <span className="text-xs text-red-700 dark:text-red-400 truncate">
                                      recusou{declineReason ? `: ${declineReason}` : ""}
                                    </span>
                                  )}
                                  {chipConflicts && (
                                    <span className="text-xs text-amber-700 dark:text-amber-400 truncate">
                                      também em {describeConflicts(chipConflicts)}
                                    </span>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 flex-shrink-0"
                                  onClick={() => handleRemoveAssignmentById(assignment.id)}
                                  disabled={!!loading}
                                >
                                  {isRemoving ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <X className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            )
                          })}

                          {/* Select de adição: sempre visível se vazio, ou quando "+" foi clicado */}
                          {(areaAssignments.length === 0 || isAdding) && (
                            <div className={isAdding && areaAssignments.length > 0 ? "flex items-center gap-1.5" : ""}>
                              <Select
                                value=""
                                onValueChange={(servantId) => {
                                  requestAssignment(selectedEvent.id, servantId, area.id)
                                  setAddingAreaId(null)
                                }}
                                disabled={isAreaLoading}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue
                                    placeholder={
                                      areaAssignments.length === 0
                                        ? "Selecionar servo..."
                                        : "Adicionar servo..."
                                    }
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {areaServants.filter((s) => !assignedServantIds.has(s.id)).length === 0 ? (
                                    <div className="p-2 text-sm text-muted-foreground">
                                      {areaServants.length === 0
                                        ? "Nenhum servo cadastrado nesta área"
                                        : "Todos os servos já foram adicionados"}
                                    </div>
                                  ) : (
                                    areaServants
                                      .filter((s) => !assignedServantIds.has(s.id))
                                      .sort((a, b) => {
                                        if (a.is_leader !== b.is_leader) return b.is_leader ? 1 : -1
                                        return a.name.localeCompare(b.name)
                                      })
                                      .map((servant) => {
                                        const available = isServantAvailable(servant.id, selectedEvent.id)
                                        const responded = respondedSet.has(servant.id)
                                        const reason = unavailableReason.get(`${servant.id}-${selectedEvent.id}`)
                                        const assignCount = servantAssignmentCount.get(servant.id) || 0
                                        const availEventCount = servantAvailableEventCount.get(servant.id) ?? 0
                                        // Já escalado em outra área deste mesmo evento
                                        const otherAreaId = eventAssignments.find(
                                          (a) => a.servant_id === servant.id && a.area_id !== area.id
                                        )?.area_id
                                        const otherAreaName = otherAreaId
                                          ? areas.find((a) => a.id === otherAreaId)?.name ?? "outra área"
                                          : null
                                        const conflictOthers = conflictMap.get(`${servant.id}-${selectedEvent.id}`)
                                        const selectable = available && !otherAreaName
                                        return (
                                          <SelectItem
                                            key={servant.id}
                                            value={servant.id}
                                            disabled={!selectable}
                                            className={!selectable ? "opacity-50" : ""}
                                          >
                                            <div
                                              className="flex items-center gap-2 w-full"
                                              title={
                                                otherAreaName
                                                  ? `Já escalado em ${otherAreaName} neste evento`
                                                  : !available
                                                    ? `Indisponível${reason ? `: ${reason}` : ""}`
                                                    : conflictOthers
                                                      ? `Mesmo horário: ${describeConflicts(conflictOthers)}`
                                                      : !responded
                                                        ? "Não respondeu a disponibilidade (considerado disponível)"
                                                        : undefined
                                              }
                                            >
                                              {otherAreaName ? (
                                                <CircleMinus className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                              ) : !available ? (
                                                <AlertCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
                                              ) : conflictOthers ? (
                                                <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0" />
                                              ) : responded ? (
                                                <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
                                              ) : (
                                                <HelpCircle className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                              )}
                                              <span className="flex-1 truncate">
                                                {servant.name}
                                                {servant.is_leader && (
                                                  <Crown className="inline h-3 w-3 text-yellow-500 ml-1 flex-shrink-0" />
                                                )}
                                                {otherAreaName ? (
                                                  <span className="ml-1 text-xs text-muted-foreground">(já em {otherAreaName})</span>
                                                ) : !available && reason ? (
                                                  <span className="ml-1 text-xs text-muted-foreground">({reason})</span>
                                                ) : available && conflictOthers ? (
                                                  <span className="ml-1 text-xs text-amber-700 dark:text-amber-400">
                                                    (mesmo horário: {describeConflicts(conflictOthers)})
                                                  </span>
                                                ) : null}
                                                {lateSet.has(servant.id) && (
                                                  <Clock3
                                                    className="inline h-3 w-3 text-amber-500 ml-1 flex-shrink-0"
                                                    aria-label="Alterou a disponibilidade após o prazo"
                                                  />
                                                )}
                                              </span>
                                              <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
                                                <Badge
                                                  variant="outline"
                                                  className="text-xs"
                                                  title={`Disponível em ${availEventCount} de ${events.length} eventos`}
                                                >
                                                  {availEventCount}/{events.length}
                                                </Badge>
                                                <Badge
                                                  variant={assignCount > 0 ? "secondary" : "outline"}
                                                  className="text-xs"
                                                  title={`Atribuído em ${assignCount} evento(s)`}
                                                >
                                                  {assignCount}×
                                                </Badge>
                                              </div>
                                            </div>
                                          </SelectItem>
                                        )
                                      })
                                  )}
                                </SelectContent>
                              </Select>
                              {isAdding && areaAssignments.length > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 w-9 p-0 flex-shrink-0"
                                  title="Cancelar"
                                  onClick={() => setAddingAreaId(null)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">
                  Selecione um evento para montar a escala
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Resumo dos Servos */}
      {servants.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <button
                className="flex items-center gap-2 flex-1 text-left"
                onClick={() => setSummaryOpen((v) => !v)}
              >
                <CardTitle className="text-base">Resumo dos Servos</CardTitle>
                <Badge variant="outline" className="text-xs font-normal">
                  {sortedSummary.length}
                </Badge>
                {summaryOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground lg:hidden" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground lg:hidden" />
                )}
              </button>
              <div className={`flex items-center gap-1 ${!summaryOpen ? "hidden lg:flex" : ""}`}>
                <span className="text-xs text-muted-foreground mr-1">Ordenar:</span>
                {(["name", "available", "area"] as const).map((mode) => (
                  <Button
                    key={mode}
                    variant={summarySort === mode ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setSummarySort(mode)}
                  >
                    {mode === "name" ? "A–Z" : mode === "available" ? "Disponíveis" : "Área"}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className={`${summaryOpen ? "" : "hidden lg:block"}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {sortedSummary.map((servant) => {
                const availRatio = events.length > 0 ? servant.availCount / events.length : 1

                return (
                  <div
                    key={servant.id}
                    onClick={() => handleServantFilter(servant.id)}
                    className={`flex items-center justify-between gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                      filteredServantId === servant.id
                        ? "bg-primary/10 ring-1 ring-primary"
                        : "bg-muted/50 hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {servant.isLeader && (
                        <Crown className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                      )}
                      <span className="text-sm font-medium truncate">
                        {servant.name}
                      </span>
                      {servant.areas.length > 0 && (
                        <Badge variant="outline" className="text-xs flex-shrink-0 hidden sm:inline-flex">
                          {servant.areas.join(", ")}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {servant.late && (
                        <Clock3
                          className="h-3.5 w-3.5 text-amber-500"
                          aria-label="Alterou a disponibilidade após o prazo"
                        />
                      )}
                      {servant.responded ? (
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            availRatio < 0.5
                              ? "border-red-300 text-red-600"
                              : availRatio < 0.8
                              ? "border-amber-300 text-amber-600"
                              : "border-green-300 text-green-600"
                          }`}
                          title={`Disponível em ${servant.availCount} de ${events.length} eventos`}
                        >
                          disp. {servant.availCount}/{events.length}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-xs text-muted-foreground border-dashed"
                          title="Não respondeu a disponibilidade (considerado disponível)"
                        >
                          <HelpCircle className="mr-1 h-3 w-3" />
                          sem resposta
                        </Badge>
                      )}
                      <Badge
                        variant={servant.assignCount > 0 ? "secondary" : "outline"}
                        className="text-xs"
                        title={`Atribuído em ${servant.assignCount} evento(s)`}
                      >
                        ×{servant.assignCount}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmação: conflito de horário */}
      <Dialog open={!!pendingConflict} onOpenChange={(open) => !open && setPendingConflict(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Conflito de horário
            </DialogTitle>
            <DialogDescription>
              {pendingConflict?.servantName} já está escalado(a) no mesmo horário em:
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-1.5 text-sm">
            {pendingConflict?.others.map((o) => (
              <li key={o.event_id} className="rounded-md border px-3 py-2">
                <span className="font-medium">{o.title}</span>
                <span className="text-muted-foreground">
                  {" "}· {o.same_ministry ? "este ministério" : o.ministry}
                  {o.area ? ` · ${o.area}` : ""} · {o.time}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setPendingConflict(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (pendingConflict) {
                  handleAddAssignment(pendingConflict.eventId, pendingConflict.servantId, pendingConflict.areaId)
                }
                setPendingConflict(null)
              }}
            >
              Escalar mesmo assim
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Prévia da Escala */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl w-full">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle>Prévia da Escala</DialogTitle>
                <DialogDescription>
                  {completedEvents}/{events.length} eventos completos
                </DialogDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportImage}
                disabled={exporting}
                className="flex-shrink-0 mt-1"
              >
                {exporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ImageDown className="mr-2 h-4 w-4" />
                )}
                {exporting ? "Gerando..." : "Salvar imagem"}
              </Button>
            </div>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[72vh] space-y-6 pr-1">
            {(() => {
              const groups = new Map<string, ScheduleEvent[]>()
              sortedEvents.forEach((event) => {
                if (!groups.has(event.event_date)) groups.set(event.event_date, [])
                groups.get(event.event_date)!.push(event)
              })
              return Array.from(groups.entries()).map(([date, dayEvents]) => (
                <div key={date} className="space-y-3">
                  {/* Cabeçalho do dia */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                      {format(parseISO(date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  {/* Eventos do dia */}
                  <div className="space-y-2">
                    {dayEvents.map((event) => {
                      const required = getRequiredAreas(event)
                      const assignedCount = required.filter((area) =>
                        (assignmentsByEventArea.get(`${event.id}-${area.id}`) ?? []).length > 0
                      ).length
                      const isComplete = assignedCount === required.length

                      return (
                        <div
                          key={event.id}
                          className={`rounded-lg border px-4 py-3 ${
                            !isComplete
                              ? "border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20"
                              : "bg-muted/30"
                          }`}
                        >
                          {/* Linha do evento */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                              <span className="text-xs font-mono text-muted-foreground bg-background border rounded px-1.5 py-0.5 leading-tight">
                                {event.event_time.slice(0, 5)}
                              </span>
                              <span className="font-semibold text-sm">{event.title}</span>
                            </div>
                            {isComplete ? (
                              <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                            ) : (
                              <span className="text-xs font-medium text-amber-600 dark:text-amber-400 flex-shrink-0">
                                {assignedCount}/{required.length} áreas
                              </span>
                            )}
                          </div>

                          {/* Grid de áreas */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                            {areas.map((area) => {
                              const areaList = assignmentsByEventArea.get(`${event.id}-${area.id}`) ?? []
                              const isAreaRequired =
                                !event.requires_areas || event.requires_areas.includes(area.id)
                              return (
                                <div
                                  key={area.id}
                                  className={!isAreaRequired ? "opacity-35" : ""}
                                >
                                  <p className="text-xs text-muted-foreground font-medium mb-0.5">
                                    {area.name}
                                  </p>
                                  {!isAreaRequired ? (
                                    <p className="text-sm italic text-muted-foreground">N/A</p>
                                  ) : areaList.length > 0 ? (
                                    <div className="space-y-0.5">
                                      {areaList.map((a, i) => (
                                        <p key={i} className="text-sm flex items-center gap-1">
                                          {(a.servant as { is_leader?: boolean } | null)?.is_leader && (
                                            <Crown className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                                          )}
                                          {(a.servant as { name?: string } | null)?.name ?? "—"}
                                        </p>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-muted-foreground">—</p>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Div off-screen usada para gerar a imagem exportada */}
      <div
        ref={exportRef}
        aria-hidden="true"
        style={{
          position: "fixed",
          left: "-9999px",
          top: 0,
          width: "800px",
          backgroundColor: "#ffffff",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "40px",
          color: "#111827",
        }}
      >
        {/* Cabeçalho da imagem */}
        {periodLabel && (
          <div style={{ marginBottom: "28px" }}>
            <p style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6b7280", marginBottom: "4px" }}>
              Escala
            </p>
            <p style={{ fontSize: "22px", fontWeight: 700, color: "#111827" }}>
              {periodLabel}
            </p>
          </div>
        )}

        {/* Conteúdo agrupado por dia */}
        {(() => {
          const groups = new Map<string, ScheduleEvent[]>()
          sortedEvents.forEach((event) => {
            if (!groups.has(event.event_date)) groups.set(event.event_date, [])
            groups.get(event.event_date)!.push(event)
          })
          return Array.from(groups.entries()).map(([date, dayEvents], groupIdx) => (
            <div key={date} style={{ marginBottom: groupIdx < groups.size - 1 ? "28px" : 0 }}>
              {/* Cabeçalho do dia */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b7280", whiteSpace: "nowrap" }}>
                  {format(parseISO(date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </span>
                <div style={{ flex: 1, height: "1px", backgroundColor: "#e5e7eb" }} />
              </div>

              {/* Eventos do dia */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {dayEvents.map((event) => {
                  const required = getRequiredAreas(event)
                  const isComplete = required.every((area) =>
                    (assignmentsByEventArea.get(`${event.id}-${area.id}`) ?? []).length > 0
                  )
                  return (
                    <div
                      key={event.id}
                      style={{
                        borderRadius: "8px",
                        border: `1px solid ${!isComplete ? "#fcd34d" : "#e5e7eb"}`,
                        backgroundColor: !isComplete ? "#fffbeb" : "#f9fafb",
                        padding: "14px 16px",
                      }}
                    >
                      {/* Linha do evento */}
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                        <span style={{ fontSize: "12px", fontFamily: "monospace", color: "#6b7280", backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "4px", padding: "2px 6px" }}>
                          {event.event_time.slice(0, 5)}
                        </span>
                        <span style={{ fontSize: "15px", fontWeight: 600, color: "#111827" }}>
                          {event.title}
                        </span>
                      </div>

                      {/* Grid de áreas */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px 24px" }}>
                        {areas.map((area) => {
                          const areaList = assignmentsByEventArea.get(`${event.id}-${area.id}`) ?? []
                          const isAreaRequired = !event.requires_areas || event.requires_areas.includes(area.id)
                          return (
                            <div key={area.id} style={{ opacity: !isAreaRequired ? 0.35 : 1 }}>
                              <p style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: "2px" }}>
                                {area.name}
                              </p>
                              {!isAreaRequired ? (
                                <p style={{ fontSize: "13px", color: "#9ca3af", fontStyle: "italic" }}>N/A</p>
                              ) : areaList.length > 0 ? (
                                <div>
                                  {areaList.map((a, i) => (
                                    <p key={i} style={{ fontSize: "13px", color: "#111827", margin: 0 }}>
                                      {(a.servant as { name?: string } | null)?.name ?? "—"}
                                    </p>
                                  ))}
                                </div>
                              ) : (
                                <p style={{ fontSize: "13px", color: "#9ca3af" }}>—</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        })()}
      </div>
    </div>
  )
}
