"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Plus, 
  Loader2, 
  Calendar,
  Clock,
  Users,
  ClipboardList,
  CheckCircle,
  AlertCircle,
  ArrowLeft
} from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { useSystemMode } from "@/components/system-mode-provider"
import { supabase } from "@/lib/supabase/client"
import { toast } from "sonner"
import Link from "next/link"
import type { SchedulePeriod, Ministry } from "@/types/escalas"
import { PERIOD_STATUS_LABELS, PERIOD_STATUS_COLORS } from "@/types/escalas"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface PeriodWithMinistry extends SchedulePeriod {
  ministry: Ministry
}

export default function PeriodosPage() {
  const router = useRouter()
  const { isAuthenticated, isAdmin, adminChecked, loading: authLoading } = useAuth()
  const { setMode } = useSystemMode()
  const [periods, setPeriods] = useState<PeriodWithMinistry[]>([])
  const [loading, setLoading] = useState(true)

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

  useEffect(() => {
    async function fetchPeriods() {
      if (!isAdmin) return
      
      try {
        const { data, error } = await supabase
          .from("schedule_periods")
          .select(`
            *,
            ministry:ministries(*)
          `)
          .order("year", { ascending: false })
          .order("month", { ascending: false })

        if (error) throw error
        setPeriods(data || [])
      } catch (error) {
        console.error("Erro ao buscar períodos:", error)
        toast.error("Erro ao carregar períodos")
      } finally {
        setLoading(false)
      }
    }

    if (isAdmin) {
      fetchPeriods()
    }
  }, [isAdmin])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "draft": return <Clock className="h-4 w-4" />
      case "collecting": return <Users className="h-4 w-4" />
      case "scheduling": return <ClipboardList className="h-4 w-4" />
      case "published": return <CheckCircle className="h-4 w-4" />
      case "closed": return <AlertCircle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button variant="ghost" asChild className="w-fit">
          <Link href="/admin-escalas">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Link>
        </Button>
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Períodos de Escala</h1>
            <p className="text-muted-foreground">
              Gerencie os períodos mensais de escala
            </p>
          </div>
          <Button asChild>
            <Link href="/admin-escalas/periodos/novo">
              <Plus className="mr-2 h-4 w-4" />
              Novo Período
            </Link>
          </Button>
        </div>
      </div>

      {/* Lista */}
      {periods.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum período criado</h3>
            <p className="text-muted-foreground text-center mb-4">
              Crie um período de escala para começar a montar as escalas mensais.
            </p>
            <Button asChild>
              <Link href="/admin-escalas/periodos/novo">
                <Plus className="mr-2 h-4 w-4" />
                Criar Período
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {periods.map((period) => (
            <Card key={period.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-2 h-16 rounded-full"
                      style={{ backgroundColor: period.ministry?.color || '#888' }}
                    />
                    <div>
                      <h3 className="font-semibold text-lg">
                        {format(new Date(period.year, period.month - 1), "MMMM 'de' yyyy", { locale: ptBR })}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {period.ministry?.name}
                      </p>
                      {period.availability_deadline && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Prazo: {format(new Date(period.availability_deadline), "dd/MM/yyyy 'às' HH:mm")}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="secondary"
                      className={`${PERIOD_STATUS_COLORS[period.status]} text-white`}
                    >
                      {getStatusIcon(period.status)}
                      <span className="ml-1">{PERIOD_STATUS_LABELS[period.status]}</span>
                    </Badge>
                    <Button variant="outline" asChild>
                      <Link href={`/admin-escalas/periodos/${period.id}`}>
                        Gerenciar
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
