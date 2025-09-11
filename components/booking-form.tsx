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
import { Calendar as CalendarIcon, Clock, Users, Phone, Mail, Building, User, CheckCircle, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase/client"
import { DatePicker } from "@/components/ui/date-picker"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { format } from "date-fns"
import { toast } from "sonner"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

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
  const [step, setStep] = useState<1 | 2>(1)
  const [extraOccurrences, setExtraOccurrences] = useState<Array<{ date: string; startTime: string; duration: string }>>([])
  const [envAvailabilityByWeekday, setEnvAvailabilityByWeekday] = useState<Record<number, { start: number; end: number }[]>>({})
  const [isLoadingEnvAvailability, setIsLoadingEnvAvailability] = useState(false)

  const [formData, setFormData] = useState({
    environmentId: preselectedEnvironment || "",
    environmentIds: [] as string[],
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
    recurrenceFrequency: "none" as "none" | "daily" | "weekly" | "monthly" | "monthly_weekday",
    recurrenceInterval: "1",
    recurrenceEndDate: "",
    recurrenceNth: [] as Array<"1" | "2" | "3" | "4" | "last">,
    recurrenceWeekdays: [] as number[],
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
  const DEFAULT_START_HOUR = 8
  const DEFAULT_END_HOUR = 22

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
    // ao mudar a data, reseta horário, mantendo ambiente selecionado
    setFormData((prev) => ({ ...prev, startTime: "" }))
  }, [formData.bookingDate])

  // Pré-seleciona próxima data disponível do ambiente vindo do fluxo de ambientes
  useEffect(() => {
    const prefillNextAvailableDate = async () => {
      if (!preselectedEnvironment || formData.bookingDate) return
      try {
        const { data } = await supabase
          .from("environment_availabilities")
          .select("weekday,start_time,end_time")
          .eq("environment_id", Number(preselectedEnvironment))
        if (!data || data.length === 0) return
        const availableWeekdays = new Set<number>(data.map((d: any) => Number(d.weekday)))
        const today = new Date()
        for (let i = 0; i < 14; i++) {
          const d = new Date(today)
          d.setDate(today.getDate() + i)
          if (availableWeekdays.has(d.getDay())) {
            const next = format(d, "yyyy-MM-dd")
            setFormData((prev) => ({ ...prev, bookingDate: next, environmentId: preselectedEnvironment }))
            break
          }
        }
      } catch {
        // ignore
      }
    }
    prefillNextAvailableDate()
  }, [preselectedEnvironment, formData.bookingDate])

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

  // Datas e recorrência
  const MAX_RECURRENCE_OCCURRENCES = 100
  const FREQUENCY_LABEL: Record<"none" | "daily" | "weekly" | "monthly" | "monthly_weekday", string> = {
    none: "Não repetir",
    daily: "Diariamente",
    weekly: "Semanalmente",
    monthly: "Mensalmente (pela data)",
    monthly_weekday: "Mensal por dia da semana",
  }

  const parseLocalYmd = (ymd: string) => {
    const [y, m, d] = (ymd || "").split("-")
    return new Date(Number(y || 0), Number(m || 1) - 1, Number(d || 1))
  }

  const formatYmd = (date: Date) => format(date, "yyyy-MM-dd")

  const addDays = (date: Date, days: number) => {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    return d
  }

  const addWeeks = (date: Date, weeks: number) => addDays(date, weeks * 7)

  const addMonthsClamped = (date: Date, months: number) => {
    const year = date.getFullYear()
    const monthIndex = date.getMonth() + months
    const targetYear = year + Math.floor(monthIndex / 12)
    const targetMonthIndex = ((monthIndex % 12) + 12) % 12
    const targetLastDay = new Date(targetYear, targetMonthIndex + 1, 0).getDate()
    const targetDay = Math.min(date.getDate(), targetLastDay)
    return new Date(targetYear, targetMonthIndex, targetDay)
  }

  const generateRecurrenceDates = (
    startYmd: string,
    frequency: "none" | "daily" | "weekly" | "monthly" | "monthly_weekday",
    intervalStr: string,
    endYmd: string,
  ): string[] => {
    const start = parseLocalYmd(startYmd)
    const interval = Math.max(1, Number.parseInt(intervalStr || "1", 10))

    if (Number.isNaN(start.getTime())) return []

    if (frequency === "none") return [startYmd]

    const end = parseLocalYmd(endYmd)
    if (Number.isNaN(end.getTime())) return []

    const dates: string[] = []
    if (frequency === "monthly_weekday") {
      // Ex.: 1º e 3º sábado, última quinta-feira
      const selectedNth = new Set(formData.recurrenceNth)
      const selectedWds = new Set(formData.recurrenceWeekdays)
      if (selectedNth.size === 0 || selectedWds.size === 0) return []

      // Gera mês a mês, pegando os n-ésimos wds
      let monthCursor = new Date(start.getFullYear(), start.getMonth(), 1)
      let count = 0
      while (monthCursor <= end && count < MAX_RECURRENCE_OCCURRENCES) {
        const y = monthCursor.getFullYear()
        const m = monthCursor.getMonth()
        // Dias do mês
        const daysInMonth = new Date(y, m + 1, 0).getDate()
        // Para cada weekday selecionado, encontre as ocorrências no mês
        for (const wd of selectedWds) {
          const occurrences: number[] = []
          for (let d = 1; d <= daysInMonth; d++) {
            const dt = new Date(y, m, d)
            if (dt.getDay() === wd) occurrences.push(d)
          }
          for (const nth of selectedNth) {
            let dayNum: number | null = null
            if (nth === "last") {
              dayNum = occurrences[occurrences.length - 1] ?? null
            } else {
              const n = Number.parseInt(nth, 10)
              dayNum = occurrences[n - 1] ?? null
            }
            if (dayNum) {
              const cand = new Date(y, m, dayNum)
              if (cand >= start && cand <= end) dates.push(formatYmd(cand))
            }
          }
        }
        // Avança em meses respeitando intervalo
        monthCursor = addMonthsClamped(monthCursor, interval)
        count += 1
      }
      // Remover duplicados e ordenar
      return Array.from(new Set(dates)).sort()
    } else {
      let cursor = new Date(start)
      let count = 0
      while (cursor <= end && count < MAX_RECURRENCE_OCCURRENCES) {
        dates.push(formatYmd(cursor))
        if (frequency === "daily") cursor = addDays(cursor, interval)
        else if (frequency === "weekly") cursor = addWeeks(cursor, interval)
        else cursor = addMonthsClamped(cursor, interval)
        count += 1
      }
      return dates
    }
  }

  const expandOccurrencesWithRecurrence = (
    seeds: Array<{ date: string; start: number; end: number }>,
    frequency: "none" | "daily" | "weekly" | "monthly",
    intervalStr: string,
    endYmd: string,
  ): Array<{ date: string; start: number; end: number }> => {
    if (frequency === "none") return seeds
    const expanded: Array<{ date: string; start: number; end: number }> = []
    for (const seed of seeds) {
      const dates = generateRecurrenceDates(seed.date, frequency, intervalStr, endYmd)
      for (const d of dates) expanded.push({ date: d, start: seed.start, end: seed.end })
    }
    return expanded
  }

  // Carregar disponibilidades do ambiente selecionado (para construir opções por data)
  useEffect(() => {
    const loadEnvAvailability = async () => {
      if (!formData.environmentId) {
        setEnvAvailabilityByWeekday({})
        return
      }
      try {
        setIsLoadingEnvAvailability(true)
        const { data } = await supabase
          .from("environment_availabilities")
          .select("weekday,start_time,end_time")
          .eq("environment_id", Number(formData.environmentId))
        const grouped = (data || []).reduce<Record<number, { start: number; end: number }[]>>((acc, row: any) => {
          const wk = Number(row.weekday)
          const s = timeStringToHour(row.start_time)
          const e = timeStringToHour(row.end_time)
          if (!acc[wk]) acc[wk] = []
          acc[wk].push({ start: s, end: e })
          return acc
        }, {})
        setEnvAvailabilityByWeekday(grouped)
      } finally {
        setIsLoadingEnvAvailability(false)
      }
    }
    loadEnvAvailability()
  }, [formData.environmentId])

  const getStartTimeOptionsForDate = (ymd: string): string[] => {
    if (!ymd) return []
    const date = parseLocalYmd(ymd)
    if (Number.isNaN(date.getTime())) return []
    const wk = date.getDay()
    const windows = envAvailabilityByWeekday[wk] || []
    const opts: string[] = []
    if (windows.length === 0) {
      for (let h = DEFAULT_START_HOUR; h < DEFAULT_END_HOUR; h++) {
        opts.push(`${pad2(h)}:00`)
      }
    } else {
      for (const win of windows) {
        for (let h = win.start; h < win.end; h++) {
          opts.push(`${pad2(h)}:00`)
        }
      }
    }
    return Array.from(new Set(opts))
  }

  const getValidDurationForDateAndStart = (ymd: string, startTime: string) => {
    if (!ymd || !startTime) return durationOptions
    const date = parseLocalYmd(ymd)
    const wk = date.getDay()
    const windows = envAvailabilityByWeekday[wk] || []
    const startHour = Number.parseInt(startTime.split(":")[0])
    if (windows.length === 0) {
      const maxDuration = DEFAULT_END_HOUR - startHour
      if (maxDuration <= 0) return []
      return durationOptions.filter((option) => Number.parseInt(option.value) <= maxDuration)
    }
    const containing = windows.find((w) => startHour >= w.start && startHour < w.end)
    if (!containing) return []
    const maxDuration = containing.end - startHour
    return durationOptions.filter((option) => Number.parseInt(option.value) <= maxDuration)
  }

  const computeEndTimeFromStartAndDuration = (startTime: string, duration: string): string => {
    if (!startTime || !duration) return ""
    const startHour = Number.parseInt(startTime.split(":")[0])
    const endHour = startHour + Number.parseInt(duration)
    return `${pad2(endHour)}:00`
  }

  const handleRemovePrimaryDate = () => {
    if (extraOccurrences.length === 0) return
    const [first, ...rest] = extraOccurrences
    setFormData((prev) => ({
      ...prev,
      bookingDate: first.date,
      startTime: first.startTime,
      duration: first.duration,
    }))
    setExtraOccurrences(rest)
  }

  const renderExtraOccurrence = (occ: { date: string; startTime: string; duration: string }, idx: number) => {
    const startOpts = getStartTimeOptionsForDate(occ.date)
    const durationOpts = getValidDurationForDateAndStart(occ.date, occ.startTime)
    const endDisplay = computeEndTimeFromStartAndDuration(occ.startTime, occ.duration)
    return (
      <div key={idx} className="grid md:grid-cols-4 gap-3">
        <div className="space-y-2">
          <Label className="flex items-center gap-2"><CalendarIcon className="h-4 w-4" /> Data</Label>
          <DatePicker
            value={occ.date}
            onChange={(d) => {
              setExtraOccurrences((prev) => {
                const next = [...prev]
                next[idx] = { ...next[idx], date: d || "" }
                return next
              })
            }}
            disablePast
          />
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2"><Clock className="h-4 w-4" /> Horário Início</Label>
          <Select
            value={occ.startTime}
            onValueChange={(v) =>
              setExtraOccurrences((prev) => {
                const next = [...prev]
                next[idx] = { ...next[idx], startTime: v }
                return next
              })
            }
            disabled={!occ.date || startOpts.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={occ.date ? (startOpts.length ? "Selecione" : "indisponível") : "Escolha a data"} />
            </SelectTrigger>
            <SelectContent className="max-h-48 overflow-y-auto">
              {startOpts.map((t) => (
                <SelectItem key={`${idx}-${t}`} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2"><Clock className="h-4 w-4" /> Duração</Label>
          <Select
            value={occ.duration}
            onValueChange={(v) =>
              setExtraOccurrences((prev) => {
                const next = [...prev]
                next[idx] = { ...next[idx], duration: v }
                return next
              })
            }
            disabled={!occ.startTime || durationOpts.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={occ.startTime ? (durationOpts.length ? "Selecione" : "indisponível") : "Escolha o início"} />
            </SelectTrigger>
            <SelectContent>
              {durationOpts.map((opt) => (
                <SelectItem key={`${idx}-dur-${opt.value}`} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`extraEnd-${idx}`}>Horário Fim</Label>
          <div className="flex items-center gap-2">
            <Input id={`extraEnd-${idx}`} value={endDisplay} readOnly placeholder="Automático" className="bg-gray-50" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setExtraOccurrences((prev) => prev.filter((_, i) => i !== idx))}
              aria-label="Remover data adicional"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Função para calcular horário de fim baseado no início e duração respeitando disponibilidade
  const calculateEndTime = (startTime: string, duration: string) => {
    if (!startTime || !duration) return ""
    const startHour = Number.parseInt(startTime.split(":")[0])
    const endHour = startHour + Number.parseInt(duration)
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
      "environmentIds",
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

    const selectedEnvs = environments.filter((env) => formData.environmentIds.includes(String(env.id)))
    if (selectedEnvs.length === 0) return "Selecione ao menos um ambiente"
    const overCap = selectedEnvs.find((env) => Number.parseInt(formData.estimatedParticipants || "0") > env.capacity)
    if (overCap) return `Número de participantes excede a capacidade do ambiente (${overCap.capacity})`

    // Validação do horário de fim
    const endTime = calculateEndTime(formData.startTime, formData.duration)

    // Extras: validar campos e horários
    for (const [idx, occ] of extraOccurrences.entries()) {
      if (!occ.date || !occ.startTime || !occ.duration) return `Preencha data, início e duração na ocorrência adicional #${idx + 1}`
      const extraEnd = computeEndTimeFromStartAndDuration(occ.startTime, occ.duration)
      if (!extraEnd) return `Horário inválido na ocorrência adicional #${idx + 1}`
    }

    // Checar duplicidade de (data, início)
    const seen = new Set<string>()
    const key = (d: string, s: string) => `${d}|${s}`
    seen.add(key(formData.bookingDate, formData.startTime))
    for (const occ of extraOccurrences) {
      const k = key(occ.date, occ.startTime)
      if (seen.has(k)) return `Data/horário duplicado: ${occ.date} ${occ.startTime}`
      seen.add(k)
    }

    // Recorrência: se habilitada, exigir data final válida e não anterior ao início
    if (formData.recurrenceFrequency !== "none") {
      if (!formData.recurrenceEndDate) return "Defina a data final da recorrência"
      const start = parseLocalYmd(formData.bookingDate)
      const end = parseLocalYmd(formData.recurrenceEndDate)
      if (end < start) return "A data final da recorrência deve ser igual ou posterior à data inicial"
      // Para monthly_weekday, exigir seleção de pelo menos um ordinal e um dia da semana
      if (formData.recurrenceFrequency === "monthly_weekday") {
        if (!formData.recurrenceNth.length) return "Selecione 1º/2º/3º/4º/Último para a recorrência mensal por dia da semana"
        if (!formData.recurrenceWeekdays.length) return "Selecione ao menos um dia da semana para a recorrência"
      }

      const occurrences = generateRecurrenceDates(
        formData.bookingDate,
        formData.recurrenceFrequency,
        formData.recurrenceInterval,
        formData.recurrenceEndDate,
      )
      if (occurrences.length === 0) return "Não foi possível gerar as datas da recorrência"
      if (occurrences.length >= MAX_RECURRENCE_OCCURRENCES)
        return `Limite máximo de ${MAX_RECURRENCE_OCCURRENCES} ocorrências atingido`
      // Observação: duplicidades entre recorrência e extras serão deduplicadas automaticamente no envio
    }

    return null
  }

  const validateStep1 = () => {
    const requiredStep1 = [
      "name",
      "email",
      "phone",
      "ministryNetwork",
      "estimatedParticipants",
      "responsiblePerson",
      "occasion",
    ]
    for (const field of requiredStep1) {
      if (!formData[field as keyof typeof formData]) return `O campo é obrigatório`
    }
    if (!/\S+@\S+\.\S+/.test(formData.email)) return "Email inválido"
    if (Number.parseInt(formData.estimatedParticipants || "0") <= 0) return "Número de participantes deve ser maior que zero"
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

    // Datas alvo (recorrência ou única)
    const allDates = generateRecurrenceDates(
      formData.bookingDate,
      formData.recurrenceFrequency,
      formData.recurrenceInterval,
      formData.recurrenceEndDate || formData.bookingDate,
    )

    // Calcula horário de fim uma vez
    const endTime = calculateEndTime(formData.startTime, formData.duration)

    try {
      // Pré-checagem de disponibilidade por dia da semana por ambiente selecionado
      const envIds = (formData.environmentIds.length ? formData.environmentIds : [formData.environmentId]).map((id) => Number(id))
      const { data: allEnvAvail } = await supabase
        .from("environment_availabilities")
        .select("weekday,start_time,end_time,environment_id")
        .in("environment_id", envIds)

      const windowsByEnvByWeekday = (allEnvAvail || []).reduce<Record<number, Record<number, { s: number; e: number }[]>>>((acc, w: any) => {
        const env = Number(w.environment_id)
        const wk = Number(w.weekday)
        const s = timeStringToHour(w.start_time)
        const e = timeStringToHour(w.end_time)
        if (!acc[env]) acc[env] = {}
        if (!acc[env][wk]) acc[env][wk] = []
        acc[env][wk].push({ s, e })
        return acc
      }, {})

      const startHour = Number.parseInt(formData.startTime.split(":")[0])
      const endHour = Number.parseInt(endTime.split(":")[0])
      const weekdayOf = (ymd: string) => parseLocalYmd(ymd).getDay()

      // Construir ocorrências alvo: recorrência + extras (cada uma com seu horário)
      const recurrenceOccurrences = allDates.map((d) => ({ date: d, start: startHour, end: endHour }))
      const extraOccurrencesResolved = extraOccurrences.map((o) => ({
        date: o.date,
        start: Number.parseInt(o.startTime.split(":")[0]),
        end: Number.parseInt(computeEndTimeFromStartAndDuration(o.startTime, o.duration).split(":")[0]),
      }))

      // Deduplicar por (date,start) para evitar bloqueios desnecessários
      const uniqueMap = new Map<string, { date: string; start: number; end: number }>()
      for (const occ of [...recurrenceOccurrences, ...extraOccurrencesResolved]) {
        const k = `${occ.date}|${occ.start}`
        if (!uniqueMap.has(k)) uniqueMap.set(k, occ)
      }
      const targetOccurrences = Array.from(uniqueMap.values())

      // Validar disponibilidade por data e ambiente
      const invalidByAvailability: string[] = []
      for (const envId of envIds) {
        for (const occ of targetOccurrences) {
          const wk = weekdayOf(occ.date)
          const windows = (windowsByEnvByWeekday[envId] || {})[wk] || []
          const fits = windows.some((w) => occ.start >= w.s && occ.end <= w.e)
          if (!fits) invalidByAvailability.push(`${occ.date} (Ambiente ${envId})`)
        }
      }

      if (invalidByAvailability.length) {
        setError(
          `Sem disponibilidade no ambiente para: ${invalidByAvailability
            .slice(0, 5)
            .join(", ")} ${invalidByAvailability.length > 5 ? `+${invalidByAvailability.length - 5} dia(s)` : ""}`,
        )
        setIsSubmitting(false)
        return
      }

      // Pré-checagem de conflitos já existentes por ambiente
      const queryDates = Array.from(new Set(targetOccurrences.map((o) => o.date)))
      const { data: existing } = await supabase
        .from("bookings")
        .select("booking_date,start_time,end_time,environment_id")
        .in("environment_id", envIds)
        .in("booking_date", queryDates)

      const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && aEnd > bStart
      const conflicting: string[] = []
      const byEnvByDate = targetOccurrences.reduce<Record<number, Record<string, { start: number; end: number }>>>((acc, o) => {
        for (const envId of envIds) {
          if (!acc[envId]) acc[envId] = {}
          acc[envId][o.date] = { start: o.start, end: o.end }
        }
        return acc
      }, {})
      for (const row of existing || []) {
        const d = (row as any).booking_date as string
        const env = Number((row as any).environment_id)
        const target = (byEnvByDate[env] || {})[d]
        if (!target) continue
        const bS = timeStringToHour((row as any).start_time)
        const bE = timeStringToHour((row as any).end_time)
        if (overlaps(target.start, target.end, bS, bE)) conflicting.push(`${d} (Ambiente ${env})`)
      }
      if (conflicting.length) {
        setError(
          `Conflito com reservas existentes em: ${conflicting
            .slice(0, 5)
            .join(", ")} ${conflicting.length > 5 ? `+${conflicting.length - 5} dia(s)` : ""}`,
        )
        setIsSubmitting(false)
        return
      }

      // Inserção em lote para todos os ambientes selecionados
      const rows = envIds.flatMap((envId) =>
        targetOccurrences.map((o) => ({
          environment_id: envId,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          ministry_network: formData.ministryNetwork,
          estimated_participants: Number.parseInt(formData.estimatedParticipants),
          responsible_person: formData.responsiblePerson,
          occasion: formData.occasion,
          booking_date: o.date,
          start_time: `${pad2(o.start)}:00`,
          end_time: `${pad2(o.end)}:00`,
        }))
      )

      const { error: insertError } = await supabase.from("bookings").insert(rows)
      if (insertError) {
        if ((insertError as any).code === "23P01") {
          setError("Já existe uma reserva para este horário em uma das datas selecionadas.")
        } else {
          setError(`Erro ao criar reservas: ${insertError.message}`)
        }
      } else {
        setSuccess(true)
        toast.success(
          rows.length > 1 ? `${rows.length} reservas criadas com sucesso` : "Reserva criada com sucesso",
        )
        setTimeout(() => {
          router.push("/reservations")
        }, 1200)
      }
    } catch (err) {
      setError("Erro inesperado ao criar reserva(s)")
    } finally {
      setIsSubmitting(false)
    }
  }

  const canSubmit = useMemo(() => validateForm() === null, [JSON.stringify({ formData, extraOccurrences, availability, environments })])
  const canGoNext = useMemo(() => validateStep1() === null, [JSON.stringify({ formData })])

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
          <CalendarIcon className="h-5 w-5" />
          Formulário de Reserva
        </CardTitle>
        <CardDescription>Preencha todos os campos para fazer sua reserva</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Steps Navigation */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Etapa {step} de 2</div>
            {step === 1 ? (
              <Button type="button" onClick={() => setStep(2)} disabled={!canGoNext}>
                Próximo
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                Voltar
              </Button>
            )}
          </div>

          {step === 1 && (
            <>
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
            </>
          )}

          {step === 2 && (
            <>
              {/* Date and Time */}
              <div className="grid md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date" className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Data
              </Label>
              <DatePicker
                id="date"
                value={formData.bookingDate}
                onChange={(yyyyMMdd) => handleInputChange("bookingDate", yyyyMMdd || "")}
                disablePast
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
              <div className="flex items-center gap-2">
                <Input
                  id="endTime"
                  value={calculateEndTime(formData.startTime, formData.duration)}
                  readOnly
                  placeholder="Automático"
                  className="bg-gray-50"
                />
                {extraOccurrences.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleRemovePrimaryDate}
                    aria-label="Remover primeira data (mover dados da próxima)"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
              </div>

          {/* Datas adicionais (somente exibir campos quando existir ao menos uma) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              {extraOccurrences.length > 0 && (
                <Label className="flex items-center gap-2">Datas adicionais</Label>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setExtraOccurrences((prev) => [...prev, { date: "", startTime: "", duration: "1" }])}
                disabled={isLoadingEnvAvailability}
              >
                <Plus className="h-4 w-4" /> Adicionar data
              </Button>
            </div>

            {extraOccurrences.length > 0 && (
              <div className="space-y-3">
                {extraOccurrences.map((occ, idx) => renderExtraOccurrence(occ, idx))}
              </div>
            )}
          </div>

          {/* Recorrência (aplicada a todas as datas listadas) */}
          <div className="space-y-2">
            <Label className="block">Recorrência (aplicada a todas as datas listadas)</Label>
              <div className={`grid gap-4 ${formData.recurrenceFrequency === "none" ? "md:grid-cols-1" : formData.recurrenceFrequency === "monthly_weekday" ? "md:grid-cols-3" : "md:grid-cols-3"}`}>
              <div className={`space-y-2 ${formData.recurrenceFrequency === "monthly_weekday" ? "md:col-span-3" : ""}`}>
                <Select
                  value={formData.recurrenceFrequency}
                  onValueChange={(v) => handleInputChange("recurrenceFrequency", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Não repetir" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{FREQUENCY_LABEL.none}</SelectItem>
                    <SelectItem value="daily">{FREQUENCY_LABEL.daily}</SelectItem>
                    <SelectItem value="weekly">{FREQUENCY_LABEL.weekly}</SelectItem>
                    <SelectItem value="monthly">{FREQUENCY_LABEL.monthly}</SelectItem>
                      <SelectItem value="monthly_weekday">{FREQUENCY_LABEL.monthly_weekday}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.recurrenceFrequency !== "none" && formData.recurrenceFrequency !== "monthly_weekday" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="recurrenceInterval">Intervalo</Label>
                    <Input
                      id="recurrenceInterval"
                      type="number"
                      min={1}
                      value={formData.recurrenceInterval}
                      onChange={(e) => handleInputChange("recurrenceInterval", e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="1"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="recurrenceEndDate">Repetir até</Label>
                    <DatePicker
                      id="recurrenceEndDate"
                      value={formData.recurrenceEndDate}
                      onChange={(yyyyMMdd) => handleInputChange("recurrenceEndDate", yyyyMMdd || "")}
                      disablePast
                    />
                  </div>
                </>
              )}

              {formData.recurrenceFrequency === "monthly_weekday" && (
                <>
                  <div className="space-y-2 md:col-span-3">
                    <Label>Ocorrências</Label>
                    <div className="grid grid-cols-5 md:grid-cols-5 gap-3 text-sm">
                      {(["1","2","3","4","last"] as const).map((tag) => (
                        <label
                          key={tag}
                          className={`inline-flex items-center justify-center rounded-md border px-3 py-2 cursor-pointer select-none ${formData.recurrenceNth.includes(tag) ? "bg-accent/40 border-primary" : "hover:bg-accent/20"}`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={formData.recurrenceNth.includes(tag)}
                            onChange={(e) => {
                              setFormData((prev) => {
                                const set = new Set(prev.recurrenceNth)
                                if (e.target.checked) set.add(tag)
                                else set.delete(tag)
                                return { ...prev, recurrenceNth: Array.from(set) as Array<typeof tag> }
                              })
                            }}
                          />
                          {tag === "last" ? "Último" : `${tag}º`}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-3">
                    <Label>Dias da semana</Label>
                    <div className="grid grid-cols-7 gap-3 text-sm md:max-w-[560px]">
                      {["DOM","SEG","TER","QUA","QUI","SEX","SAB"].map((lbl, idx) => (
                        <label
                          key={idx}
                          className={`inline-flex items-center justify-center rounded-md border px-3 py-2 cursor-pointer select-none ${formData.recurrenceWeekdays.includes(idx) ? "bg-accent/40 border-primary" : "hover:bg-accent/20"}`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={formData.recurrenceWeekdays.includes(idx)}
                            onChange={(e) => {
                              setFormData((prev) => {
                                const set = new Set(prev.recurrenceWeekdays)
                                if (e.target.checked) set.add(idx)
                                else set.delete(idx)
                                return { ...prev, recurrenceWeekdays: Array.from(set).sort() }
                              })
                            }}
                          />
                          {lbl}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="recurrenceEndDate">Repetir até</Label>
                    <DatePicker
                      id="recurrenceEndDate"
                      value={formData.recurrenceEndDate}
                      onChange={(yyyyMMdd) => handleInputChange("recurrenceEndDate", yyyyMMdd || "")}
                      disablePast
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Environment Selection (múltiplos ambientes) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Ambientes
            </Label>
            <div className="grid md:grid-cols-2 gap-2">
              {environmentsToShow.map((env) => {
                const id = String(env.id)
                const checked = formData.environmentIds.includes(id)
                return (
                  <label key={id} className="flex items-center gap-2 border rounded px-3 py-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="accent-current"
                      checked={checked}
                      onChange={(e) => {
                        setFormData((prev) => {
                          const set = new Set(prev.environmentIds)
                          if (e.target.checked) set.add(id)
                          else set.delete(id)
                          return { ...prev, environmentIds: Array.from(set) }
                        })
                      }}
                    />
                    <span className="flex-1">{env.name}</span>
                    <span className="text-xs text-muted-foreground">Cap.: {env.capacity}</span>
                  </label>
                )
              })}
            </div>
          </div>
            </>
          )}

          {/* Aviso de disponibilidade por dia */}
          {formData.bookingDate && !isLoadingAvailability && availability.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded text-sm">
              Não há disponibilidade configurada para {WEEKDAY_LABELS_PT_BR[getWeekdayFromDate(formData.bookingDate) || 0]}.
            </div>
          )}

          <TooltipProvider>
            <Tooltip open={(!canSubmit && !isSubmitting) ? undefined : false}>
              <TooltipTrigger asChild>
                <div>
                  {step === 2 ? (
                    <Button type="submit" disabled={isSubmitting || !canSubmit} className="w-full">
                      {isSubmitting ? "Criando Reserva..." : "Criar Reserva"}
                    </Button>
                  ) : (
                    <Button type="button" onClick={() => setStep(2)} disabled={!canGoNext} className="w-full">
                      Próximo
                    </Button>
                  )}
                </div>
              </TooltipTrigger>
              {step === 2 && !canSubmit && !isSubmitting && (
                <TooltipContent>
                  Preencha todos os campos obrigatórios para habilitar o envio
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </form>
      </CardContent>
    </Card>
  )
}
