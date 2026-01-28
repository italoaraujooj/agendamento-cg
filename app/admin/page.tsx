"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth/auth-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Calendar as CalendarIcon,
  Clock,
  Users,
  Phone,
  Mail,
  Building,
  User,
  Shield,
  CheckCircle,
  XCircle,
  Clock3,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  FileText,
  Download,
  X,
  DollarSign,
  ClipboardList,
} from "lucide-react"
import { ExternalRentalsManager } from "@/components/admin/external-rentals"
import { supabase } from "@/lib/supabase/client"
import { toast } from "sonner"
import Link from "next/link"
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
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

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
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by?: string
  reviewed_at?: string
  review_notes?: string
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

const STATUS_CONFIG = {
  pending: {
    label: 'Pendente',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: Clock3,
  },
  approved: {
    label: 'Aprovada',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: CheckCircle,
  },
  rejected: {
    label: 'Rejeitada',
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: XCircle,
  },
}

const parseLocalYmd = (ymd: string): Date => {
  const [yearStr, monthStr, dayStr] = (ymd || "").split("-")
  const year = Number.parseInt(yearStr || "0", 10)
  const month = Number.parseInt(monthStr || "1", 10)
  const day = Number.parseInt(dayStr || "1", 10)
  return new Date(year, month - 1, day)
}

export default function AdminPage() {
  const router = useRouter()
  const { user, isAuthenticated, isAdmin, adminChecked, loading: authLoading } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  
  // Estados para o dialog de ação
  const [actionDialog, setActionDialog] = useState<{
    open: boolean
    type: 'approve' | 'reject' | null
    booking: Booking | null
  }>({ open: false, type: null, booking: null })
  const [reviewNotes, setReviewNotes] = useState("")
  
  // Estado para os modais de relatório
  const [showHistory, setShowHistory] = useState(false) // Histórico (agendamentos passados)
  const [showUpcoming, setShowUpcoming] = useState(false) // Relatório Mensal (agendamentos futuros/vigente)
  const [selectedMonths, setSelectedMonths] = useState<string[]>([])
  const [selectAllMonths, setSelectAllMonths] = useState(true)

  // Verificar acesso admin
  useEffect(() => {
    // Aguardar carregamento da autenticação
    if (authLoading) return
    
    // Se não está autenticado, redirecionar
    if (!isAuthenticated) {
      router.push('/')
      return
    }
    
    // Aguardar verificação de admin ser concluída
    if (!adminChecked) return
    
    // Se não é admin, mostrar erro e redirecionar
    if (!isAdmin) {
      toast.error('Acesso negado. Você não tem permissão de administrador.')
      router.push('/')
      return
    }
  }, [authLoading, isAuthenticated, isAdmin, adminChecked, router])

  // Carregar dados
  useEffect(() => {
    const fetchData = async () => {
      if (!isAdmin) return

      try {
        const [bookingsRes, environmentsRes] = await Promise.all([
          supabase
            .from('bookings')
            .select(`
              *,
              environments!inner (
                id,
                name,
                capacity
              )
            `)
            .order('created_at', { ascending: false }),
          supabase.from('environments').select('*').order('name'),
        ])

        if (bookingsRes.error) throw bookingsRes.error
        if (environmentsRes.error) throw environmentsRes.error

        setBookings(bookingsRes.data || [])
        setEnvironments(environmentsRes.data || [])
      } catch (error) {
        console.error('Erro ao carregar dados:', error)
        toast.error('Erro ao carregar dados')
      } finally {
        setLoading(false)
      }
    }

    if (isAdmin) {
      fetchData()
    }
  }, [isAdmin])

  // Processar ação (aprovar/rejeitar)
  const handleAction = async () => {
    if (!actionDialog.booking || !actionDialog.type) return

    const booking = actionDialog.booking
    const newStatus = actionDialog.type === 'approve' ? 'approved' : 'rejected'
    
    setProcessingId(booking.id)

    try {
      // Atualizar status no banco
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          status: newStatus,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes || null,
        })
        .eq('id', booking.id)

      if (updateError) throw updateError

      // Buscar nome do ambiente para o email
      const environmentData = Array.isArray(booking.environments) 
        ? booking.environments[0] 
        : booking.environments

      // Enviar notificação por email
      try {
        await fetch('/api/send-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: actionDialog.type === 'approve' ? 'booking_approved' : 'booking_rejected',
            booking: {
              ...booking,
              environment_name: environmentData?.name,
            },
            adminNotes: reviewNotes,
          }),
        })
      } catch (emailError) {
        console.error('Erro ao enviar email:', emailError)
        // Não falhar a ação por causa do email
      }

      // Atualizar lista local
      setBookings(prev =>
        prev.map(b =>
          b.id === booking.id
            ? { 
                ...b, 
                status: newStatus, 
                reviewed_by: user?.id, 
                reviewed_at: new Date().toISOString(),
                review_notes: reviewNotes || undefined,
              }
            : b
        )
      )

      toast.success(
        newStatus === 'approved' 
          ? 'Reserva aprovada com sucesso!' 
          : 'Reserva rejeitada.'
      )
    } catch (error) {
      console.error('Erro ao processar ação:', error)
      toast.error('Erro ao processar ação')
    } finally {
      setProcessingId(null)
      setActionDialog({ open: false, type: null, booking: null })
      setReviewNotes("")
    }
  }

  // Cancelar reserva (delete)
  const handleCancelBooking = async (booking: Booking) => {
    if (!confirm('Tem certeza que deseja cancelar esta reserva? Esta ação não pode ser desfeita.')) {
      return
    }

    setProcessingId(booking.id)

    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', booking.id)

      if (error) throw error

      setBookings(prev => prev.filter(b => b.id !== booking.id))
      toast.success('Reserva cancelada com sucesso!')
    } catch (error) {
      console.error('Erro ao cancelar reserva:', error)
      toast.error('Erro ao cancelar reserva')
    } finally {
      setProcessingId(null)
    }
  }

  // Formatação de data
  const formatDate = (dateString: string) => {
    const date = parseLocalYmd(dateString)
    return date.toLocaleDateString("pt-BR", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const formatTime = (timeString: string) => timeString.slice(0, 5)

  // Filtrar reservas por status
  const pendingBookings = bookings.filter(b => b.status === 'pending')
  const rejectedBookings = bookings.filter(b => b.status === 'rejected')
  
  // Separar aprovadas em vigentes (futuras) e finalizadas (passadas)
  const todayDate = new Date()
  todayDate.setHours(0, 0, 0, 0)
  
  const approvedBookings = bookings
    .filter(b => {
      if (b.status !== 'approved') return false
      const bookingDate = parseLocalYmd(b.booking_date)
      return bookingDate >= todayDate // Data de hoje ou futuras
    })
    .sort((a, b) => {
      // Ordenar por data e hora crescente (mais próxima primeiro)
      const dateCompare = a.booking_date.localeCompare(b.booking_date)
      if (dateCompare !== 0) return dateCompare
      return a.start_time.localeCompare(b.start_time)
    })
  
  const completedBookings = bookings.filter(b => {
    if (b.status !== 'approved') return false
    const bookingDate = parseLocalYmd(b.booking_date)
    return bookingDate < todayDate // Datas passadas
  }).sort((a, b) => b.booking_date.localeCompare(a.booking_date)) // Mais recentes primeiro

  const MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]

  // Data de referência: início do mês atual
  const today = new Date()
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  
  // Separar agendamentos em histórico (passados) e futuros (mês atual + futuros)
  const historyBookings = bookings.filter(b => {
    const date = parseLocalYmd(b.booking_date)
    return date < currentMonthStart // Antes do início do mês atual
  })
  
  const upcomingBookings = bookings.filter(b => {
    const date = parseLocalYmd(b.booking_date)
    return date >= currentMonthStart // Mês atual ou futuro
  })

  // Função para agrupar reservas por mês
  const getBookingsByMonth = (sourceBookings: Booking[], filterBySelected = false) => {
    const grouped: Record<string, {
      month: string
      year: number
      monthIndex: number
      bookings: Booking[]
      approved: number
      rejected: number
      pending: number
      totalParticipants: number
    }> = {}

    sourceBookings.forEach(booking => {
      const date = parseLocalYmd(booking.booking_date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      // Se está filtrando e o mês não está selecionado, pular
      if (filterBySelected && !selectAllMonths && selectedMonths.length > 0 && !selectedMonths.includes(monthKey)) {
        return
      }
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          month: MONTH_NAMES[date.getMonth()],
          year: date.getFullYear(),
          monthIndex: date.getMonth(),
          bookings: [],
          approved: 0,
          rejected: 0,
          pending: 0,
          totalParticipants: 0,
        }
      }

      grouped[monthKey].bookings.push(booking)
      grouped[monthKey].totalParticipants += booking.estimated_participants
      
      if (booking.status === 'approved') grouped[monthKey].approved++
      else if (booking.status === 'rejected') grouped[monthKey].rejected++
      else grouped[monthKey].pending++
    })

    // Ordenar por data (mais recente primeiro para histórico, mais antigo primeiro para futuros)
    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, value]) => ({ key, ...value }))
  }

  // Meses disponíveis para histórico (passados)
  const historyMonths = getBookingsByMonth(historyBookings, false)
  const historyMonthsFiltered = getBookingsByMonth(historyBookings, true)
  
  // Meses disponíveis para relatório mensal (futuros/vigente)
  const upcomingMonths = getBookingsByMonth(upcomingBookings, false)
  const upcomingMonthsFiltered = getBookingsByMonth(upcomingBookings, true)

  // Função para toggle de seleção de mês
  const toggleMonth = (monthKey: string) => {
    setSelectAllMonths(false)
    setSelectedMonths(prev => 
      prev.includes(monthKey) 
        ? prev.filter(m => m !== monthKey)
        : [...prev, monthKey]
    )
  }

  // Função para selecionar/deselecionar todos
  const toggleSelectAll = () => {
    if (selectAllMonths) {
      setSelectAllMonths(false)
      setSelectedMonths([])
    } else {
      setSelectAllMonths(true)
      setSelectedMonths([])
    }
  }
  
  // Reset seleção de meses ao abrir modal
  const openHistoryModal = () => {
    setSelectAllMonths(true)
    setSelectedMonths([])
    setShowHistory(true)
  }
  
  const openUpcomingModal = () => {
    setSelectAllMonths(true)
    setSelectedMonths([])
    setShowUpcoming(true)
  }

  // Reservas filtradas para o relatório (histórico)
  const filteredHistoryBookings = selectAllMonths 
    ? historyBookings 
    : historyBookings.filter(b => {
        const date = parseLocalYmd(b.booking_date)
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        return selectedMonths.includes(monthKey)
      })
      
  // Reservas filtradas para o relatório (futuros)
  const filteredUpcomingBookings = selectAllMonths 
    ? upcomingBookings 
    : upcomingBookings.filter(b => {
        const date = parseLocalYmd(b.booking_date)
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        return selectedMonths.includes(monthKey)
      })

  // Função para exportar relatório como CSV (detalhado)
  const exportReportCSV = (
    sourceBookings: Booking[], 
    monthReport: typeof historyMonthsFiltered,
    reportType: 'history' | 'upcoming'
  ) => {
    const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
    const reportTitle = reportType === 'history' ? 'Histórico de Agendamentos' : 'Agendamentos Futuros'
    const fileName = reportType === 'history' ? 'historico-agendamentos' : 'agendamentos-futuros'
    
    // Cabeçalhos detalhados
    const headers = [
      'Data', 
      'Dia da Semana',
      'Horário Início', 
      'Horário Fim', 
      'Ambiente', 
      'Solicitante', 
      'Email', 
      'Telefone',
      'Ministério/Rede',
      'Responsável',
      'Participantes', 
      'Ocasião',
      'Status'
    ]
    
    // Ordenar por data
    const sortedBookings = [...sourceBookings].sort((a, b) => 
      reportType === 'history' 
        ? b.booking_date.localeCompare(a.booking_date) // Mais recente primeiro para histórico
        : a.booking_date.localeCompare(b.booking_date) // Mais próximo primeiro para futuros
    )
    
    const rows = sortedBookings.map(booking => {
      const date = parseLocalYmd(booking.booking_date)
      const envData = Array.isArray(booking.environments) 
        ? booking.environments[0] 
        : booking.environments
      const statusLabel = booking.status === 'approved' ? 'Aprovada' : 
                         booking.status === 'rejected' ? 'Rejeitada' : 'Pendente'
      
      return [
        formatDate(booking.booking_date),
        DAY_NAMES[date.getDay()],
        formatTime(booking.start_time),
        formatTime(booking.end_time),
        envData?.name || 'N/A',
        `"${booking.name}"`,
        booking.email,
        booking.phone,
        `"${booking.ministry_network}"`,
        `"${booking.responsible_person}"`,
        booking.estimated_participants,
        `"${booking.occasion.replace(/"/g, '""')}"`,
        statusLabel
      ]
    })

    // Adicionar resumo no final
    const filteredApproved = sourceBookings.filter(b => b.status === 'approved').length
    const filteredRejected = sourceBookings.filter(b => b.status === 'rejected').length
    const filteredPending = sourceBookings.filter(b => b.status === 'pending').length
    const totalParticipants = sourceBookings.reduce((sum, b) => sum + b.estimated_participants, 0)

    const csvContent = [
      reportTitle,
      '',
      headers.join(','),
      ...rows.map(row => row.join(',')),
      '',
      'RESUMO',
      `Total de Agendamentos,${sourceBookings.length}`,
      `Aprovados,${filteredApproved}`,
      `Pendentes,${filteredPending}`,
      `Rejeitados,${filteredRejected}`,
      `Total de Participantes,${totalParticipants}`,
      `Meses Incluídos,"${monthReport.map(m => `${m.month}/${m.year}`).join(', ')}"`,
    ].join('\n')

    // Adicionar BOM para UTF-8
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `${fileName}-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    toast.success('Relatório CSV detalhado exportado com sucesso!')
  }

  // Função para exportar relatório como PDF (detalhado com separação por mês)
  const exportReportPDF = (
    sourceBookings: Booking[], 
    monthReport: typeof historyMonthsFiltered,
    reportType: 'history' | 'upcoming'
  ) => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const todayStr = new Date().toLocaleDateString('pt-BR')
    const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
    
    const reportTitle = reportType === 'history' ? 'Histórico de Agendamentos' : 'Agendamentos Futuros'
    const fileName = reportType === 'history' ? 'historico-agendamentos' : 'agendamentos-futuros'
    const headerColor: [number, number, number] = reportType === 'history' ? [107, 114, 128] : [59, 130, 246] // Cinza para histórico, azul para futuros
    
    // Calcular totais filtrados
    const filteredApproved = sourceBookings.filter(b => b.status === 'approved').length
    const filteredRejected = sourceBookings.filter(b => b.status === 'rejected').length
    const filteredPending = sourceBookings.filter(b => b.status === 'pending').length
    const totalParticipants = sourceBookings.reduce((sum, b) => sum + b.estimated_participants, 0)
    
    // Título
    doc.setFontSize(20)
    doc.setTextColor(...headerColor)
    doc.text(reportTitle, pageWidth / 2, 20, { align: 'center' })
    
    // Subtítulo
    doc.setFontSize(12)
    doc.setTextColor(107, 114, 128)
    doc.text(`Sistema de Agendamento - Cidade Viva CG`, pageWidth / 2, 28, { align: 'center' })
    doc.text(`Gerado em: ${todayStr}`, pageWidth / 2, 35, { align: 'center' })
    
    // Período do relatório
    if (monthReport.length > 0) {
      const periodos = monthReport.map(m => `${m.month}/${m.year}`).join(', ')
      doc.setFontSize(10)
      doc.text(`Período: ${periodos}`, pageWidth / 2, 42, { align: 'center' })
    }

    // Resumo Geral
    doc.setFontSize(14)
    doc.setTextColor(31, 41, 55)
    doc.text('Resumo Geral', 14, 55)

    // Tabela de resumo
    autoTable(doc, {
      startY: 60,
      head: [['Métrica', 'Quantidade']],
      body: [
        ['Total de Reservas', String(sourceBookings.length)],
        ['Aprovadas', String(filteredApproved)],
        ['Pendentes', String(filteredPending)],
        ['Rejeitadas', String(filteredRejected)],
        ['Total de Participantes', String(totalParticipants)],
      ],
      theme: 'striped',
      headStyles: { fillColor: headerColor },
      styles: { fontSize: 10 },
      columnStyles: {
        0: { fontStyle: 'bold' },
      },
    })

    // Resumo por Mês
    let currentY = (doc as any).lastAutoTable?.finalY || 100
    doc.setFontSize(14)
    doc.setTextColor(31, 41, 55)
    doc.text('Resumo por Mês', 14, currentY + 15)

    autoTable(doc, {
      startY: currentY + 20,
      head: [['Mês/Ano', 'Total', 'Aprovadas', 'Pendentes', 'Rejeitadas', 'Participantes']],
      body: monthReport.map(m => [
        `${m.month}/${m.year}`,
        String(m.bookings.length),
        String(m.approved),
        String(m.pending),
        String(m.rejected),
        String(m.totalParticipants),
      ]),
      theme: 'striped',
      headStyles: { fillColor: headerColor },
      styles: { fontSize: 9 },
      columnStyles: {
        0: { fontStyle: 'bold' },
      },
    })

    // Detalhamento por mês (cada mês em uma seção separada)
    monthReport.forEach((monthData) => {
      doc.addPage()
      
      // Cabeçalho do mês
      doc.setFontSize(16)
      doc.setTextColor(...headerColor)
      doc.text(`${monthData.month} de ${monthData.year}`, pageWidth / 2, 20, { align: 'center' })
      
      // Mini resumo do mês
      doc.setFontSize(10)
      doc.setTextColor(107, 114, 128)
      doc.text(
        `Total: ${monthData.bookings.length} | Aprovadas: ${monthData.approved} | Pendentes: ${monthData.pending} | Rejeitadas: ${monthData.rejected}`,
        pageWidth / 2, 28, { align: 'center' }
      )
      
      // Ordenar reservas do mês por data
      const sortedMonthBookings = [...monthData.bookings].sort((a, b) => 
        a.booking_date.localeCompare(b.booking_date) || a.start_time.localeCompare(b.start_time)
      )
      
      // Tabela detalhada do mês
      const detailedData = sortedMonthBookings.map(booking => {
        const date = parseLocalYmd(booking.booking_date)
        const envData = Array.isArray(booking.environments) 
          ? booking.environments[0] 
          : booking.environments
        const statusLabel = booking.status === 'approved' ? 'Aprovada' : 
                           booking.status === 'rejected' ? 'Rejeitada' : 'Pendente'
        return [
          formatDate(booking.booking_date),
          DAY_NAMES[date.getDay()],
          `${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}`,
          envData?.name || 'N/A',
          booking.name,
          booking.ministry_network,
          String(booking.estimated_participants),
          statusLabel,
        ]
      })

      autoTable(doc, {
        startY: 35,
        head: [['Data', 'Dia', 'Horário', 'Ambiente', 'Solicitante', 'Ministério', 'Part.', 'Status']],
        body: detailedData,
        theme: 'striped',
        headStyles: { fillColor: headerColor },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 18 },
          2: { cellWidth: 28 },
          3: { cellWidth: 30 },
          4: { cellWidth: 30 },
          5: { cellWidth: 25 },
          6: { cellWidth: 12, halign: 'center' },
          7: { cellWidth: 18, halign: 'center' },
        },
        didParseCell: function(data: any) {
          // Colorir células de status
          if (data.section === 'body' && data.column.index === 7) {
            const status = data.cell.raw as string
            if (status === 'Aprovada') {
              data.cell.styles.textColor = [22, 163, 74]
            } else if (status === 'Rejeitada') {
              data.cell.styles.textColor = [220, 38, 38]
            } else {
              data.cell.styles.textColor = [202, 138, 4]
            }
          }
        },
      })

      // Se houver reservas com detalhes adicionais, adicionar tabela expandida
      const bookingsWithDetails = sortedMonthBookings.filter(b => b.occasion || b.responsible_person)
      if (bookingsWithDetails.length > 0) {
        const detailY = (doc as any).lastAutoTable?.finalY || 100
        
        if (detailY > 200) {
          doc.addPage()
          doc.setFontSize(12)
          doc.setTextColor(31, 41, 55)
          doc.text(`Detalhes Adicionais - ${monthData.month}/${monthData.year}`, 14, 20)
          
          autoTable(doc, {
            startY: 25,
            head: [['Data', 'Solicitante', 'Responsável', 'Contato', 'Ocasião']],
            body: bookingsWithDetails.map(booking => [
              formatDate(booking.booking_date),
              booking.name,
              booking.responsible_person,
              `${booking.email}\n${booking.phone}`,
              booking.occasion.substring(0, 80) + (booking.occasion.length > 80 ? '...' : ''),
            ]),
            theme: 'striped',
            headStyles: { fillColor: [107, 114, 128] },
            styles: { fontSize: 7, cellPadding: 2 },
          })
        }
      }
    })

    // Rodapé em todas as páginas
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(156, 163, 175)
      doc.text(
        `Página ${i} de ${pageCount} - Sistema de Agendamento - Cidade Viva CG`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      )
    }

    // Salvar
    doc.save(`${fileName}-${new Date().toISOString().split('T')[0]}.pdf`)
    toast.success(`${reportTitle} exportado com sucesso!`)
  }

  // Loading state - aguardar auth e verificação de admin
  if (authLoading || loading || (isAuthenticated && !adminChecked)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Carregando...</span>
        </div>
      </div>
    )
  }

  // Não autorizado
  if (!isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button asChild variant="ghost" className="mb-4">
            <Link href="/" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar ao Início
            </Link>
          </Button>

          <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              <h1 className="text-4xl font-bold">Painel de Administração</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={openHistoryModal}
                variant="outline"
                className="flex items-center gap-2 border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
              >
                <Clock className="h-4 w-4" />
                Histórico
                {historyBookings.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{historyBookings.length}</Badge>
                )}
              </Button>
              <Button
                onClick={openUpcomingModal}
                variant="outline"
                className="flex items-center gap-2 border-blue-300 hover:bg-blue-50 dark:border-blue-700 dark:hover:bg-blue-950"
              >
                <CalendarIcon className="h-4 w-4" />
                Relatório Mensal
                {upcomingBookings.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{upcomingBookings.length}</Badge>
                )}
              </Button>
            </div>
          </div>
          <p className="text-xl text-muted-foreground">
            Gerencie solicitações de reserva e aprove ou rejeite pedidos
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock3 className="h-8 w-8 text-yellow-500" />
                <span className="text-3xl font-bold">{pendingBookings.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Aprovadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <span className="text-3xl font-bold">{approvedBookings.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Rejeitadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <XCircle className="h-8 w-8 text-red-500" />
                <span className="text-3xl font-bold">{rejectedBookings.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs Principais */}
        <Tabs defaultValue="bookings" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="bookings" className="flex items-center gap-2 text-base py-3">
              <ClipboardList className="h-5 w-5" />
              Agendamentos Internos
            </TabsTrigger>
            <TabsTrigger value="rentals" className="flex items-center gap-2 text-base py-3">
              <DollarSign className="h-5 w-5" />
              Locações Externas
            </TabsTrigger>
          </TabsList>

          {/* Conteúdo de Agendamentos Internos */}
          <TabsContent value="bookings">
            {/* Tabs de status de reservas */}
            <Tabs defaultValue="pending" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="pending" className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4" />
                  Pendentes ({pendingBookings.length})
                </TabsTrigger>
                <TabsTrigger value="approved" className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Aprovadas ({approvedBookings.length})
                </TabsTrigger>
                <TabsTrigger value="completed" className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Finalizadas ({completedBookings.length})
                </TabsTrigger>
                <TabsTrigger value="rejected" className="flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Rejeitadas ({rejectedBookings.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="space-y-4 mt-4">
                {pendingBookings.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-12">
                      <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">Tudo em dia!</h3>
                      <p className="text-muted-foreground">
                        Não há solicitações pendentes de aprovação.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {pendingBookings.map((booking) => (
                      <BookingAdminCard
                        key={booking.id}
                        booking={booking}
                        onApprove={() => setActionDialog({ open: true, type: 'approve', booking })}
                        onReject={() => setActionDialog({ open: true, type: 'reject', booking })}
                        onCancel={() => handleCancelBooking(booking)}
                        processing={processingId === booking.id}
                        formatDate={formatDate}
                        formatTime={formatTime}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="approved" className="space-y-4 mt-4">
                {approvedBookings.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-12">
                      <CalendarIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">Nenhuma reserva vigente</h3>
                      <p className="text-muted-foreground">
                        Não há reservas aprovadas para datas futuras.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {approvedBookings.map((booking) => (
                      <BookingAdminCard
                        key={booking.id}
                        booking={booking}
                        onCancel={() => handleCancelBooking(booking)}
                        processing={processingId === booking.id}
                        formatDate={formatDate}
                        formatTime={formatTime}
                        showActions={false}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="completed" className="space-y-4 mt-4">
                {completedBookings.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-12">
                      <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">Nenhuma reserva finalizada</h3>
                      <p className="text-muted-foreground">
                        Ainda não há reservas que já aconteceram.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {completedBookings.map((booking) => (
                      <BookingAdminCard
                        key={booking.id}
                        booking={booking}
                        processing={processingId === booking.id}
                        formatDate={formatDate}
                        formatTime={formatTime}
                        showActions={false}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="rejected" className="space-y-4 mt-4">
                {rejectedBookings.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-12">
                      <CalendarIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">Nenhuma reserva rejeitada</h3>
                      <p className="text-muted-foreground">
                        Não há reservas rejeitadas no momento.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {rejectedBookings.map((booking) => (
                      <BookingAdminCard
                        key={booking.id}
                        booking={booking}
                        processing={processingId === booking.id}
                        formatDate={formatDate}
                        formatTime={formatTime}
                        showActions={false}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Conteúdo de Locações Externas */}
          <TabsContent value="rentals">
            <ExternalRentalsManager userId={user?.id || ''} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog de Ação */}
      <AlertDialog open={actionDialog.open} onOpenChange={(open) => {
        if (!open) {
          setActionDialog({ open: false, type: null, booking: null })
          setReviewNotes("")
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog.type === 'approve' ? '✅ Aprovar Reserva' : '❌ Rejeitar Reserva'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionDialog.type === 'approve' 
                ? 'Ao aprovar, o solicitante receberá uma notificação por email.'
                : 'Ao rejeitar, o solicitante receberá uma notificação por email informando a decisão.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {actionDialog.booking && (
            <div className="py-4">
              <div className="bg-muted p-4 rounded-lg mb-4">
                <p className="font-medium">{actionDialog.booking.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(actionDialog.booking.booking_date)} • {formatTime(actionDialog.booking.start_time)} - {formatTime(actionDialog.booking.end_time)}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reviewNotes">
                  Observações {actionDialog.type === 'reject' ? '(motivo da rejeição)' : '(opcional)'}
                </Label>
                <Textarea
                  id="reviewNotes"
                  placeholder={actionDialog.type === 'reject' 
                    ? "Informe o motivo da rejeição..."
                    : "Adicione observações se necessário..."
                  }
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              className={actionDialog.type === 'approve' 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-red-600 hover:bg-red-700'}
            >
              {actionDialog.type === 'approve' ? 'Aprovar' : 'Rejeitar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Histórico (Agendamentos Passados) */}
      {showHistory && (
        <ReportModal
          title="Histórico de Agendamentos"
          subtitle="Agendamentos de meses anteriores ao mês vigente"
          isOpen={showHistory}
          onClose={() => setShowHistory(false)}
          availableMonths={historyMonths}
          monthlyReport={historyMonthsFiltered}
          filteredBookings={filteredHistoryBookings}
          selectedMonths={selectedMonths}
          selectAllMonths={selectAllMonths}
          onToggleMonth={toggleMonth}
          onToggleSelectAll={toggleSelectAll}
          onExportCSV={() => exportReportCSV(filteredHistoryBookings, historyMonthsFiltered, 'history')}
          onExportPDF={() => exportReportPDF(filteredHistoryBookings, historyMonthsFiltered, 'history')}
          formatDate={formatDate}
          formatTime={formatTime}
          parseLocalYmd={parseLocalYmd}
          colorScheme="gray"
          emptyMessage="Não há agendamentos passados no sistema."
        />
      )}

      {/* Modal de Relatório Mensal (Agendamentos Futuros/Vigente) */}
      {showUpcoming && (
        <ReportModal
          title="Relatório de Agendamentos"
          subtitle="Agendamentos do mês vigente e futuros"
          isOpen={showUpcoming}
          onClose={() => setShowUpcoming(false)}
          availableMonths={upcomingMonths}
          monthlyReport={upcomingMonthsFiltered}
          filteredBookings={filteredUpcomingBookings}
          selectedMonths={selectedMonths}
          selectAllMonths={selectAllMonths}
          onToggleMonth={toggleMonth}
          onToggleSelectAll={toggleSelectAll}
          onExportCSV={() => exportReportCSV(filteredUpcomingBookings, upcomingMonthsFiltered, 'upcoming')}
          onExportPDF={() => exportReportPDF(filteredUpcomingBookings, upcomingMonthsFiltered, 'upcoming')}
          formatDate={formatDate}
          formatTime={formatTime}
          parseLocalYmd={parseLocalYmd}
          colorScheme="blue"
          emptyMessage="Não há agendamentos futuros ou do mês vigente no sistema."
        />
      )}
    </div>
  )
}

// Componente do Modal de Relatório
interface MonthData {
  key: string
  month: string
  year: number
  monthIndex: number
  bookings: Booking[]
  approved: number
  rejected: number
  pending: number
  totalParticipants: number
}

interface ReportModalProps {
  title: string
  subtitle: string
  isOpen: boolean
  onClose: () => void
  availableMonths: MonthData[]
  monthlyReport: MonthData[]
  filteredBookings: Booking[]
  selectedMonths: string[]
  selectAllMonths: boolean
  onToggleMonth: (monthKey: string) => void
  onToggleSelectAll: () => void
  onExportCSV: () => void
  onExportPDF: () => void
  formatDate: (date: string) => string
  formatTime: (time: string) => string
  parseLocalYmd: (dateString: string) => Date
  colorScheme: 'blue' | 'gray'
  emptyMessage: string
}

function ReportModal({
  title,
  subtitle,
  isOpen,
  onClose,
  availableMonths,
  monthlyReport,
  filteredBookings,
  selectedMonths,
  selectAllMonths,
  onToggleMonth,
  onToggleSelectAll,
  onExportCSV,
  onExportPDF,
  formatDate,
  formatTime,
  parseLocalYmd,
  colorScheme,
  emptyMessage,
}: ReportModalProps) {
  if (!isOpen) return null
  
  const colors = colorScheme === 'blue' 
    ? {
        gradient: 'from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30',
        border: 'border-blue-200 dark:border-blue-800',
        text: 'text-blue-600 dark:text-blue-400',
        icon: 'text-blue-600',
      }
    : {
        gradient: 'from-gray-50 to-slate-50 dark:from-gray-950/30 dark:to-slate-950/30',
        border: 'border-gray-200 dark:border-gray-700',
        text: 'text-gray-600 dark:text-gray-400',
        icon: 'text-gray-600',
      }

  const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header do Modal */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            {colorScheme === 'blue' ? (
              <CalendarIcon className={`h-6 w-6 ${colors.icon}`} />
            ) : (
              <Clock className={`h-6 w-6 ${colors.icon}`} />
            )}
            <div>
              <h2 className="text-2xl font-bold">{title}</h2>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={onExportCSV}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              disabled={filteredBookings.length === 0}
            >
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <Button
              onClick={onExportPDF}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:hover:bg-red-950/50 dark:text-red-400 dark:border-red-800"
              disabled={filteredBookings.length === 0}
            >
              <FileText className="h-4 w-4" />
              PDF
            </Button>
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Seletor de Meses */}
        {availableMonths.length > 0 && (
          <div className="px-6 py-4 border-b bg-muted/30">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Filtrar por mês:</span>
              <button
                onClick={onToggleSelectAll}
                className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                  selectAllMonths 
                    ? 'bg-primary text-primary-foreground border-primary' 
                    : 'bg-background hover:bg-muted border-border'
                }`}
              >
                Todos
              </button>
              {availableMonths.map((monthData) => (
                <button
                  key={monthData.key}
                  onClick={() => onToggleMonth(monthData.key)}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                    (selectAllMonths || selectedMonths.includes(monthData.key))
                      ? 'bg-primary text-primary-foreground border-primary' 
                      : 'bg-background hover:bg-muted border-border'
                  }`}
                >
                  {monthData.month.substring(0, 3)}/{monthData.year}
                </button>
              ))}
            </div>
            {!selectAllMonths && selectedMonths.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                ⚠️ Selecione pelo menos um mês para gerar o relatório
              </p>
            )}
          </div>
        )}

        {/* Conteúdo do Relatório */}
        <div className="flex-1 overflow-y-auto p-6">
          {(availableMonths.length === 0 || (!selectAllMonths && selectedMonths.length === 0)) ? (
            <div className="text-center py-12">
              <CalendarIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                {availableMonths.length === 0 ? emptyMessage : 'Selecione os meses'}
              </h3>
              <p className="text-muted-foreground">
                {availableMonths.length === 0 
                  ? ''
                  : 'Selecione pelo menos um mês acima para visualizar o relatório.'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Resumo Geral */}
              <Card className={`bg-gradient-to-r ${colors.gradient} ${colors.border}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>Resumo Geral</span>
                    <Badge variant="outline" className="font-normal">
                      {monthlyReport.length} {monthlyReport.length === 1 ? 'mês' : 'meses'} selecionado{monthlyReport.length !== 1 ? 's' : ''}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center">
                      <p className={`text-3xl font-bold ${colors.text}`}>{filteredBookings.length}</p>
                      <p className="text-sm text-muted-foreground">Total de Reservas</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                        {filteredBookings.filter(b => b.status === 'approved').length}
                      </p>
                      <p className="text-sm text-muted-foreground">Aprovadas</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                        {filteredBookings.filter(b => b.status === 'pending').length}
                      </p>
                      <p className="text-sm text-muted-foreground">Pendentes</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                        {filteredBookings.filter(b => b.status === 'rejected').length}
                      </p>
                      <p className="text-sm text-muted-foreground">Rejeitadas</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                        {filteredBookings.reduce((sum, b) => sum + b.estimated_participants, 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">Participantes</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Relatório por Mês */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  Detalhamento por Mês
                </h3>
                
                {monthlyReport.map((monthData) => (
                  <Card key={monthData.key} className="overflow-hidden">
                    <CardHeader className="bg-muted/50 py-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">
                          {monthData.month} de {monthData.year}
                        </CardTitle>
                        <Badge variant="outline" className="text-sm">
                          {monthData.bookings.length} reserva{monthData.bookings.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                          <span>Aprovadas: <strong>{monthData.approved}</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                          <span>Pendentes: <strong>{monthData.pending}</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500"></div>
                          <span>Rejeitadas: <strong>{monthData.rejected}</strong></span>
                        </div>
                        <div className="flex items-center gap-2 md:col-span-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>Total de participantes: <strong>{monthData.totalParticipants}</strong></span>
                        </div>
                      </div>

                      {/* Lista detalhada de reservas do mês */}
                      <details className="mt-4" open>
                        <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4" />
                          Ver detalhes das reservas ({monthData.bookings.length})
                        </summary>
                        <div className="mt-3 space-y-3">
                          {monthData.bookings
                            .sort((a, b) => a.booking_date.localeCompare(b.booking_date) || a.start_time.localeCompare(b.start_time))
                            .map((booking) => {
                              const envData = Array.isArray(booking.environments) 
                                ? booking.environments[0] 
                                : booking.environments
                              const bookingDate = parseLocalYmd(booking.booking_date)
                              return (
                                <div
                                  key={booking.id}
                                  className={`text-sm p-3 rounded-lg border-l-4 ${
                                    booking.status === 'approved' ? 'border-l-green-500 bg-green-50 dark:bg-green-950/20' :
                                    booking.status === 'rejected' ? 'border-l-red-500 bg-red-50 dark:bg-red-950/20' :
                                    'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
                                  }`}
                                >
                                  {/* Linha 1: Data, Horário e Status */}
                                  <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-3 flex-wrap">
                                      <div className="flex items-center gap-1.5 text-xs bg-background/80 px-2 py-1 rounded">
                                        <CalendarIcon className="h-3.5 w-3.5" />
                                        <span className="font-semibold">{formatDate(booking.booking_date)}</span>
                                        <span className="text-muted-foreground">({DAY_NAMES[bookingDate.getDay()]})</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 text-xs bg-background/80 px-2 py-1 rounded">
                                        <Clock className="h-3.5 w-3.5" />
                                        <span>{formatTime(booking.start_time)} - {formatTime(booking.end_time)}</span>
                                      </div>
                                    </div>
                                    <Badge 
                                      variant={booking.status === 'approved' ? 'default' : booking.status === 'rejected' ? 'destructive' : 'secondary'}
                                      className="text-xs"
                                    >
                                      {booking.status === 'approved' ? 'Aprovada' : booking.status === 'rejected' ? 'Rejeitada' : 'Pendente'}
                                    </Badge>
                                  </div>
                                  
                                  {/* Linha 2: Solicitante e Ambiente */}
                                  <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                      <p className="font-medium flex items-center gap-1.5">
                                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                                        {booking.name}
                                      </p>
                                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                        <Shield className="h-3 w-3" />
                                        {booking.ministry_network}
                                      </p>
                                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                                        <Mail className="h-3 w-3" />
                                        {booking.email}
                                        <span className="mx-1">•</span>
                                        <Phone className="h-3 w-3" />
                                        {booking.phone}
                                      </p>
                                    </div>
                                    <div className="text-right space-y-1">
                                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                                        <Building className="h-3 w-3" />
                                        {envData?.name || 'N/A'}
                                      </Badge>
                                      <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                                        <Users className="h-3 w-3" />
                                        {booking.estimated_participants} pessoas
                                      </p>
                                    </div>
                                  </div>
                                  
                                  {/* Linha 3: Ocasião (se houver) */}
                                  {booking.occasion && (
                                    <div className="mt-2 pt-2 border-t border-border/50">
                                      <p className="text-xs text-muted-foreground">
                                        <span className="font-medium">Ocasião:</span> {booking.occasion}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                        </div>
                      </details>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer do Modal */}
        <div className="flex justify-end gap-2 p-4 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  )
}

// Componente do Card de Reserva para Admin
interface BookingAdminCardProps {
  booking: Booking
  onApprove?: () => void
  onReject?: () => void
  onCancel?: () => void
  processing: boolean
  formatDate: (date: string) => string
  formatTime: (time: string) => string
  showActions?: boolean
}

function BookingAdminCard({
  booking,
  onApprove,
  onReject,
  onCancel,
  processing,
  formatDate,
  formatTime,
  showActions = true,
}: BookingAdminCardProps) {
  const statusConfig = STATUS_CONFIG[booking.status]
  const StatusIcon = statusConfig.icon
  
  const getEnvironmentData = (environments: Booking['environments']) => {
    if (Array.isArray(environments)) {
      return environments[0] || { id: '', name: '', capacity: 0 }
    }
    return environments || { id: '', name: '', capacity: 0 }
  }

  const environment = getEnvironmentData(booking.environments)

  return (
    <Card className={`border-l-4 ${
      booking.status === 'pending' ? 'border-l-yellow-500' :
      booking.status === 'approved' ? 'border-l-green-500' :
      'border-l-red-500'
    }`}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              {booking.name}
              <Badge variant="outline" className={statusConfig.color}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusConfig.label}
              </Badge>
            </CardTitle>
            <CardDescription className="flex items-center gap-4 mt-1">
              <span className="flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" />
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

      <CardContent>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{environment.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a href={`mailto:${booking.email}`} className="text-primary hover:underline">
                {booking.email}
              </a>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <a href={`tel:${booking.phone}`} className="text-primary hover:underline">
                {booking.phone}
              </a>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{booking.ministry_network}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{booking.responsible_person}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-muted rounded-lg">
          <p className="text-sm">
            <strong>Ocasião:</strong> {booking.occasion}
          </p>
        </div>

        {booking.review_notes && (
          <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-sm">
              <strong className="text-amber-700 dark:text-amber-400">Observações:</strong>{' '}
              <span className="text-amber-800 dark:text-amber-300">{booking.review_notes}</span>
            </p>
          </div>
        )}

        {/* Ações */}
        {(showActions || onCancel) && (
          <div className="flex gap-2 mt-4 pt-4 border-t">
            {showActions && booking.status === 'pending' && (
              <>
                <Button
                  onClick={onApprove}
                  disabled={processing}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {processing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Aprovar
                </Button>
                <Button
                  onClick={onReject}
                  disabled={processing}
                  variant="destructive"
                  className="flex-1"
                >
                  {processing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-2" />
                  )}
                  Rejeitar
                </Button>
              </>
            )}
            {onCancel && (
              <Button
                onClick={onCancel}
                disabled={processing}
                variant="outline"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                {processing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <AlertTriangle className="h-4 w-4 mr-2" />
                )}
                Cancelar Reserva
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
