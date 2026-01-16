import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now()

    // Verificar variáveis de ambiente essenciais
    const envCheck = {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
      NODE_ENV: process.env.NODE_ENV,
    }

    // Verificar conexão com Supabase
    let supabaseStatus = 'unknown'
    let supabaseError = null
    let sessionCheck = null

    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return request.cookies.get(name)?.value
            },
            set() {
              // Não modificar cookies em health check
            },
            remove() {
              // Não modificar cookies em health check
            },
          },
        }
      )

      // Tentar fazer uma query simples para testar a conexão
      const { data, error } = await supabase
        .from('environments')
        .select('count')
        .limit(1)

      if (error) {
        supabaseStatus = 'error'
        supabaseError = error.message
      } else {
        supabaseStatus = 'connected'
        
        // Verificar também se há uma sessão ativa
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        sessionCheck = {
          hasSession: !!session,
          sessionError: sessionError?.message || null,
          userId: session?.user?.id || null,
        }
      }
    } catch (error) {
      supabaseStatus = 'error'
      supabaseError = `Erro de conexão: ${error}`
    }

    // Verificar cookies de autenticação
    const allCookies = request.cookies.getAll()
    const authCookies = allCookies.filter(cookie => 
      cookie.name.includes('auth') || 
      cookie.name.includes('sb-') || 
      cookie.name.includes('supabase')
    )

    const endTime = Date.now()
    const responseTime = endTime - startTime

    // Determinar status geral
    const isHealthy = supabaseStatus === 'connected' && envCheck.NEXT_PUBLIC_SUPABASE_URL && envCheck.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const status = isHealthy ? 'healthy' : 'unhealthy'

    return NextResponse.json({
      status,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      environment: envCheck,
      supabase: {
        status: supabaseStatus,
        error: supabaseError,
      },
      session: sessionCheck,
      cookies: {
        total: allCookies.length,
        authCookies: authCookies.length,
        authCookieNames: authCookies.map(c => c.name),
      },
      version: '1.0.0',
    }, {
      status: isHealthy ? 200 : 503,
    })

  } catch (error) {
    console.error('Erro no health check:', error)
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Erro interno do servidor',
      message: String(error),
    }, {
      status: 500,
    })
  }
}
