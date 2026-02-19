import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://agendamento-cg.vercel.app'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(`${APP_URL}/login?error=Token não fornecido`)
  }

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.redirect(`${APP_URL}/login?error=Erro de configuração do servidor`)
  }

  // Buscar token
  const { data: confirmation, error: fetchError } = await supabase
    .from('email_confirmations')
    .select('*')
    .eq('token', token)
    .single()

  if (fetchError || !confirmation) {
    return NextResponse.redirect(`${APP_URL}/login?error=Link inválido ou já utilizado`)
  }

  // Verificar expiração
  if (new Date(confirmation.expires_at) < new Date()) {
    // Deletar token expirado
    await supabase
      .from('email_confirmations')
      .delete()
      .eq('id', confirmation.id)

    return NextResponse.redirect(`${APP_URL}/login?error=Link expirado. Faça o cadastro novamente.`)
  }

  // Confirmar email do usuário via admin API
  const { error: updateError } = await supabase.auth.admin.updateUserById(
    confirmation.user_id,
    { email_confirm: true }
  )

  if (updateError) {
    console.error('Erro ao confirmar email do usuário:', updateError)
    return NextResponse.redirect(`${APP_URL}/login?error=Erro ao confirmar email`)
  }

  // Buscar dados do usuário para criar perfil
  const { data: userData } = await supabase.auth.admin.getUserById(confirmation.user_id)

  if (userData?.user) {
    const fullName = userData.user.user_metadata?.full_name || ''
    const email = userData.user.email || ''

    // Criar perfil (ignorar erro se já existir)
    await supabase
      .from('profiles')
      .upsert(
        {
          id: confirmation.user_id,
          email,
          full_name: fullName,
          profile_completed: false,
        },
        { onConflict: 'id' }
      )
  }

  // Deletar token usado
  await supabase
    .from('email_confirmations')
    .delete()
    .eq('id', confirmation.id)

  return NextResponse.redirect(`${APP_URL}/login?confirmed=true`)
}
