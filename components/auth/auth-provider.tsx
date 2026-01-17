"use client"

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  isAdmin: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  isAuthenticated: boolean
  refreshAdminStatus: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

// Timeout para operações de autenticação (em ms)
const AUTH_TIMEOUT = 10000

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const initializationRef = useRef(false)

  // Função para verificar se o usuário é admin com timeout
  const checkAdminStatus = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setIsAdmin(false)
      return
    }

    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout ao verificar admin')), 5000)
      })

      const queryPromise = supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .single()

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any

      if (error) {
        // Ignora erro se a tabela não existir ou perfil não encontrado
        if (error.code !== 'PGRST116' && error.code !== '42P01') {
          console.warn('Aviso ao verificar status de admin:', error.message)
        }
        setIsAdmin(false)
        return
      }

      setIsAdmin(data?.is_admin || false)
    } catch (err) {
      console.warn('Erro ao verificar status de admin:', err)
      setIsAdmin(false)
    }
  }, [])

  const refreshAdminStatus = useCallback(async () => {
    if (user?.id) {
      await checkAdminStatus(user.id)
    }
  }, [user?.id, checkAdminStatus])

  useEffect(() => {
    // Evita inicialização dupla
    if (initializationRef.current) return
    initializationRef.current = true

    let isMounted = true
    let timeoutId: NodeJS.Timeout

    const getInitialSession = async () => {
      try {
        // Timeout de segurança para evitar loading infinito
        timeoutId = setTimeout(() => {
          if (isMounted && loading) {
            console.warn('⚠️ Timeout ao carregar sessão, resetando estado...')
            setSession(null)
            setUser(null)
            setIsAdmin(false)
            setLoading(false)
          }
        }, AUTH_TIMEOUT)

        const { data: { session }, error } = await supabase.auth.getSession()

        if (!isMounted) return

        if (error) {
          console.error('❌ Erro ao obter sessão:', error.message)
          // Limpa sessão inválida
          setSession(null)
          setUser(null)
          setIsAdmin(false)
          setLoading(false)
          return
        }

        // Verifica se a sessão é válida (token não expirado)
        if (session) {
          const expiresAt = session.expires_at
          const now = Math.floor(Date.now() / 1000)
          
          if (expiresAt && expiresAt < now) {
            console.warn('⚠️ Sessão expirada, tentando refresh...')
            // Tenta refresh do token
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
            
            if (refreshError || !refreshData.session) {
              console.warn('⚠️ Falha no refresh, limpando sessão...')
              await supabase.auth.signOut()
              setSession(null)
              setUser(null)
              setIsAdmin(false)
              setLoading(false)
              return
            }
            
            // Usa a sessão atualizada
            setSession(refreshData.session)
            setUser(refreshData.session.user)
            await checkAdminStatus(refreshData.session.user?.id)
          } else {
            // Sessão válida
            setSession(session)
            setUser(session.user)
            await checkAdminStatus(session.user?.id)
          }
        } else {
          // Sem sessão
          setSession(null)
          setUser(null)
          setIsAdmin(false)
        }
      } catch (err) {
        console.error('❌ Erro inesperado ao carregar sessão:', err)
        if (isMounted) {
          setSession(null)
          setUser(null)
          setIsAdmin(false)
        }
      } finally {
        clearTimeout(timeoutId)
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (!isMounted) return

        console.log('🔄 Auth state changed:', event)

        if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
          setSession(null)
          setUser(null)
          setIsAdmin(false)
          setLoading(false)
          return
        }

        if (event === 'TOKEN_REFRESHED') {
          console.log('✅ Token atualizado')
        }

        setSession(session)
        setUser(session?.user ?? null)
        
        if (session?.user?.id) {
          await checkAdminStatus(session.user.id)
        } else {
          setIsAdmin(false)
        }
        
        setLoading(false)
      }
    )

    return () => {
      isMounted = false
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [checkAdminStatus])

  const signInWithGoogle = async () => {
    console.log('🔄 Iniciando login com Google...')
    setLoading(true)
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) {
        console.error('❌ Erro no login:', error.message)
        setLoading(false)
        throw error
      }
    } catch (err) {
      setLoading(false)
      throw err
    }
  }

  const signOut = async () => {
    console.log('🔄 Fazendo logout...')
    setLoading(true)
    
    try {
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('❌ Erro no logout:', error.message)
        // Mesmo com erro, limpa o estado local
      }
      
      // Limpa estado local independente do resultado
      setSession(null)
      setUser(null)
      setIsAdmin(false)
    } catch (err) {
      console.error('❌ Erro inesperado no logout:', err)
      // Limpa estado local mesmo em caso de erro
      setSession(null)
      setUser(null)
      setIsAdmin(false)
    } finally {
      setLoading(false)
    }
  }

  const value: AuthContextType = {
    user,
    session,
    loading,
    isAdmin,
    signInWithGoogle,
    signOut,
    isAuthenticated: !!user,
    refreshAdminStatus
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
