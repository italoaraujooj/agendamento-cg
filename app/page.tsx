import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, MapPin, Users, CheckCircle, LogIn } from "lucide-react"
import { AuthButton } from "@/components/auth/auth-button"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header com botão de login */}
        <div className="flex justify-between items-center mb-8">
          <div></div>
          <div className="flex items-center gap-4">
            <AuthButton />
          </div>
        </div>

        <div className="text-center mb-12">
          <h1 className="text-2xl sm:text-4xl font-bold mb-4">Sistema de Agendamento de Espaços</h1>
          <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Reserve os espaços da igreja de forma simples e organizada. Sistema completo para gerenciar reservas dos
            ambientes da igreja.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto mb-12">
          <Card>
            <CardHeader className="text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4" />
              <CardTitle>Fazer Reserva</CardTitle>
              <CardDescription>Agende um espaço para seu ministério ou evento</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/booking">Agendar Agora</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <MapPin className="h-12 w-12 mx-auto mb-4" />
              <CardTitle>Ver Ambientes</CardTitle>
              <CardDescription>Conheça os espaços disponíveis e suas capacidades</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/environments">Ver Espaços</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Users className="h-12 w-12 mx-auto mb-4" />
              <CardTitle>Ver Reservas</CardTitle>
              <CardDescription>Visualize todas as reservas agendadas</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/reservations">Ver Agenda</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <LogIn className="h-12 w-12 mx-auto mb-4" />
              <CardTitle>Meu Perfil</CardTitle>
              <CardDescription>Gerencie suas reservas e integrações</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/profile">Acessar Perfil</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Funcionalidades do Sistema</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-6 w-6 mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold">Agendamento Simples</h3>
                <p className="text-muted-foreground text-sm">
                  Formulário completo com todos os dados necessários para a reserva
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle className="h-6 w-6 mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold">Controle de Conflitos</h3>
                <p className="text-muted-foreground text-sm">Sistema evita sobreposição de horários automaticamente</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle className="h-6 w-6 mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold">Blocos de 1 Hora</h3>
                <p className="text-muted-foreground text-sm">Agendamentos organizados em blocos de uma hora</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle className="h-6 w-6 mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold">Visualização Completa</h3>
                <p className="text-muted-foreground text-sm">Veja reservas por ambiente ou em visão geral</p>
              </div>
            </div>
          </div>
        </div>

        {/* Link visível para Política de Privacidade - exigido pelo Google */}
        <div className="max-w-4xl mx-auto mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            Ao utilizar este sistema, você concorda com nossa{" "}
            <Link href="/privacy" className="text-primary hover:underline font-medium">
              Política de Privacidade
            </Link>
          </p>
        </div>

      </div>
    </div>
  )
}
