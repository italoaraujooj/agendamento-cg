import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  console.log('🔍 DEBUG: Verificando status do Google Calendar...')
  
  try {
    // Criar cliente Supabase
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll().map(cookie => ({
              name: cookie.name,
              value: cookie.value
            }))
          },
          setAll() {
            // Não precisamos setar cookies nesta API
          },
        },
      }
    )
    
    // Verificar sessão
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    console.log('🔐 Status da sessão:', {
      hasSession: !!session,
      userId: session?.user?.id,
      email: session?.user?.email,
      sessionError
    })

    if (!session) {
      return NextResponse.json({
        status: 'error',
        message: 'Usuário não autenticado',
        details: { sessionError }
      })
    }

    // Verificar perfil e tokens
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    console.log('👤 Status do perfil:', {
      hasProfile: !!profile,
      hasGoogleAccessToken: !!profile?.google_access_token,
      hasGoogleRefreshToken: !!profile?.google_refresh_token,
      calendarIntegrationEnabled: profile?.calendar_integration_enabled,
      tokenExpiry: profile?.google_token_expires_at,
      profileError
    })

    // Verificar se token expirou
    const isExpired = profile?.google_token_expires_at ? 
      new Date(profile.google_token_expires_at) <= new Date() : true

    console.log('⏰ Status do token:', {
      expiryDate: profile?.google_token_expires_at,
      isExpired,
      now: new Date().toISOString()
    })

    // Tentar fazer uma chamada simples para a API do Google
    let googleApiTest = null
    if (profile?.google_access_token && !isExpired) {
      try {
        console.log('🧪 Testando Google Calendar API...')
        const testResponse = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${profile.google_access_token}`,
            'Content-Type': 'application/json',
          }
        })

        googleApiTest = {
          status: testResponse.status,
          statusText: testResponse.statusText,
          ok: testResponse.ok
        }

        if (testResponse.ok) {
          const calendarInfo = await testResponse.json()
          googleApiTest.calendarSummary = calendarInfo.summary
        } else {
          const errorText = await testResponse.text()
          googleApiTest.error = errorText
        }

        console.log('📡 Resultado do teste da Google API:', googleApiTest)
      } catch (error) {
        console.log('❌ Erro no teste da Google API:', error)
        googleApiTest = { error: error.message }
      }
    }

    return NextResponse.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      session: {
        hasSession: !!session,
        userId: session.user.id,
        email: session.user.email
      },
      profile: {
        hasProfile: !!profile,
        hasGoogleAccessToken: !!profile?.google_access_token,
        hasGoogleRefreshToken: !!profile?.google_refresh_token,
        calendarIntegrationEnabled: profile?.calendar_integration_enabled,
        tokenExpiry: profile?.google_token_expires_at,
        isExpired
      },
      googleApiTest,
      errors: {
        sessionError,
        profileError
      }
    })

  } catch (error) {
    console.error('❌ Erro no debug:', error)
    return NextResponse.json({
      status: 'error',
      message: 'Erro interno no debug',
      error: error.message
    }, { status: 500 })
  }
}
