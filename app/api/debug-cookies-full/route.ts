import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 FULL-COOKIE-DEBUG - Iniciando debug completo...')
    
    // Obter todos os headers da requisição
    const headers = Object.fromEntries(request.headers.entries())
    
    // Obter informações sobre cookies da requisição
    const cookieHeader = request.headers.get('cookie')
    const allCookies = request.cookies.getAll()
    
    console.log('🔍 FULL-COOKIE-DEBUG - Cookie header:', cookieHeader)
    console.log('🔍 FULL-COOKIE-DEBUG - Parsed cookies:', allCookies)
    
    // Analisar o header Cookie manualmente
    let manualParsedCookies: Array<{name: string, value: string}> = []
    if (cookieHeader) {
      manualParsedCookies = cookieHeader
        .split(';')
        .map(cookie => {
          const [name, ...valueParts] = cookie.trim().split('=')
          return {
            name: name.trim(),
            value: valueParts.join('=').trim()
          }
        })
        .filter(cookie => cookie.name && cookie.value)
    }
    
    // Filtrar cookies de autenticação
    const authCookiesFromHeader = manualParsedCookies.filter(c => 
      c.name.includes('auth') || c.name.includes('sb-') || c.name.includes('supabase')
    )
    
    const authCookiesFromParsed = allCookies.filter(c => 
      c.name.includes('auth') || c.name.includes('sb-') || c.name.includes('supabase')
    )

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      requestInfo: {
        url: request.url,
        method: request.method,
        userAgent: headers['user-agent'] || null,
        host: headers['host'] || null,
        origin: headers['origin'] || null,
        referer: headers['referer'] || null,
      },
      cookieAnalysis: {
        hasCookieHeader: !!cookieHeader,
        cookieHeaderLength: cookieHeader?.length || 0,
        cookieHeaderRaw: cookieHeader,
        manualParsedCount: manualParsedCookies.length,
        nextJsParsedCount: allCookies.length,
        authCookiesInHeader: authCookiesFromHeader.length,
        authCookiesInParsed: authCookiesFromParsed.length,
      },
      cookies: {
        fromHeader: manualParsedCookies.map(c => ({
          name: c.name,
          hasValue: !!c.value,
          valueLength: c.value?.length || 0,
          valuePreview: c.value?.substring(0, 50) + (c.value?.length > 50 ? '...' : ''),
          isAuth: c.name.includes('auth') || c.name.includes('sb-') || c.name.includes('supabase'),
        })),
        fromNextJs: allCookies.map(c => ({
          name: c.name,
          hasValue: !!c.value,
          valueLength: c.value?.length || 0,
          valuePreview: c.value?.substring(0, 50) + (c.value?.length > 50 ? '...' : ''),
          isAuth: c.name.includes('auth') || c.name.includes('sb-') || c.name.includes('supabase'),
        })),
      },
      authCookiesFound: {
        fromHeader: authCookiesFromHeader,
        fromParsed: authCookiesFromParsed,
      },
      headers: {
        cookie: headers['cookie'] || null,
        authorization: headers['authorization'] || null,
        'x-forwarded-for': headers['x-forwarded-for'] || null,
        'x-real-ip': headers['x-real-ip'] || null,
      },
      diagnosis: {
        cookiesBeingSent: !!cookieHeader && cookieHeader.length > 0,
        authCookiesBeingSent: authCookiesFromHeader.length > 0,
        nextJsCanParseCookies: allCookies.length > 0,
        possibleIssues: [
          ...(!cookieHeader ? ['Nenhum header Cookie enviado pelo navegador'] : []),
          ...(cookieHeader && !authCookiesFromHeader.length ? ['Header Cookie presente, mas sem cookies de auth'] : []),
          ...(authCookiesFromHeader.length !== authCookiesFromParsed.length ? ['Discrepância entre parsing manual e Next.js'] : []),
          ...(allCookies.length === 0 ? ['Next.js não consegue parsear cookies'] : []),
        ],
      },
      recommendations: [
        ...((!cookieHeader) ? ['Verificar se cookies estão sendo definidos no navegador'] : []),
        ...(cookieHeader && !authCookiesFromHeader.length ? ['Verificar configuração de domínio/path dos cookies'] : []),
        ...(authCookiesFromHeader.length > 0 ? ['Cookies de auth estão chegando - problema pode estar no Supabase'] : []),
      ],
    })

  } catch (error) {
    console.error('🔍 FULL-COOKIE-DEBUG - Erro:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro no debug completo',
      message: String(error),
      timestamp: new Date().toISOString(),
    }, {
      status: 500,
    })
  }
}

export async function POST(request: NextRequest) {
  // Endpoint para definir cookies de teste
  try {
    const body = await request.json().catch(() => ({}))
    const { testCookies = false } = body

    const response = NextResponse.json({
      success: true,
      message: 'Cookies de teste definidos',
      timestamp: new Date().toISOString(),
    })

    if (testCookies) {
      // Definir cookies de teste com diferentes configurações
      const testCookieConfigs = [
        {
          name: 'test-cookie-basic',
          value: 'basic-value',
          path: '/',
        },
        {
          name: 'test-cookie-secure',
          value: 'secure-value',
          path: '/',
          httpOnly: true,
          secure: false, // false para localhost
          sameSite: 'lax' as const,
        },
        {
          name: 'test-auth-token',
          value: 'test-auth-value-123',
          path: '/',
          maxAge: 60 * 60, // 1 hora
        },
      ]

      testCookieConfigs.forEach(config => {
        response.cookies.set(config)
      })

      console.log('🔍 FULL-COOKIE-DEBUG - Cookies de teste definidos')
    }

    return response

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Erro ao definir cookies de teste',
      message: String(error),
    }, {
      status: 500,
    })
  }
}
