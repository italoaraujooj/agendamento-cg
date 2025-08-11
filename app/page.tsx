import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, MapPin, Users, CheckCircle } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Sistema de Agendamento de Espaços</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Reserve os espaços da igreja de forma simples e organizada. Sistema completo para gerenciar reservas dos
            ambientes da igreja.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-12">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <Calendar className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <CardTitle>Fazer Reserva</CardTitle>
              <CardDescription>Agende um espaço para seu ministério ou evento</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/booking">Agendar Agora</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <MapPin className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <CardTitle>Ver Ambientes</CardTitle>
              <CardDescription>Conheça os espaços disponíveis e suas capacidades</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full bg-transparent">
                <Link href="/environments">Ver Espaços</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <Users className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <CardTitle>Ver Reservas</CardTitle>
              <CardDescription>Visualize todas as reservas agendadas</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full bg-transparent">
                <Link href="/reservations">Ver Agenda</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">Funcionalidades do Sistema</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-gray-900">Agendamento Simples</h3>
                <p className="text-gray-600 text-sm">
                  Formulário completo com todos os dados necessários para a reserva
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-gray-900">Controle de Conflitos</h3>
                <p className="text-gray-600 text-sm">Sistema evita sobreposição de horários automaticamente</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-gray-900">Blocos de 1 Hora</h3>
                <p className="text-gray-600 text-sm">Agendamentos organizados em blocos de uma hora</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-gray-900">Visualização Completa</h3>
                <p className="text-gray-600 text-sm">Veja reservas por ambiente ou em visão geral</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
