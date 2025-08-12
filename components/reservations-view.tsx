"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, Clock, Users, Phone, Mail, Building, User, Filter, X, CalendarDays } from "lucide-react"

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

interface ReservationsViewProps {
  bookings: Booking[]
  environments: Environment[]
  currentFilters: {
    environment?: string
    date?: string
  }
}

export default function ReservationsView({ bookings, environments, currentFilters }: ReservationsViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [filterDate, setFilterDate] = useState(currentFilters.date || "")
  const [filterEnvironment, setFilterEnvironment] = useState(currentFilters.environment || "")

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString())

    if (!filterEnvironment || filterEnvironment === "all") {
      params.delete("environment")
    } else {
      params.set("environment", filterEnvironment)
    }

    if (filterDate) {
      params.set("date", filterDate)
    } else {
      params.delete("date")
    }

    router.push(`/reservations?${params.toString()}`)
  }

  const clearFilters = () => {
    setFilterDate("")
    setFilterEnvironment("")
    router.push("/reservations")
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const formatTime = (timeString: string) => {
    return timeString.slice(0, 5)
  }

  // Group bookings by environment for the "Por Ambiente" tab
  const bookingsByEnvironment = environments.reduce(
    (acc, env) => {
      acc[env.id] = {
        environment: env,
        bookings: bookings.filter((booking) => booking.environments.id === env.id),
      }
      return acc
    },
    {} as Record<string, { environment: Environment; bookings: Booking[] }>,
  )

  const hasActiveFilters = currentFilters.environment || currentFilters.date

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="filterDate">Data</Label>
              <Input id="filterDate" type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="filterEnvironment">Ambiente</Label>
              <Select value={filterEnvironment} onValueChange={setFilterEnvironment}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os ambientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os ambientes</SelectItem>
                  {environments.map((env) => (
                    <SelectItem key={env.id} value={env.id}>
                      {env.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <Button onClick={applyFilters} className="flex-1">
                Aplicar Filtros
              </Button>
              {hasActiveFilters && (
                <Button onClick={clearFilters} variant="outline" size="icon">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {hasActiveFilters && (
            <div className="mt-4 flex gap-2">
              {currentFilters.date && <Badge variant="secondary">Data: {formatDate(currentFilters.date)}</Badge>}
              {currentFilters.environment && (
                <Badge variant="secondary">
                  Ambiente: {environments.find((env) => env.id === currentFilters.environment)?.name}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs for different views */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="all">Todas as Reservas</TabsTrigger>
          <TabsTrigger value="by-environment">Por Ambiente</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {bookings.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <CalendarDays className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Nenhuma reserva encontrada</h3>
                <p className="text-gray-500">
                  {hasActiveFilters
                    ? "Tente ajustar os filtros ou limpar para ver todas as reservas."
                    : "Ainda não há reservas cadastradas no sistema."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {bookings.map((booking) => (
                <BookingCard key={booking.id} booking={booking} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="by-environment" className="space-y-6">
          {Object.values(bookingsByEnvironment).map(({ environment, bookings: envBookings }) => (
            <Card key={environment.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  {environment.name}
                </CardTitle>
                <CardDescription>
                  Capacidade: {environment.capacity} pessoas • {envBookings.length} reserva(s)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {envBookings.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Nenhuma reserva para este ambiente</p>
                ) : (
                  <div className="space-y-3">
                    {envBookings.map((booking) => (
                      <BookingCard key={booking.id} booking={booking} compact />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function BookingCard({ booking, compact = false }: { booking: Booking; compact?: boolean }) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const formatTime = (timeString: string) => {
    return timeString.slice(0, 5)
  }

  return (
    <Card className={compact ? "border-l-4 border-l-blue-500" : ""}>
      <CardHeader className={compact ? "pb-3" : ""}>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{booking.name}</CardTitle>
            <CardDescription className="flex items-center gap-4 mt-1">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(booking.booking_date)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
              </span>
            </CardDescription>
          </div>
          <Badge variant="outline" className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {booking.estimated_participants}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className={compact ? "pt-0" : ""}>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            {!compact && (
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-gray-500" />
                <span className="font-medium">{booking.environments.name}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-gray-500" />
              <span>{booking.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-500" />
              <span>{booking.phone}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-500" />
              <span>{booking.ministry_network}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-500" />
              <span>{booking.responsible_person}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm">
            <strong>Ocasião:</strong> {booking.occasion}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
