import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/server'
import crypto from 'crypto'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
const APP_NAME = 'Sistema de Agendamento - Cidade Viva CG'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://agendamento-cg.vercel.app'

const confirmationEmailTemplate = (fullName: string, confirmUrl: string): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirme seu email</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Confirme seu Email</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="color: #374151; font-size: 16px; margin: 0 0 20px;">
                Olá <strong>${fullName}</strong>,
              </p>
              <p style="color: #374151; font-size: 16px; margin: 0 0 20px;">
                Obrigado por se cadastrar! Para ativar sua conta, clique no botão abaixo para confirmar seu email.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${confirmUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Confirmar Email
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #6b7280; font-size: 14px; margin: 20px 0 0;">
                Este link expira em 24 horas. Se você não criou uma conta, ignore este email.
              </p>
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
    const { email, fullName, userId } = await request.json()

    if (!email || !fullName || !userId) {
      return NextResponse.json(
        { error: 'email, fullName e userId são obrigatórios' },
        { status: 400 }
      )
    }

    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY não está configurada')
      return NextResponse.json(
        { error: 'RESEND_API_KEY não configurada' },
        { status: 500 }
      )
    }

    const supabase = createAdminClient()
    if (!supabase) {
      console.error('SUPABASE_SERVICE_ROLE_KEY não está configurada')
      return NextResponse.json(
        { error: 'Configuração do servidor incompleta' },
        { status: 500 }
      )
    }

    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    // Deletar tokens anteriores deste usuário
    await supabase
      .from('email_confirmations')
      .delete()
      .eq('user_id', userId)

    // Salvar novo token
    const { error: insertError } = await supabase
      .from('email_confirmations')
      .insert({
        user_id: userId,
        token,
        expires_at: expiresAt,
      })

    if (insertError) {
      console.error('Erro ao salvar token de confirmação:', insertError)
      return NextResponse.json(
        { error: 'Erro ao gerar token de confirmação' },
        { status: 500 }
      )
    }

    const confirmUrl = `${APP_URL}/api/auth/confirm-email?token=${token}`

    const { error: emailError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [email],
      subject: `Confirme seu email - ${APP_NAME}`,
      html: confirmationEmailTemplate(fullName, confirmUrl),
    })

    if (emailError) {
      console.error('Erro ao enviar email de confirmação:', emailError)
      return NextResponse.json(
        { error: 'Erro ao enviar email de confirmação' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro na API de confirmação de email:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
