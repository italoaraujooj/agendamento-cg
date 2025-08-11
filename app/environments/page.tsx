import { createServerClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Users, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface Environment {
  id: string
  name: string
  description: string | null
  capacity: number
  created_at: string
}

export default async function EnvironmentsPage() {
  const supabase = createServerClient()

  if (!supabase) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg text-gray-600">Erro ao conectar com o banco de dados</p>
      </div>
    )
  }

  const { data: environments, error } = await supabase.from("environments").select("*").order("name")

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg text-red-600">Erro ao carregar ambientes: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Button asChild variant="ghost" className="mb-4">
            <Link href="/" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar ao Início
            </Link>
          </Button>

          <h1 className="text-4xl font-bold text-gray-900 mb-4">Ambientes Disponíveis</h1>
          <p className="text-xl text-gray-600">Conheça os espaços da igreja e suas capacidades</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {environments?.map((environment: Environment) => (
            <Card key={environment.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-lg">{environment.name}</CardTitle>
                  </div>
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {environment.capacity}
                  </Badge>
                </div>
                <CardDescription className="text-sm">Capacidade máxima: {environment.capacity} pessoas</CardDescription>
              </CardHeader>

              <CardContent>
                <p className="text-gray-700 mb-4">{environment.description || "Sem descrição disponível"}</p>

                <Button asChild className="w-full">
                  <Link href={`/booking?environment=${environment.id}`}>Agendar Este Espaço</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {(!environments || environments.length === 0) && (
          <div className="text-center py-12">
            <MapPin className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Nenhum ambiente encontrado</h3>
            <p className="text-gray-500">
              Execute o script de configuração do banco de dados para criar os ambientes padrão.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
