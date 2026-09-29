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
import type { Blockout } from "@/lib/escalas/blockouts"
import { toast } from "sonner"
import Link from "next/link"
import type { 
  SchedulePeriod, 
  ScheduleEvent, 
  Area, 
  Servant, 
  ServantAvailability,
  ScheduleAssignment,
  ServantConflict,
  Ministry
} from "@/types/escalas"
import { PERIOD_STATUS_LABELS } from "@/types/escalas"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { plural } from "@/lib/plural"

interface PeriodWithDetails extends SchedulePeriod {
  ministry: Ministry
}

export default function MontarEscalaPage() {
  const router = useRouter()
  const params = useParams()
  const periodId = params.periodId as string
  
  const { isAuthenticated, isAdmin, ministryRoles, adminChecked, loading: authLoading } = useAuth()
  const { setMode } = useSystemMode()
  
  const [period, setPeriod] = useState<PeriodWithDetails | null>(null)
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [servants, setServants] = useState<Servant[]>([])
  const [availabilities, setAvailabilities] = useState<ServantAvailability[]>([])
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([])
  const [conflicts, setConflicts] = useState<ServantConflict[]>([])
  const [declineReasons, setDeclineReasons] = useState<Record<string, string | null>>({})
  const [blockouts, setBlockouts] = useState<Record<string, Blockout[]>>({})
  const [loading, setLoading] = useState(true)
  const [publishDialog, setPublishDialog] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [incompleteWarning, setIncompleteWarning] = useState(false)
  const [incompleteCount, setIncompleteCount] = useState(0)

  useEffect(() => {
    setMode("escalas")
  }, [setMode])

  // Admin ou líder de algum ministério (a API confere se é o ministério deste período)
  const canManage = isAdmin || ministryRoles.length > 0

  useEffect(() => {
    if (!authLoading && adminChecked) {
      if (!isAuthenticated || !canManage) {
        toast.error("Acesso negado")
        router.push("/escalas")
      }
    }
  }, [authLoading, isAuthenticated, canManage, adminChecked, router])

  const fetchData = useCallback(async () => {
    try {
      // Dados da montagem via API (admin ou líder do ministério)
      const res = await fetch(`/api/escalas/schedule-periods/${periodId}/builder`)
      if (res.status === 404 || res.status === 403) {
        toast.error(res.status === 403 ? "Acesso negado" : "Período não encontrado")
        router.push("/admin-escalas/periodos")
        return
      }
      if (!res.ok) throw new Error("Erro ao carregar dados")
      const data = await res.json()

      setPeriod(data.period)
      setEvents(data.events)
      setAreas(data.areas)
      setServants(data.servants)
      setAvailabilities(data.availabilities)
      setAssignments(data.assignments)
      setConflicts(data.conflicts)
      setDeclineReasons(data.declineReasons)
      setBlockouts(data.blockouts)
    } catch (error) {
      console.error("Erro ao buscar dados:", error)
      toast.error("Erro ao carregar dados")
    } finally {
      setLoading(false)
    }
  }, [periodId, router])

  useEffect(() => {
    if (canManage) {
      fetchData()
    }
  }, [canManage, fetchData])

  const handlePublish = async (force = false) => {
    setPublishing(true)
    try {
      const response = await fetch(`/api/escalas/schedule-periods/${periodId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      })
      const data = await response.json()

      if (!response.ok) {
        if (data.incompleteEvents && !force) {
          setIncompleteCount(data.incompleteEvents)
          setPublishDialog(false)
          setIncompleteWarning(true)
          return
        }
        throw new Error(data.error || "Erro ao publicar")
      }

      const n = data.notification as { sent: number; failed: number; withoutEmail: string[] } | null
      toast.success(
        period?.status === "published"
          ? "Escala atualizada com sucesso!"
          : "Escala publicada com sucesso!",
        {
          description: n
            ? [
                n.sent > 0 ? `${plural(n.sent, "servo avisado", "servos avisados")} por e-mail sobre as mudanças.` : "Nenhuma mudança para avisar.",
                n.failed > 0 ? `${plural(n.failed, "e-mail falhou", "e-mails falharam")} — clique em Atualizar de novo para reenviar.` : null,
                n.withoutEmail.length > 0 ? `Sem e-mail: ${n.withoutEmail.join(", ")}.` : null,
              ].filter(Boolean).join(" ")
            : undefined,
          duration: 8000,
        }
      )
      router.push(`/admin-escalas/periodos/${periodId}`)
    } catch (error) {
      console.error("Erro:", error)
      toast.error(error instanceof Error ? error.message : "Erro ao publicar")
    } finally {
      setPublishing(false)
      setPublishDialog(false)
    }
  }

  // Calcular progresso (respeitando requires_areas por evento)
  const completedEvents = events.filter((event) => {
    const eventAssigns = assignments.filter((a) => a.schedule_event_id === event.id)
    const requiredAreas =
      event.requires_areas && event.requires_areas.length > 0
        ? areas.filter((area) => event.requires_areas!.includes(area.id))
        : areas
    return requiredAreas.every((area) => eventAssigns.some((a) => a.area_id === area.id))
  }).length

  const canPublish = events.length > 0

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
              variant={period.status === "published" ? "outline" : "default"}
            >
              <Send className="mr-2 h-4 w-4" />
              {period.status === "published" ? "Atualizar Escala" : "Publicar Escala"}
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
          periodLabel={`${period.ministry?.name} · ${format(new Date(period.year, period.month - 1), "MMMM 'de' yyyy", { locale: ptBR })}`}
          availabilityDeadline={period.availability_deadline}
          conflicts={conflicts}
          blockouts={blockouts}
          declineReasons={declineReasons}
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
            <AlertDialogTitle>
              {period.status === "published" ? "Atualizar Escala" : "Publicar Escala"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {period.status === "published" ? (
                <>
                  Tem certeza que deseja atualizar a escala já publicada?
                  <br />
                  <br />
                  As alterações serão refletidas imediatamente para todos os servos que acessarem a página{" "}
                  <strong>Minha Escala</strong>.
                </>
              ) : (
                <>
                  Tem certeza que deseja publicar esta escala?
                  <br />
                  <br />
                  Após publicada, a escala ficará visível para todos os servos.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => handlePublish()} disabled={publishing}>
              {publishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {period.status === "published" ? "Atualizar" : "Publicar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Incomplete Events Warning */}
      <AlertDialog open={incompleteWarning} onOpenChange={setIncompleteWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eventos sem preenchimento</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{plural(incompleteCount, "evento", "eventos")}</strong> {incompleteCount === 1 ? "ainda possui" : "ainda possuem"} áreas obrigatórias sem servo atribuído.
              <br />
              <br />
              Deseja publicar a escala mesmo assim? Os eventos incompletos ficarão visíveis com as áreas em branco.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar e corrigir</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handlePublish(true)}
              disabled={publishing}
              className="bg-warning hover:bg-warning/90 text-warning-foreground"
            >
              {publishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Publicar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
