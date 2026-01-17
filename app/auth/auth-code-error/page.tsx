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
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <AlertTriangle className="h-12 w-12 text-red-500" />
          </div>
          <CardTitle className="text-red-700 dark:text-red-400">
            Erro na Autenticação
          </CardTitle>
          <CardDescription>
            Ocorreu um problema durante o processo de login
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-400">
                <strong>Erro:</strong> {error}
              </p>
            </div>
          )}
          
          <div className="text-sm text-gray-600 dark:text-gray-400">
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
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <AlertTriangle className="h-12 w-12 text-red-500" />
            </div>
            <CardTitle className="text-red-700 dark:text-red-400">
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