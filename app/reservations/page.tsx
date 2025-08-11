import { createServerClient } from "@/lib/supabase/server"
import ReservationsView from "@/components/reservations-view"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

interface Booking {
  id: string
  name: string
  email: string
  phone: string
  ministry_network: string
  estimated_participants: number
  responsible_person: string
  occasion: string
  booking_date: string
  start_time: string
  end_time: string
  created_at: string
  environments: {
    id: string
    name: string
    capacity: number
  }
}

interface Environment {
  id: string
  name: string
  capacity: number
}

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: { environment?: string; date?: string }
}) {
  const supabase = createServerClient()

  if (!supabase) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg text-gray-600">Erro ao conectar com o banco de dados</p>
      </div>
    )
  }

  // Get all environments for filter
  const { data: environments } = await supabase.from("environments").select("id, name, capacity").order("name")

  // Build query for bookings
  let query = supabase
    .from("bookings")
    .select(`
      *,
      environments (
        id,
        name,
        capacity
      )
    `)
    .order("booking_date", { ascending: true })
    .order("start_time", { ascending: true })

  // Apply filters
  if (searchParams.environment) {
    query = query.eq("environment_id", searchParams.environment)
  }

  if (searchParams.date) {
    query = query.eq("booking_date", searchParams.date)
  }

  const { data: bookings, error } = await query

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg text-red-600">Erro ao carregar reservas: {error.message}</p>
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

          <h1 className="text-4xl font-bold text-gray-900 mb-4">Visualizar Reservas</h1>
          <p className="text-xl text-gray-600">Veja todas as reservas agendadas</p>
        </div>

        <ReservationsView
          bookings={bookings || []}
          environments={environments || []}
          currentFilters={{
            environment: searchParams.environment,
            date: searchParams.date,
          }}
        />
      </div>
    </div>
  )
}
