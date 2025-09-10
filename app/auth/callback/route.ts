import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { b64ToState, type ClientState } from '@/lib/google-oauth'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const next = searchParams.get('next') ?? '/'

  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error)
    
    // Specific handling for common OAuth errors
    if (error === 'redirect_uri_mismatch') {
      return NextResponse.redirect(`${origin}/debug-oauth?error=redirect_uri_mismatch&message=URL de redirecionamento não configurada corretamente no Google Cloud Console`)
    }
    
    return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${error}`)
  }

  if (code) {
    // Decodificar estado OAuth se presente
    let oauthState: any = null
    let returnUrl = '/'
    let isCustomOAuth = false

    if (state) {
      try {
        oauthState = b64ToState(state)
        returnUrl = oauthState.returnUrl || '/'
        isCustomOAuth = oauthState.provider === 'google' && oauthState.user_id
        console.log('📋 Estado OAuth decodificado:', { 
          provider: oauthState.provider, 
          returnUrl: returnUrl,
          user_id: oauthState.user_id,
          isCustomOAuth: isCustomOAuth
        })
      } catch (e) {
        console.warn('Failed to parse OAuth state:', e)
      }
    }

    // Se for nosso OAuth customizado, processar tokens e redirecionar
    if (isCustomOAuth) {
      console.log('🔄 Processando OAuth customizado...')
      return NextResponse.redirect(`${origin}${returnUrl}?code=${code}&state=${state}&oauth_type=custom`)
    }

    // Handle Supabase Auth callback normal
    const response = NextResponse.next()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            request.cookies.set({
              name,
              value,
              ...options,
            })
            response.cookies.set({
              name,
              value,
              ...options,
            })
          },
          remove(name: string, options: any) {
            request.cookies.set({
              name,
              value: '',
              ...options,
            })
            response.cookies.set({
              name,
              value: '',
              ...options,
            })
          },
        },
      }
    )

    console.log('🔄 Tentando trocar código por sessão...', {
      code: code.substring(0, 20) + '...',
      hasState: !!state,
      isCustomOAuth,
      returnUrl
    })

    const { error: authError, data } = await supabase.auth.exchangeCodeForSession(code)
    
    console.log('📋 Resultado do exchangeCodeForSession:', {
      hasError: !!authError,
      hasSession: !!data?.session,
      hasProviderToken: !!data?.session?.provider_token,
      hasRefreshToken: !!data?.session?.provider_refresh_token,
      provider: data?.session?.user?.app_metadata?.provider,
      errorMessage: authError?.message
    })

    if (!authError && data.session) {
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      
      console.log('✅ OAuth bem-sucedido, redirecionando para:', returnUrl)

      // Se não há estado customizado, tentar processar como OAuth direto do Google
      if (!isCustomOAuth && data.session.provider_token) {
        console.log('🔄 Processando OAuth direto do Google...', {
          userId: data.session.user.id,
          hasProviderToken: !!data.session.provider_token,
          hasRefreshToken: !!data.session.provider_refresh_token
        })
        
        try {
          // Armazenar tokens no banco de dados
          const { error: storeError } = await supabase.rpc('store_google_oauth_token', {
            p_user_id: data.session.user.id,
            p_access_token: data.session.provider_token,
            p_refresh_token: data.session.provider_refresh_token || null,
            p_expires_in: 3600, // 1 hora padrão
          })

          if (!storeError) {
            console.log('💾 Tokens do OAuth direto armazenados com sucesso!')
          } else {
            console.error('❌ Erro ao armazenar tokens diretos:', storeError)
          }
        } catch (error) {
          console.error('❌ Erro ao processar OAuth direto:', error)
        }
      } else if (!isCustomOAuth) {
        console.warn('⚠️ OAuth direto mas sem provider_token na sessão')
      }

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${returnUrl}?integration=success`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${returnUrl}?integration=success`)
      } else {
        return NextResponse.redirect(`${origin}${returnUrl}?integration=success`)
      }
    } else {
      console.error('❌ Erro no OAuth:', {
        error: authError,
        hasData: !!data,
        hasSession: !!data?.session
      })
      return NextResponse.redirect(`${origin}${returnUrl}?integration=error&error_details=${encodeURIComponent(authError?.message || 'Unknown error')}`)
    }
  }

  // Return to error page
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
