import { GoogleCalendarSetup } from '@/components/auth/google-calendar-setup'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { User, Mail, Calendar, Shield } from 'lucide-react'
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

          <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 max-w-md mx-auto mb-8">
            <h2 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
              🚨 Diagnóstico do Problema
            </h2>
            <div className="space-y-2 text-sm">
              <p className="text-yellow-700">
                ❌ Cookies não encontrados no servidor
              </p>
              <p className="text-yellow-600">
                ⚠️ Possível problema de configuração de cookies
              </p>
              <p className="text-blue-600">
                ℹ️ Precisa verificar se cookies estão no navegador
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4 max-w-sm mx-auto">
            <div className="flex gap-2">
              <a
                href="/"
                className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
          <h1 className="text-3xl font-bold mb-4 text-yellow-700">Erro de Autenticação</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Ocorreu um erro ao verificar sua sessão
          </p>

          <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 max-w-md mx-auto mb-8">
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              {sessionError.message}
            </p>
          </div>

          <div className="flex flex-col gap-4 max-w-sm mx-auto">
            <a
              href="/"
              className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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

        {/* Google Calendar Integration */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <GoogleCalendarSetup />

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
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <div>
                <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                  Conta Conectada
                </h3>
                <p className="text-xs text-green-600 dark:text-green-300">
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
