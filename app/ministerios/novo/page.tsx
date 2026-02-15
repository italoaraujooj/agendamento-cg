"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth/auth-provider"
import { useSystemMode } from "@/components/system-mode-provider"
import { MinistryForm } from "@/components/escalas/ministry-form"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

export default function NovoMinisterioPage() {
  const router = useRouter()
  const { isAuthenticated, isAdmin, adminChecked, loading: authLoading } = useAuth()
  const { setMode } = useSystemMode()

  useEffect(() => {
    setMode("escalas")
  }, [setMode])

  // Verificar permissão de admin
  useEffect(() => {
    if (!authLoading && adminChecked) {
      if (!isAuthenticated) {
        router.push("/escalas")
        return
      }
      if (!isAdmin) {
        toast.error("Acesso negado. Você não tem permissão de administrador.")
        router.push("/escalas")
        return
      }
    }
  }, [authLoading, isAuthenticated, isAdmin, adminChecked, router])

  if (authLoading || !adminChecked || (isAuthenticated && !isAdmin)) {
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
          <Link href="/ministerios">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Ministérios
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Criar Ministério</h1>
        <p className="text-muted-foreground">
          Configure um novo ministério para gerenciar escalas
        </p>
      </div>

      <MinistryForm />
    </div>
  )
}
