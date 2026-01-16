"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Calendar as CalendarIcon,
  Clock,
  Users,
  Phone,
  Mail,
  Building,
  User,
  DollarSign,
  Plus,
  Edit,
  Trash2,
  FileText,
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  X,
  Check,
  AlertTriangle,
  Loader2,
  CreditCard,
  Banknote,
  ArrowUpCircle,
  ArrowDownCircle,
} from "lucide-react"
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

// Tipos
interface Environment {
  id: number
  name: string
  capacity: number
}

interface ExternalRental {
  id: string
  environment_id: number
  rental_date: string
  start_time: string
  end_time: string
  renter_name: string
  renter_email: string | null
  renter_phone: string
  renter_document: string | null
  renter_address: string | null
  event_description: string
  expected_participants: number
  total_value: number
  discount: number
  final_value: number
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  notes: string | null
  contract_signed: boolean
  created_at: string
  updated_at: string
  environments?: Environment
}

interface RentalPayment {
  id: string
  rental_id: string
  amount: number
  payment_date: string
  payment_method: 'pix' | 'cash' | 'credit_card' | 'debit_card' | 'bank_transfer' | 'check' | 'other'
  reference: string | null
  notes: string | null
  created_at: string
}

interface RentalCost {
  id: string
  rental_id: string | null
  description: string
  amount: number
  cost_date: string
  category: 'cleaning' | 'maintenance' | 'utilities' | 'supplies' | 'staff' | 'marketing' | 'taxes' | 'insurance' | 'other'
  notes: string | null
  receipt_reference: string | null
  created_at: string
}

// Configurações de status
const STATUS_CONFIG = {
  pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock },
  confirmed: { label: 'Confirmado', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: Check },
  completed: { label: 'Realizado', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: Check },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: X },
}

const PAYMENT_METHODS = {
  pix: { label: 'PIX', icon: Banknote },
  cash: { label: 'Dinheiro', icon: Banknote },
  credit_card: { label: 'Cartão de Crédito', icon: CreditCard },
  debit_card: { label: 'Cartão de Débito', icon: CreditCard },
  bank_transfer: { label: 'Transferência', icon: Building },
  check: { label: 'Cheque', icon: FileText },
  other: { label: 'Outro', icon: Wallet },
}

const COST_CATEGORIES = {
  cleaning: { label: 'Limpeza', color: 'bg-blue-100 text-blue-800' },
  maintenance: { label: 'Manutenção', color: 'bg-orange-100 text-orange-800' },
  utilities: { label: 'Utilidades', color: 'bg-yellow-100 text-yellow-800' },
  supplies: { label: 'Suprimentos', color: 'bg-green-100 text-green-800' },
  staff: { label: 'Pessoal', color: 'bg-purple-100 text-purple-800' },
  marketing: { label: 'Marketing', color: 'bg-pink-100 text-pink-800' },
  taxes: { label: 'Impostos', color: 'bg-red-100 text-red-800' },
  insurance: { label: 'Seguro', color: 'bg-indigo-100 text-indigo-800' },
  other: { label: 'Outros', color: 'bg-gray-100 text-gray-800' },
}

interface ExternalRentalsManagerProps {
  userId: string
}

// Funções de máscara
const maskPhone = (value: string): string => {
  const numbers = value.replace(/\D/g, '')
  if (numbers.length <= 10) {
    // Formato: (99) 9999-9999
    return numbers
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .slice(0, 14)
  } else {
    // Formato: (99) 99999-9999
    return numbers
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .slice(0, 15)
  }
}

const maskCpfCnpj = (value: string): string => {
  const numbers = value.replace(/\D/g, '')
  if (numbers.length <= 11) {
    // CPF: 999.999.999-99
    return numbers
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
      .slice(0, 14)
  } else {
    // CNPJ: 99.999.999/9999-99
    return numbers
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
      .slice(0, 18)
  }
}

const maskCurrency = (value: string): string => {
  const numbers = value.replace(/\D/g, '')
  const amount = parseInt(numbers || '0', 10) / 100
  return amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const unmaskCurrency = (value: string): string => {
  const numbers = value.replace(/\D/g, '')
  return (parseInt(numbers || '0', 10) / 100).toFixed(2)
}

export function ExternalRentalsManager({ userId }: ExternalRentalsManagerProps) {
  // Estados principais
  const [rentals, setRentals] = useState<ExternalRental[]>([])
  const [payments, setPayments] = useState<RentalPayment[]>([])
  const [costs, setCosts] = useState<RentalCost[]>([])
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('rentals')
  
  // Estados de modal
  const [showRentalForm, setShowRentalForm] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [showCostForm, setShowCostForm] = useState(false)
  const [editingRental, setEditingRental] = useState<ExternalRental | null>(null)
  const [selectedRentalId, setSelectedRentalId] = useState<string | null>(null)
  
  // Estado de submissão
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Estado para indicar se as tabelas existem
  const [tablesExist, setTablesExist] = useState(true)
  
  // Estado para confirmação de exclusão
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    type: 'rental' | 'payment' | 'cost'
    id: string
  }>({ open: false, type: 'rental', id: '' })

  // Estados do formulário de locação
  const [rentalForm, setRentalForm] = useState({
    environment_id: '',
    rental_date: '',
    start_time: '',
    end_time: '',
    renter_name: '',
    renter_email: '',
    renter_phone: '',
    renter_document: '',
    renter_address: '',
    event_description: '',
    expected_participants: '',
    total_value: '',
    discount: '0',
    status: 'pending' as const,
    notes: '',
    contract_signed: false,
  })

  // Estados do formulário de pagamento
  const [paymentForm, setPaymentForm] = useState({
    rental_id: '',
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'pix' as const,
    reference: '',
    notes: '',
  })

  // Estados do formulário de custo
  const [costForm, setCostForm] = useState({
    rental_id: '',
    description: '',
    amount: '',
    cost_date: new Date().toISOString().split('T')[0],
    category: 'other' as const,
    notes: '',
    receipt_reference: '',
  })

  // Carregar dados
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Buscar ambientes
      const { data: envData } = await supabase
        .from('environments')
        .select('*')
        .order('name')
      
      if (envData) setEnvironments(envData)

      // Buscar locações
      const { data: rentalsData, error: rentalsError } = await supabase
        .from('external_rentals')
        .select('*, environments(id, name, capacity)')
        .order('rental_date', { ascending: false })
      
      if (rentalsError) {
        console.error('Erro ao buscar locações:', rentalsError)
        // Se a tabela não existir, marcar que as tabelas não existem
        if (rentalsError.code === '42P01' || rentalsError.message?.includes('does not exist')) {
          setTablesExist(false)
        }
      } else if (rentalsData) {
        setTablesExist(true)
        setRentals(rentalsData)
      }

      // Buscar pagamentos (somente se as tabelas existem)
      if (tablesExist) {
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('rental_payments')
          .select('*')
          .order('payment_date', { ascending: false })
        
        if (!paymentsError && paymentsData) {
          setPayments(paymentsData)
        }

        // Buscar custos
        const { data: costsData, error: costsError } = await supabase
          .from('rental_costs')
          .select('*')
          .order('cost_date', { ascending: false })
        
        if (!costsError && costsData) {
          setCosts(costsData)
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  // Funções de cálculo
  const calculateTotalRevenue = () => {
    return payments.reduce((sum, p) => sum + Number(p.amount), 0)
  }

  const calculateTotalCosts = () => {
    return costs.reduce((sum, c) => sum + Number(c.amount), 0)
  }

  const calculateNetBalance = () => {
    return calculateTotalRevenue() - calculateTotalCosts()
  }

  const getRentalPayments = (rentalId: string) => {
    return payments.filter(p => p.rental_id === rentalId)
  }

  const getRentalTotalPaid = (rentalId: string) => {
    return getRentalPayments(rentalId).reduce((sum, p) => sum + Number(p.amount), 0)
  }

  const getRentalPendingBalance = (rental: ExternalRental) => {
    return Number(rental.final_value) - getRentalTotalPaid(rental.id)
  }

  // Formatadores
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00')
    return date.toLocaleDateString('pt-BR')
  }

  const formatTime = (timeString: string) => timeString.slice(0, 5)

  // Função auxiliar para converter horário em número
  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number)
    return hours * 60 + (minutes || 0)
  }

  // Função para verificar sobreposição de horários
  const hasTimeOverlap = (
    start1: number, end1: number,
    start2: number, end2: number
  ): boolean => {
    return start1 < end2 && end1 > start2
  }

  // Handlers do formulário de locação
  const handleRentalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validações básicas
    if (!rentalForm.environment_id) {
      toast.error('Selecione um ambiente')
      return
    }
    if (!rentalForm.rental_date) {
      toast.error('Informe a data da locação')
      return
    }
    if (!rentalForm.start_time || !rentalForm.end_time) {
      toast.error('Informe os horários de início e fim')
      return
    }
    if (!rentalForm.renter_name) {
      toast.error('Informe o nome do locador')
      return
    }
    if (!rentalForm.renter_phone) {
      toast.error('Informe o telefone do locador')
      return
    }
    if (!rentalForm.event_description) {
      toast.error('Informe a descrição do evento')
      return
    }
    if (!rentalForm.total_value || parseFloat(rentalForm.total_value) <= 0) {
      toast.error('Informe o valor da locação')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      const envId = parseInt(rentalForm.environment_id)
      const rentalDate = rentalForm.rental_date
      const startMinutes = timeToMinutes(rentalForm.start_time)
      const endMinutes = timeToMinutes(rentalForm.end_time)

      // Verificar conflito com agendamentos internos (bookings)
      const { data: existingBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, booking_date, start_time, end_time, name, status')
        .eq('environment_id', envId)
        .eq('booking_date', rentalDate)
        .neq('status', 'rejected')

      if (bookingsError) {
        console.error('Erro ao verificar agendamentos:', bookingsError)
        // Continuar mesmo com erro (tabela pode não existir)
      }

      // Verificar sobreposição com agendamentos internos
      const conflictingBookings = (existingBookings || []).filter(booking => {
        const bookingStart = timeToMinutes(booking.start_time)
        const bookingEnd = timeToMinutes(booking.end_time)
        return hasTimeOverlap(startMinutes, endMinutes, bookingStart, bookingEnd)
      })

      if (conflictingBookings.length > 0) {
        const conflictNames = conflictingBookings.map(b => b.name).join(', ')
        toast.error(`Conflito com agendamento(s) interno(s): ${conflictNames}. Este horário já está reservado.`)
        setIsSubmitting(false)
        return
      }

      // Verificar conflito com outras locações externas (exceto a que está sendo editada)
      let externalQuery = supabase
        .from('external_rentals')
        .select('id, rental_date, start_time, end_time, renter_name, status')
        .eq('environment_id', envId)
        .eq('rental_date', rentalDate)
        .neq('status', 'cancelled')

      if (editingRental) {
        externalQuery = externalQuery.neq('id', editingRental.id)
      }

      const { data: existingRentals, error: rentalsError } = await externalQuery

      if (rentalsError && rentalsError.code !== '42P01') {
        // 42P01 = tabela não existe (primeira vez usando)
        console.error('Erro ao verificar locações:', rentalsError)
      }

      // Verificar sobreposição com outras locações externas
      const conflictingRentals = (existingRentals || []).filter(rental => {
        const rentalStart = timeToMinutes(rental.start_time)
        const rentalEnd = timeToMinutes(rental.end_time)
        return hasTimeOverlap(startMinutes, endMinutes, rentalStart, rentalEnd)
      })

      if (conflictingRentals.length > 0) {
        const conflictNames = conflictingRentals.map(r => r.renter_name).join(', ')
        toast.error(`Conflito com outra(s) locação(ões) externa(s): ${conflictNames}. Este horário já está reservado.`)
        setIsSubmitting(false)
        return
      }

      // Sem conflitos, prosseguir com o salvamento
      const data = {
        environment_id: envId,
        rental_date: rentalDate,
        start_time: rentalForm.start_time,
        end_time: rentalForm.end_time,
        renter_name: rentalForm.renter_name.trim(),
        renter_email: rentalForm.renter_email?.trim() || null,
        renter_phone: rentalForm.renter_phone.trim(),
        renter_document: rentalForm.renter_document?.trim() || null,
        renter_address: rentalForm.renter_address?.trim() || null,
        event_description: rentalForm.event_description.trim(),
        expected_participants: parseInt(rentalForm.expected_participants) || 0,
        total_value: parseFloat(rentalForm.total_value),
        discount: parseFloat(rentalForm.discount) || 0,
        status: rentalForm.status,
        notes: rentalForm.notes?.trim() || null,
        contract_signed: rentalForm.contract_signed,
        created_by: userId,
      }

      if (editingRental) {
        const { error } = await supabase
          .from('external_rentals')
          .update(data)
          .eq('id', editingRental.id)
        
        if (error) throw error
        toast.success('Locação atualizada com sucesso!')
      } else {
        const { error } = await supabase
          .from('external_rentals')
          .insert([data])
        
        if (error) throw error
        toast.success('Locação cadastrada com sucesso!')
      }

      setShowRentalForm(false)
      setEditingRental(null)
      resetRentalForm()
      fetchData()
    } catch (error: any) {
      console.error('Erro ao salvar locação:', error)
      toast.error(error.message || 'Erro ao salvar locação')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetRentalForm = () => {
    setRentalForm({
      environment_id: '',
      rental_date: '',
      start_time: '',
      end_time: '',
      renter_name: '',
      renter_email: '',
      renter_phone: '',
      renter_document: '',
      renter_address: '',
      event_description: '',
      expected_participants: '',
      total_value: '',
      discount: '0',
      status: 'pending',
      notes: '',
      contract_signed: false,
    })
  }

  const openEditRental = (rental: ExternalRental) => {
    setEditingRental(rental)
    setRentalForm({
      environment_id: String(rental.environment_id),
      rental_date: rental.rental_date,
      start_time: rental.start_time,
      end_time: rental.end_time,
      renter_name: rental.renter_name,
      renter_email: rental.renter_email || '',
      renter_phone: rental.renter_phone,
      renter_document: rental.renter_document || '',
      renter_address: rental.renter_address || '',
      event_description: rental.event_description,
      expected_participants: String(rental.expected_participants),
      total_value: String(rental.total_value),
      discount: String(rental.discount),
      status: rental.status,
      notes: rental.notes || '',
      contract_signed: rental.contract_signed,
    })
    setShowRentalForm(true)
  }

  // Handlers do formulário de pagamento
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validações
    if (!paymentForm.rental_id) {
      toast.error('Selecione uma locação')
      return
    }
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toast.error('Informe um valor válido')
      return
    }
    if (!paymentForm.payment_date) {
      toast.error('Informe a data do pagamento')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      const { error } = await supabase
        .from('rental_payments')
        .insert([{
          rental_id: paymentForm.rental_id,
          amount: parseFloat(paymentForm.amount),
          payment_date: paymentForm.payment_date,
          payment_method: paymentForm.payment_method,
          reference: paymentForm.reference?.trim() || null,
          notes: paymentForm.notes?.trim() || null,
          created_by: userId,
        }])
      
      if (error) throw error
      
      toast.success('Pagamento registrado com sucesso!')
      setShowPaymentForm(false)
      setPaymentForm({
        rental_id: '',
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'pix',
        reference: '',
        notes: '',
      })
      fetchData()
    } catch (error: any) {
      console.error('Erro ao registrar pagamento:', error)
      toast.error(error.message || 'Erro ao registrar pagamento')
    } finally {
      setIsSubmitting(false)
    }
  }

  const openPaymentForm = (rentalId: string) => {
    setPaymentForm(prev => ({ ...prev, rental_id: rentalId }))
    setShowPaymentForm(true)
  }

  // Handlers do formulário de custo
  const handleCostSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validações
    if (!costForm.description) {
      toast.error('Informe a descrição do custo')
      return
    }
    if (!costForm.amount || parseFloat(costForm.amount) <= 0) {
      toast.error('Informe um valor válido')
      return
    }
    if (!costForm.cost_date) {
      toast.error('Informe a data do custo')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      const { error } = await supabase
        .from('rental_costs')
        .insert([{
          rental_id: costForm.rental_id || null,
          description: costForm.description.trim(),
          amount: parseFloat(costForm.amount),
          cost_date: costForm.cost_date,
          category: costForm.category,
          notes: costForm.notes?.trim() || null,
          receipt_reference: costForm.receipt_reference?.trim() || null,
          created_by: userId,
        }])
      
      if (error) throw error
      
      toast.success('Custo registrado com sucesso!')
      setShowCostForm(false)
      setCostForm({
        rental_id: '',
        description: '',
        amount: '',
        cost_date: new Date().toISOString().split('T')[0],
        category: 'other',
        notes: '',
        receipt_reference: '',
      })
      fetchData()
    } catch (error: any) {
      console.error('Erro ao registrar custo:', error)
      toast.error(error.message || 'Erro ao registrar custo')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handler de exclusão
  const handleDelete = async () => {
    try {
      const { type, id } = deleteDialog
      let table = ''
      
      switch (type) {
        case 'rental':
          table = 'external_rentals'
          break
        case 'payment':
          table = 'rental_payments'
          break
        case 'cost':
          table = 'rental_costs'
          break
      }

      const { error } = await supabase.from(table).delete().eq('id', id)
      
      if (error) throw error
      
      toast.success('Item excluído com sucesso!')
      setDeleteDialog({ open: false, type: 'rental', id: '' })
      fetchData()
    } catch (error: any) {
      console.error('Erro ao excluir:', error)
      toast.error(error.message || 'Erro ao excluir')
    }
  }

  // Atualizar status da locação
  const updateRentalStatus = async (rentalId: string, newStatus: ExternalRental['status']) => {
    try {
      const { error } = await supabase
        .from('external_rentals')
        .update({ status: newStatus })
        .eq('id', rentalId)
      
      if (error) throw error
      
      toast.success('Status atualizado!')
      fetchData()
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error)
      toast.error(error.message || 'Erro ao atualizar status')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Carregando dados...</span>
      </div>
    )
  }

  // Mostrar aviso se as tabelas não existem
  if (!tablesExist) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Configuração Necessária</h3>
          <p className="text-muted-foreground mb-4 max-w-lg mx-auto">
            As tabelas de locações externas ainda não foram criadas no banco de dados. 
            Execute o script de migração SQL para habilitar esta funcionalidade.
          </p>
          <div className="bg-muted p-4 rounded-lg text-left max-w-lg mx-auto">
            <p className="text-sm font-medium mb-2">Passos para configurar:</p>
            <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
              <li>Acesse o Supabase Dashboard</li>
              <li>Vá em SQL Editor</li>
              <li>Execute o script: <code className="bg-background px-1 rounded">scripts/009-external-rentals.sql</code></li>
              <li>Recarregue esta página</li>
            </ol>
          </div>
          <Button 
            className="mt-6"
            onClick={() => window.location.reload()}
          >
            Recarregar Página
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cards de Resumo Financeiro */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-800 dark:text-green-300 flex items-center gap-2">
              <ArrowUpCircle className="h-4 w-4" />
              Total Recebido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">
              {formatCurrency(calculateTotalRevenue())}
            </p>
            <p className="text-xs text-green-600 dark:text-green-500 mt-1">
              {payments.length} pagamento(s)
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border-red-200 dark:border-red-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-800 dark:text-red-300 flex items-center gap-2">
              <ArrowDownCircle className="h-4 w-4" />
              Total de Custos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-700 dark:text-red-400">
              {formatCurrency(calculateTotalCosts())}
            </p>
            <p className="text-xs text-red-600 dark:text-red-500 mt-1">
              {costs.length} despesa(s)
            </p>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${calculateNetBalance() >= 0 
          ? 'from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800' 
          : 'from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border-orange-200 dark:border-orange-800'
        }`}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-sm font-medium flex items-center gap-2 ${calculateNetBalance() >= 0 
              ? 'text-blue-800 dark:text-blue-300' 
              : 'text-orange-800 dark:text-orange-300'
            }`}>
              <Wallet className="h-4 w-4" />
              Saldo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${calculateNetBalance() >= 0 
              ? 'text-blue-700 dark:text-blue-400' 
              : 'text-orange-700 dark:text-orange-400'
            }`}>
              {formatCurrency(calculateNetBalance())}
            </p>
            <p className={`text-xs mt-1 ${calculateNetBalance() >= 0 
              ? 'text-blue-600 dark:text-blue-500' 
              : 'text-orange-600 dark:text-orange-500'
            }`}>
              Receitas - Despesas
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 border-purple-200 dark:border-purple-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-800 dark:text-purple-300 flex items-center gap-2">
              <Building className="h-4 w-4" />
              Total de Locações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">
              {rentals.length}
            </p>
            <p className="text-xs text-purple-600 dark:text-purple-500 mt-1">
              {rentals.filter(r => r.status === 'confirmed').length} confirmada(s)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Abas de Gerenciamento */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="rentals" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Locações
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-2">
            <ArrowUpCircle className="h-4 w-4" />
            Pagamentos
          </TabsTrigger>
          <TabsTrigger value="costs" className="flex items-center gap-2">
            <ArrowDownCircle className="h-4 w-4" />
            Custos
          </TabsTrigger>
        </TabsList>

        {/* Aba de Locações */}
        <TabsContent value="rentals" className="mt-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Locações Externas</h3>
            <Button onClick={() => { resetRentalForm(); setEditingRental(null); setShowRentalForm(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Locação
            </Button>
          </div>

          {rentals.length === 0 ? (
            <Card className="p-8 text-center">
              <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h4 className="text-lg font-semibold mb-2">Nenhuma locação cadastrada</h4>
              <p className="text-muted-foreground mb-4">
                Comece cadastrando uma nova locação externa.
              </p>
              <Button onClick={() => setShowRentalForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Locação
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {rentals.map((rental) => {
                const StatusIcon = STATUS_CONFIG[rental.status].icon
                const pendingBalance = getRentalPendingBalance(rental)
                const totalPaid = getRentalTotalPaid(rental.id)
                
                return (
                  <Card key={rental.id} className="overflow-hidden">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {rental.renter_name}
                            <Badge className={STATUS_CONFIG[rental.status].color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {STATUS_CONFIG[rental.status].label}
                            </Badge>
                          </CardTitle>
                          <CardDescription className="flex items-center gap-4 mt-1">
                            <span className="flex items-center gap-1">
                              <CalendarIcon className="h-3.5 w-3.5" />
                              {formatDate(rental.rental_date)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {formatTime(rental.start_time)} - {formatTime(rental.end_time)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Building className="h-3.5 w-3.5" />
                              {rental.environments?.name || 'N/A'}
                            </span>
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditRental(rental)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => setDeleteDialog({ open: true, type: 'rental', id: rental.id })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 gap-4">
                        {/* Informações do Locador */}
                        <div className="space-y-2 text-sm">
                          <p className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            {rental.renter_phone}
                          </p>
                          {rental.renter_email && (
                            <p className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              {rental.renter_email}
                            </p>
                          )}
                          {rental.renter_document && (
                            <p className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              {rental.renter_document}
                            </p>
                          )}
                          <p className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            {rental.expected_participants} participantes
                          </p>
                        </div>

                        {/* Informações Financeiras */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Valor Total:</span>
                            <span className="font-medium">{formatCurrency(rental.total_value)}</span>
                          </div>
                          {rental.discount > 0 && (
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground">Desconto:</span>
                              <span className="text-red-600">-{formatCurrency(rental.discount)}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center text-sm font-semibold border-t pt-2">
                            <span>Valor Final:</span>
                            <span className="text-primary">{formatCurrency(rental.final_value)}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Pago:</span>
                            <span className="text-green-600">{formatCurrency(totalPaid)}</span>
                          </div>
                          {pendingBalance > 0 && (
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground">Pendente:</span>
                              <span className="text-orange-600 font-medium">{formatCurrency(pendingBalance)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Descrição do Evento */}
                      {rental.event_description && (
                        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                          <p className="text-sm font-medium mb-1">Descrição do Evento:</p>
                          <p className="text-sm text-muted-foreground">{rental.event_description}</p>
                        </div>
                      )}

                      {/* Ações */}
                      <div className="flex gap-2 mt-4 pt-4 border-t">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openPaymentForm(rental.id)}
                        >
                          <DollarSign className="h-4 w-4 mr-1" />
                          Registrar Pagamento
                        </Button>
                        
                        {rental.status === 'pending' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-blue-600"
                            onClick={() => updateRentalStatus(rental.id, 'confirmed')}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Confirmar
                          </Button>
                        )}
                        
                        {rental.status === 'confirmed' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-green-600"
                            onClick={() => updateRentalStatus(rental.id, 'completed')}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Marcar Realizado
                          </Button>
                        )}
                        
                        {rental.status !== 'cancelled' && rental.status !== 'completed' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-red-600"
                            onClick={() => updateRentalStatus(rental.id, 'cancelled')}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* Aba de Pagamentos */}
        <TabsContent value="payments" className="mt-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Pagamentos Recebidos</h3>
            <Button onClick={() => setShowPaymentForm(true)} disabled={rentals.length === 0}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Pagamento
            </Button>
          </div>

          {payments.length === 0 ? (
            <Card className="p-8 text-center">
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h4 className="text-lg font-semibold mb-2">Nenhum pagamento registrado</h4>
              <p className="text-muted-foreground">
                Registre pagamentos recebidos das locações.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => {
                const rental = rentals.find(r => r.id === payment.rental_id)
                const PaymentIcon = PAYMENT_METHODS[payment.payment_method]?.icon || Wallet
                
                return (
                  <Card key={payment.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                          <PaymentIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="font-medium">{rental?.renter_name || 'Locação não encontrada'}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(payment.payment_date)} • {PAYMENT_METHODS[payment.payment_method]?.label}
                            {payment.reference && ` • Ref: ${payment.reference}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-bold text-green-600">
                          +{formatCurrency(payment.amount)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          onClick={() => setDeleteDialog({ open: true, type: 'payment', id: payment.id })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* Aba de Custos */}
        <TabsContent value="costs" className="mt-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Custos e Despesas</h3>
            <Button onClick={() => setShowCostForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Custo
            </Button>
          </div>

          {costs.length === 0 ? (
            <Card className="p-8 text-center">
              <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h4 className="text-lg font-semibold mb-2">Nenhum custo registrado</h4>
              <p className="text-muted-foreground">
                Registre custos e despesas relacionados às locações.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {costs.map((cost) => {
                const rental = cost.rental_id ? rentals.find(r => r.id === cost.rental_id) : null
                const categoryConfig = COST_CATEGORIES[cost.category]
                
                return (
                  <Card key={cost.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                          <ArrowDownCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{cost.description}</p>
                            <Badge variant="outline" className={categoryConfig?.color}>
                              {categoryConfig?.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(cost.cost_date)}
                            {rental && ` • Vinculado a: ${rental.renter_name}`}
                            {cost.receipt_reference && ` • Ref: ${cost.receipt_reference}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-bold text-red-600">
                          -{formatCurrency(cost.amount)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          onClick={() => setDeleteDialog({ open: true, type: 'cost', id: cost.id })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal de Formulário de Locação */}
      {showRentalForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-background">
              <h2 className="text-xl font-bold">
                {editingRental ? 'Editar Locação' : 'Nova Locação Externa'}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => { setShowRentalForm(false); setEditingRental(null); }}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            <form onSubmit={handleRentalSubmit} className="p-6 space-y-6">
              {/* Ambiente e Data */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="environment">Ambiente *</Label>
                  <Select
                    value={rentalForm.environment_id}
                    onValueChange={(value) => setRentalForm({ ...rentalForm, environment_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o ambiente" />
                    </SelectTrigger>
                    <SelectContent>
                      {environments.map((env) => (
                        <SelectItem key={env.id} value={String(env.id)}>
                          {env.name} (Cap. {env.capacity})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rental_date">Data *</Label>
                  <Input
                    id="rental_date"
                    type="date"
                    value={rentalForm.rental_date}
                    onChange={(e) => setRentalForm({ ...rentalForm, rental_date: e.target.value })}
                  />
                </div>
              </div>

              {/* Horários */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_time">Horário Início *</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={rentalForm.start_time}
                    onChange={(e) => setRentalForm({ ...rentalForm, start_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_time">Horário Fim *</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={rentalForm.end_time}
                    onChange={(e) => setRentalForm({ ...rentalForm, end_time: e.target.value })}
                  />
                </div>
              </div>

              {/* Dados do Locador */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Dados do Locador
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="renter_name">Nome Completo *</Label>
                    <Input
                      id="renter_name"
                      value={rentalForm.renter_name}
                      onChange={(e) => setRentalForm({ ...rentalForm, renter_name: e.target.value })}
                      placeholder="Nome do locador"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="renter_phone">Telefone *</Label>
                    <Input
                      id="renter_phone"
                      value={rentalForm.renter_phone}
                      onChange={(e) => setRentalForm({ ...rentalForm, renter_phone: maskPhone(e.target.value) })}
                      placeholder="(99) 99999-9999"
                      maxLength={15}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="renter_email">Email</Label>
                    <Input
                      id="renter_email"
                      type="email"
                      value={rentalForm.renter_email}
                      onChange={(e) => setRentalForm({ ...rentalForm, renter_email: e.target.value })}
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="renter_document">CPF/CNPJ</Label>
                    <Input
                      id="renter_document"
                      value={rentalForm.renter_document}
                      onChange={(e) => setRentalForm({ ...rentalForm, renter_document: maskCpfCnpj(e.target.value) })}
                      placeholder="999.999.999-99 ou 99.999.999/9999-99"
                      maxLength={18}
                    />
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <Label htmlFor="renter_address">Endereço</Label>
                  <Input
                    id="renter_address"
                    value={rentalForm.renter_address}
                    onChange={(e) => setRentalForm({ ...rentalForm, renter_address: e.target.value })}
                  />
                </div>
              </div>

              {/* Dados do Evento */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Dados do Evento
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="event_description">Descrição do Evento *</Label>
                    <Textarea
                      id="event_description"
                      value={rentalForm.event_description}
                      onChange={(e) => setRentalForm({ ...rentalForm, event_description: e.target.value })}
                      rows={3}
                      placeholder="Descreva o tipo de evento que será realizado"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expected_participants">Participantes Esperados</Label>
                    <Input
                      id="expected_participants"
                      type="number"
                      value={rentalForm.expected_participants}
                      onChange={(e) => setRentalForm({ ...rentalForm, expected_participants: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Valores */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Valores
                </h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="total_value">Valor Total (R$) *</Label>
                    <Input
                      id="total_value"
                      type="number"
                      step="0.01"
                      min="0"
                      value={rentalForm.total_value}
                      onChange={(e) => setRentalForm({ ...rentalForm, total_value: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discount">Desconto (R$)</Label>
                    <Input
                      id="discount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={rentalForm.discount}
                      onChange={(e) => setRentalForm({ ...rentalForm, discount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor Final</Label>
                    <div className="h-10 px-3 py-2 bg-muted rounded-md flex items-center font-semibold text-green-600">
                      {formatCurrency((parseFloat(rentalForm.total_value) || 0) - (parseFloat(rentalForm.discount) || 0))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Status e Observações */}
              <div className="border-t pt-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={rentalForm.status}
                      onValueChange={(value: any) => setRentalForm({ ...rentalForm, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="confirmed">Confirmado</SelectItem>
                        <SelectItem value="completed">Realizado</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rentalForm.contract_signed}
                        onChange={(e) => setRentalForm({ ...rentalForm, contract_signed: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span>Contrato Assinado</span>
                    </label>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    value={rentalForm.notes}
                    onChange={(e) => setRentalForm({ ...rentalForm, notes: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>

              {/* Botões */}
              <div className="flex justify-end gap-3 border-t pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => { setShowRentalForm(false); setEditingRental(null); }}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    editingRental ? 'Salvar Alterações' : 'Cadastrar Locação'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Formulário de Pagamento */}
      {showPaymentForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">Registrar Pagamento</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowPaymentForm(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="payment_rental">Locação *</Label>
                <Select
                  value={paymentForm.rental_id}
                  onValueChange={(value) => setPaymentForm({ ...paymentForm, rental_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a locação" />
                  </SelectTrigger>
                  <SelectContent>
                    {rentals.filter(r => r.status !== 'cancelled').map((rental) => (
                      <SelectItem key={rental.id} value={rental.id}>
                        {rental.renter_name} - {formatDate(rental.rental_date)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_amount">Valor (R$) *</Label>
                <Input
                  id="payment_amount"
                  type="number"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_date">Data do Pagamento *</Label>
                <Input
                  id="payment_date"
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_method">Método de Pagamento *</Label>
                <Select
                  value={paymentForm.payment_method}
                  onValueChange={(value: any) => setPaymentForm({ ...paymentForm, payment_method: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_METHODS).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_reference">Referência/Comprovante</Label>
                <Input
                  id="payment_reference"
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                  placeholder="Código PIX, nº do comprovante, etc."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_notes">Observações</Label>
                <Textarea
                  id="payment_notes"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowPaymentForm(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  Registrar Pagamento
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Formulário de Custo */}
      {showCostForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">Registrar Custo</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowCostForm(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            <form onSubmit={handleCostSubmit} className="p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cost_rental">Vincular a Locação (opcional)</Label>
                <Select
                  value={costForm.rental_id}
                  onValueChange={(value) => setCostForm({ ...costForm, rental_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Custo geral (não vinculado)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Custo geral (não vinculado)</SelectItem>
                    {rentals.map((rental) => (
                      <SelectItem key={rental.id} value={rental.id}>
                        {rental.renter_name} - {formatDate(rental.rental_date)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cost_description">Descrição *</Label>
                <Input
                  id="cost_description"
                  value={costForm.description}
                  onChange={(e) => setCostForm({ ...costForm, description: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cost_amount">Valor (R$) *</Label>
                <Input
                  id="cost_amount"
                  type="number"
                  step="0.01"
                  value={costForm.amount}
                  onChange={(e) => setCostForm({ ...costForm, amount: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cost_date">Data *</Label>
                <Input
                  id="cost_date"
                  type="date"
                  value={costForm.cost_date}
                  onChange={(e) => setCostForm({ ...costForm, cost_date: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cost_category">Categoria *</Label>
                <Select
                  value={costForm.category}
                  onValueChange={(value: any) => setCostForm({ ...costForm, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(COST_CATEGORIES).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cost_receipt">Nº Nota Fiscal/Recibo</Label>
                <Input
                  id="cost_receipt"
                  value={costForm.receipt_reference}
                  onChange={(e) => setCostForm({ ...costForm, receipt_reference: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cost_notes">Observações</Label>
                <Textarea
                  id="cost_notes"
                  value={costForm.notes}
                  onChange={(e) => setCostForm({ ...costForm, notes: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowCostForm(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  Registrar Custo
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este {
                deleteDialog.type === 'rental' ? 'locação' : 
                deleteDialog.type === 'payment' ? 'pagamento' : 'custo'
              }? Esta ação não pode ser desfeita.
              {deleteDialog.type === 'rental' && (
                <span className="block mt-2 text-red-600">
                  ⚠️ Todos os pagamentos vinculados a esta locação também serão excluídos.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
