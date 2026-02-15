"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Calendar, MapPin, Users, Home, Shield, Users2, CalendarDays, ClipboardList } from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"
import { AuthButton } from "@/components/auth/auth-button"
import { CalendarStatusIndicator } from "@/components/calendar-status-indicator"
import { SystemModeSwitch } from "@/components/system-mode-switch"
import { useAuth } from "@/components/auth/auth-provider"
import { useSystemMode } from "@/components/system-mode-provider"

export default function NavigationHeader() {
  const pathname = usePathname()
  const { isAdmin, isAuthenticated } = useAuth()
  const { isEscalas } = useSystemMode()

  // Menu do módulo de Agendamentos
  const agendamentosNavItems = [
    {
      href: "/",
      label: "Início",
      icon: Home,
      active: pathname === "/",
    },
    {
      href: "/environments",
      label: "Ambientes",
      icon: MapPin,
      active: pathname === "/environments",
    },
    {
      href: "/booking",
      label: "Agendar",
      icon: Calendar,
      active: pathname === "/booking",
    },
    {
      href: "/reservations",
      label: "Reservas",
      icon: Users,
      active: pathname === "/reservations",
    },
  ]

  // Menu do módulo de Escalas
  const escalasNavItems = [
    {
      href: "/escalas",
      label: "Dashboard",
      icon: Home,
      active: pathname === "/escalas",
    },
    {
      href: "/ministerios",
      label: "Ministérios",
      icon: Users2,
      active: pathname === "/ministerios" || pathname.startsWith("/ministerios/"),
    },
    {
      href: "/calendario",
      label: "Calendário",
      icon: CalendarDays,
      active: pathname === "/calendario",
    },
  ]

  // Selecionar menu baseado no modo
  const baseNavItems = isEscalas ? escalasNavItems : agendamentosNavItems

  // Adicionar link de admin se o usuário for administrador
  const allNavItems = isAuthenticated && isAdmin
    ? [
        ...baseNavItems,
        isEscalas
          ? {
              href: "/admin-escalas",
              label: "Admin",
              icon: Shield,
              active: pathname === "/admin-escalas" || pathname.startsWith("/admin-escalas/"),
            }
          : {
              href: "/admin",
              label: "Admin",
              icon: Shield,
              active: pathname === "/admin" || pathname.startsWith("/admin/"),
            },
      ]
    : baseNavItems

  // Título e ícone baseado no modo
  const headerTitle = isEscalas ? "Escalas - Cidade Viva CG" : "Agendamento - Cidade Viva CG"
  const headerHref = isEscalas ? "/escalas" : "/"
  const HeaderIcon = isEscalas ? ClipboardList : Calendar

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href={headerHref} className="flex items-center gap-2">
            <HeaderIcon className="h-6 w-6 text-primary" />
            <span className="font-bold text-sm sm:text-base md:text-xl">{headerTitle}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {allNavItems.map((item) => {
              const Icon = item.icon
              return (
                <Button
                  key={item.href}
                  asChild
                  variant={item.active ? "default" : "ghost"}
                  className="flex items-center gap-2"
                >
                  <Link href={item.href}>
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </Button>
              )
            })}
            {!isEscalas && <CalendarStatusIndicator />}
            <SystemModeSwitch />
            <AuthButton />
            <ModeToggle />
          </nav>

          {/* Mobile Navigation */}
          <nav className="md:hidden flex items-center gap-1">
            {allNavItems.map((item) => {
              const Icon = item.icon
              return (
                <Button 
                  key={item.href} 
                  asChild 
                  variant={item.active ? "default" : "ghost"} 
                  size="sm"
                >
                  <Link href={item.href}>
                    <Icon className="h-4 w-4" />
                  </Link>
                </Button>
              )
            })}
            <SystemModeSwitch />
            <AuthButton />
            <ModeToggle />
          </nav>
        </div>
      </div>
    </header>
  )
}
