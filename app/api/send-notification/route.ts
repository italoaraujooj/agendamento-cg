import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/server'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
const APP_NAME = 'Sistema de Agendamento - Cidade Viva CG'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://agendamento-cg.vercel.app'

interface BookingData {
  id: string
  name: string
  email: string
  phone: string
  ministry_network: string
  estimated_participants: number
  responsible_person: string
  occasion: string
  booking_date: string
  start_time: string
  end_time: string
  environment_name?: string
}

interface NotificationPayload {
  type: 'new_booking' | 'booking_approved' | 'booking_rejected'
  booking: BookingData
  adminNotes?: string
}

// Formatar data para exibição
const formatDate = (dateString: string): string => {
  const [year, month, day] = dateString.split('-')
  return `${day}/${month}/${year}`
}

// Formatar horário para exibição
const formatTime = (timeString: string): string => {
  return timeString.slice(0, 5)
}

// Template HTML para nova reserva (enviado aos admins)
const newBookingEmailTemplate = (booking: BookingData): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nova Solicitação de Reserva</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">📅 Nova Solicitação de Reserva</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="color: #374151; font-size: 16px; margin: 0 0 20px;">
                Uma nova solicitação de reserva foi recebida e aguarda sua aprovação.
              </p>
              
              <!-- Booking Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <tr>
                  <td>
                    <h3 style="color: #1f2937; margin: 0 0 15px; font-size: 18px;">Detalhes da Reserva</h3>
                    
                    <table width="100%" cellpadding="5" cellspacing="0">
                      <tr>
                        <td style="color: #6b7280; width: 140px;">Solicitante:</td>
                        <td style="color: #1f2937; font-weight: 600;">${booking.name}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280;">Ambiente:</td>
                        <td style="color: #1f2937; font-weight: 600;">${booking.environment_name || 'Não especificado'}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280;">Data:</td>
                        <td style="color: #1f2937; font-weight: 600;">${formatDate(booking.booking_date)}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280;">Horário:</td>
                        <td style="color: #1f2937; font-weight: 600;">${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280;">Ministério/Rede:</td>
                        <td style="color: #1f2937;">${booking.ministry_network}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280;">Participantes:</td>
                        <td style="color: #1f2937;">${booking.estimated_participants} pessoas</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280;">Responsável:</td>
                        <td style="color: #1f2937;">${booking.responsible_person}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280;">Ocasião:</td>
                        <td style="color: #1f2937;">${booking.occasion}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Contact Info -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                <tr>
                  <td>
                    <h4 style="color: #1e40af; margin: 0 0 10px; font-size: 14px;">📞 Contato do Solicitante</h4>
                    <p style="color: #374151; margin: 5px 0;">Email: <a href="mailto:${booking.email}" style="color: #2563eb;">${booking.email}</a></p>
                    <p style="color: #374151; margin: 5px 0;">Telefone: ${booking.phone}</p>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${APP_URL}/admin" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Gerenciar Solicitação
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f3f4f6; padding: 20px; text-align: center;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                ${APP_NAME}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

// Template HTML para reserva aprovada (enviado ao solicitante)
const bookingApprovedTemplate = (booking: BookingData, adminNotes?: string): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reserva Aprovada</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">✅ Reserva Aprovada!</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="color: #374151; font-size: 16px; margin: 0 0 20px;">
                Olá <strong>${booking.name}</strong>,
              </p>
              <p style="color: #374151; font-size: 16px; margin: 0 0 20px;">
                Sua solicitação de reserva foi <span style="color: #059669; font-weight: 600;">APROVADA</span>! Confira os detalhes abaixo:
              </p>
              
              <!-- Booking Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ecfdf5; border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid #10b981;">
                <tr>
                  <td>
                    <table width="100%" cellpadding="5" cellspacing="0">
                      <tr>
                        <td style="color: #6b7280; width: 140px;">Ambiente:</td>
                        <td style="color: #1f2937; font-weight: 600;">${booking.environment_name || 'Não especificado'}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280;">Data:</td>
                        <td style="color: #1f2937; font-weight: 600;">${formatDate(booking.booking_date)}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280;">Horário:</td>
                        <td style="color: #1f2937; font-weight: 600;">${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280;">Ocasião:</td>
                        <td style="color: #1f2937;">${booking.occasion}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              ${adminNotes ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                <tr>
                  <td>
                    <h4 style="color: #92400e; margin: 0 0 10px; font-size: 14px;">📝 Observações da Administração</h4>
                    <p style="color: #78350f; margin: 0;">${adminNotes}</p>
                  </td>
                </tr>
              </table>
              ` : ''}
              
              <p style="color: #374151; font-size: 14px;">
                Lembre-se de chegar com antecedência e deixar o ambiente organizado após o uso.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${APP_URL}/reservations" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Ver Minhas Reservas
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f3f4f6; padding: 20px; text-align: center;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                ${APP_NAME}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

// Template HTML para reserva rejeitada (enviado ao solicitante)
const bookingRejectedTemplate = (booking: BookingData, adminNotes?: string): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reserva Não Aprovada</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">❌ Reserva Não Aprovada</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="color: #374151; font-size: 16px; margin: 0 0 20px;">
                Olá <strong>${booking.name}</strong>,
              </p>
              <p style="color: #374151; font-size: 16px; margin: 0 0 20px;">
                Infelizmente sua solicitação de reserva não foi aprovada.
              </p>
              
              <!-- Booking Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef2f2; border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid #ef4444;">
                <tr>
                  <td>
                    <table width="100%" cellpadding="5" cellspacing="0">
                      <tr>
                        <td style="color: #6b7280; width: 140px;">Ambiente:</td>
                        <td style="color: #1f2937;">${booking.environment_name || 'Não especificado'}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280;">Data:</td>
                        <td style="color: #1f2937;">${formatDate(booking.booking_date)}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280;">Horário:</td>
                        <td style="color: #1f2937;">${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              ${adminNotes ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                <tr>
                  <td>
                    <h4 style="color: #92400e; margin: 0 0 10px; font-size: 14px;">📝 Motivo</h4>
                    <p style="color: #78350f; margin: 0;">${adminNotes}</p>
                  </td>
                </tr>
              </table>
              ` : ''}
              
              <p style="color: #374151; font-size: 14px;">
                Se tiver dúvidas, entre em contato com a administração.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${APP_URL}/booking" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Fazer Nova Solicitação
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f3f4f6; padding: 20px; text-align: center;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                ${APP_NAME}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

export async function POST(request: NextRequest) {
  try {
    const payload: NotificationPayload = await request.json()
    const { type, booking, adminNotes } = payload

    console.log('📧 API send-notification chamada:', { type, bookingName: booking?.name })

    // Verificar se a API key do Resend está configurada
    if (!process.env.RESEND_API_KEY) {
      console.error('❌ RESEND_API_KEY não está configurada')
      return NextResponse.json(
        { error: 'RESEND_API_KEY não configurada', configured: false },
        { status: 500 }
      )
    }

    // Usar cliente administrativo para buscar admins (bypassa RLS)
    const supabase = createAdminClient()
    if (!supabase) {
      console.error('❌ SUPABASE_SERVICE_ROLE_KEY não está configurada')
      return NextResponse.json(
        { error: 'Configuração do servidor incompleta (service role key)' },
        { status: 500 }
      )
    }

    switch (type) {
      case 'new_booking': {
        console.log('📋 Buscando administradores e aprovadores...')

        // Buscar admins e usuários com permissão de aprovar reservas em paralelo
        const [{ data: admins, error: adminError }, { data: approvers, error: approverError }] =
          await Promise.all([
            supabase.from('profiles').select('email').eq('is_admin', true),
            supabase
              .from('user_permissions')
              .select('profiles(email)')
              .eq('permission', 'approve_bookings'),
          ])

        if (adminError) {
          console.error('❌ Erro ao buscar administradores:', adminError)
          return NextResponse.json(
            { error: 'Erro ao buscar administradores', details: adminError },
            { status: 500 }
          )
        }

        if (approverError) {
          console.error('❌ Erro ao buscar aprovadores:', approverError)
        }

        // Unir e deduplicar emails
        const emailSet = new Set<string>()
        for (const a of admins ?? []) {
          if (a.email?.includes('@')) emailSet.add(a.email)
        }
        for (const p of approvers ?? []) {
          const email = (p.profiles as { email?: string } | null)?.email
          if (email?.includes('@')) emailSet.add(email)
        }

        const adminEmails = Array.from(emailSet)

        console.log(`👥 Destinatários encontrados: ${adminEmails.length}`)

        if (adminEmails.length === 0) {
          console.warn('⚠️ Nenhum destinatário com email válido encontrado')
          return NextResponse.json(
            { warning: 'Nenhum destinatário com email válido', sent: 0 }
          )
        }

        console.log(`📤 Enviando email para ${adminEmails.length} destinatário(s)`)
        
        const { data, error } = await resend.emails.send({
          from: FROM_EMAIL,
          to: adminEmails,
          subject: `[Nova Solicitação] Reserva de ${booking.name} - ${formatDate(booking.booking_date)}`,
          html: newBookingEmailTemplate(booking),
        })

        if (error) {
          console.error('❌ Erro ao enviar email via Resend:', error)
          return NextResponse.json(
            { error: 'Erro ao enviar notificação', details: error },
            { status: 500 }
          )
        }

        console.log('✅ Email enviado com sucesso! ID:', data?.id)

        return NextResponse.json({ 
          success: true, 
          sent: adminEmails.length,
          messageId: data?.id
        })
      }

      case 'booking_approved': {
        const { data, error } = await resend.emails.send({
          from: FROM_EMAIL,
          to: [booking.email],
          subject: `✅ Sua reserva foi aprovada! - ${formatDate(booking.booking_date)}`,
          html: bookingApprovedTemplate(booking, adminNotes),
        })

        if (error) {
          console.error('Erro ao enviar email de aprovação:', error)
          return NextResponse.json(
            { error: 'Erro ao enviar notificação', details: error },
            { status: 500 }
          )
        }

        return NextResponse.json({ success: true, messageId: data?.id })
      }

      case 'booking_rejected': {
        const { data, error } = await resend.emails.send({
          from: FROM_EMAIL,
          to: [booking.email],
          subject: `❌ Sua reserva não foi aprovada - ${formatDate(booking.booking_date)}`,
          html: bookingRejectedTemplate(booking, adminNotes),
        })

        if (error) {
          console.error('Erro ao enviar email de rejeição:', error)
          return NextResponse.json(
            { error: 'Erro ao enviar notificação', details: error },
            { status: 500 }
          )
        }

        return NextResponse.json({ success: true, messageId: data?.id })
      }

      default:
        return NextResponse.json(
          { error: 'Tipo de notificação inválido' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Erro na API de notificação:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
