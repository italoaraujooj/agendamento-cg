import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface CalendarEvent {
  id?: string
  booking_id: string
  action: 'create' | 'update' | 'delete'
  summary: string
  description: string
  start_date: string
  end_date: string
  location?: string
  user_email: string
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { booking_id, action, summary, description, start_date, end_date, location, user_email } = await req.json()

    console.log('🎯 Sync Calendar Request:', { booking_id, action, user_email })

    // Buscar dados da reserva se não foram fornecidos
    let eventData = { summary, description, start_date, end_date, location }

    if (!summary) {
      const { data: booking } = await supabaseClient
        .from('bookings')
        .select('name, occasion, booking_date, start_time, end_time, blocks_all_environments, environments(name)')
        .eq('id', booking_id)
        .single()

      if (booking) {
        eventData = {
          summary: booking.name,
          description: `Ocasião: ${booking.occasion}`,
          start_date: `${booking.booking_date}T${booking.start_time}`,
          end_date: `${booking.booking_date}T${booking.end_time}`,
          location: booking.blocks_all_environments ? 'Igreja inteira' : booking.environments?.name || 'Local não informado'
        }
      }
    }

    // Primeiro, encontrar o ID do usuário pelo email
    const { data: userData } = await supabaseClient.auth.admin.getUserByEmail(user_email)

    if (!userData.user) {
      throw new Error('Usuário não encontrado')
    }

    const userId = userData.user.id

    // Buscar tokens de acesso do usuário na tabela profiles
    const { data: userProfile } = await supabaseClient
      .from('profiles')
      .select('google_access_token, google_refresh_token, google_token_expires_at, calendar_integration_enabled')
      .eq('id', userId)
      .single()

    if (!userProfile || !userProfile.google_access_token || !userProfile.calendar_integration_enabled) {
      throw new Error('Usuário não tem integração com Google Calendar habilitada')
    }

    // Verificar se o token está expirado e renovar se necessário
    const now = new Date()
    const tokenExpiry = userProfile.google_token_expires_at ? new Date(userProfile.google_token_expires_at) : null

    let accessToken = userProfile.google_access_token

    if (tokenExpiry && tokenExpiry <= now && userProfile.google_refresh_token) {
      console.log('🔄 Token expirado, renovando...')
      accessToken = await refreshGoogleToken(userProfile.google_refresh_token)

      // Atualizar token no banco usando a função
      await supabaseClient.rpc('store_google_oauth_token', {
        p_user_id: userId,
        p_access_token: accessToken,
        p_refresh_token: userProfile.google_refresh_token,
        p_expires_in: 3600 // 1 hora
      })
    }

    // Executar ação no Google Calendar
    let result
    switch (action) {
      case 'create':
        result = await createCalendarEvent(accessToken, eventData)
        break
      case 'update':
        result = await updateCalendarEvent(accessToken, eventData)
        break
      case 'delete':
        result = await deleteCalendarEvent(accessToken, eventData)
        break
      default:
        throw new Error(`Ação não suportada: ${action}`)
    }

    // Atualizar booking com ID do evento do Google Calendar
    if (action === 'create' && result?.eventId) {
      await supabaseClient
        .from('bookings')
        .update({
          google_event_id: result.eventId,
          synced_at: new Date().toISOString()
        })
        .eq('id', booking_id)
    }

    console.log('✅ Calendar sync completed:', result)

    return new Response(
      JSON.stringify({
        success: true,
        eventId: result?.eventId,
        action,
        booking_id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('❌ Calendar sync error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

// Função para criar evento no Google Calendar
async function createCalendarEvent(accessToken: string, eventData: any) {
  const calendarId = 'primary' // Usar calendário principal do usuário

  const event = {
    summary: eventData.summary,
    description: eventData.description,
    location: eventData.location,
    start: {
      dateTime: eventData.start_date,
      timeZone: 'America/Sao_Paulo'
    },
    end: {
      dateTime: eventData.end_date,
      timeZone: 'America/Sao_Paulo'
    },
    reminders: {
      useDefault: true
    }
  }

  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(event)
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Erro ao criar evento: ${error}`)
  }

  const data = await response.json()
  return { eventId: data.id, htmlLink: data.htmlLink }
}

// Função para atualizar evento no Google Calendar
async function updateCalendarEvent(accessToken: string, eventData: any) {
  // Implementar atualização
  console.log('📝 Update event:', eventData)
  return { success: true }
}

// Função para deletar evento no Google Calendar
async function deleteCalendarEvent(accessToken: string, eventData: any) {
  // Implementar deleção
  console.log('🗑️ Delete event:', eventData)
  return { success: true }
}

// Função para renovar token do Google
async function refreshGoogleToken(refreshToken: string): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  })

  if (!response.ok) {
    throw new Error('Erro ao renovar token do Google')
  }

  const data = await response.json()
  return data.access_token
}
