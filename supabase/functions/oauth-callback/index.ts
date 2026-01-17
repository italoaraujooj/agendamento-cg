import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import '../_shared/cors.ts'

interface GoogleTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  scope: string
}

serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const googleClientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')!
    const googleClientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')!

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const { code, redirect_uri, user_id } = await req.json()

    if (!code || !redirect_uri || !user_id) {
      throw new Error('Parâmetros obrigatórios não fornecidos: code, redirect_uri, user_id')
    }

    console.log('🔄 Iniciando troca do código OAuth por tokens...')

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('❌ Erro ao trocar código por tokens:', errorText)
      throw new Error(`Falha na troca de código OAuth: ${tokenResponse.status}`)
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json()
    console.log('✅ Tokens obtidos com sucesso!')

    // Store tokens in database using RPC function
    const { error: storeError } = await supabaseClient.rpc('store_google_oauth_token', {
      p_user_id: user_id,
      p_access_token: tokens.access_token,
      p_refresh_token: tokens.refresh_token,
      p_expires_in: tokens.expires_in,
    })

    if (storeError) {
      console.error('❌ Erro ao armazenar tokens:', storeError)
      throw new Error(`Falha ao salvar tokens: ${storeError.message}`)
    }

    console.log('💾 Tokens armazenados com sucesso no banco de dados!')

    // Get user profile information
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
      },
    })

    if (profileResponse.ok) {
      const profile = await profileResponse.json()

      // Update user profile with Google info
      const { error: profileError } = await supabaseClient
        .from('profiles')
        .upsert({
          id: user_id,
          email: profile.email,
          full_name: profile.name,
          avatar_url: profile.picture,
          updated_at: new Date().toISOString(),
        })

      if (profileError) {
        console.warn('⚠️ Aviso: Não foi possível atualizar perfil:', profileError)
        // Não throw aqui pois a parte principal (tokens) já funcionou
      } else {
        console.log('👤 Perfil do usuário atualizado com dados do Google!')
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Tokens OAuth armazenados com sucesso!',
        calendar_integration_enabled: true,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )

  } catch (error) {
    console.error('❌ Erro no callback OAuth:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro interno no servidor',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  }
})
