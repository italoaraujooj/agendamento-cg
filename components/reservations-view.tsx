"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/components/auth/auth-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar as CalendarIcon, Clock, Users, Phone, Mail, Building, User, Filter, X, CalendarDays, History, Calendar, Edit, Trash2, Clock3, CheckCircle, XCircle } from "lucide-react"
import { DatePicker } from "@/components/ui/date-picker"
import { supabase } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Booking {
  id: string
  user_id: string
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
  google_event_id?: string
  synced_at?: string
  status?: 'pending' | 'approved' | 'rejected'
  reviewed_by?: string
  reviewed_at?: string
  review_notes?: string
  environments: {
    id: string
    name: string
    capacity: number
  } | {
    id: string
    name: string
    capacity: number
  }[]
}

interface Environment {
  id: string
  name: string
  capacity: number
}

interface ReservationsViewProps {
  bookings: Booking[]
  pastBookings: Booking[]
  currentBookings: Booking[]
  environments: Environment[]
  currentFilters: {
    environment?: string
    date?: string
  }
}

const parseLocalYmd = (ymd: string): Date => {
  const [yearStr, monthStr, dayStr] = (ymd || "").split("-")
  const year = Number.parseInt(yearStr || "0", 10)
  const month = Number.parseInt(monthStr || "1", 10)
  const day = Number.parseInt(dayStr || "1", 10)
  return new Date(year, month - 1, day)
}

// Configuração de status de reserva
const STATUS_CONFIG = {
  pending: {
    label: 'Pendente',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
    icon: Clock3,
  },
  approved: {
    label: 'Aprovada',
    color: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
    icon: CheckCircle,
  },
  rejected: {
    label: 'Rejeitada',
    color: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
    icon: XCircle,
  },
}

export default function ReservationsView({ bookings, pastBookings, currentBookings, environments, currentFilters }: ReservationsViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isAuthenticated } = useAuth()
  const [filterDate, setFilterDate] = useState(currentFilters.date || "")
  const [filterEnvironment, setFilterEnvironment] = useState(currentFilters.environment || "")

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString())

    if (filterEnvironment && filterEnvironment !== "all") {
      params.set("environment", filterEnvironment)
    } else {
      params.delete("environment")
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
    const date = parseLocalYmd(dateString)
    return date.toLocaleDateString("pt-BR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const formatTime = (timeString: string) => {
    return timeString.slice(0, 5)
  }

  // Helper function to safely get environment data
  const getEnvironmentData = (environments: Booking['environments']) => {
    if (Array.isArray(environments)) {
      return environments[0] || { id: '', name: '', capacity: 0 }
    }
    return environments || { id: '', name: '', capacity: 0 }
  }

  // Group bookings by environment for the "Por Ambiente" tab
  const bookingsByEnvironment = environments.reduce(
    (acc, env) => {
      acc[env.id] = {
        environment: env,
        bookings: bookings.filter((booking) => getEnvironmentData(booking.environments).id === env.id),
      }
      return acc
    },
    {} as Record<string, { environment: Environment; bookings: Booking[] }>,
  )

  // Group past bookings by environment
  const pastBookingsByEnvironment = environments.reduce(
    (acc, env) => {
      acc[env.id] = {
        environment: env,
        bookings: pastBookings.filter((booking) => getEnvironmentData(booking.environments).id === env.id),
      }
      return acc
    },
    {} as Record<string, { environment: Environment; bookings: Booking[] }>,
  )

  // Group current bookings by environment
  const currentBookingsByEnvironment = environments.reduce(
    (acc, env) => {
      acc[env.id] = {
        environment: env,
        bookings: currentBookings.filter((booking) => getEnvironmentData(booking.environments).id === env.id),
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
              <DatePicker id="filterDate" value={filterDate} onChange={(v) => setFilterDate(v || "")} />
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
          {/* Sistema de abas aninhadas para separar por status temporal */}
          <Tabs defaultValue="current" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="current" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Atuais/Futuras ({currentBookings.length})
              </TabsTrigger>
              <TabsTrigger value="past" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Passadas ({pastBookings.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="current" className="space-y-4">
              {currentBookings.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Nenhuma reserva atual/futura</h3>
                    <p className="text-gray-500">
                      {hasActiveFilters
                        ? "Tente ajustar os filtros ou limpar para ver todas as reservas."
                        : "Não há reservas atuais ou futuras no sistema."}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {currentBookings.map((booking) => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      user={user}
                      isAuthenticated={isAuthenticated}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="past" className="space-y-4">
              {pastBookings.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <History className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Nenhuma reserva passada</h3>
                    <p className="text-gray-500">
                      {hasActiveFilters
                        ? "Tente ajustar os filtros ou limpar para ver todas as reservas."
                        : "Não há reservas passadas no sistema."}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {pastBookings.map((booking) => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      isPast
                      user={user}
                      isAuthenticated={isAuthenticated}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="by-environment" className="space-y-6">
          {/* Sistema de abas aninhadas para separar por status temporal */}
          <Tabs defaultValue="current" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="current" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Atuais/Futuras ({currentBookings.length})
              </TabsTrigger>
              <TabsTrigger value="past" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Passadas ({pastBookings.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="current" className="space-y-6">
              {Object.values(currentBookingsByEnvironment).map(({ environment, bookings: envBookings }) => (
                <Card key={environment.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      {environment.name}
                    </CardTitle>
                    <CardDescription>
                      Capacidade: {environment.capacity} pessoas • {envBookings.length} reserva(s) atual(is)/futura(s)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {envBookings.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">Nenhuma reserva atual/futura para este ambiente</p>
                    ) : (
                      <div className="space-y-3">
                        {envBookings.map((booking) => (
                          <BookingCard
                            key={booking.id}
                            booking={booking}
                            compact
                            user={user}
                            isAuthenticated={isAuthenticated}
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="past" className="space-y-6">
              {Object.values(pastBookingsByEnvironment).map(({ environment, bookings: envBookings }) => (
                <Card key={environment.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      {environment.name}
                    </CardTitle>
                    <CardDescription>
                      Capacidade: {environment.capacity} pessoas • {envBookings.length} reserva(s) passada(s)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {envBookings.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">Nenhuma reserva passada para este ambiente</p>
                    ) : (
                      <div className="space-y-3">
                        {envBookings.map((booking) => (
                          <BookingCard
                            key={booking.id}
                            booking={booking}
                            compact
                            isPast
                            user={user}
                            isAuthenticated={isAuthenticated}
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function BookingCard({ booking, compact = false, isPast = false, user, isAuthenticated }: { booking: Booking; compact?: boolean; isPast?: boolean; user?: any; isAuthenticated?: boolean }) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Mostrar controles apenas para o proprietário da reserva e se não estiver rejeitada
  const isOwner = isAuthenticated && user?.id === booking.user_id
  const canManageBookings = isOwner && booking.status !== 'rejected'

  // Configuração do status
  const status = booking.status || 'pending'
  const statusConfig = STATUS_CONFIG[status]
  const StatusIcon = statusConfig.icon

  // Helper function to safely get environment data
  const getEnvironmentData = (environments: Booking['environments']) => {
    if (Array.isArray(environments)) {
      return environments[0] || { id: '', name: '', capacity: 0 }
    }
    return environments || { id: '', name: '', capacity: 0 }
  }

  const handleDelete = async () => {
    if (!canManageBookings) return

    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', booking.id)

      if (error) throw error

      toast.success('Reserva cancelada com sucesso!')
      // Recarregar a página para atualizar a lista
      window.location.reload()
    } catch (error) {
      console.error('Erro ao cancelar reserva:', error)
      toast.error('Erro ao cancelar reserva. Tente novamente.')
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  const handleEdit = () => {
    if (!canManageBookings) return
    // Por enquanto, apenas mostrar uma mensagem
    toast.info('Funcionalidade de edição será implementada em breve')
  }

  const formatDateShort = (dateString: string) => {
    const date = parseLocalYmd(dateString)
    return date.toLocaleDateString("pt-BR", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const formatTime = (timeString: string) => {
    return timeString.slice(0, 5)
  }

  // Estilos condicionais baseados no status da reserva
  const cardClassName = compact 
    ? `border-l-4 ${isPast ? "border-l-muted-foreground bg-muted/30" : "border-l-blue-500"}` 
    : isPast ? "bg-muted/30 opacity-90" : ""

  const titleClassName = isPast ? "text-muted-foreground" : "text-lg"
  const descriptionClassName = isPast ? "text-muted-foreground/80" : ""

  return (
    <Card className={cardClassName}>
      <CardHeader className={compact ? "pb-3" : ""}>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className={titleClassName}>
              {booking.name}
              <div className="flex gap-2 ml-2">
                {/* Badge de Status */}
                <Badge variant="outline" className={`text-xs ${statusConfig.color}`}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusConfig.label}
                </Badge>
                {isPast && (
                  <Badge variant="secondary" className="text-xs">
                    Passada
                  </Badge>
                )}
                {booking.google_event_id && (
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
                    📅 Calendar
                  </Badge>
                )}
              </div>
            </CardTitle>
            <CardDescription className={`flex items-center gap-4 mt-1 ${descriptionClassName}`}>
              <span className="flex items-center gap-1">
                 <CalendarIcon className="h-3 w-3" />
                {formatDateShort(booking.booking_date)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
              </span>
            </CardDescription>
          </div>
          <Badge variant={isPast ? "secondary" : "outline"} className="flex items-center gap-1">
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
                <Building className={`h-4 w-4 ${isPast ? "text-muted-foreground/60" : "text-muted-foreground"}`} />
                <span className={`font-medium ${isPast ? "text-muted-foreground" : ""}`}>{getEnvironmentData(booking.environments).name}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Mail className={`h-4 w-4 ${isPast ? "text-muted-foreground/60" : "text-muted-foreground"}`} />
              <span className={isPast ? "text-muted-foreground" : ""}>{booking.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className={`h-4 w-4 ${isPast ? "text-muted-foreground/60" : "text-muted-foreground"}`} />
              <span className={isPast ? "text-muted-foreground" : ""}>{booking.phone}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className={`h-4 w-4 ${isPast ? "text-muted-foreground/60" : "text-muted-foreground"}`} />
              <span className={isPast ? "text-muted-foreground" : ""}>{booking.ministry_network}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className={`h-4 w-4 ${isPast ? "text-muted-foreground/60" : "text-muted-foreground"}`} />
              <span className={isPast ? "text-muted-foreground" : ""}>{booking.responsible_person}</span>
            </div>
          </div>
        </div>

        <div className={`mt-4 p-3 rounded-lg ${isPast ? "bg-muted/50" : "bg-muted"}`}>
          <p className={`text-sm ${isPast ? "text-muted-foreground" : ""}`}>
            <strong>Ocasião:</strong> {booking.occasion}
          </p>
        </div>

        {/* Exibir observações de revisão se houver */}
        {booking.review_notes && (
          <div className={`mt-3 p-3 rounded-lg border ${
            status === 'approved' 
              ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' 
              : status === 'rejected'
              ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
              : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
          }`}>
            <p className={`text-sm ${
              status === 'approved' 
                ? 'text-green-800 dark:text-green-300' 
                : status === 'rejected'
                ? 'text-red-800 dark:text-red-300'
                : 'text-yellow-800 dark:text-yellow-300'
            }`}>
              <strong>Observações:</strong> {booking.review_notes}
            </p>
          </div>
        )}

        {/* Aviso para reservas pendentes */}
        {status === 'pending' && !isPast && (
          <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              <span>Aguardando aprovação da administração</span>
            </p>
          </div>
        )}

        {/* Aviso para reservas rejeitadas */}
        {status === 'rejected' && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-800 dark:text-red-300 flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              <span>Esta reserva foi rejeitada pela administração</span>
            </p>
          </div>
        )}

        {/* Controles de edição/cancelamento apenas para o proprietário da reserva */}
        {canManageBookings && (
          <div className="flex gap-2 mt-4 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEdit}
              className="flex items-center gap-2"
            >
              <Edit className="h-4 w-4" />
              Editar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isDeleting}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {isDeleting ? 'Cancelando...' : 'Cancelar'}
            </Button>
          </div>
        )}
      </CardContent>

      {/* Dialog de confirmação para cancelamento */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Reserva</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar esta reserva? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
