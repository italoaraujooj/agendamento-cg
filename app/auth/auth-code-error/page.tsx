'use client'

import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'

function AuthCodeErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  return (
    <div className="min-h-screen bg-gradient-to-br from-destructive/10 to-warning/5 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <AlertTriangle className="h-12 w-12 text-destructive" />
          </div>
          <CardTitle className="text-destructive">
            Erro na Autenticação
          </CardTitle>
          <CardDescription>
            Ocorreu um problema durante o processo de login
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-destructive/10 p-3 rounded-lg">
              <p className="text-sm text-destructive">
                <strong>Erro:</strong> {error}
              </p>
            </div>
          )}
          
          <div className="text-sm text-muted-foreground">
            <p>Possíveis causas:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Configuração OAuth incorreta</li>
              <li>URL de redirecionamento não autorizada</li>
              <li>Problema de conectividade</li>
              <li>Sessão expirada</li>
            </ul>
          </div>

          <div className="flex gap-2">
            <Button asChild variant="outline" className="flex-1">
              <Link href="/">
                <Home className="h-4 w-4 mr-2" />
                Início
              </Link>
            </Button>
            <Button 
              onClick={() => window.location.reload()} 
              variant="default" 
              className="flex-1"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar Novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AuthCodeErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-destructive/10 to-warning/5 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <AlertTriangle className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle className="text-destructive">
              Carregando...
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
    }>
      <AuthCodeErrorContent />
    </Suspense>
  )
}