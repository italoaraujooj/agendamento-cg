import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  
  console.log('🔄 Auth callback iniciado:', { hasCode: !!code, hasError: !!error })

  // Handle OAuth errors
  if (error) {
    console.error('❌ OAuth error:', error)
    return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${error}`)
  }

  if (code) {
    const response = NextResponse.redirect(`${origin}/`)
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            response.cookies.set({
              name,
              value,
              ...options,
            })
          },
          remove(name: string, options: any) {
            response.cookies.set({
              name,
              value: '',
              ...options,
            })
          },
        },
      }
    )

    console.log('🔄 Trocando código por sessão...')

    const { error, data } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('❌ Erro na troca do código:', error)
      return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${error.message}`)
    }

    console.log('✅ Login realizado com sucesso!')

    // Se há provider_token, armazenar no banco para Google Calendar
    if (data.session?.provider_token) {
      console.log('🔄 Armazenando tokens do Google Calendar...')
      try {
        const { error: storeError } = await supabase.rpc('store_google_oauth_token', {
          p_user_id: data.session.user.id,
          p_access_token: data.session.provider_token,
          p_refresh_token: data.session.provider_refresh_token || null,
          p_expires_in: 3600,
        })

        if (!storeError) {
          console.log('💾 Tokens do Google Calendar armazenados!')
        } else {
          console.error('❌ Erro ao armazenar tokens:', storeError)
        }
      } catch (error) {
        console.error('❌ Erro ao processar tokens:', error)
      }
    }

    return response
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
