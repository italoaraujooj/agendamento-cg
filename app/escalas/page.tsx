"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Users2, 
  CalendarDays, 
  ClipboardList, 
  Clock,
  ArrowRight,
  Plus,
  Settings
} from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { useSystemMode } from "@/components/system-mode-provider"
import Link from "next/link"

export default function EscalasDashboardPage() {
  const { isAuthenticated, isAdmin, loading } = useAuth()
  const { setMode } = useSystemMode()
  const router = useRouter()

  // Garantir que estamos no modo escalas
  useEffect(() => {
    setMode("escalas")
  }, [setMode])

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Sistema de Escalas</h1>
        <p className="text-muted-foreground">
          Gerencie escalas de servos dos ministérios da igreja
        </p>
      </div>

      {/* Cards de Acesso Rápido */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Ministérios */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                <Users2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle>Ministérios</CardTitle>
                <CardDescription>Gerencie ministérios e servos</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Configure ministérios, áreas de serviço e cadastre os voluntários.
            </p>
            <Button asChild className="w-full">
              <Link href="/ministerios">
                Acessar Ministérios
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Calendário Regular */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                <CalendarDays className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <CardTitle>Calendário Regular</CardTitle>
                <CardDescription>Eventos recorrentes</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Configure cultos e eventos que acontecem regularmente toda semana.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/calendario">
                Configurar Calendário
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Admin Escalas */}
        {isAuthenticated && isAdmin && (
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                  <ClipboardList className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <CardTitle>Períodos de Escala</CardTitle>
                  <CardDescription>Montar escalas mensais</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Crie períodos, colete disponibilidades e monte as escalas.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/admin-escalas">
                  Gerenciar Escalas
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Seção de Informações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Como funciona
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Badge variant="outline" className="mb-2">Passo 1</Badge>
              <h4 className="font-medium">Configure Ministérios</h4>
              <p className="text-sm text-muted-foreground">
                Cadastre os ministérios, suas áreas e os servos voluntários.
              </p>
            </div>
            <div className="space-y-2">
              <Badge variant="outline" className="mb-2">Passo 2</Badge>
              <h4 className="font-medium">Defina o Calendário</h4>
              <p className="text-sm text-muted-foreground">
                Configure os eventos regulares como cultos de domingo e quarta.
              </p>
            </div>
            <div className="space-y-2">
              <Badge variant="outline" className="mb-2">Passo 3</Badge>
              <h4 className="font-medium">Colete Disponibilidade</h4>
              <p className="text-sm text-muted-foreground">
                Envie o link para os servos informarem sua disponibilidade mensal.
              </p>
            </div>
            <div className="space-y-2">
              <Badge variant="outline" className="mb-2">Passo 4</Badge>
              <h4 className="font-medium">Monte a Escala</h4>
              <p className="text-sm text-muted-foreground">
                Com base nas disponibilidades, monte e publique a escala do mês.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mensagem para não autenticados */}
      {!isAuthenticated && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Settings className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Faça login para gerenciar</h3>
            <p className="text-muted-foreground text-center mb-4">
              Você precisa estar logado como administrador para gerenciar ministérios e escalas.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
