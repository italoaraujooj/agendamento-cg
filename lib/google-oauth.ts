import { Session } from '@supabase/supabase-js'

// Escopos necessários para integração completa com Google Calendar
const GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.calendarlist",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
]

export interface ClientState {
  session?: Session
  returnUrl?: string
  provider: string
  user_id?: string
}

/**
 * Converte o estado do cliente para Base64
 */
export function stateToB64(state: ClientState): string {
  return btoa(JSON.stringify(state))
}

/**
 * Converte Base64 de volta para o estado do cliente
 */
export function b64ToState(b64State: string): ClientState {
  try {
    return JSON.parse(atob(b64State))
  } catch (error) {
    console.error('Erro ao decodificar estado OAuth:', error)
    return { provider: 'google' }
  }
}

/**
 * Obtém o hostname atual
 */
export function getHostName(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  
  // Para uso no servidor
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
}

/**
 * Gera URL para OAuth do Google Calendar com configurações otimizadas
 */
export function getGoogleCalendarOAuthUrl(state: ClientState): string {
  const params = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID || "",
    redirect_uri: `${getHostName()}/auth/callback`, // Usar callback existente que já está configurado
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPES.join(" "),
    prompt: "consent", // Força nova autorização para garantir todos os escopos
    access_type: "offline", // Para obter refresh token
    state: stateToB64(state),
    include_granted_scopes: "true", // Inclui escopos já autorizados
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

/**
 * Gera URL para OAuth do Google com prompt específico
 */
export function getGoogleOAuthUrlWithPrompt(
  state: ClientState,
  prompt: 'none' | 'consent' | 'select_account' = 'consent'
): string {
  const params = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID || "",
    redirect_uri: `${getHostName()}/auth/callback`,
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPES.join(" "),
    prompt,
    access_type: "offline",
    state: stateToB64(state),
    include_granted_scopes: "true",
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

/**
 * Verifica se todos os escopos necessários estão presentes
 */
export function hasRequiredScopes(grantedScopes: string): boolean {
  const granted = grantedScopes.toLowerCase().split(' ')
  const required = GOOGLE_CALENDAR_SCOPES.map(scope => scope.toLowerCase())
  
  return required.every(scope => 
    granted.some(grantedScope => grantedScope.includes(scope))
  )
}

/**
 * Obtém escopos em falta
 */
export function getMissingScopes(grantedScopes: string): string[] {
  const granted = grantedScopes.toLowerCase().split(' ')
  const required = GOOGLE_CALENDAR_SCOPES.map(scope => scope.toLowerCase())
  
  return required.filter(scope => 
    !granted.some(grantedScope => grantedScope.includes(scope))
  )
}

/**
 * Constantes para configuração
 */
export const OAUTH_CONFIG = {
  SCOPES: GOOGLE_CALENDAR_SCOPES,
  PROMPT_TYPES: {
    NONE: 'none' as const,
    CONSENT: 'consent' as const,
    SELECT_ACCOUNT: 'select_account' as const,
  }
} as const
