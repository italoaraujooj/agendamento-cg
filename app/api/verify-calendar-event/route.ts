import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

interface VerifyEventRequest {
  eventId?: string
  startDate?: string // YYYY-MM-DD
  endDate?: string   // YYYY-MM-DD
  searchTerm?: string // Para buscar por título do evento
}

export async function POST(request: NextRequest) {
  try {
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
    
    // Verificar autenticação
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Não autorizado - sessão não encontrada' },
        { status: 401 }
      )
    }

    const providerToken = session.provider_token
    if (!providerToken) {
      return NextResponse.json(
        { error: 'Token do Google não encontrado. Faça login novamente.' },
        { status: 401 }
      )
    }

    const body: VerifyEventRequest = await request.json()
    const { eventId, startDate, endDate, searchTerm } = body

    // Se um eventId específico foi fornecido, buscar por ele
    if (eventId) {
      console.log('🔍 Verificando evento específico:', eventId)
      
      const eventResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
        {
          headers: {
            'Authorization': `Bearer ${providerToken}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (eventResponse.ok) {
        const event = await eventResponse.json()
        return NextResponse.json({
          success: true,
          found: true,
          event: {
            id: event.id,
            summary: event.summary,
            description: event.description,
            start: event.start,
            end: event.end,
            htmlLink: event.htmlLink,
            status: event.status
          }
        })
      } else if (eventResponse.status === 404) {
        return NextResponse.json({
          success: true,
          found: false,
          message: 'Evento não encontrado no Google Calendar'
        })
      } else {
        const errorText = await eventResponse.text()
        console.error('❌ Erro ao verificar evento:', errorText)
        return NextResponse.json(
          { error: 'Erro ao verificar evento no Google Calendar' },
          { status: eventResponse.status }
        )
      }
    }

    // Buscar eventos em um período ou por termo de busca
    let searchUrl = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
    const searchParams = new URLSearchParams({
      maxResults: '50',
      singleEvents: 'true',
      orderBy: 'startTime'
    })

    if (startDate) {
      searchParams.append('timeMin', `${startDate}T00:00:00Z`)
    }
    if (endDate) {
      searchParams.append('timeMax', `${endDate}T23:59:59Z`)
    }
    if (searchTerm) {
      searchParams.append('q', searchTerm)
    }

    searchUrl += '?' + searchParams.toString()

    console.log('🔍 Buscando eventos no período:', { startDate, endDate, searchTerm })

    const listResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${providerToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!listResponse.ok) {
      const errorText = await listResponse.text()
      console.error('❌ Erro ao listar eventos:', errorText)
      return NextResponse.json(
        { error: 'Erro ao listar eventos do Google Calendar' },
        { status: listResponse.status }
      )
    }

    const listData = await listResponse.json()
    const events = listData.items || []

    return NextResponse.json({
      success: true,
      found: events.length > 0,
      count: events.length,
      events: events.map((event: any) => ({
        id: event.id,
        summary: event.summary,
        description: event.description,
        start: event.start,
        end: event.end,
        htmlLink: event.htmlLink,
        status: event.status
      }))
    })

  } catch (error) {
    console.error('❌ Erro interno ao verificar eventos:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}

// Método GET para verificação rápida via URL
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get('eventId')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  
  // Redirecionar para o método POST com os mesmos parâmetros
  return POST(new NextRequest(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify({
      eventId,
      startDate,
      endDate
    })
  }))
}
