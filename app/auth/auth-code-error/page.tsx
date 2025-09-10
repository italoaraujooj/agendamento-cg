import { Suspense } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

function ErrorContent() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-md">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/20">
            <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
          </div>
          <CardTitle className="text-xl">Erro de Autenticação</CardTitle>
        <CardDescription>
          Você precisa estar logado para acessar esta página
        </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>Para acessar o perfil, você precisa:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Estar logado no sistema</li>
              <li>Ter uma conta válida</li>
              <li>Sessão de autenticação ativa</li>
            </ul>
          </div>

          <div className="flex flex-col gap-2 pt-4">
            <Button asChild>
              <Link href="/">
                <Home className="mr-2 h-4 w-4" />
                Voltar ao Início
              </Link>
            </Button>

            <Button variant="outline" asChild>
              <Link href="/profile">
                <RefreshCw className="mr-2 h-4 w-4" />
                Tentar Novamente
              </Link>
            </Button>
          </div>

          <div className="text-xs text-muted-foreground pt-4 border-t">
            <p>
              Se o problema persistir, entre em contato com o suporte ou
              tente fazer login novamente.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AuthCodeErrorPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto py-8 px-4 max-w-md">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/20">
                <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400 animate-pulse" />
              </div>
              <p className="text-sm text-muted-foreground">Carregando...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  )
}
