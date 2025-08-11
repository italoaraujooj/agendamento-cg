"use client"

import type React from "react"

import { useState } from "react"
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

  // Generate time options (8:00 to 22:00)
  const timeOptions = []
  for (let hour = 8; hour <= 22; hour++) {
    const timeString = `${hour.toString().padStart(2, "0")}:00`
    timeOptions.push(timeString)
  }

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

  // Função para calcular horário de fim baseado no início e duração
  const calculateEndTime = (startTime: string, duration: string) => {
    if (!startTime || !duration) return ""

    const startHour = Number.parseInt(startTime.split(":")[0])
    const endHour = startHour + Number.parseInt(duration)

    if (endHour > 22) return "" // Não pode passar das 22h

    return `${endHour.toString().padStart(2, "0")}:00`
  }

  // Função para obter opções de duração válidas baseadas no horário de início
  const getValidDurationOptions = (startTime: string) => {
    if (!startTime) return durationOptions

    const startHour = Number.parseInt(startTime.split(":")[0])
    const maxDuration = 22 - startHour

    return durationOptions.filter((option) => Number.parseInt(option.value) <= maxDuration)
  }

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
        ministry_network: formData.ministryNetwork,
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

          {/* Environment Selection */}
          <div className="space-y-2">
            <Label htmlFor="environment" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Ambiente
            </Label>
            <Select value={formData.environmentId} onValueChange={(value) => handleInputChange("environmentId", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o ambiente" />
              </SelectTrigger>
              <SelectContent>
                {environments.map((env) => (
                  <SelectItem key={env.id} value={env.id}>
                    {env.name} (Capacidade: {env.capacity})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
                onChange={(e) => handleInputChange("phone", e.target.value)}
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
              <Select value={formData.startTime} onValueChange={handleStartTimeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.slice(0, -1).map((time) => (
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
                <SelectContent>
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

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Criando Reserva..." : "Criar Reserva"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
