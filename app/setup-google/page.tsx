'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, AlertCircle, Settings, ExternalLink } from 'lucide-react'

export default function SetupGooglePage() {
  const [envStatus, setEnvStatus] = useState<{
    clientId: boolean
    clientSecret: boolean
    supabaseUrl: boolean
    supabaseKey: boolean
  }>({
    clientId: !!process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: !!process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })

  const allConfigured = Object.values(envStatus).every(Boolean)

  const steps = [
    {
      title: '1. Conta Google Cloud Console',
      description: 'Crie um projeto no Google Cloud Console',
      link: 'https://console.cloud.google.com/',
      external: true,
    },
    {
      title: '2. Configurar OAuth Consent Screen',
      description: 'Configure a tela de consentimento OAuth',
      details: [
        'Escolha "External" para usuários externos',
        'Adicione scopes: calendar.events, userinfo.email, userinfo.profile'
      ]
    },
    {
      title: '3. Criar Credenciais OAuth',
      description: 'Crie as credenciais OAuth 2.0',
      details: [
        'Application type: Web application',
        'Authorized JavaScript origins: http://localhost:3000',
        'Authorized redirect URIs: http://localhost:3000/auth/callback'
      ]
    },
    {
      title: '4. Configurar Variáveis de Ambiente',
      description: 'Configure as variáveis no arquivo .env.local',
      envVars: [
        'NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=your_google_client_id',
        'GOOGLE_OAUTH_CLIENT_SECRET=your_google_client_secret'
      ]
    },
    {
      title: '5. Executar Scripts SQL',
      description: 'Execute os scripts de configuração no Supabase',
      scripts: [
        'scripts/007-google-calendar-integration.sql',
        'scripts/setup-google-calendar-integration.sql'
      ]
    }
  ]

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">🔧 Configuração Google Calendar</h1>
          <p className="text-muted-foreground">
            Siga os passos abaixo para configurar a integração com Google Calendar
          </p>
        </div>

        {/* Status da Configuração */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Status da Configuração
            </CardTitle>
            <CardDescription>
              Verifique se todas as variáveis necessárias estão configuradas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Google Client ID:</span>
                <Badge variant={envStatus.clientId ? "default" : "destructive"}>
                  {envStatus.clientId ? (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Configurado
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Não configurado
                    </>
                  )}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Google Client Secret:</span>
                <Badge variant={envStatus.clientSecret ? "default" : "destructive"}>
                  {envStatus.clientSecret ? (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Configurado
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Não configurado
                    </>
                  )}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Supabase URL:</span>
                <Badge variant={envStatus.supabaseUrl ? "default" : "destructive"}>
                  {envStatus.supabaseUrl ? (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Configurado
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Não configurado
                    </>
                  )}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Supabase Key:</span>
                <Badge variant={envStatus.supabaseKey ? "default" : "destructive"}>
                  {envStatus.supabaseKey ? (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Configurado
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Não configurado
                    </>
                  )}
                </Badge>
              </div>
            </div>

            {allConfigured ? (
              <div className="mt-4 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Todas as variáveis estão configuradas!</span>
                </div>
                <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                  Você pode prosseguir para testar a integração no seu perfil.
                </p>
              </div>
            ) : (
              <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">Algumas variáveis não estão configuradas</span>
                </div>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-2">
                  Siga os passos abaixo para completar a configuração.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Passos de Configuração */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">📋 Passos de Configuração</h2>

          {steps.map((step, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full text-sm font-bold">
                    {index + 1}
                  </span>
                  {step.title}
                </CardTitle>
                <CardDescription>{step.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {step.link && (
                  <div className="mb-4">
                    <Button asChild variant="outline">
                      <a href={step.link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Acessar {step.link.includes('console.cloud.google') ? 'Google Cloud Console' : 'Link'}
                      </a>
                    </Button>
                  </div>
                )}

                {step.details && (
                  <div className="mb-4">
                    <h4 className="font-medium mb-2">Detalhes:</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      {step.details.map((detail, detailIndex) => (
                        <li key={detailIndex}>{detail}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {step.envVars && (
                  <div className="mb-4">
                    <h4 className="font-medium mb-2">Variáveis de ambiente (.env.local):</h4>
                    <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                      <code className="text-sm">
                        {step.envVars.join('\n')}
                      </code>
                    </div>
                  </div>
                )}

                {step.scripts && (
                  <div className="mb-4">
                    <h4 className="font-medium mb-2">Scripts SQL para executar:</h4>
                    <div className="space-y-2">
                      {step.scripts.map((script, scriptIndex) => (
                        <div key={scriptIndex} className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                          <code className="text-sm">{script}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Ações */}
        <div className="flex flex-wrap justify-center gap-4">
          <Button asChild>
            <a href="/profile">
              👤 Ir para Perfil (Testar Integração)
            </a>
          </Button>

          <Button asChild variant="outline">
            <a href="/debug-oauth">
              🔍 Diagnóstico OAuth
            </a>
          </Button>

          <Button asChild variant="outline">
            <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">
              🌐 Google Cloud Console
            </a>
          </Button>

          <Button asChild variant="outline">
            <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">
              🗄️ Supabase Dashboard
            </a>
          </Button>
        </div>

        {/* Arquivos de Documentação */}
        <Card>
          <CardHeader>
            <CardTitle>📚 Documentação Disponível</CardTitle>
            <CardDescription>
              Arquivos de configuração e guias disponíveis no projeto
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">📋 scripts/setup-google-oauth.md</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Guia completo de configuração OAuth do Google
                </p>
                <Button variant="outline" size="sm" disabled>
                  Ver arquivo
                </Button>
              </div>

              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">🗄️ scripts/007-google-calendar-integration.sql</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Script SQL para configurar tabelas e funções
                </p>
                <Button variant="outline" size="sm" disabled>
                  Ver arquivo
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

