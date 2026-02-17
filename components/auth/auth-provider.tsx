"use client"

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User, Session, AuthChangeEvent, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'Invalid login credentials': 'Email ou senha incorretos',
  'Email not confirmed': 'Email ainda não foi confirmado. Verifique sua caixa de entrada.',
  'User already registered': 'Este email já está cadastrado',
  'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres',
  'Unable to validate email address: invalid format': 'Formato de email inválido',
  'Email rate limit exceeded': 'Muitas tentativas. Aguarde alguns minutos.',
  'For security purposes, you can only request this once every 60 seconds': 'Por segurança, aguarde 60 segundos antes de tentar novamente.',
}

function translateAuthError(error: AuthError): string {
  return AUTH_ERROR_MESSAGES[error.message] || error.message
}

interface MinistryRole {
  ministry_id: string
  role: string
}

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  isAdmin: boolean
  adminChecked: boolean // Indica se a verificação de admin foi concluída
  ministryRoles: MinistryRole[]
  isMinistryLeader: (ministryId: string) => boolean
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string) => Promise<void>
  resetPassword: (email: string) => Promise<void>
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

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminChecked, setAdminChecked] = useState(false)
  const [ministryRoles, setMinistryRoles] = useState<MinistryRole[]>([])
  const [initialized, setInitialized] = useState(false)

  // Função para verificar se o usuário é admin e buscar roles de ministério
  const checkAdminStatus = useCallback(async (userId: string | undefined) => {
    setAdminChecked(false)

    if (!userId) {
      setIsAdmin(false)
      setMinistryRoles([])
      setAdminChecked(true)
      return
    }

    try {
      // Timeout com Promise.race
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 5000)
      })

      const fetchAll = async () => {
        const [profileResult, rolesResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', userId)
            .single(),
          supabase
            .from('user_ministry_roles')
            .select('ministry_id, role')
            .eq('user_id', userId),
        ])
        return { profileResult, rolesResult }
      }

      const result = await Promise.race([fetchAll(), timeoutPromise])

      if (!result) {
        // Timeout
        setIsAdmin(false)
        setMinistryRoles([])
        setAdminChecked(true)
        return
      }

      const { profileResult, rolesResult } = result

      if (profileResult.error) {
        setIsAdmin(false)
      } else {
        setIsAdmin(profileResult.data?.is_admin || false)
      }

      if (rolesResult.error) {
        setMinistryRoles([])
      } else {
        setMinistryRoles(rolesResult.data || [])
      }
    } catch (err) {
      console.warn('Erro ao verificar admin:', err)
      setIsAdmin(false)
      setMinistryRoles([])
    } finally {
      setAdminChecked(true)
    }
  }, [])

  const refreshAdminStatus = useCallback(async () => {
    if (user?.id) {
      await checkAdminStatus(user.id)
    }
  }, [user?.id, checkAdminStatus])

  const isMinistryLeader = useCallback((ministryId: string) => {
    return ministryRoles.some(r => r.ministry_id === ministryId)
  }, [ministryRoles])

  // Inicialização - executar apenas uma vez
  useEffect(() => {
    if (initialized) return

    let isMounted = true

    const initialize = async () => {
      console.log('🔄 Inicializando autenticação...')
      
      try {
        // Timeout de segurança
        const timeoutPromise = new Promise<null>((resolve) => {
          setTimeout(() => {
            console.warn('⚠️ Timeout na inicialização')
            resolve(null)
          }, 8000)
        })

        const sessionPromise = supabase.auth.getSession().then(({ data }) => data.session)

        const session = await Promise.race([sessionPromise, timeoutPromise])

        if (!isMounted) return

        if (session) {
          console.log('✅ Sessão encontrada')
          setSession(session)
          setUser(session.user)
          await checkAdminStatus(session.user?.id)
        } else {
          console.log('ℹ️ Sem sessão ativa')
          setSession(null)
          setUser(null)
          setIsAdmin(false)
          setMinistryRoles([])
          setAdminChecked(true)
        }
      } catch (err) {
        console.error('❌ Erro na inicialização:', err)
        if (isMounted) {
          setSession(null)
          setUser(null)
          setIsAdmin(false)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
          setInitialized(true)
        }
      }
    }

    initialize()

    // Listener para mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, newSession: Session | null) => {
        if (!isMounted) return

        console.log('🔄 Auth event:', event)

        // Eventos de logout
        if (event === 'SIGNED_OUT') {
          setSession(null)
          setUser(null)
          setIsAdmin(false)
          setMinistryRoles([])
          setAdminChecked(true)
          setLoading(false)
          return
        }

        // Atualiza sessão
        setSession(newSession)
        setUser(newSession?.user ?? null)

        if (newSession?.user?.id) {
          // Aguardar verificação de admin para evitar race condition
          await checkAdminStatus(newSession.user.id)
        } else {
          setIsAdmin(false)
          setAdminChecked(true)
        }

        setLoading(false)
      }
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [initialized, checkAdminStatus])

  const signInWithGoogle = async () => {
    console.log('🔄 Iniciando login com Google...')

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
      console.error('❌ Erro no login:', error.message)
      throw error
    }
    // Não seta loading aqui pois vai redirecionar
  }

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      throw new Error(translateAuthError(error))
    }
  }

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      throw new Error(translateAuthError(error))
    }
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/resetar-senha`,
    })
    if (error) {
      throw new Error(translateAuthError(error))
    }
  }

  const signOut = async () => {
    console.log('🔄 Fazendo logout...')
    
    // Limpa estado local primeiro para UI responsiva
    setSession(null)
    setUser(null)
    setIsAdmin(false)
    setMinistryRoles([])
    
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('Erro no logout:', err)
      // Estado já foi limpo, então ignora
    }
  }

  const value: AuthContextType = {
    user,
    session,
    loading,
    isAdmin,
    adminChecked,
    ministryRoles,
    isMinistryLeader,
    signInWithGoogle,
    signInWithEmail,
    signUp,
    resetPassword,
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
