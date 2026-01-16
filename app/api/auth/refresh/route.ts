import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.json({ success: true })

    // Criar cliente Supabase para API routes
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
              maxAge: 0,
            })
          },
        },
      }
    )

    // Obter refresh token do body ou dos cookies
    const body = await request.json().catch(() => ({}))
    let { refreshToken } = body

    // Se não foi fornecido no body, tentar obter da sessão atual
    if (!refreshToken) {
      const { data: { session } } = await supabase.auth.getSession()
      refreshToken = session?.refresh_token
    }

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Token não encontrado', message: 'Refresh token não fornecido ou não encontrado' },
        { status: 400 }
      )
    }

    // Fazer refresh da sessão
    const { data: { session }, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken
    })

    if (error) {
      console.error('Erro no refresh da sessão:', error.message)
      
      // Se o refresh token é inválido, limpar cookies
      if (error.message.includes('refresh_token') || error.message.includes('invalid')) {
        const cookiesToClear = [
          'sb-access-token',
          'sb-refresh-token',
          'supabase-auth-token',
          'supabase.auth.token',
        ]

        cookiesToClear.forEach(cookieName => {
          response.cookies.set({
            name: cookieName,
            value: '',
            maxAge: 0,
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
          })
        })

        // Limpar cookies específicos do projeto Supabase
        const supabaseProjectId = process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0]
        if (supabaseProjectId) {
          const projectCookies = [
            `sb-${supabaseProjectId}-auth-token`,
            `sb-${supabaseProjectId}-auth-token.0`,
            `sb-${supabaseProjectId}-auth-token.1`,
          ]

          projectCookies.forEach(cookieName => {
            response.cookies.set({
              name: cookieName,
              value: '',
              maxAge: 0,
              path: '/',
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
            })
          })
        }
      }

      return NextResponse.json(
        { error: 'Erro no refresh', message: error.message },
        { status: 401 }
      )
    }

    if (!session) {
      return NextResponse.json(
        { error: 'Sessão inválida', message: 'Não foi possível renovar a sessão' },
        { status: 401 }
      )
    }

    // Retornar nova sessão
    return NextResponse.json({
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        expires_in: session.expires_in,
        token_type: session.token_type,
      },
      user: {
        id: session.user.id,
        email: session.user.email,
        user_metadata: session.user.user_metadata,
        app_metadata: session.user.app_metadata,
        created_at: session.user.created_at,
        updated_at: session.user.updated_at,
      },
      isAuthenticated: true,
      message: 'Sessão renovada com sucesso',
    })

  } catch (error) {
    console.error('Erro na API de refresh:', error)
    return NextResponse.json(
      { error: 'Erro interno', message: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
