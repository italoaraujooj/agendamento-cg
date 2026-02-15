"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { 
  ArrowLeft, 
  Loader2, 
  Calendar,
  Clock,
  Users,
  ClipboardList,
  CheckCircle,
  Play,
  Download,
  Send,
  Link2,
  Copy,
  Trash2,
  RefreshCw,
  Plus
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/components/auth/auth-provider"
import { useSystemMode } from "@/components/system-mode-provider"
import { toast } from "sonner"
import Link from "next/link"
import type { SchedulePeriod, ScheduleEvent, Ministry } from "@/types/escalas"
import { PERIOD_STATUS_LABELS, PERIOD_STATUS_COLORS, EVENT_SOURCE_LABELS } from "@/types/escalas"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface PeriodWithDetails extends SchedulePeriod {
  ministry: Ministry
  events: ScheduleEvent[]
}

export default function PeriodoDetalhePage() {
  const router = useRouter()
  const params = useParams()
  const periodId = params.id as string
  
  const { isAuthenticated, isAdmin, adminChecked, loading: authLoading } = useAuth()
  const { setMode } = useSystemMode()
  
  const [period, setPeriod] = useState<PeriodWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [deleteDialog, setDeleteDialog] = useState(false)
  const [createEventOpen, setCreateEventOpen] = useState(false)
  const [createEventLoading, setCreateEventLoading] = useState(false)
  const [newEvent, setNewEvent] = useState({
    date: "",
    time: "19:00",
    title: "",
    description: "",
  })

  useEffect(() => {
    setMode("escalas")
  }, [setMode])

  useEffect(() => {
    if (!authLoading && adminChecked) {
      if (!isAuthenticated || !isAdmin) {
        toast.error("Acesso negado")
        router.push("/escalas")
      }
    }
  }, [authLoading, isAuthenticated, isAdmin, adminChecked, router])

  const fetchPeriod = useCallback(async () => {
    try {
      const response = await fetch(`/api/escalas/schedule-periods/${periodId}`)
      if (!response.ok) {
        if (response.status === 404) {
          toast.error("Período não encontrado")
          router.push("/admin-escalas/periodos")
          return
        }
        throw new Error("Erro ao carregar período")
      }
      const data = await response.json()
      setPeriod(data)
    } catch (error) {
      console.error("Erro ao buscar período:", error)
      toast.error("Erro ao carregar período")
    } finally {
      setLoading(false)
    }
  }, [periodId, router])

  useEffect(() => {
    if (isAdmin) {
      fetchPeriod()
    }
  }, [isAdmin, fetchPeriod])

  const handleGenerateEvents = async () => {
    setActionLoading("generate")
    try {
      const response = await fetch(`/api/escalas/schedule-periods/${periodId}/generate-events`, {
        method: "POST",
      })
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || "Erro ao gerar eventos")
      }
      
      toast.success(data.message)
      fetchPeriod()
    } catch (error) {
      console.error("Erro:", error)
      toast.error(error instanceof Error ? error.message : "Erro ao gerar eventos")
    } finally {
      setActionLoading(null)
    }
  }

  const handleImportBookings = async () => {
    setActionLoading("import")
    try {
      const response = await fetch(`/api/escalas/schedule-periods/${periodId}/import-bookings`, {
        method: "POST",
      })
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || "Erro ao importar")
      }
      
      toast.success(data.message)
      fetchPeriod()
    } catch (error) {
      console.error("Erro:", error)
      toast.error(error instanceof Error ? error.message : "Erro ao importar")
    } finally {
      setActionLoading(null)
    }
  }

  const handleChangeStatus = async (newStatus: string) => {
    setActionLoading("status")
    try {
      const response = await fetch(`/api/escalas/schedule-periods/${periodId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || "Erro ao alterar status")
      }
      
      toast.success(`Status alterado para ${PERIOD_STATUS_LABELS[newStatus as keyof typeof PERIOD_STATUS_LABELS]}`)
      fetchPeriod()
    } catch (error) {
      console.error("Erro:", error)
      toast.error(error instanceof Error ? error.message : "Erro ao alterar status")
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async () => {
    setActionLoading("delete")
    try {
      const response = await fetch(`/api/escalas/schedule-periods/${periodId}`, {
        method: "DELETE",
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Erro ao excluir")
      }
      
      toast.success("Período excluído!")
      router.push("/admin-escalas/periodos")
    } catch (error) {
      console.error("Erro:", error)
      toast.error(error instanceof Error ? error.message : "Erro ao excluir")
    } finally {
      setActionLoading(null)
      setDeleteDialog(false)
    }
  }

  const copyAvailabilityLink = () => {
    if (!period) return
    const link = `${window.location.origin}/disponibilidade/${period.availability_token}`
    navigator.clipboard.writeText(link)
    toast.success("Link copiado!")
  }

  const openCreateEvent = () => {
    if (!period) return
    setNewEvent({
      date: period.start_date,
      time: "19:00",
      title: "",
      description: "",
    })
    setCreateEventOpen(true)
  }

  const handleCreateEvent = async () => {
    if (!period) return
    if (!newEvent.date || !newEvent.time || !newEvent.title.trim()) {
      toast.error("Preencha data, horário e título do evento.")
      return
    }

    setCreateEventLoading(true)
    try {
      const response = await fetch("/api/escalas/schedule-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_id: period.id,
          event_date: newEvent.date,
          event_time: newEvent.time,
          title: newEvent.title.trim(),
          description: newEvent.description.trim() || null,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Erro ao criar evento")
      }

      toast.success("Evento criado com sucesso!")
      setCreateEventOpen(false)
      fetchPeriod()
    } catch (error) {
      console.error("Erro ao criar evento:", error)
      toast.error(error instanceof Error ? error.message : "Erro ao criar evento")
    } finally {
      setCreateEventLoading(false)
    }
  }

  if (authLoading || !adminChecked || loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (!period) return null

  const eventsGroupedByDate = period.events?.reduce((acc, event) => {
    const date = event.event_date
    if (!acc[date]) acc[date] = []
    acc[date].push(event)
    return acc
  }, {} as Record<string, ScheduleEvent[]>) || {}

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button variant="ghost" asChild className="w-fit">
          <Link href="/admin-escalas/periodos">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Períodos
          </Link>
        </Button>
        
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div 
              className="w-2 h-16 rounded-full"
              style={{ backgroundColor: period.ministry?.color || '#888' }}
            />
            <div>
              <h1 className="text-3xl font-bold">
                {format(new Date(period.year, period.month - 1), "MMMM 'de' yyyy", { locale: ptBR })}
              </h1>
              <p className="text-muted-foreground">{period.ministry?.name}</p>
              <Badge 
                variant="secondary"
                className={`mt-2 ${PERIOD_STATUS_COLORS[period.status]} text-white`}
              >
                {PERIOD_STATUS_LABELS[period.status]}
              </Badge>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {period.status === "draft" && (
              <>
                <Button variant="outline" onClick={handleGenerateEvents} disabled={!!actionLoading}>
                  {actionLoading === "generate" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Gerar Eventos
                </Button>
                <Button variant="outline" onClick={handleImportBookings} disabled={!!actionLoading}>
                  {actionLoading === "import" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Importar Agendamentos
                </Button>
                <Button variant="outline" onClick={openCreateEvent} disabled={!!actionLoading}>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Evento
                </Button>
                <Button onClick={() => handleChangeStatus("collecting")} disabled={!!actionLoading}>
                  <Play className="mr-2 h-4 w-4" />
                  Iniciar Coleta
                </Button>
              </>
            )}
            
            {period.status === "collecting" && (
              <>
                <Button variant="outline" onClick={copyAvailabilityLink}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar Link
                </Button>
                <Button onClick={() => handleChangeStatus("scheduling")} disabled={!!actionLoading}>
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Montar Escala
                </Button>
              </>
            )}
            
            {period.status === "scheduling" && (
              <>
                <Button variant="outline" asChild>
                  <Link href={`/admin-escalas/montar/${period.id}`}>
                    <ClipboardList className="mr-2 h-4 w-4" />
                    Montar Escala
                  </Link>
                </Button>
              </>
            )}
            
            {period.status !== "published" && period.status !== "closed" && (
              <Button 
                variant="destructive" 
                size="icon"
                onClick={() => setDeleteDialog(true)}
                disabled={!!actionLoading}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Eventos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{period.events?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Prazo Disponibilidade</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {period.availability_deadline 
                ? format(new Date(period.availability_deadline), "dd/MM/yyyy 'às' HH:mm")
                : "Não definido"
              }
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Link de Disponibilidade</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" onClick={copyAvailabilityLink}>
              <Link2 className="mr-2 h-4 w-4" />
              Copiar Link
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="events">
        <TabsList>
          <TabsTrigger value="events">
            <Calendar className="mr-2 h-4 w-4" />
            Eventos ({period.events?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="info">
            <Clock className="mr-2 h-4 w-4" />
            Informações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="mt-4">
          {period.events?.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum evento</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Gere eventos a partir do calendário regular ou importe do sistema de agendamentos.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleGenerateEvents} disabled={!!actionLoading}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Gerar do Calendário
                  </Button>
                  <Button variant="outline" onClick={handleImportBookings} disabled={!!actionLoading}>
                    <Download className="mr-2 h-4 w-4" />
                    Importar Agendamentos
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {Object.entries(eventsGroupedByDate)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, events]) => (
                  <Card key={date}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">
                        {format(new Date(date + "T12:00:00"), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {events
                          .sort((a, b) => a.event_time.localeCompare(b.event_time))
                          .map((event) => (
                            <div 
                              key={event.id}
                              className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-sm">
                                  {event.event_time.slice(0, 5)}
                                </span>
                                <span>{event.title}</span>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {EVENT_SOURCE_LABELS[event.source]}
                              </Badge>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="info" className="mt-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <h4 className="font-medium mb-1">Período</h4>
                <p className="text-muted-foreground">
                  {format(new Date(period.start_date), "dd/MM/yyyy")} a{" "}
                  {format(new Date(period.end_date), "dd/MM/yyyy")}
                </p>
              </div>
              {period.notes && (
                <div>
                  <h4 className="font-medium mb-1">Observações</h4>
                  <p className="text-muted-foreground">{period.notes}</p>
                </div>
              )}
              <div>
                <h4 className="font-medium mb-1">Criado em</h4>
                <p className="text-muted-foreground">
                  {format(new Date(period.created_at), "dd/MM/yyyy 'às' HH:mm")}
                </p>
              </div>
              {period.published_at && (
                <div>
                  <h4 className="font-medium mb-1">Publicado em</h4>
                  <p className="text-muted-foreground">
                    {format(new Date(period.published_at), "dd/MM/yyyy 'às' HH:mm")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Período</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este período de escala?
              <br />
              <strong>Todos os eventos e atribuições serão perdidos.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              {actionLoading === "delete" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Criar Evento Avulso */}
      <Dialog open={createEventOpen} onOpenChange={setCreateEventOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Evento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="event-date">Data *</Label>
                <Input
                  id="event-date"
                  type="date"
                  value={newEvent.date}
                  min={period.start_date}
                  max={period.end_date}
                  onChange={(e) => setNewEvent((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-time">Horário *</Label>
                <Input
                  id="event-time"
                  type="time"
                  value={newEvent.time}
                  onChange={(e) => setNewEvent((prev) => ({ ...prev, time: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-title">Título *</Label>
              <Input
                id="event-title"
                placeholder="Ex: Culto Especial, Treinamento, Reunião de Equipe"
                value={newEvent.title}
                maxLength={120}
                onChange={(e) => setNewEvent((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-description">Descrição</Label>
              <Textarea
                id="event-description"
                placeholder="Detalhes adicionais (opcional)"
                value={newEvent.description}
                maxLength={500}
                rows={3}
                onChange={(e) => setNewEvent((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateEventOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateEvent} disabled={createEventLoading}>
              {createEventLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Evento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
