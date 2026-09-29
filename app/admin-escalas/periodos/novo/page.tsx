"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth/auth-provider"
import { useSystemMode } from "@/components/system-mode-provider"
import { PeriodForm } from "@/components/escalas/period-form"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

export default function NovoPeriodoPage() {
  const router = useRouter()
  const { isAuthenticated, isAdmin, ministryRoles, adminChecked, loading: authLoading } = useAuth()
  const { setMode } = useSystemMode()
  // Admin ou líder: o líder só cria períodos dos ministérios que gerencia
  const canManage = isAdmin || ministryRoles.length > 0

  useEffect(() => {
    setMode("escalas")
  }, [setMode])

  useEffect(() => {
    if (!authLoading && adminChecked) {
      if (!isAuthenticated || !canManage) {
        toast.error("Acesso negado")
        router.push("/escalas")
      }
    }
  }, [authLoading, isAuthenticated, canManage, adminChecked, router])

  if (authLoading || !adminChecked) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/admin-escalas/periodos">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Períodos
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Criar Período de Escala</h1>
        <p className="text-muted-foreground">
          Defina o mês e ministério para criar uma nova escala
        </p>
      </div>

      <PeriodForm allowedMinistryIds={isAdmin ? undefined : ministryRoles.map((r) => r.ministry_id)} />
    </div>
  )
}
