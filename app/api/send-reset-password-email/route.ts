import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/server'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
const APP_NAME = 'Sistema de Agendamento - Cidade Viva CG'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://agendamento-cg.vercel.app'

const resetPasswordEmailTemplate = (resetUrl: string): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redefinir senha</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Redefinir Senha</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="color: #374151; font-size: 16px; margin: 0 0 20px;">
                Recebemos uma solicitação para redefinir a senha da sua conta.
                Clique no botão abaixo para criar uma nova senha.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Redefinir Senha
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #6b7280; font-size: 14px; margin: 20px 0 0;">
                Este link expira em 1 hora. Se você não solicitou a redefinição de senha, ignore este email.
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
    const { email, origin } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'email é obrigatório' }, { status: 400 })
    }

    const redirectTo = `${origin || APP_URL}/auth/callback`

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'RESEND_API_KEY não configurada' }, { status: 500 })
    }

    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 })
    }

    // Gerar link de recuperação via admin API
    const { data, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo,
      },
    })

    if (linkError || !data?.properties?.action_link) {
      // Não revelar se o email existe ou não
      console.error('Erro ao gerar link de recuperação:', linkError)
      return NextResponse.json({ success: true })
    }

    const resetUrl = data.properties.action_link

    const { error: emailError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [email],
      subject: `Redefinir senha - ${APP_NAME}`,
      html: resetPasswordEmailTemplate(resetUrl),
    })

    if (emailError) {
      console.error('Erro ao enviar email de recuperação:', emailError)
      return NextResponse.json({ error: 'Erro ao enviar email' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro na API de recuperação de senha:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
