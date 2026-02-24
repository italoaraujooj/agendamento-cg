"use client"

import { useState, useMemo } from "react"
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
} from "lucide-react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"
import type {
  ScheduleEvent,
  Servant,
  Area,
  ServantAvailability,
  ScheduleAssignment
} from "@/types/escalas"

interface ScheduleBuilderProps {
  periodId: string
  events: ScheduleEvent[]
  areas: Area[]
  servants: Servant[]
  availabilities: ServantAvailability[]
  assignments: ScheduleAssignment[]
  onAssignmentChange: () => void
}

export function ScheduleBuilder({
  periodId,
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
  const [summarySort, setSummarySort] = useState<"name" | "available" | "area">("name")
  const [filteredServantName, setFilteredServantName] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

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

  const getEventAssignments = useMemo(() => {
    const assignmentMap = new Map<string, ScheduleAssignment[]>()
    assignments.forEach((a) => {
      const key = a.schedule_event_id
      if (!assignmentMap.has(key)) assignmentMap.set(key, [])
      assignmentMap.get(key)!.push(a)
    })
    return (eventId: string) => assignmentMap.get(eventId) || []
  }, [assignments])

  const getAreaServants = useMemo(() => {
    const servantMap = new Map<string, Servant[]>()
    servants.forEach((s) => {
      if (!s.is_active) return
      if (!servantMap.has(s.area_id)) servantMap.set(s.area_id, [])
      servantMap.get(s.area_id)!.push(s)
    })
    return (areaId: string) => servantMap.get(areaId) || []
  }, [servants])

  // Contador de atribuições por servo
  const servantAssignmentCount = useMemo(() => {
    const countMap = new Map<string, number>()
    assignments.forEach((a) => {
      countMap.set(a.servant_id, (countMap.get(a.servant_id) || 0) + 1)
    })
    return countMap
  }, [assignments])

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

  // Resumo desduplicado por nome para o painel de visão geral
  const servantSummary = useMemo(() => {
    const groups = new Map<string, { servants: Servant[]; areas: string[] }>()

    servants.forEach((s) => {
      const key = s.name.toLowerCase().trim()
      if (!groups.has(key)) groups.set(key, { servants: [], areas: [] })
      const group = groups.get(key)!
      group.servants.push(s)
      if (s.area?.name && !group.areas.includes(s.area.name)) {
        group.areas.push(s.area.name)
      }
    })

    return Array.from(groups.values())
      .map(({ servants: group, areas }) => {
        const ids = group.map((s) => s.id)
        // Disponível no evento se pelo menos um dos IDs estiver disponível
        const availCount = events.filter((e) =>
          ids.some((id) => !unavailableSet.has(`${id}-${e.id}`))
        ).length
        // Atribuições somadas de todos os IDs
        const assignCount = ids.reduce(
          (sum, id) => sum + (servantAssignmentCount.get(id) || 0),
          0
        )
        return {
          name: group[0].name,
          areas,
          isLeader: group.some((s) => s.is_leader),
          availCount,
          assignCount,
          ids,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name)) // ordenação base sempre por nome
  }, [servants, events, unavailableSet, servantAssignmentCount])

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
    if (!filteredServantName) return events
    const summary = servantSummary.find(
      (s) => s.name.toLowerCase().trim() === filteredServantName.toLowerCase().trim()
    )
    if (!summary) return events
    return events.filter((e) => summary.ids.some((id) => !unavailableSet.has(`${id}-${e.id}`)))
  }, [filteredServantName, servantSummary, events, unavailableSet])

  const handleServantFilter = (name: string) => {
    if (filteredServantName === name) {
      setFilteredServantName(null)
    } else {
      setFilteredServantName(name)
      const summary = servantSummary.find((s) => s.name === name)
      if (summary) {
        const available = events
          .filter((e) => summary.ids.some((id) => !unavailableSet.has(`${id}-${e.id}`)))
          .sort((a, b) => {
            const dc = a.event_date.localeCompare(b.event_date)
            return dc !== 0 ? dc : a.event_time.localeCompare(b.event_time)
          })
        if (!selectedEventId || !available.some((e) => e.id === selectedEventId)) {
          setSelectedEventId(available.length > 0 ? available[0].id : null)
        }
      }
    }
  }

  const selectedEvent = events.find((e) => e.id === selectedEventId)
  const eventAssignments = selectedEventId ? getEventAssignments(selectedEventId) : []

  const handleAssign = async (eventId: string, servantId: string, areaId: string) => {
    setLoading(`${eventId}-${areaId}`)
    try {
      const response = await fetch("/api/escalas/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schedule_event_id: eventId,
          servant_id: servantId,
          area_id: areaId,
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

  const handleRemoveAssignment = async (eventId: string, areaId: string) => {
    setLoading(`${eventId}-${areaId}`)
    try {
      const response = await fetch(
        `/api/escalas/assignments?event_id=${eventId}&area_id=${areaId}`,
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

  const completedEvents = events.filter((event) => {
    const eventAssigns = getEventAssignments(event.id)
    return areas.every((area) => eventAssigns.some((a) => a.area_id === area.id))
  }).length

  // Pré-computar mapa de atribuições por evento+área para a prévia
  const assignmentByEventArea = useMemo(() => {
    const map = new Map<string, ScheduleAssignment>()
    assignments.forEach((a) => {
      map.set(`${a.schedule_event_id}-${a.area_id}`, a)
    })
    return map
  }, [assignments])

  const sortedEvents = useMemo(
    () =>
      [...events].sort((a, b) => {
        const dc = a.event_date.localeCompare(b.event_date)
        return dc !== 0 ? dc : a.event_time.localeCompare(b.event_time)
      }),
    [events]
  )

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
          <Eye className="mr-2 h-4 w-4" />
          Ver Prévia da Escala
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Eventos */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Eventos</CardTitle>
                <div className="flex items-center gap-1">
                  {filteredServantName && (
                    <Badge variant="secondary" className="text-xs flex items-center gap-1 max-w-[110px]">
                      <span className="truncate">{filteredServantName.split(" ")[0]}</span>
                      <button
                        onClick={() => setFilteredServantName(null)}
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
                  {filteredEvents.length === 0 && filteredServantName ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhum evento disponível para {filteredServantName.split(" ")[0]}
                    </p>
                  ) : null}
                  {filteredEvents
                    .sort((a, b) => {
                      const dateCompare = a.event_date.localeCompare(b.event_date)
                      if (dateCompare !== 0) return dateCompare
                      return a.event_time.localeCompare(b.event_time)
                    })
                    .map((event) => {
                      const assigns = getEventAssignments(event.id)
                      const isComplete = areas.every((area) =>
                        assigns.some((a) => a.area_id === area.id)
                      )
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
                                {assigns.length}/{areas.length}
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
        <div className="lg:col-span-2">
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
                  const currentAssignment = eventAssignments.find(
                    (a) => a.area_id === area.id
                  )
                  const isLoading = loading === `${selectedEvent.id}-${area.id}`

                  return (
                    <div key={area.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{area.name}</h4>
                        {currentAssignment && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleRemoveAssignment(selectedEvent.id, area.id)
                            }
                            disabled={isLoading}
                          >
                            {isLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>

                      <Select
                        value={currentAssignment?.servant_id || ""}
                        onValueChange={(servantId) =>
                          handleAssign(selectedEvent.id, servantId, area.id)
                        }
                        disabled={isLoading}
                      >
                        <SelectTrigger
                          className={
                            currentAssignment
                              ? "border-green-500 bg-green-50 dark:bg-green-950"
                              : ""
                          }
                        >
                          <SelectValue placeholder="Selecionar servo..." />
                        </SelectTrigger>
                        <SelectContent>
                          {areaServants.length === 0 ? (
                            <div className="p-2 text-sm text-muted-foreground">
                              Nenhum servo cadastrado nesta área
                            </div>
                          ) : (
                            areaServants
                              .sort((a, b) => {
                                if (a.is_leader !== b.is_leader)
                                  return b.is_leader ? 1 : -1
                                return a.name.localeCompare(b.name)
                              })
                              .map((servant) => {
                                const available = isServantAvailable(
                                  servant.id,
                                  selectedEvent.id
                                )
                                const assignCount =
                                  servantAssignmentCount.get(servant.id) || 0
                                const availEventCount =
                                  servantAvailableEventCount.get(servant.id) ?? 0

                                return (
                                  <SelectItem
                                    key={servant.id}
                                    value={servant.id}
                                    disabled={!available}
                                    className={!available ? "opacity-50" : ""}
                                  >
                                    <div className="flex items-center gap-2 w-full">
                                      {available ? (
                                        <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
                                      ) : (
                                        <AlertCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
                                      )}
                                      <span className="flex-1">{servant.name}</span>
                                      {servant.is_leader && (
                                        <Crown className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                                      )}
                                      <Badge
                                        variant="outline"
                                        className="ml-1 text-xs"
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
                                  </SelectItem>
                                )
                              })
                          )}
                        </SelectContent>
                      </Select>

                      {!currentAssignment && (
                        <p className="text-xs text-muted-foreground">
                          {areaServants.filter((s) =>
                            isServantAvailable(s.id, selectedEvent.id)
                          ).length}{" "}
                          servo(s) disponível(is)
                        </p>
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
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
              <CardTitle className="text-base">Resumo dos Servos</CardTitle>
              <div className="flex items-center gap-1">
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
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {sortedSummary.map((servant) => {
                const availRatio = events.length > 0 ? servant.availCount / events.length : 1

                return (
                  <div
                    key={servant.name}
                    onClick={() => handleServantFilter(servant.name)}
                    className={`flex items-center justify-between gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                      filteredServantName === servant.name
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

      {/* Prévia da Escala */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl w-full">
          <DialogHeader>
            <DialogTitle>Prévia da Escala</DialogTitle>
            <DialogDescription>
              {completedEvents}/{events.length} eventos completos
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto max-h-[70vh]">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-10 bg-background">
                  <tr className="border-b">
                    <th className="text-left font-medium py-2 pr-4 pl-1 whitespace-nowrap text-muted-foreground w-32">
                      Data
                    </th>
                    <th className="text-left font-medium py-2 pr-4 text-muted-foreground">
                      Evento
                    </th>
                    {areas.map((area) => (
                      <th
                        key={area.id}
                        className="text-left font-medium py-2 pr-4 whitespace-nowrap text-muted-foreground"
                      >
                        {area.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedEvents.map((event, idx) => {
                    const prevEvent = idx > 0 ? sortedEvents[idx - 1] : null
                    const isNewDate = !prevEvent || prevEvent.event_date !== event.event_date
                    const isComplete = areas.every((area) =>
                      assignmentByEventArea.has(`${event.id}-${area.id}`)
                    )

                    return (
                      <>
                        {isNewDate && idx > 0 && (
                          <tr key={`sep-${event.id}`}>
                            <td colSpan={2 + areas.length} className="py-1" />
                          </tr>
                        )}
                        <tr
                          key={event.id}
                          className={`border-b last:border-0 ${
                            !isComplete ? "bg-amber-50 dark:bg-amber-950/20" : ""
                          }`}
                        >
                          <td className="py-2.5 pr-4 pl-1 whitespace-nowrap align-top">
                            {isNewDate ? (
                              <span className="font-medium">
                                {format(parseISO(event.event_date), "EEE, dd/MM", { locale: ptBR })}
                              </span>
                            ) : null}
                          </td>
                          <td className="py-2.5 pr-4 align-top">
                            <span className="font-medium">{event.title}</span>
                            <span className="text-muted-foreground ml-1.5 text-xs">
                              {event.event_time.slice(0, 5)}
                            </span>
                          </td>
                          {areas.map((area) => {
                            const assignment = assignmentByEventArea.get(`${event.id}-${area.id}`)
                            return (
                              <td key={area.id} className="py-2.5 pr-4 align-top whitespace-nowrap">
                                {assignment?.servant ? (
                                  <span className="flex items-center gap-1">
                                    {assignment.servant.is_leader && (
                                      <Crown className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                                    )}
                                    {assignment.servant.name}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      </>
                    )
                  })}
                </tbody>
              </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
