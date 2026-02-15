"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  CheckCircle,
  Send
} from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { useSystemMode } from "@/components/system-mode-provider"
import { ScheduleBuilder } from "@/components/escalas/schedule-builder"
import { supabase } from "@/lib/supabase/client"
import { toast } from "sonner"
import Link from "next/link"
import type { 
  SchedulePeriod, 
  ScheduleEvent, 
  Area, 
  Servant, 
  ServantAvailability,
  ScheduleAssignment,
  Ministry 
} from "@/types/escalas"
import { PERIOD_STATUS_LABELS } from "@/types/escalas"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface PeriodWithDetails extends SchedulePeriod {
  ministry: Ministry
}

export default function MontarEscalaPage() {
  const router = useRouter()
  const params = useParams()
  const periodId = params.periodId as string
  
  const { isAuthenticated, isAdmin, adminChecked, loading: authLoading } = useAuth()
  const { setMode } = useSystemMode()
  
  const [period, setPeriod] = useState<PeriodWithDetails | null>(null)
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [servants, setServants] = useState<Servant[]>([])
  const [availabilities, setAvailabilities] = useState<ServantAvailability[]>([])
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [publishDialog, setPublishDialog] = useState(false)
  const [publishing, setPublishing] = useState(false)

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

  const fetchData = useCallback(async () => {
    try {
      // Buscar período
      const { data: periodData, error: periodError } = await supabase
        .from("schedule_periods")
        .select(`
          *,
          ministry:ministries(*)
        `)
        .eq("id", periodId)
        .single()

      if (periodError || !periodData) {
        toast.error("Período não encontrado")
        router.push("/admin-escalas/periodos")
        return
      }

      setPeriod(periodData)

      // Buscar eventos
      const { data: eventsData } = await supabase
        .from("schedule_events")
        .select("*")
        .eq("period_id", periodId)
        .order("event_date")
        .order("event_time")

      setEvents(eventsData || [])

      // Buscar áreas do ministério
      const { data: areasData } = await supabase
        .from("areas")
        .select("*")
        .eq("ministry_id", periodData.ministry_id)
        .eq("is_active", true)
        .order("order_index")
        .order("name")

      setAreas(areasData || [])

      // Buscar servos das áreas
      const { data: servantsData } = await supabase
        .from("servants")
        .select(`
          *,
          area:areas(*)
        `)
        .eq("is_active", true)

      // Filtrar servos do ministério
      const ministryServants = servantsData?.filter(
        (s) => s.area?.ministry_id === periodData.ministry_id
      ) || []
      setServants(ministryServants)

      // Buscar disponibilidades
      const { data: availData } = await supabase
        .from("servant_availability")
        .select("*")
        .eq("period_id", periodId)

      setAvailabilities(availData || [])

      // Buscar atribuições
      const eventIds = eventsData?.map((e) => e.id) || []
      if (eventIds.length > 0) {
        const { data: assignData } = await supabase
          .from("schedule_assignments")
          .select(`
            *,
            servant:servants(*),
            area:areas(*)
          `)
          .in("schedule_event_id", eventIds)

        setAssignments(assignData || [])
      }
    } catch (error) {
      console.error("Erro ao buscar dados:", error)
      toast.error("Erro ao carregar dados")
    } finally {
      setLoading(false)
    }
  }, [periodId, router])

  useEffect(() => {
    if (isAdmin) {
      fetchData()
    }
  }, [isAdmin, fetchData])

  const handlePublish = async () => {
    setPublishing(true)
    try {
      const response = await fetch(`/api/escalas/schedule-periods/${periodId}/publish`, {
        method: "POST",
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Erro ao publicar")
      }

      toast.success("Escala publicada com sucesso!")
      router.push(`/admin-escalas/periodos/${periodId}`)
    } catch (error) {
      console.error("Erro:", error)
      toast.error(error instanceof Error ? error.message : "Erro ao publicar")
    } finally {
      setPublishing(false)
      setPublishDialog(false)
    }
  }

  // Calcular progresso
  const completedEvents = events.filter((event) => {
    const eventAssigns = assignments.filter((a) => a.schedule_event_id === event.id)
    return areas.every((area) => eventAssigns.some((a) => a.area_id === area.id))
  }).length

  const canPublish = completedEvents === events.length && events.length > 0

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

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button variant="ghost" asChild className="w-fit">
          <Link href={`/admin-escalas/periodos/${periodId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para o Período
          </Link>
        </Button>
        
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div 
              className="w-2 h-16 rounded-full"
              style={{ backgroundColor: period.ministry?.color || '#888' }}
            />
            <div>
              <h1 className="text-2xl font-bold">Montar Escala</h1>
              <p className="text-muted-foreground">
                {period.ministry?.name} - {format(new Date(period.year, period.month - 1), "MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Progresso</p>
              <p className="text-lg font-bold">
                {completedEvents}/{events.length} eventos
              </p>
            </div>
            <Button
              onClick={() => setPublishDialog(true)}
              disabled={!canPublish}
            >
              <Send className="mr-2 h-4 w-4" />
              Publicar Escala
            </Button>
          </div>
        </div>
      </div>

      {/* Aviso se não há eventos */}
      {events.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum evento</h3>
            <p className="text-muted-foreground text-center mb-4">
              Gere eventos a partir do calendário regular antes de montar a escala.
            </p>
            <Button variant="outline" asChild>
              <Link href={`/admin-escalas/periodos/${periodId}`}>
                Voltar e Gerar Eventos
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ScheduleBuilder
          periodId={periodId}
          events={events}
          areas={areas}
          servants={servants}
          availabilities={availabilities}
          assignments={assignments}
          onAssignmentChange={fetchData}
        />
      )}

      {/* Publish Confirmation */}
      <AlertDialog open={publishDialog} onOpenChange={setPublishDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publicar Escala</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja publicar esta escala?
              <br />
              <br />
              Após publicada, a escala ficará visível para todos os servos e não
              poderá mais ser editada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handlePublish} disabled={publishing}>
              {publishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Publicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
