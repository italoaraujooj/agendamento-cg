import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

interface CreateEventRequest {
  eventTitle: string
  eventDescription?: string
  startTime: string // ISO string
  endTime: string   // ISO string
}

interface GoogleCalendarEvent {
  summary: string
  description?: string
  start: {
    dateTime: string
    timeZone: string
  }
  end: {
    dateTime: string
    timeZone: string
  }
}

export async function POST(request: NextRequest) {
  try {
    // Criar cliente Supabase para obter a sessão
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
    
    // Verificar se o usuário está autenticado
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Não autorizado - sessão não encontrada' },
        { status: 401 }
      )
    }

    // Buscar tokens do Google no banco de dados
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('google_access_token, google_refresh_token, google_token_expires_at, calendar_integration_enabled')
      .eq('id', session.user.id)
      .single()

    if (profileError) {
      return NextResponse.json(
        { error: 'Erro ao buscar dados do perfil' },
        { status: 500 }
      )
    }

    if (!profile?.google_access_token || !profile?.calendar_integration_enabled) {
      return NextResponse.json(
        { error: 'Google Calendar não está conectado. Conecte sua conta primeiro.' },
        { status: 401 }
      )
    }

    // Verificar se token não expirou
    const isExpired = profile.google_token_expires_at ? 
      new Date(profile.google_token_expires_at) <= new Date() : false

    if (isExpired) {
      return NextResponse.json(
        { error: 'Token do Google expirou. Reconecte sua conta.' },
        { status: 401 }
      )
    }

    const providerToken = profile.google_access_token

    // Obter dados da requisição
    const body: CreateEventRequest = await request.json()
    const { eventTitle, eventDescription, startTime, endTime } = body

    // Validar dados obrigatórios
    if (!eventTitle || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Campos obrigatórios não fornecidos: eventTitle, startTime, endTime' },
        { status: 400 }
      )
    }

    // Montar objeto do evento para a API do Google Calendar
    const calendarEvent: GoogleCalendarEvent = {
      summary: eventTitle,
      description: eventDescription || '',
      start: {
        dateTime: startTime,
        timeZone: 'America/Sao_Paulo'
      },
      end: {
        dateTime: endTime,
        timeZone: 'America/Sao_Paulo'
      }
    }

    // Fazer chamada para a API do Google Calendar
    const googleResponse = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${providerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(calendarEvent)
    })

    if (!googleResponse.ok) {
      const errorText = await googleResponse.text()
      
      // Tratar erros específicos
      if (googleResponse.status === 401) {
        return NextResponse.json(
          { error: 'Token do Google expirado. Faça login novamente.' },
          { status: 401 }
        )
      }
      
      if (googleResponse.status === 403) {
        return NextResponse.json(
          { error: 'Acesso negado à API do Google Calendar. Verifique as permissões.' },
          { status: 403 }
        )
      }

      return NextResponse.json(
        { error: 'Falha ao criar evento no Google Calendar', details: errorText },
        { status: googleResponse.status }
      )
    }

    const createdEvent = await googleResponse.json()

    return NextResponse.json({
      success: true,
      message: 'Evento criado com sucesso no Google Calendar!',
      event: {
        id: createdEvent.id,
        htmlLink: createdEvent.htmlLink,
        summary: createdEvent.summary,
        start: createdEvent.start,
        end: createdEvent.end
      }
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}
