"use client"

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar, CheckCircle, AlertTriangle, Settings, RefreshCw } from 'lucide-react'
import { useAuth } from './auth/auth-provider'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface CalendarStatus {
  isConnected: boolean
  isExpired: boolean
  expiresAt?: string
}

interface CalendarStatusIndicatorProps {
  className?: string
}

export function CalendarStatusIndicator({ className }: CalendarStatusIndicatorProps) {
  const { isAuthenticated, user } = useAuth()
  const [status, setStatus] = useState<CalendarStatus>({ isConnected: false, isExpired: false })
  const [isChecking, setIsChecking] = useState(false)

  const checkStatus = async () => {
    if (!isAuthenticated) return

    setIsChecking(true)
    try {
      const response = await fetch('/api/debug-calendar-status')
      if (response.ok) {
        const data = await response.json()
        setStatus({
          isConnected: data.profile.hasGoogleAccessToken && data.profile.calendarIntegrationEnabled,
          isExpired: data.profile.isExpired,
          expiresAt: data.profile.tokenExpiry
        })
      }
    } catch (error) {
      console.error('Erro ao verificar status do calendar:', error)
    } finally {
      setIsChecking(false)
    }
  }

  useEffect(() => {
    checkStatus()
  }, [isAuthenticated])

  if (!isAuthenticated) {
    return null
  }

  const getStatusInfo = () => {
    if (!status.isConnected) {
      return {
        variant: 'secondary' as const,
        text: 'Calendar Desconectado',
        icon: AlertTriangle,
        color: 'text-yellow-600'
      }
    }

    if (status.isExpired) {
      return {
        variant: 'destructive' as const,
        text: 'Calendar Expirado',
        icon: AlertTriangle,
        color: 'text-red-600'
      }
    }

    return {
      variant: 'default' as const,
      text: 'Calendar Conectado',
      icon: CheckCircle,
      color: 'text-green-600'
    }
  }

  const statusInfo = getStatusInfo()
  const StatusIcon = statusInfo.icon

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={cn("h-8 px-2", className)}>
          <Calendar className="h-4 w-4 mr-1" />
          <Badge variant={statusInfo.variant} className="text-xs">
            {status.isConnected ? (status.isExpired ? 'Expirado' : 'Conectado') : 'Desconectado'}
          </Badge>
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Google Calendar</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={checkStatus}
              disabled={isChecking}
            >
              {isChecking ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <StatusIcon className={`h-4 w-4 ${statusInfo.color}`} />
            <span className="text-sm">{statusInfo.text}</span>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>Usuário:</strong> {user?.email}</p>
            {status.expiresAt && (
              <p><strong>Expira em:</strong> {new Date(status.expiresAt).toLocaleString()}</p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              variant={status.isConnected ? "outline" : "default"}
              asChild
              className="flex-1"
            >
              <a href="/profile">
                <Settings className="h-4 w-4 mr-1" />
                Configurar
              </a>
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
