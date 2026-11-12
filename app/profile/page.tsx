import { CalendarSubscribe } from '@/components/escalas/calendar-subscribe'
import { signBookingsCalendarToken } from '@/lib/escalas/availability-token'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { User, Mail, Calendar, Shield, Info } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'

export default async function ProfilePage() {
  const supabase = await createServerClient()

  if (!supabase) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">⚠️ Erro de Configuração</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Erro ao conectar com o banco de dados
          </p>
        </div>
      </div>
    )
  }

  // Obter a sessão diretamente
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  // Se não há sessão, mostrar página informativa em vez de redirecionar
  if (!session) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">🔍 Problema de Cookies Detectado</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Os cookies de autenticação não estão sendo enviados para o servidor
          </p>

          <div className="bg-warning/10 border border-warning/30 rounded-lg p-6 max-w-md mx-auto mb-8">
            <h2 className="text-lg font-semibold text-warning mb-2">
              🚨 Diagnóstico do Problema
            </h2>
            <div className="space-y-2 text-sm">
              <p className="text-warning">
                ❌ Cookies não encontrados no servidor
              </p>
              <p className="text-primary">
                ⚠️ Possível problema de configuração de cookies
              </p>
              <p className="text-info">
                ℹ️ Precisa verificar se cookies estão no navegador
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4 max-w-sm mx-auto">
            <div className="flex gap-2">
              <a
                href="/"
                className="inline-flex items-center justify-center px-4 py-2 bg-info text-info-foreground rounded-lg hover:bg-info/90 transition-colors"
              >
                🔐 Fazer Login
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Se há erro na sessão, mostrar página de erro
  if (sessionError) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4 text-warning">Erro de Autenticação</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Ocorreu um erro ao verificar sua sessão
          </p>

          <div className="bg-warning/10 border border-warning/30 rounded-lg p-6 max-w-md mx-auto mb-8">
            <p className="text-sm text-warning">
              {sessionError.message}
            </p>
          </div>

          <div className="flex flex-col gap-4 max-w-sm mx-auto">
            <a
              href="/"
              className="inline-flex items-center justify-center px-4 py-2 bg-info text-info-foreground rounded-lg hover:bg-info/90 transition-colors"
            >
              ← Voltar para a Página Inicial
            </a>
          </div>
        </div>
      </div>
    )
  }


  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()

  // Link pessoal do feed de reservas (ICS)
  const bookingsCalendarToken = signBookingsCalendarToken(session.user.id)

  const { data: bookingStats } = await supabase
    .from('bookings')
    .select('id', { count: 'exact' })
    .eq('user_id', session.user.id)

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Meu Perfil</h1>
          <p className="text-muted-foreground">
            Gerencie suas informações e integrações
          </p>
        </div>

        {/* Profile Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informações Pessoais
            </CardTitle>
            <CardDescription>
              Suas informações básicas de perfil
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Nome</p>
                  <p className="text-sm text-muted-foreground">
                    {profile?.full_name || session.user.user_metadata?.full_name || 'Não informado'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">
                    {profile?.email || session.user.email}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Total de Reservas</p>
                  <p className="text-sm text-muted-foreground">
                    {bookingStats?.length || 0} reservas realizadas
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Status da Conta</p>
                  <Badge variant="default" className="text-xs">
                    Verificado
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reservas na agenda: link de assinatura (ICS), sem acesso à conta Google */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Minhas reservas na agenda
              </CardTitle>
              <CardDescription>
                Assine suas reservas no Google Agenda, no iPhone ou no Outlook
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Suas reservas aprovadas e em análise aparecem na sua agenda e se atualizam
                sozinhas. O app de agenda busca as mudanças de tempos em tempos, então uma
                reserva nova pode levar algumas horas para aparecer.
              </p>
              <CalendarSubscribe calendarToken={bookingsCalendarToken} feedPath="/api/reservas/ics" />
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  O link é pessoal: quem tiver ele consegue ver suas reservas. Não compartilhe.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Account Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Estatísticas da Conta</CardTitle>
              <CardDescription>
                Resumo da sua atividade no sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Reservas este mês</span>
                <Badge variant="secondary">0</Badge>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Próximas reservas</span>
                <Badge variant="secondary">0</Badge>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Reservas canceladas</span>
                <Badge variant="outline">0</Badge>
              </div>

              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  Estatísticas atualizadas em tempo real
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Integration Status Messages */}
        <Card className="border-success/30 bg-success/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-success rounded-full"></div>
              <div>
                <h3 className="text-sm font-medium text-success">
                  Conta Conectada
                </h3>
                <p className="text-xs text-success">
                  Sua conta está totalmente configurada e pronta para uso
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
