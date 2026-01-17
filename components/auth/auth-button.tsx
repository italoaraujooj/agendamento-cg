"use client"

import { useAuth } from './auth-provider'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogIn, LogOut, User } from 'lucide-react'

export function AuthButton() {
  const { user, loading, signInWithGoogle, signOut } = useAuth()
  const [mounted, setMounted] = useState(false)

  // Evitar hidratação mismatch esperando o componente montar
  useEffect(() => {
    setMounted(true)
  }, [])

  // Durante a hidratação, mostrar um placeholder
  if (!mounted) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <div className="w-4 h-4 mr-2" />
        Carregando...
      </Button>
    )
  }

  if (loading) {
    return (
      <Button variant="ghost" disabled>
        <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mr-2" />
        Carregando...
      </Button>
    )
  }

  if (!user) {
    return (
      <Button onClick={signInWithGoogle} variant="default">
        <LogIn className="w-4 h-4 mr-2" />
        Entrar com Google
      </Button>
    )
  }

  const userInitials = user.user_metadata?.full_name
    ? user.user_metadata.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
    : user.email?.[0].toUpperCase() || 'U'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={user.user_metadata?.avatar_url}
              alt={user.user_metadata?.full_name || user.email || 'User'}
            />
            <AvatarFallback>{userInitials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {user.user_metadata?.full_name || 'Usuário'}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => window.location.href = '/profile'}>
          <User className="mr-2 h-4 w-4" />
          <span>Perfil & Integrações</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
