"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Calendar, CheckCircle, AlertTriangle, RefreshCw, ExternalLink, Info } from 'lucide-react'
import { useAuth } from './auth-provider'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface GoogleTokenStatus {
  hasTokens: boolean
  isExpired: boolean
  isIntegrationEnabled: boolean
  expiresAt?: string
}

export function GoogleCalendarSetup() {
  const { user, session, isAuthenticated } = useAuth()
  const [isConnecting, setIsConnecting] = useState(false)
  const [tokenStatus, setTokenStatus] = useState<GoogleTokenStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const checkTokenStatus = async () => {
    if (!isAuthenticated) return

    try {
      const response = await fetch('/api/debug-calendar-status')
      if (response.ok) {
        const data = await response.json()
        setTokenStatus({
          hasTokens: data.profile.hasGoogleAccessToken,
          isExpired: data.profile.isExpired,
          isIntegrationEnabled: data.profile.calendarIntegrationEnabled,
          expiresAt: data.profile.tokenExpiry
        })
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    checkTokenStatus()
  }, [isAuthenticated])

  // Detectar mudanças na sessão (quando voltar do OAuth)
  useEffect(() => {
    if (session?.provider_token && !tokenStatus?.hasTokens) {
      handleStoreTokens()
    }
  }, [session, tokenStatus])

  const handleStoreTokens = async () => {
    if (!session?.provider_token || !user) return

    try {
      // Usar a RPC function diretamente para armazenar tokens
      const { error } = await supabase.rpc('store_google_oauth_token', {
        p_user_id: user.id,
        p_access_token: session.provider_token,
        p_refresh_token: session.provider_refresh_token || null,
        p_expires_in: 3600,
      })

      if (!error) {
        toast.success('Google Calendar conectado com sucesso!')
        checkTokenStatus()
      } else {
        console.error('Erro ao armazenar tokens:', error)
      }
    } catch (error) {
      console.error('Erro ao armazenar tokens:', error)
    }
  }

  const handleConnect = async () => {
    if (!isAuthenticated || !user) {
      toast.error('Você precisa estar logado')
      return
    }

    setIsConnecting(true)

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'openid email profile https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.calendarlist',
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      })

      if (error) {
        console.error('❌ Erro no OAuth:', error)
        toast.error('Erro ao conectar. Tente novamente.')
        setIsConnecting(false)
      }
    } catch (error) {
      console.error('❌ Erro:', error)
      toast.error('Erro ao conectar. Tente novamente.')
      setIsConnecting(false)
    }
  }

  if (!isAuthenticated) {
    return null
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  const isConnected = tokenStatus?.hasTokens && !tokenStatus?.isExpired

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Google Calendar
        </CardTitle>
        <CardDescription>
          Conecte sua conta do Google para sincronizar automaticamente seus agendamentos
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isConnected ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-700">Conectado</span>
                <Badge variant="default">Ativo</Badge>
              </>
            ) : tokenStatus?.hasTokens && tokenStatus?.isExpired ? (
              <>
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <span className="font-medium text-yellow-700">Expirado</span>
                <Badge variant="secondary">Reconectar</Badge>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-gray-600" />
                <span className="font-medium text-gray-700">Não conectado</span>
                <Badge variant="outline">Desconectado</Badge>
              </>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={checkTokenStatus}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Informações */}
        {tokenStatus && (
          <div className="bg-gray-50 p-3 rounded text-sm">
            <p><strong>Email:</strong> {user?.email}</p>
            {tokenStatus.expiresAt && (
              <p><strong>Expira em:</strong> {new Date(tokenStatus.expiresAt).toLocaleString()}</p>
            )}
          </div>
        )}

        {/* Botão Principal */}
        <Button 
          onClick={handleConnect}
          disabled={isConnecting}
          className="w-full"
          variant={isConnected ? "outline" : "default"}
        >
          {isConnecting ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Conectando...
            </>
          ) : (
            <>
              <Calendar className="h-4 w-4 mr-2" />
              {isConnected ? 'Reconectar' : 'Conectar Google Calendar'}
            </>
          )}
        </Button>

        {/* Status da Integração */}
        {isConnected ? (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Integração ativa!</strong> Seus novos agendamentos serão automaticamente 
              sincronizados com o Google Calendar.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Benefícios da integração:</strong>
              <br />
              • Eventos criados automaticamente no seu Google Calendar
              <br />
              • Sincronização em tempo real
              <br />
              • Lembretes automáticos do Google
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
