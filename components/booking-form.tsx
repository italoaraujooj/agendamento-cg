"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Clock, Users, Phone, Mail, Building, User, CheckCircle } from "lucide-react"
import { supabase } from "@/lib/supabase/client"

interface Environment {
  id: string
  name: string
  description: string | null
  capacity: number
}

interface BookingFormProps {
  environments: Environment[]
  preselectedEnvironment?: string
}

interface EnvironmentAvailability {
  id: number
  environment_id: number
  weekday: number
  start_time: string
  end_time: string
}

export default function BookingForm({ environments, preselectedEnvironment }: BookingFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    environmentId: preselectedEnvironment || "",
    name: "",
    email: "",
    phone: "",
    ministryNetwork: "",
    estimatedParticipants: "",
    responsiblePerson: "",
    occasion: "",
    bookingDate: "",
    startTime: "",
    duration: "1", // duração em horas
  })

  // Disponibilidades e reservas do dia (para calcular horários e ambientes disponíveis)
  const [availability, setAvailability] = useState<EnvironmentAvailability[]>([])
  const [bookingsForDate, setBookingsForDate] = useState<
    { environment_id: string | number; start_time: string; end_time: string }[]
  >([])
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false)

  const WEEKDAY_LABELS_PT_BR: readonly string[] = [
    "Domingo",
    "Segunda",
    "Terça",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sábado",
  ] as const

  const getWeekdayFromDate = (date: string): number | null => {
    if (!date) return null
    const d = new Date(`${date}T00:00:00`)
    if (Number.isNaN(d.getTime())) return null
    return d.getDay()
  }

  const timeStringToHour = (t: string): number => Number.parseInt(t.split(":")[0] || "0", 10)
  const pad2 = (n: number) => n.toString().padStart(2, "0")

  const MAX_PHONE_DIGITS = 11
  const MAX_PHONE_MASK_LENGTH = 15

  const formatPhoneBR = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, MAX_PHONE_DIGITS)
    if (digits.length <= 2) return `(${digits}`
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }

  useEffect(() => {
    const fetchDayData = async () => {
      const weekday = getWeekdayFromDate(formData.bookingDate)
      if (weekday === null) {
        setAvailability([])
        setBookingsForDate([])
        return
      }
      try {
        setIsLoadingAvailability(true)
        const [availRes, bookingsRes] = await Promise.all([
          supabase
            .from("environment_availabilities")
            .select("*")
            .eq("weekday", weekday)
            .order("start_time", { ascending: true }),
          formData.bookingDate
            ? supabase
                .from("bookings")
                .select("environment_id, start_time, end_time")
                .eq("booking_date", formData.bookingDate)
            : Promise.resolve({ data: [], error: null } as any),
        ])
        setAvailability(availRes.data || [])
        setBookingsForDate((bookingsRes as any).data || [])
      } finally {
        setIsLoadingAvailability(false)
      }
    }
    fetchDayData()
    // ao mudar a data, reseta horário e ambiente
    setFormData((prev) => ({ ...prev, startTime: "", environmentId: "" }))
  }, [formData.bookingDate])

  const startTimeOptions = useMemo(() => {
    if (!availability.length) return [] as string[]
    const options: string[] = []
    for (const w of availability) {
      const s = timeStringToHour(w.start_time)
      const e = timeStringToHour(w.end_time)
      for (let h = s; h < e; h++) {
        options.push(`${pad2(h)}:00`)
      }
    }
    return Array.from(new Set(options))
  }, [availability])

  // Seleciona automaticamente o primeiro horário disponível do dia
  useEffect(() => {
    if (!formData.startTime && startTimeOptions.length > 0) {
      setFormData((prev) => ({ ...prev, startTime: startTimeOptions[0] }))
    }
  }, [startTimeOptions, formData.startTime])

  // Opções de duração
  const durationOptions = [
    { value: "1", label: "1 hora" },
    { value: "2", label: "2 horas" },
    { value: "3", label: "3 horas" },
    { value: "4", label: "4 horas" },
    { value: "5", label: "5 horas" },
    { value: "6", label: "6 horas" },
    { value: "8", label: "8 horas" },
    { value: "10", label: "10 horas" },
    { value: "12", label: "12 horas" },
  ]

  // Função para calcular horário de fim baseado no início e duração respeitando disponibilidade
  const calculateEndTime = (startTime: string, duration: string) => {
    if (!startTime || !duration) return ""
    const startHour = Number.parseInt(startTime.split(":")[0])
    const endHour = startHour + Number.parseInt(duration)
    if (availability.length) {
      const ok = availability.some((w) => {
        const s = timeStringToHour(w.start_time)
        const e = timeStringToHour(w.end_time)
        return startHour >= s && endHour <= e
      })
      if (!ok) return ""
    }
    return `${endHour.toString().padStart(2, "0")}:00`
  }

  // Função para obter opções de duração válidas baseadas no horário de início e janela
  const getValidDurationOptions = (startTime: string) => {
    if (!startTime) return durationOptions
    if (!availability.length) return durationOptions
    const startHour = Number.parseInt(startTime.split(":")[0])
    const containing = availability.find((w) => {
      const s = timeStringToHour(w.start_time)
      const e = timeStringToHour(w.end_time)
      return startHour >= s && startHour < e
    })
    if (!containing) return []
    const maxDuration = timeStringToHour(containing.end_time) - startHour
    return durationOptions.filter((option) => Number.parseInt(option.value) <= maxDuration)
  }

  // Lista de ambientes disponíveis baseado em data/hora/duração e reservas existentes
  const availableEnvironments = useMemo(() => {
    if (!formData.bookingDate || !formData.startTime || !formData.duration) return [] as Environment[]
    const startHour = Number.parseInt(formData.startTime.split(":")[0])
    const endHour = startHour + Number.parseInt(formData.duration)
    const windowsByEnv = availability.reduce<Record<string, EnvironmentAvailability[]>>((acc, w) => {
      const key = String(w.environment_id)
      if (!acc[key]) acc[key] = []
      acc[key].push(w)
      return acc
    }, {})
    const bookingsByEnv = bookingsForDate.reduce<Record<string, { start: number; end: number }[]>>((acc, b) => {
      const key = String(b.environment_id)
      if (!acc[key]) acc[key] = []
      acc[key].push({ start: Number.parseInt(b.start_time.split(":")[0]), end: Number.parseInt(b.end_time.split(":")[0]) })
      return acc
    }, {})
    const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && aEnd > bStart
    return environments.filter((env) => {
      const key = String(env.id)
      const windows = windowsByEnv[key] || []
      const fitsWindow = windows.some((w) => {
        const s = timeStringToHour(w.start_time)
        const e = timeStringToHour(w.end_time)
        return startHour >= s && endHour <= e
      })
      if (!fitsWindow) return false
      const taken = (bookingsByEnv[key] || []).some((b) => overlaps(startHour, endHour, b.start, b.end))
      return !taken
    })
  }, [availability, bookingsForDate, environments, formData.bookingDate, formData.startTime, formData.duration])

  // Fallback: se não houver ambientes disponíveis calculados, exibir todos para não ficar vazio
  const environmentsToShow = availableEnvironments.length > 0 ? availableEnvironments : environments

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setError(null)
  }

  // Modificando para lidar com mudanças no horário de início
  const handleStartTimeChange = (startTime: string) => {
    setFormData((prev) => {
      const validDurations = getValidDurationOptions(startTime)
      const currentDuration = prev.duration

      // Se a duração atual não é mais válida, usar a primeira válida
      const newDuration = validDurations.find((d) => d.value === currentDuration)
        ? currentDuration
        : validDurations[0]?.value || "1"

      return {
        ...prev,
        startTime,
        duration: newDuration,
      }
    })
  }

  // Nova função para lidar com mudanças na duração
  const handleDurationChange = (duration: string) => {
    setFormData((prev) => ({
      ...prev,
      duration,
    }))
  }

  const validateForm = () => {
    const required = [
      "environmentId",
      "name",
      "email",
      "phone",
      "ministryNetwork",
      "estimatedParticipants",
      "responsiblePerson",
      "occasion",
      "bookingDate",
      "startTime",
      "duration",
    ]

    for (const field of required) {
      if (!formData[field as keyof typeof formData]) {
        return `O campo é obrigatório`
      }
    }

    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      return "Email inválido"
    }

    if (Number.parseInt(formData.estimatedParticipants) <= 0) {
      return "Número de participantes deve ser maior que zero"
    }

    const selectedEnv = environments.find((env) => env.id === formData.environmentId)
    if (selectedEnv && Number.parseInt(formData.estimatedParticipants) > selectedEnv.capacity) {
      return `Número de participantes excede a capacidade do ambiente (${selectedEnv.capacity})`
    }

    // Validação do horário de fim
    const endTime = calculateEndTime(formData.startTime, formData.duration)
    if (!endTime) {
      return "Duração selecionada ultrapassa o horário limite (22:00)"
    }

    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      setIsSubmitting(false)
      return
    }

    // Calculando endTime antes de enviar
    const endTime = calculateEndTime(formData.startTime, formData.duration)

    try {
      const { error: insertError } = await supabase.from("bookings").insert({
        environment_id: formData.environmentId,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        ministry: formData.ministryNetwork,
        estimated_participants: Number.parseInt(formData.estimatedParticipants),
        responsible_person: formData.responsiblePerson,
        occasion: formData.occasion,
        booking_date: formData.bookingDate,
        start_time: formData.startTime,
        end_time: endTime,
      })

      if (insertError) {
        if (insertError.code === "23P01") {
          setError("Já existe uma reserva para este horário. Escolha outro horário.")
        } else {
          setError(`Erro ao criar reserva: ${insertError.message}`)
        }
      } else {
        setSuccess(true)
        setTimeout(() => {
          router.push("/reservations")
        }, 2000)
      }
    } catch (err) {
      setError("Erro inesperado ao criar reserva")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (success) {
    return (
      <Card className="text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-16 w-16 text-green-600" />
          </div>
          <CardTitle className="text-green-600 text-2xl">Reserva Criada com Sucesso!</CardTitle>
          <CardDescription className="text-lg">
            Sua reserva foi registrada no sistema. Redirecionando para a página de reservas...
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Formulário de Reserva
        </CardTitle>
        <CardDescription>Preencha todos os campos para fazer sua reserva</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>}

          

          {/* Personal Information */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Nome Completo
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Seu nome completo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                placeholder="seu@email.com"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Telefone
              </Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", formatPhoneBR(e.target.value))}
                maxLength={MAX_PHONE_MASK_LENGTH}
                inputMode="numeric"
                placeholder="(11) 99999-9999"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ministry" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Ministério/Rede
              </Label>
              <Input
                id="ministry"
                value={formData.ministryNetwork}
                onChange={(e) => handleInputChange("ministryNetwork", e.target.value)}
                placeholder="Nome do ministério ou rede"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="participants" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Participantes Estimados
              </Label>
              <Input
                id="participants"
                type="number"
                min="1"
                value={formData.estimatedParticipants}
                onChange={(e) => handleInputChange("estimatedParticipants", e.target.value)}
                placeholder="Número de pessoas"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="responsible">Responsável por Abrir/Fechar a Igreja</Label>
              <Input
                id="responsible"
                value={formData.responsiblePerson}
                onChange={(e) => handleInputChange("responsiblePerson", e.target.value)}
                placeholder="Nome do responsável"
              />
            </div>
          </div>

          {/* Date and Time */}
          <div className="grid md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Data
              </Label>
              <Input
                id="date"
                type="date"
                value={formData.bookingDate}
                onChange={(e) => handleInputChange("bookingDate", e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="startTime" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Horário Início
              </Label>
              <Select value={formData.startTime} onValueChange={handleStartTimeChange} disabled={!startTimeOptions.length || isLoadingAvailability}>
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingAvailability ? "Carregando..." : startTimeOptions.length ? "Selecione" : "indisponível"} />
                </SelectTrigger>
                <SelectContent>
                  {startTimeOptions.map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Duração
              </Label>
              <Select value={formData.duration} onValueChange={handleDurationChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="max-h-48 overflow-y-auto">
                  {getValidDurationOptions(formData.startTime).map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="endTime">Horário Fim</Label>
              <Input
                id="endTime"
                value={calculateEndTime(formData.startTime, formData.duration)}
                readOnly
                placeholder="Automático"
                className="bg-gray-50"
              />
            </div>
          </div>

          {/* Environment Selection (após selecionar data e hora) */}
          <div className="space-y-2">
            <Label htmlFor="environment" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Ambiente
            </Label>
            <Select
              value={formData.environmentId}
              onValueChange={(value) => handleInputChange("environmentId", value)}
              disabled={!formData.bookingDate || !formData.startTime || !formData.duration || isLoadingAvailability}
            >
              <SelectTrigger className="w-fit">
                <SelectValue
                  placeholder={
                    isLoadingAvailability
                      ? "Carregando..."
                      : !formData.bookingDate || !formData.startTime || !formData.duration
                        ? "Escolha data e hora primeiro"
                        : environmentsToShow.length
                          ? "Selecione o ambiente"
                          : "Nenhum ambiente disponível"
                  }
                />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                {environmentsToShow.map((env) => (
                  <SelectItem key={env.id} value={String(env.id)}>
                    {env.name} (Capacidade: {env.capacity})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Occasion */}
          <div className="space-y-2">
            <Label htmlFor="occasion">Ocasião/Motivo</Label>
            <Textarea
              id="occasion"
              value={formData.occasion}
              onChange={(e) => handleInputChange("occasion", e.target.value)}
              placeholder="Descreva o motivo da reserva (reunião, evento, estudo, etc.)"
              rows={3}
            />
          </div>

          {/* Aviso de disponibilidade por dia */}
          {formData.bookingDate && !isLoadingAvailability && availability.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded text-sm">
              Não há disponibilidade configurada para {WEEKDAY_LABELS_PT_BR[getWeekdayFromDate(formData.bookingDate) || 0]}.
            </div>
          )}

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Criando Reserva..." : "Criar Reserva"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
