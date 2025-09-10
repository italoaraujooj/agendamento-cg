import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
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
            // Para API routes, não podemos modificar cookies diretamente
            // Os cookies serão gerenciados pelo middleware
          },
          remove(name: string, options: any) {
            // Para API routes, não podemos modificar cookies diretamente
          },
        },
      }
    )

    // Verificar se o usuário está autenticado
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Não autorizado', message: 'Usuário não autenticado' },
        { status: 401 }
      )
    }

    // Obter dados da requisição
    const body = await request.json()
    const { bookingId, action } = body

    if (!bookingId) {
      return NextResponse.json(
        { error: 'Dados inválidos', message: 'ID da reserva é obrigatório' },
        { status: 400 }
      )
    }

    // Buscar dados da reserva
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        environments (
          name,
          location
        )
      `)
      .eq('id', bookingId)
      .eq('user_id', session.user.id)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: 'Reserva não encontrada', message: 'Reserva não existe ou não pertence ao usuário' },
        { status: 404 }
      )
    }

    // Verificar se o usuário tem integração com Google Calendar
    const { data: integration, error: integrationError } = await supabase
      .from('user_google_integrations')
      .select('*')
      .eq('user_id', session.user.id)
      .single()

    if (integrationError || !integration) {
      return NextResponse.json(
        { error: 'Integração não encontrada', message: 'Usuário não possui integração com Google Calendar' },
        { status: 404 }
      )
    }

    // Verificar se o token ainda é válido
    const now = new Date()
    const expiresAt = new Date(integration.expires_at)
    
    if (now >= expiresAt) {
      // Token expirado - tentar renovar
      try {
        const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            refresh_token: integration.refresh_token,
            grant_type: 'refresh_token',
          }),
        })

        if (!refreshResponse.ok) {
          return NextResponse.json(
            { error: 'Token expirado', message: 'Não foi possível renovar o token de acesso' },
            { status: 401 }
          )
        }

        const refreshData = await refreshResponse.json()
        
        // Atualizar token no banco
        await supabase
          .from('user_google_integrations')
          .update({
            access_token: refreshData.access_token,
            expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
          })
          .eq('user_id', session.user.id)

        integration.access_token = refreshData.access_token
      } catch (refreshError) {
        console.error('Erro ao renovar token:', refreshError)
        return NextResponse.json(
          { error: 'Token expirado', message: 'Não foi possível renovar o token de acesso' },
          { status: 401 }
        )
      }
    }

    // Preparar dados do evento
    const startDateTime = new Date(`${booking.booking_date}T${booking.start_time}`)
    const endDateTime = new Date(`${booking.booking_date}T${booking.end_time}`)

    const event = {
      summary: `${booking.name} - ${booking.environments?.name}`,
      description: `Reserva: ${booking.name}\nLocal: ${booking.environments?.name}\nLocalização: ${booking.environments?.location}\nParticipantes: ${booking.estimated_participants}\n\nCriado via Sistema de Agendamento - Cidade Viva CG`,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: 'America/Sao_Paulo',
      },
      location: booking.environments?.location,
      attendees: [
        {
          email: session.user.email,
          displayName: session.user.user_metadata?.name || session.user.email,
        }
      ],
    }

    // Executar ação solicitada
    if (action === 'create') {
      // Criar evento no Google Calendar
      const calendarResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${integration.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      )

      if (!calendarResponse.ok) {
        const errorData = await calendarResponse.json()
        console.error('Erro na API do Google Calendar:', errorData)
        return NextResponse.json(
          { error: 'Erro no Google Calendar', message: 'Não foi possível criar o evento' },
          { status: 500 }
        )
      }

      const calendarEvent = await calendarResponse.json()

      // Atualizar reserva com ID do evento
      await supabase
        .from('bookings')
        .update({ google_event_id: calendarEvent.id })
        .eq('id', bookingId)

      return NextResponse.json({
        success: true,
        message: 'Evento criado no Google Calendar com sucesso',
        eventId: calendarEvent.id,
        eventLink: calendarEvent.htmlLink,
      })

    } else if (action === 'delete' && booking.google_event_id) {
      // Deletar evento do Google Calendar
      const deleteResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${booking.google_event_id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${integration.access_token}`,
          },
        }
      )

      if (!deleteResponse.ok && deleteResponse.status !== 404) {
        console.error('Erro ao deletar evento do Google Calendar')
        return NextResponse.json(
          { error: 'Erro no Google Calendar', message: 'Não foi possível deletar o evento' },
          { status: 500 }
        )
      }

      // Remover ID do evento da reserva
      await supabase
        .from('bookings')
        .update({ google_event_id: null })
        .eq('id', bookingId)

      return NextResponse.json({
        success: true,
        message: 'Evento removido do Google Calendar com sucesso',
      })
    }

    return NextResponse.json(
      { error: 'Ação inválida', message: 'Ação não reconhecida' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Erro na API sync-calendar:', error)
    return NextResponse.json(
      { error: 'Erro interno', message: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
