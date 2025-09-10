"use client"

import { useAuth } from './auth-provider'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface MigrationResult {
  user_id: string
  email: string
  reservas_migradas: number
  timestamp: string
}

export function AutoMigrateBookings() {
  const { user, isAuthenticated } = useAuth()
  const [hasMigrated, setHasMigrated] = useState(false)
  const [isMigrating, setIsMigrating] = useState(false)

  useEffect(() => {
    // Executar migração automática quando usuário faz login
    const migrateBookings = async () => {
      if (!isAuthenticated || !user || hasMigrated || isMigrating) {
        return
      }

      setIsMigrating(true)

      try {
        console.log('🔄 Iniciando migração automática para:', user.email)

        // Chamar função de migração automática
        const { data, error } = await supabase.rpc('handle_user_login', {
          user_email: user.email
        })

        if (error) {
          console.error('❌ Erro na migração automática:', error)
          return
        }

        const result: MigrationResult = data

        console.log('✅ Migração automática concluída:', result)

        // Mostrar notificação apenas se reservas foram migradas
        if (result.reservas_migradas > 0) {
          toast.success(
            `Encontradas e associadas ${result.reservas_migradas} reserva(s) existente(s) à sua conta!`,
            {
              description: 'Suas reservas antigas agora estão disponíveis para edição.',
              duration: 6000,
            }
          )
        }

        setHasMigrated(true)

      } catch (error) {
        console.error('❌ Erro inesperado na migração:', error)
      } finally {
        setIsMigrating(false)
      }
    }

    migrateBookings()
  }, [isAuthenticated, user, hasMigrated, isMigrating])

  // Componente invisível - apenas executa a lógica
  return null
}

// Hook personalizado para migração manual (opcional)
export function useBookingMigration() {
  const { user } = useAuth()

  const migrateManually = async (): Promise<MigrationResult | null> => {
    if (!user) {
      throw new Error('Usuário não autenticado')
    }

    try {
      const { data, error } = await supabase.rpc('handle_user_login', {
        user_email: user.email
      })

      if (error) {
        throw error
      }

      return data as MigrationResult
    } catch (error) {
      console.error('Erro na migração manual:', error)
      throw error
    }
  }

  const getStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_migration_stats')

      if (error) {
        throw error
      }

      return data
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error)
      throw error
    }
  }

  return {
    migrateManually,
    getStats
  }
}
