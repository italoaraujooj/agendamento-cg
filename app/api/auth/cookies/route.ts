import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Obter todos os cookies da requisição
    const allCookies = request.cookies.getAll()
    
    // Filtrar cookies relacionados à autenticação
    const authCookies = allCookies.filter(cookie => 
      cookie.name.includes('auth') || 
      cookie.name.includes('sb-') || 
      cookie.name.includes('supabase')
    )

    // Informações de debug sobre cookies
    const cookieInfo = {
      total: allCookies.length,
      authCookies: authCookies.length,
      cookies: authCookies.map(cookie => ({
        name: cookie.name,
        hasValue: !!cookie.value,
        valueLength: cookie.value?.length || 0,
        valuePreview: cookie.value?.substring(0, 50) + (cookie.value?.length > 50 ? '...' : ''),
      })),
      allCookieNames: allCookies.map(cookie => cookie.name),
    }

    // Tentar criar cliente Supabase para verificar se os cookies funcionam
    let sessionInfo = null
    let sessionError = null

    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
        cookies: {
          get(name: string) {
            // Primeiro, tentar o cookie exato
            let cookieValue = request.cookies.get(name)?.value
            if (cookieValue) {
              return cookieValue
            }

            // Mapeamento específico para os cookies do projeto
            const cookieMapping: { [key: string]: string[] } = {
              'sb-nizgxljpvlhdabnrghqz-auth-token': [
                'sb-nizgxljpvlhdabnrghqz-auth-token-readable',
                'sb-nizgxljpvlhdabnrghqz-auth-token-test',
                'auth-token',
              ],
              'sb-nizgxljpvlhdabnrghqz-auth-token.0': [
                'sb-nizgxljpvlhdabnrghqz-auth-token-readable',
                'sb-nizgxljpvlhdabnrghqz-auth-token-test',
                'auth-token',
              ],
              'sb-nizgxljpvlhdabnrghqz-auth-token.1': [
                'sb-nizgxljpvlhdabnrghqz-auth-token-refresh',
              ],
            }

            // Verificar mapeamentos específicos
            const mappedCookies = cookieMapping[name] || []
            for (const mappedName of mappedCookies) {
              const mappedValue = request.cookies.get(mappedName)?.value
              if (mappedValue) {
                return mappedValue
              }
            }

            // Tentar variações genéricas
            const variations = [
              name.replace('-auth-token', '-auth-token-test'),
              name.replace('-auth-token', '-auth-token-readable'),
              name.replace('-auth-token', '-auth-token-refresh'),
              name.replace('sb-nizgxljpvlhdabnrghqz-auth-token', 'auth-token'),
              name + '.0',
              name + '.1',
              name + '.2',
            ]

            for (const variation of variations) {
              const variationValue = request.cookies.get(variation)?.value
              if (variationValue) {
                return variationValue
              }
            }

            return undefined
          },
          set() {
            // Não modificar cookies em GET
          },
          remove() {
            // Não modificar cookies em GET
          },
        },
        }
      )

      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        sessionError = error.message
      } else {
        sessionInfo = {
          hasSession: !!session,
          userId: session?.user?.id,
          userEmail: session?.user?.email,
          expiresAt: session?.expires_at,
          tokenType: session?.token_type,
        }
      }
    } catch (error) {
      sessionError = `Erro ao criar cliente Supabase: ${error}`
    }

    return NextResponse.json({
      cookieInfo,
      sessionInfo,
      sessionError,
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      },
    })

  } catch (error) {
    console.error('Erro na API de cookies:', error)
    return NextResponse.json(
      { error: 'Erro interno', message: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { action, cookieName, cookieValue } = body

    const response = NextResponse.json({ success: true })

    if (action === 'set' && cookieName && cookieValue) {
      // Definir cookie
      response.cookies.set({
        name: cookieName,
        value: cookieValue,
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 dias
      })

      return NextResponse.json({
        success: true,
        message: `Cookie ${cookieName} definido com sucesso`,
      })

    } else if (action === 'clear' && cookieName) {
      // Limpar cookie específico
      response.cookies.set({
        name: cookieName,
        value: '',
        maxAge: 0,
        path: '/',
      })

      return NextResponse.json({
        success: true,
        message: `Cookie ${cookieName} limpo com sucesso`,
      })

    } else if (action === 'clearAll') {
      // Limpar todos os cookies de autenticação
      const allCookies = request.cookies.getAll()
      const authCookies = allCookies.filter(cookie => 
        cookie.name.includes('auth') || 
        cookie.name.includes('sb-') || 
        cookie.name.includes('supabase')
      )

      authCookies.forEach(cookie => {
        response.cookies.set({
          name: cookie.name,
          value: '',
          maxAge: 0,
          path: '/',
        })
      })

      return NextResponse.json({
        success: true,
        message: `${authCookies.length} cookies de autenticação limpos`,
        clearedCookies: authCookies.map(c => c.name),
      })

    } else {
      return NextResponse.json(
        { error: 'Ação inválida', message: 'Ação não reconhecida ou parâmetros faltando' },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Erro na API de cookies POST:', error)
    return NextResponse.json(
      { error: 'Erro interno', message: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
