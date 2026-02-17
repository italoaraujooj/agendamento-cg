"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Calendar, MapPin, Users, Home, Shield, Users2, CalendarDays, ClipboardList, Menu } from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"
import { AuthButton } from "@/components/auth/auth-button"
import { CalendarStatusIndicator } from "@/components/calendar-status-indicator"
import { SystemModeSwitch } from "@/components/system-mode-switch"
import { useAuth } from "@/components/auth/auth-provider"
import { useSystemMode } from "@/components/system-mode-provider"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export default function NavigationHeader() {
  const pathname = usePathname()
  const { isAdmin, isAuthenticated } = useAuth()
  const { isEscalas } = useSystemMode()
  const [open, setOpen] = useState(false)

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
        {/* Top bar */}
        <div className="flex items-center justify-between h-14">
          <Link href={headerHref} className="flex items-center gap-2">
            <HeaderIcon className="h-6 w-6 text-primary" />
            <span className="font-bold text-sm sm:text-base md:text-xl">{headerTitle}</span>
          </Link>

          <div className="flex items-center gap-1">
            {!isEscalas && <CalendarStatusIndicator className="hidden md:flex" />}
            <AuthButton />
            <ModeToggle />
            {/* Mobile: Sheet para CalendarStatus */}
            {!isEscalas && (
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-primary" />
                      Google Calendar
                    </SheetTitle>
                  </SheetHeader>
                  <div className="mt-4">
                    <CalendarStatusIndicator />
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </div>
        </div>

        {/* Nav bar */}
        <div className="flex items-center gap-3 h-10 border-t border-border/50 overflow-x-auto scrollbar-hide">
          <SystemModeSwitch />
          <div className="w-px h-5 bg-border shrink-0" />
          <nav className="flex items-center gap-1">
            {allNavItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                    item.active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </header>
  )
}
