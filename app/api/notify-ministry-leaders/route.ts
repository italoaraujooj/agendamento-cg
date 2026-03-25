import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/server'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
const APP_NAME = 'Sistema de Agendamento - Cidade Viva CG'

const formatDate = (dateString: string): string => {
  const [year, month, day] = dateString.split('-')
  return `${day}/${month}/${year}`
}

const formatTime = (timeString: string): string => timeString.slice(0, 5)

const ministryLeaderEmailTemplate = (params: {
  leaderName: string
  requesterName: string
  requesterPhone: string
  ministryName: string
  occasion: string
  bookingDate: string
  startTime: string
  endTime: string
}): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Solicitação de Apoio de Ministério</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">🙌 Solicitação de Apoio</h1>
              <p style="color: #e0e7ff; margin: 8px 0 0; font-size: 14px;">Ministério ${params.ministryName}</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="color: #374151; font-size: 16px; margin: 0 0 8px;">
                Olá, <strong>${params.leaderName}</strong>!
              </p>
              <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">
                <strong>${params.requesterName}</strong> precisa do apoio do seu ministério no seguinte evento:
              </p>

              <!-- Event Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f3ff; border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid #7c3aed;">
                <tr>
                  <td>
                    <h3 style="color: #4c1d95; margin: 0 0 15px; font-size: 16px;">Detalhes do Evento</h3>
                    <table width="100%" cellpadding="5" cellspacing="0">
                      <tr>
                        <td style="color: #6b7280; width: 100px;">Ocasião:</td>
                        <td style="color: #1f2937; font-weight: 600;">${params.occasion}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280;">Data:</td>
                        <td style="color: #1f2937; font-weight: 600;">${formatDate(params.bookingDate)}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280;">Horário:</td>
                        <td style="color: #1f2937; font-weight: 600;">${formatTime(params.startTime)} às ${formatTime(params.endTime)}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280;">Local:</td>
                        <td style="color: #1f2937; font-weight: 600;">Salão Principal</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Contact -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                <tr>
                  <td>
                    <h4 style="color: #1e40af; margin: 0 0 8px; font-size: 14px;">📞 Entre em contato com o solicitante</h4>
                    <p style="color: #374151; margin: 0; font-size: 15px;">
                      <strong>${params.requesterName}</strong> — ${params.requesterPhone}
                    </p>
                  </td>
                </tr>
              </table>

              <p style="color: #6b7280; font-size: 13px; margin: 0;">
                Esta é uma notificação automática do ${APP_NAME}.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f3f4f6; padding: 20px; text-align: center;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">${APP_NAME}</p>
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
    const { booking_id } = await request.json()

    if (!booking_id) {
      return NextResponse.json({ error: 'booking_id obrigatório' }, { status: 400 })
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'RESEND_API_KEY não configurada' }, { status: 500 })
    }

    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Erro de configuração do servidor' }, { status: 500 })
    }

    // Buscar dados da reserva
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('name, phone, occasion, booking_date, start_time, end_time')
      .eq('id', booking_id)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Reserva não encontrada' }, { status: 404 })
    }

    // Buscar ministérios solicitados ainda não notificados, com dados do líder
    const { data: requests, error: requestsError } = await supabase
      .from('booking_ministry_requests')
      .select(`
        id,
        ministries (
          id,
          name,
          leader_id,
          servants!ministries_leader_id_fkey (
            id,
            name,
            email,
            user_id
          )
        )
      `)
      .eq('booking_id', booking_id)
      .is('notified_at', null)

    if (requestsError) {
      console.error('Erro ao buscar solicitações:', requestsError)
      return NextResponse.json({ error: requestsError.message }, { status: 500 })
    }

    if (!requests || requests.length === 0) {
      return NextResponse.json({ message: 'Nenhuma solicitação pendente', sent: 0 })
    }

    const results: { ministryName: string; success: boolean; error?: string }[] = []
    const notifiedIds: string[] = []

    for (const req of requests) {
      const ministry = req.ministries as any
      if (!ministry) continue

      const leader = ministry.servants as any
      if (!leader) {
        console.warn(`Ministério ${ministry.name} sem líder cadastrado`)
        results.push({ ministryName: ministry.name, success: false, error: 'Sem líder cadastrado' })
        continue
      }

      // Prioriza email do servo; fallback para profiles se tiver user_id
      let leaderEmail: string | null = leader.email || null

      if (!leaderEmail && leader.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', leader.user_id)
          .single()
        leaderEmail = profile?.email || null
      }

      if (!leaderEmail) {
        console.warn(`Líder do ministério ${ministry.name} sem email`)
        results.push({ ministryName: ministry.name, success: false, error: 'Líder sem email' })
        continue
      }

      const { error: emailError } = await resend.emails.send({
        from: FROM_EMAIL,
        to: [leaderEmail],
        subject: `🙌 Solicitação de apoio — ${ministry.name} — ${formatDate(booking.booking_date)}`,
        html: ministryLeaderEmailTemplate({
          leaderName: leader.name,
          requesterName: booking.name,
          requesterPhone: booking.phone,
          ministryName: ministry.name,
          occasion: booking.occasion,
          bookingDate: booking.booking_date,
          startTime: booking.start_time,
          endTime: booking.end_time,
        }),
      })

      if (emailError) {
        console.error(`Erro ao enviar email para líder de ${ministry.name}:`, emailError)
        results.push({ ministryName: ministry.name, success: false, error: String(emailError) })
      } else {
        results.push({ ministryName: ministry.name, success: true })
        notifiedIds.push(req.id)
      }
    }

    // Marcar como notificadas
    if (notifiedIds.length > 0) {
      await supabase
        .from('booking_ministry_requests')
        .update({ notified_at: new Date().toISOString() })
        .in('id', notifiedIds)
    }

    const sent = results.filter(r => r.success).length
    return NextResponse.json({ success: true, sent, results })
  } catch (error) {
    console.error('Erro na API notify-ministry-leaders:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
