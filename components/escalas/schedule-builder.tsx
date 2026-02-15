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
  Check, 
  X, 
  AlertCircle, 
  Loader2, 
  Crown,
  Calendar,
  Clock
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

  // Memoized helpers
  const isServantAvailable = useMemo(() => {
    const availabilityMap = new Map<string, boolean>()
    availabilities.forEach((a) => {
      const key = `${a.servant_id}-${a.event_id}`
      availabilityMap.set(key, a.is_available)
    })
    return (servantId: string, eventId: string) => {
      const key = `${servantId}-${eventId}`
      // Se não há registro, considerar disponível por padrão
      return availabilityMap.get(key) ?? true
    }
  }, [availabilities])

  const getEventAssignments = useMemo(() => {
    const assignmentMap = new Map<string, ScheduleAssignment[]>()
    assignments.forEach((a) => {
      const key = a.schedule_event_id
      if (!assignmentMap.has(key)) {
        assignmentMap.set(key, [])
      }
      assignmentMap.get(key)!.push(a)
    })
    return (eventId: string) => assignmentMap.get(eventId) || []
  }, [assignments])

  const getAreaServants = useMemo(() => {
    const servantMap = new Map<string, Servant[]>()
    servants.forEach((s) => {
      if (!s.is_active) return
      const key = s.area_id
      if (!servantMap.has(key)) {
        servantMap.set(key, [])
      }
      servantMap.get(key)!.push(s)
    })
    return (areaId: string) => servantMap.get(areaId) || []
  }, [servants])

  const servantAssignmentCount = useMemo(() => {
    const countMap = new Map<string, number>()
    assignments.forEach((a) => {
      const count = countMap.get(a.servant_id) || 0
      countMap.set(a.servant_id, count + 1)
    })
    return countMap
  }, [assignments])

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

  const formatEventDate = (dateStr: string) => {
    return format(parseISO(dateStr), "EEE, dd/MM", { locale: ptBR })
  }

  // Contar eventos completos (todas as áreas com atribuição)
  const completedEvents = events.filter((event) => {
    const eventAssigns = getEventAssignments(event.id)
    return areas.every((area) => eventAssigns.some((a) => a.area_id === area.id))
  }).length

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Lista de Eventos */}
      <div className="lg:col-span-1">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Eventos</CardTitle>
              <Badge variant="outline">
                {completedEvents}/{events.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="space-y-1 p-2">
                {events
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

                    return (
                      <button
                        key={event.id}
                        onClick={() => setSelectedEventId(event.id)}
                        className={`w-full text-left p-3 rounded-lg transition-colors ${
                          selectedEventId === event.id
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">
                              {formatEventDate(event.event_date)}
                            </p>
                            <p className="text-xs opacity-80">
                              {event.event_time.slice(0, 5)} - {event.title}
                            </p>
                          </div>
                          {isComplete ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Badge variant="outline" className="text-xs">
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
                    {selectedEvent.event_time.slice(0, 5)} - {selectedEvent.title}
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
                              // Líderes primeiro, depois por nome
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
                                      className="ml-2 text-xs"
                                    >
                                      {assignCount}x
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
  )
}
