import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
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
            // Para API routes GET, não modificamos cookies
          },
          remove(name: string, options: any) {
            // Para API routes GET, não modificamos cookies
          },
        },
      }
    )

    // Obter sessão atual
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error) {
      console.error('Erro ao obter sessão:', error.message)
      return NextResponse.json(
        { 
          error: 'Erro de sessão', 
          message: error.message,
          session: null,
          user: null,
          isAuthenticated: false,
        },
        { status: 401 }
      )
    }

    // Retornar informações da sessão
    return NextResponse.json({
      session: session ? {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        expires_in: session.expires_in,
        token_type: session.token_type,
      } : null,
      user: session?.user ? {
        id: session.user.id,
        email: session.user.email,
        user_metadata: session.user.user_metadata,
        app_metadata: session.user.app_metadata,
        created_at: session.user.created_at,
        updated_at: session.user.updated_at,
      } : null,
      isAuthenticated: !!session,
      message: session ? 'Sessão válida' : 'Nenhuma sessão ativa',
    })

  } catch (error) {
    console.error('Erro na API de sessão:', error)
    return NextResponse.json(
      { 
        error: 'Erro interno', 
        message: 'Erro interno do servidor',
        session: null,
        user: null,
        isAuthenticated: false,
      },
      { status: 500 }
    )
  }
}

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

    // Obter dados do body para possível refresh
    const body = await request.json().catch(() => ({}))
    const { refreshToken } = body

    if (refreshToken) {
      // Tentar fazer refresh da sessão
      const { data: { session }, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken
      })

      if (error) {
        return NextResponse.json(
          { error: 'Erro no refresh', message: error.message },
          { status: 401 }
        )
      }

      return NextResponse.json({
        session: session ? {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
          expires_in: session.expires_in,
          token_type: session.token_type,
        } : null,
        user: session?.user,
        isAuthenticated: !!session,
        message: 'Sessão renovada com sucesso',
      })
    }

    // Se não há refresh token, apenas retornar sessão atual
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error) {
      return NextResponse.json(
        { error: 'Erro de sessão', message: error.message },
        { status: 401 }
      )
    }

    return NextResponse.json({
      session: session ? {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        expires_in: session.expires_in,
        token_type: session.token_type,
      } : null,
      user: session?.user,
      isAuthenticated: !!session,
      message: session ? 'Sessão válida' : 'Nenhuma sessão ativa',
    })

  } catch (error) {
    console.error('Erro na API de sessão POST:', error)
    return NextResponse.json(
      { error: 'Erro interno', message: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
