import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, MapPin, Users, LogIn, ArrowRight, Clock } from "lucide-react"

export default function HomePage() {
  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Sistema de Agendamento de Espaços</h1>
        <p className="text-muted-foreground">
          Reserve os espaços da igreja de forma simples e organizada
        </p>
      </div>

      {/* Cards de Acesso Rápido */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle>Fazer Reserva</CardTitle>
                <CardDescription>Agende um espaço</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Agende um espaço para seu ministério ou evento da igreja.
            </p>
            <Button asChild className="w-full">
              <Link href="/booking">
                Agendar Agora
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                <MapPin className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <CardTitle>Ver Ambientes</CardTitle>
                <CardDescription>Espaços disponíveis</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Conheça os espaços disponíveis e suas capacidades.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/environments">
                Ver Espaços
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900">
                <Users className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <CardTitle>Ver Reservas</CardTitle>
                <CardDescription>Agenda completa</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Visualize todas as reservas agendadas nos ambientes.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/reservations">
                Ver Agenda
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                <LogIn className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardTitle>Meu Perfil</CardTitle>
                <CardDescription>Conta e integrações</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Gerencie suas reservas e integrações de calendário.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/profile">
                Acessar Perfil
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Seção de Informações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Funcionalidades do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Badge variant="outline" className="mb-2">Simples</Badge>
              <h4 className="font-medium">Agendamento Rápido</h4>
              <p className="text-sm text-muted-foreground">
                Formulário completo com todos os dados necessários para a reserva.
              </p>
            </div>
            <div className="space-y-2">
              <Badge variant="outline" className="mb-2">Inteligente</Badge>
              <h4 className="font-medium">Controle de Conflitos</h4>
              <p className="text-sm text-muted-foreground">
                Sistema evita sobreposição de horários automaticamente.
              </p>
            </div>
            <div className="space-y-2">
              <Badge variant="outline" className="mb-2">Organizado</Badge>
              <h4 className="font-medium">Blocos de 1 Hora</h4>
              <p className="text-sm text-muted-foreground">
                Agendamentos organizados em blocos de uma hora.
              </p>
            </div>
            <div className="space-y-2">
              <Badge variant="outline" className="mb-2">Completo</Badge>
              <h4 className="font-medium">Visualização Geral</h4>
              <p className="text-sm text-muted-foreground">
                Veja reservas por ambiente ou em visão geral.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Link para Política de Privacidade */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Ao utilizar este sistema, você concorda com nossa{" "}
          <Link href="/privacy" className="text-primary hover:underline font-medium">
            Política de Privacidade
          </Link>
        </p>
      </div>
    </div>
  )
}
