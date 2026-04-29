import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')
  const error = searchParams.get('error')
  
  console.log('🔄 Auth callback iniciado:', { hasCode: !!code, hasError: !!error })

  // Handle OAuth errors
  if (error) {
    console.error('❌ OAuth error:', error)
    return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${error}`)
  }

  if (code) {
    // Determinar URL de redirecionamento com base no tipo
    let redirectUrl = `${origin}/`
    if (type === 'signup') {
      redirectUrl = `${origin}/login?confirmed=true`
    } else if (type === 'recovery') {
      redirectUrl = `${origin}/resetar-senha`
    } else if (type === 'invite') {
      redirectUrl = `${origin}/completar-cadastro`
    }

    const response = NextResponse.redirect(redirectUrl)
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            response.cookies.set({
              name,
              value,
              ...options,
            })
          },
          remove(name: string, options: any) {
            response.cookies.set({
              name,
              value: '',
              ...options,
            })
          },
        },
      }
    )

    console.log('🔄 Trocando código por sessão...')

    const { error, data } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('❌ Erro na troca do código:', error)
      return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${error.message}`)
    }

    console.log('✅ Login realizado com sucesso!')

    const user = data.session.user

    // Sincronizar dados do Google com o perfil
    try {
      const fullName = user.user_metadata?.full_name || user.user_metadata?.name
      const avatarUrl = user.user_metadata?.avatar_url

      if (fullName || avatarUrl) {
        console.log('🔄 Sincronizando dados do perfil...')

        // Primeiro, verificar se o perfil existe
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('id', user.id)
          .single()

        if (existingProfile) {
          // Atualizar apenas campos que estão vazios
          const updates: Record<string, string> = {}
          if (!existingProfile.full_name && fullName) {
            updates.full_name = fullName
          }
          if (!existingProfile.avatar_url && avatarUrl) {
            updates.avatar_url = avatarUrl
          }

          if (Object.keys(updates).length > 0) {
            updates.updated_at = new Date().toISOString()
            const { error: updateError } = await supabase
              .from('profiles')
              .update(updates)
              .eq('id', user.id)

            if (!updateError) {
              console.log('💾 Perfil sincronizado com dados do Google!')
            } else {
              console.error('❌ Erro ao sincronizar perfil:', updateError)
            }
          }
        } else {
          // Criar perfil se não existir
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              email: user.email,
              full_name: fullName,
              avatar_url: avatarUrl,
              profile_completed: false,
              first_login_at: new Date().toISOString(),
            })

          if (!insertError) {
            console.log('💾 Perfil criado com dados do Google!')
          } else if (insertError.code !== '23505') { // Ignorar erro de duplicata
            console.error('❌ Erro ao criar perfil:', insertError)
          }
        }
      }
    } catch (error) {
      console.error('❌ Erro ao sincronizar perfil:', error)
    }

    // Auto-vincular servos com o mesmo email ao usuário
    if (user.email) {
      try {
        const adminClient = createAdminClient()
        if (adminClient) {
          const { data: unlinkedServants } = await adminClient
            .from('servants')
            .select('id')
            .ilike('email', user.email)
            .is('user_id', null)
            .eq('is_active', true)

          if (unlinkedServants && unlinkedServants.length > 0) {
            console.log(`🔗 Vinculando ${unlinkedServants.length} servo(s) ao usuário ${user.email}...`)
            await adminClient
              .from('servants')
              .update({ user_id: user.id })
              .in('id', unlinkedServants.map((s: { id: string }) => s.id))
            console.log('✅ Servos vinculados!')
          }
        }
      } catch (err) {
        console.error('❌ Erro ao vincular servos ao perfil:', err)
      }
    }

    // Se há provider_token, armazenar no banco para Google Calendar
    if (data.session?.provider_token) {
      console.log('🔄 Armazenando tokens do Google Calendar...')
      try {
        const { error: storeError } = await supabase.rpc('store_google_oauth_token', {
          p_user_id: user.id,
          p_access_token: data.session.provider_token,
          p_refresh_token: data.session.provider_refresh_token || null,
          p_expires_in: 3600,
        })

        if (!storeError) {
          console.log('💾 Tokens do Google Calendar armazenados!')
        } else {
          console.error('❌ Erro ao armazenar tokens:', storeError)
        }
      } catch (error) {
        console.error('❌ Erro ao processar tokens:', error)
      }
    }

    return response
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
