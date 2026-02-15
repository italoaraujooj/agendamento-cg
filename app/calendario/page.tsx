"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Plus,
  CalendarDays,
  Loader2,
  Clock,
  Pencil,
  Trash2,
  MoreHorizontal,
  ChevronDown,
  ChevronUp
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useAuth } from "@/components/auth/auth-provider"
import { useSystemMode } from "@/components/system-mode-provider"
import { RegularEventForm } from "@/components/escalas/regular-event-form"
import { supabase } from "@/lib/supabase/client"
import { toast } from "sonner"
import type { RegularEvent, Ministry } from "@/types/escalas"
import { DAY_OF_WEEK_LABELS, WEEK_OF_MONTH_LABELS } from "@/types/escalas"

interface RegularEventWithMinistry extends RegularEvent {
  ministry: Ministry
}

/** Eventos agrupados por título + dia + horário */
interface GroupedEvent {
  key: string
  title: string
  time: string
  day_of_week: number
  events: RegularEventWithMinistry[] // sub-eventos individuais (diferem em week_of_month)
  weeks: (number | null)[] // week_of_month de cada sub-evento
  ministries: RegularEventWithMinistry["ministries"]
  ministry: RegularEventWithMinistry["ministry"]
}

export default function CalendarioPage() {
  const { isAuthenticated, isAdmin, loading: authLoading } = useAuth()
  const { setMode } = useSystemMode()
  const [events, setEvents] = useState<RegularEventWithMinistry[]>([])
  const [loading, setLoading] = useState(true)
  
  // Expanded day cards
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set())
  const MAX_VISIBLE_EVENTS = 3

  const toggleDay = (day: number) => {
    setExpandedDays(prev => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })
  }

  // Dialog states
  const [formOpen, setFormOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<RegularEvent | undefined>()
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    event: RegularEventWithMinistry | null
  }>({ open: false, event: null })

  useEffect(() => {
    setMode("escalas")
  }, [setMode])

  const fetchRegularEvents = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("regular_events")
        .select(`
          *,
          ministries:regular_event_ministries(
            ministry_id,
            ministry:ministries(id, name, color)
          ),
          ministry:ministries(id, name, color)
        `)
        .eq("is_active", true)
        .order("day_of_week")
        .order("time")

      if (error) throw error
      setEvents(data || [])
    } catch (error) {
      console.error("Erro ao buscar eventos:", error)
      toast.error("Erro ao carregar calendário")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRegularEvents()
  }, [fetchRegularEvents])

  const handleAddEvent = () => {
    setEditingEvent(undefined)
    setFormOpen(true)
  }

  const handleEditEvent = (event: RegularEvent) => {
    setEditingEvent(event)
    setFormOpen(true)
  }

  const handleDeleteEvent = async () => {
    if (!deleteDialog.event) return

    try {
      const response = await fetch(`/api/escalas/regular-events/${deleteDialog.event.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Erro ao excluir evento")
      }

      toast.success("Evento removido!")
      fetchRegularEvents()
    } catch (error) {
      console.error("Erro ao excluir evento:", error)
      toast.error("Erro ao excluir evento")
    } finally {
      setDeleteDialog({ open: false, event: null })
    }
  }

  // Agrupar eventos iguais (mesmo título, dia, horário) e depois por dia da semana
  const groupedByDay = (() => {
    // Primeiro: agrupar eventos iguais
    const groupMap = new Map<string, GroupedEvent>()
    for (const event of events) {
      const key = `${event.title.trim().toLowerCase()}|${event.day_of_week}|${event.time}`
      const existing = groupMap.get(key)
      if (existing) {
        existing.events.push(event)
        existing.weeks.push(event.week_of_month)
      } else {
        groupMap.set(key, {
          key,
          title: event.title,
          time: event.time,
          day_of_week: event.day_of_week,
          events: [event],
          weeks: [event.week_of_month],
          ministries: event.ministries,
          ministry: event.ministry,
        })
      }
    }

    // Segundo: organizar por dia da semana
    const byDay: Record<number, GroupedEvent[]> = {}
    for (const group of groupMap.values()) {
      group.weeks.sort((a, b) => (a ?? 99) - (b ?? 99))
      const day = group.day_of_week
      if (!byDay[day]) byDay[day] = []
      byDay[day].push(group)
    }
    return byDay
  })()

  const formatTime = (time: string) => time.slice(0, 5)

  const canEdit = isAuthenticated && isAdmin

  if (authLoading || loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Calendário Regular</h1>
          <p className="text-muted-foreground">
            Configure os eventos recorrentes da igreja
          </p>
        </div>
        {canEdit && (
          <Button onClick={handleAddEvent}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Evento
          </Button>
        )}
      </div>

      {/* Calendário Semanal */}
      {events.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum evento configurado</h3>
            <p className="text-muted-foreground text-center mb-4">
              Configure os cultos e eventos regulares que acontecem toda semana.
            </p>
            {canEdit && (
              <Button onClick={handleAddEvent}>
                <Plus className="mr-2 h-4 w-4" />
                Criar Evento
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => {
            const dayGroups = groupedByDay[dayOfWeek] || []
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

            return (
              <Card
                key={dayOfWeek}
                className={isWeekend ? "border-primary/30" : ""}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    {DAY_OF_WEEK_LABELS[dayOfWeek]}
                    {dayGroups.length > 0 && (
                      <Badge variant="secondary" className="ml-auto">
                        {dayGroups.length}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {dayGroups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Sem eventos
                    </p>
                  ) : (
                    <>
                      {(expandedDays.has(dayOfWeek)
                        ? dayGroups
                        : dayGroups.slice(0, MAX_VISIBLE_EVENTS)
                      ).map((group) => (
                        <div
                          key={group.key}
                          className="flex items-start gap-2 p-2 rounded-md bg-muted/50 group"
                        >
                          <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {group.title}
                            </p>
                            <div className="flex items-center gap-1 flex-wrap text-xs text-muted-foreground">
                              <span>{formatTime(group.time)}</span>
                              {group.weeks.some(w => w !== null) && (
                                group.weeks.filter(w => w !== null).map((w) => (
                                  <Badge key={w} variant="outline" className="text-xs">
                                    {w}ª sem.
                                  </Badge>
                                ))
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {group.ministries && group.ministries.length > 0 ? (
                              group.ministries.map((rel) => (
                                <div
                                  key={rel.ministry_id}
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: rel.ministry?.color || '#888' }}
                                  title={rel.ministry?.name}
                                />
                              ))
                            ) : group.ministry ? (
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: group.ministry.color || '#888' }}
                                title={group.ministry.name}
                              />
                            ) : null}
                          </div>
                          {canEdit && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <MoreHorizontal className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {group.events.length === 1 ? (
                                  <>
                                    <DropdownMenuItem onClick={() => handleEditEvent(group.events[0])}>
                                      <Pencil className="mr-2 h-4 w-4" />
                                      Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => setDeleteDialog({ open: true, event: group.events[0] })}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Remover
                                    </DropdownMenuItem>
                                  </>
                                ) : (
                                  <>
                                    {group.events.map((ev) => {
                                      const weekLabel = ev.week_of_month
                                        ? `${ev.week_of_month}ª sem.`
                                        : "Todas"
                                      return (
                                        <DropdownMenuItem key={`edit-${ev.id}`} onClick={() => handleEditEvent(ev)}>
                                          <Pencil className="mr-2 h-4 w-4" />
                                          Editar ({weekLabel})
                                        </DropdownMenuItem>
                                      )
                                    })}
                                    {group.events.map((ev) => {
                                      const weekLabel = ev.week_of_month
                                        ? `${ev.week_of_month}ª sem.`
                                        : "Todas"
                                      return (
                                        <DropdownMenuItem
                                          key={`del-${ev.id}`}
                                          className="text-destructive"
                                          onClick={() => setDeleteDialog({ open: true, event: ev })}
                                        >
                                          <Trash2 className="mr-2 h-4 w-4" />
                                          Remover ({weekLabel})
                                        </DropdownMenuItem>
                                      )
                                    })}
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      ))}
                      {dayGroups.length > MAX_VISIBLE_EVENTS && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs text-muted-foreground h-7"
                          onClick={() => toggleDay(dayOfWeek)}
                        >
                          {expandedDays.has(dayOfWeek) ? (
                            <>
                              <ChevronUp className="mr-1 h-3 w-3" />
                              Mostrar menos
                            </>
                          ) : (
                            <>
                              <ChevronDown className="mr-1 h-3 w-3" />
                              Ver mais {dayGroups.length - MAX_VISIBLE_EVENTS} evento(s)
                            </>
                          )}
                        </Button>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Legenda */}
      {events.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Legenda - Ministérios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Array.from(
                new Set(
                  events.flatMap(e => {
                    if (e.ministries && e.ministries.length > 0) {
                      return e.ministries.map(rel => rel.ministry?.id).filter(Boolean)
                    }
                    return e.ministry?.id ? [e.ministry.id] : []
                  })
                )
              )
                .map(ministryId => {
                  const ministry = events
                    .flatMap(e => {
                      if (e.ministries && e.ministries.length > 0) {
                        return e.ministries.map(rel => rel.ministry).filter(Boolean)
                      }
                      return e.ministry ? [e.ministry] : []
                    })
                    .find(m => m?.id === ministryId)
                  if (!ministry) return null
                  return (
                    <div key={ministryId} className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: ministry.color }}
                      />
                      <span className="text-sm">{ministry.name}</span>
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form Dialog */}
      <RegularEventForm
        event={editingEvent}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={fetchRegularEvents}
      />

      {/* Delete Confirmation */}
      <AlertDialog 
        open={deleteDialog.open} 
        onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o evento{" "}
              <strong>{deleteDialog.event?.title}</strong>?
              <br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteEvent}
              className="bg-destructive hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
