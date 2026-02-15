// Tipos TypeScript para o módulo de Escalas de Ministérios

export interface Ministry {
  id: string
  name: string
  description: string | null
  color: string
  is_active: boolean
  leader_id?: string | null
  co_leader_id?: string | null
  created_at: string
  updated_at: string
  // Relacionamentos
  areas?: Area[]
  leader?: { id: string; name: string } | null
  co_leader?: { id: string; name: string } | null
}

export interface Area {
  id: string
  ministry_id: string
  name: string
  description: string | null
  is_active: boolean
  order_index: number
  min_servants: number
  max_servants: number | null
  created_at: string
  updated_at: string
  // Relacionamentos
  ministry?: Ministry
  servants?: Servant[]
}

export interface Servant {
  id: string
  area_id: string
  user_id: string | null
  name: string
  email: string | null
  phone: string | null
  is_active: boolean
  is_leader: boolean
  notes: string | null
  created_at: string
  updated_at: string
  // Relacionamentos
  area?: Area
}

export interface RegularEvent {
  id: string
  ministry_id: string | null // Nullable para compatibilidade com relacionamento many-to-many
  title: string
  day_of_week: number // 0-6 (Domingo-Sábado)
  time: string // HH:mm:ss
  week_of_month: number | null // 1 = semana após 1º domingo; 2-5 = seguintes; null = todas
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
  // Relacionamentos
  ministry?: Ministry // Para compatibilidade com dados legados
  ministries?: Array<{
    ministry_id: string
    ministry: Ministry
  }> // Relacionamento many-to-many
}

export type SchedulePeriodStatus = 
  | 'draft' 
  | 'collecting' 
  | 'scheduling' 
  | 'published' 
  | 'closed'

export interface SchedulePeriod {
  id: string
  ministry_id: string
  month: number
  year: number
  status: SchedulePeriodStatus
  start_date: string
  end_date: string
  availability_deadline: string | null
  availability_token: string
  notes: string | null
  created_at: string
  updated_at: string
  published_at: string | null
  // Relacionamentos
  ministry?: Ministry
  events?: ScheduleEvent[]
}

export type EventType = 'regular' | 'special' | 'imported'
export type EventSource = 'manual' | 'regular_calendar' | 'booking_system'

export interface ScheduleEvent {
  id: string
  period_id: string
  event_date: string
  event_time: string
  event_type: EventType
  title: string
  description: string | null
  source: EventSource
  external_id: string | null
  requires_areas: string[] | null
  created_at: string
  updated_at: string
  // Relacionamentos
  period?: SchedulePeriod
  assignments?: ScheduleAssignment[]
}

export interface ServantAvailability {
  id: string
  servant_id: string
  period_id: string
  event_id: string | null
  is_available: boolean
  notes: string | null
  submitted_at: string
  created_at: string
  updated_at: string
  // Relacionamentos
  servant?: Servant
  event?: ScheduleEvent
}

export interface ScheduleAssignment {
  id: string
  schedule_event_id: string
  servant_id: string
  area_id: string
  confirmed: boolean
  confirmed_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Relacionamentos
  servant?: Servant
  area?: Area
  event?: ScheduleEvent
}

// Tipos auxiliares para formulários
export interface MinistryFormData {
  name: string
  description?: string
  color: string
}

export interface AreaFormData {
  ministry_id: string
  name: string
  description?: string
  min_servants: number
  max_servants?: number | null
  order_index?: number
}

export interface ServantFormData {
  area_id: string
  name: string
  email?: string
  phone?: string
  notes?: string
}

export interface RegularEventFormData {
  ministry_id: string
  title: string
  day_of_week: number
  time: string
  week_of_month?: number | null
  notes?: string
}

export interface SchedulePeriodFormData {
  ministry_id: string
  month: number
  year: number
  availability_deadline?: string
  notes?: string
}

export interface AvailabilitySubmission {
  servant_id: string
  period_id: string
  availabilities: {
    event_id: string
    is_available: boolean
    notes?: string
  }[]
}

// Constantes
export const DAY_OF_WEEK_LABELS: Record<number, string> = {
  0: 'Domingo',
  1: 'Segunda-feira',
  2: 'Terça-feira',
  3: 'Quarta-feira',
  4: 'Quinta-feira',
  5: 'Sexta-feira',
  6: 'Sábado',
}

export const DAY_OF_WEEK_SHORT: Record<number, string> = {
  0: 'Dom',
  1: 'Seg',
  2: 'Ter',
  3: 'Qua',
  4: 'Qui',
  5: 'Sex',
  6: 'Sáb',
}

/** Nª ocorrência do dia da semana no mês (ex.: 1 = 1º sábado, 2 = 2º sábado) */
export const WEEK_OF_MONTH_LABELS: Record<number, string> = {
  1: '1ª ocorrência no mês',
  2: '2ª ocorrência no mês',
  3: '3ª ocorrência no mês',
  4: '4ª ocorrência no mês',
  5: '5ª ocorrência no mês',
}

export const PERIOD_STATUS_LABELS: Record<SchedulePeriodStatus, string> = {
  draft: 'Rascunho',
  collecting: 'Coletando Disponibilidade',
  scheduling: 'Montando Escala',
  published: 'Publicada',
  closed: 'Encerrada',
}

export const PERIOD_STATUS_COLORS: Record<SchedulePeriodStatus, string> = {
  draft: 'bg-gray-500',
  collecting: 'bg-blue-500',
  scheduling: 'bg-yellow-500',
  published: 'bg-green-500',
  closed: 'bg-gray-400',
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  regular: 'Regular',
  special: 'Especial',
  imported: 'Importado',
}

export const EVENT_SOURCE_LABELS: Record<EventSource, string> = {
  manual: 'Manual',
  regular_calendar: 'Calendário Regular',
  booking_system: 'Sistema de Agendamentos',
}

// Cores predefinidas para ministérios
export const MINISTRY_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
]
