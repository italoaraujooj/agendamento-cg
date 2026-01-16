import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServerClient } from '@/lib/supabase/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(request: NextRequest) {
  try {
    const debugInfo: Record<string, any> = {
      timestamp: new Date().toISOString(),
      environment: {
        RESEND_API_KEY_configured: !!process.env.RESEND_API_KEY,
        RESEND_API_KEY_length: process.env.RESEND_API_KEY?.length || 0,
        RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || 'agendamento@icvcg.com.br',
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'não configurado',
      },
      admins: [],
      profilesTable: null,
      testEmail: null,
    }

    // Verificar conexão com Supabase
    const supabase = await createServerClient()
    if (!supabase) {
      debugInfo.supabaseConnection = 'ERRO: Não foi possível conectar ao Supabase'
      return NextResponse.json(debugInfo)
    }
    debugInfo.supabaseConnection = 'OK'

    // Verificar se a tabela profiles existe e tem a coluna is_admin
    const { data: profilesSchema, error: schemaError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1)

    if (schemaError) {
      debugInfo.profilesTable = {
        error: schemaError.message,
        hint: 'Talvez a tabela profiles não exista ou a migração não foi executada'
      }
    } else {
      debugInfo.profilesTable = 'OK - Tabela acessível'
    }

    // Buscar todos os perfis que são admin
    const { data: admins, error: adminError } = await supabase
      .from('profiles')
      .select('id, email, full_name, is_admin')
      .eq('is_admin', true)

    if (adminError) {
      debugInfo.admins = {
        error: adminError.message,
        hint: 'Erro ao buscar administradores. Verifique se a coluna is_admin existe.'
      }
    } else if (!admins || admins.length === 0) {
      debugInfo.admins = {
        count: 0,
        message: 'Nenhum administrador encontrado',
        hint: 'Execute: UPDATE public.profiles SET is_admin = true WHERE email = \'seu-email@exemplo.com\''
      }
    } else {
      debugInfo.admins = {
        count: admins.length,
        list: admins.map(a => ({
          id: a.id,
          email: a.email || 'NÃO DEFINIDO',
          full_name: a.full_name || 'NÃO DEFINIDO',
          hasEmail: !!a.email,
        }))
      }

      // Verificar quantos tem email válido
      const adminsWithEmail = admins.filter(a => a.email && a.email.includes('@'))
      debugInfo.admins.withValidEmail = adminsWithEmail.length
      debugInfo.admins.emails = adminsWithEmail.map(a => a.email)
    }

    // Verificar todos os perfis para debug
    const { data: allProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, full_name, is_admin')
      .limit(10)

    if (!profilesError && allProfiles) {
      debugInfo.sampleProfiles = allProfiles.map(p => ({
        id: p.id.substring(0, 8) + '...',
        email: p.email || 'NULL',
        is_admin: p.is_admin,
      }))
    }

    // Testar envio de email (se tiver API key e admin com email)
    if (process.env.RESEND_API_KEY) {
      const adminEmails = debugInfo.admins?.emails || []
      
      if (adminEmails.length > 0) {
        // Não enviar email real no debug, apenas verificar configuração
        debugInfo.testEmail = {
          wouldSendTo: adminEmails,
          from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
          status: 'Configuração parece OK. Emails serão enviados para esses endereços.'
        }
      } else {
        debugInfo.testEmail = {
          error: 'Nenhum administrador com email válido para enviar notificação',
          hint: 'Certifique-se de que o email está preenchido na tabela profiles para os administradores'
        }
      }
    } else {
      debugInfo.testEmail = {
        error: 'RESEND_API_KEY não está configurada',
        hint: 'Adicione RESEND_API_KEY ao seu arquivo .env.local'
      }
    }

    // Sugestões de correção
    debugInfo.suggestions = []
    
    if (!process.env.RESEND_API_KEY) {
      debugInfo.suggestions.push('Configure RESEND_API_KEY no arquivo .env.local')
    }
    
    if (debugInfo.admins?.count === 0) {
      debugInfo.suggestions.push('Defina um administrador: UPDATE public.profiles SET is_admin = true WHERE email = \'seu-email@exemplo.com\'')
    }
    
    if (debugInfo.admins?.withValidEmail === 0 && debugInfo.admins?.count > 0) {
      debugInfo.suggestions.push('Sincronize os emails: UPDATE public.profiles p SET email = u.email FROM auth.users u WHERE p.id = u.id')
    }

    return NextResponse.json(debugInfo)
  } catch (error) {
    return NextResponse.json({
      error: 'Erro ao executar diagnóstico',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// POST para enviar um email de teste
export async function POST(request: NextRequest) {
  try {
    const { testEmail } = await request.json()

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({
        error: 'RESEND_API_KEY não configurada'
      }, { status: 400 })
    }

    if (!testEmail) {
      return NextResponse.json({
        error: 'Forneça um email de teste no body: { "testEmail": "seu@email.com" }'
      }, { status: 400 })
    }

    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: [testEmail],
      subject: '🔧 Teste de Email - Sistema de Agendamento',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1 style="color: #10b981;">✅ Email de Teste</h1>
          <p>Se você está vendo este email, a configuração do Resend está funcionando corretamente!</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <p><strong>From:</strong> ${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}</p>
        </div>
      `,
    })

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
        details: error
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Email de teste enviado para ${testEmail}`,
      messageId: data?.id
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Erro ao enviar email de teste',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
