import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.json({ success: true, message: 'Logout realizado com sucesso' })

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

    // Fazer logout no Supabase (isso vai limpar os cookies automaticamente)
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Erro no logout:', error.message)
      return NextResponse.json(
        { error: 'Erro no logout', message: error.message },
        { status: 500 }
      )
    }

    // Limpar cookies manualmente para garantir
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

    // Também limpar possíveis variações dos cookies do Supabase
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

    return response

  } catch (error) {
    console.error('Erro na API de logout:', error)
    return NextResponse.json(
      { error: 'Erro interno', message: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// Permitir também método GET para logout via link
export async function GET(request: NextRequest) {
  return POST(request)
}
