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
  searchParams: Promise<{ environment?: string; date?: string }>
}) {
  const sp = await searchParams
  const supabase = createServerClient()

  if (!supabase) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg text-muted-foreground">Erro ao conectar com o banco de dados</p>
      </div>
    )
  }

  // Get all environments for filter
  const { data: environments } = await supabase.from("environments").select("id, name, capacity").order("name")

  // Build query for bookings
  let query = supabase
    .from("bookings")
    .select(
      `
      id,
      name,
      email,
      phone,
      ministry_network,
      estimated_participants,
      responsible_person,
      occasion,
      booking_date,
      start_time,
      end_time,
      created_at,
      environments (
        id,
        name,
        capacity
      )
    `,
      { count: "exact" }
    )
    .order("booking_date", { ascending: true })
    .order("start_time", { ascending: true })

  // Apply filters
  if (sp.environment) {
    query = query.eq("environment_id", sp.environment)
  }

  if (sp.date) {
    query = query.eq("booking_date", sp.date)
  }

  const { data: bookings, error } = await query

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg text-destructive">Erro ao carregar reservas: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Button asChild variant="ghost" className="mb-4">
            <Link href="/" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar ao Início
            </Link>
          </Button>

          <h1 className="text-4xl font-bold mb-4">Visualizar Reservas</h1>
          <p className="text-xl text-muted-foreground">Veja todas as reservas agendadas</p>
        </div>

        <ReservationsView
          bookings={bookings || []}
          environments={environments || []}
          currentFilters={{
            environment: sp.environment,
            date: sp.date,
          }}
        />
      </div>
    </div>
  )
}
