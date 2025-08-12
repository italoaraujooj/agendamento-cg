import { createServerClient } from "@/lib/supabase/server"
import BookingForm from "@/components/booking-form"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

interface Environment {
  id: string
  name: string
  description: string | null
  capacity: number
}

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ environment?: string }>
}) {
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

          <h1 className="text-4xl font-bold text-gray-900 mb-4">Fazer Reserva</h1>
          <p className="text-xl text-gray-600">Preencha o formulário para agendar um espaço da igreja</p>
        </div>

        <div className="max-w-2xl mx-auto">
          <BookingForm environments={environments || []} preselectedEnvironment={(await searchParams).environment} />
        </div>
      </div>
    </div>
  )
}
