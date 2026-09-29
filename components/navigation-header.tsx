"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"
import { AuthButton } from "@/components/auth/auth-button"
import { CalendarStatusIndicator } from "@/components/calendar-status-indicator"
import { SystemModeSwitch } from "@/components/system-mode-switch"
import { useSystemMode } from "@/components/system-mode-provider"
import { NavMenuSheet } from "@/components/navigation/nav-menu-sheet"
import { isTokenPage, useNavItems } from "@/components/navigation/use-nav-items"
import { cn } from "@/lib/utils"

/**
 * Cabeçalho em uma linha. Telas largas (xl): navegação completa inline.
 * Telas médias: menu completo no hambúrguer. Celular: a navegação fica na
 * barra inferior (MobileBottomNav), e aqui só logo e conta.
 */
export default function NavigationHeader() {
  const pathname = usePathname()
  const { isEscalas } = useSystemMode()
  const { items, moduleLabel, homeHref } = useNavItems()
  const showNav = !isTokenPage(pathname)

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="container mx-auto px-4 flex items-center gap-4 h-14">
        <Link href={homeHref} className="flex items-center gap-2 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-96.png" alt="" className="h-8 w-8 rounded-lg" />
          <span className="font-bold leading-tight">
            Cidade Viva CG
            <span className="block text-xs font-medium text-muted-foreground xl:hidden">{moduleLabel}</span>
          </span>
        </Link>

        {showNav && (
          <div className="hidden xl:flex items-center gap-3 min-w-0">
            <SystemModeSwitch />
            <nav className="flex items-center gap-1">
              {items.map((item) => {
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
        )}

        <div className="ml-auto flex items-center gap-1">
          {!isEscalas && <CalendarStatusIndicator className="hidden xl:flex" />}
          <AuthButton />
          <div className="hidden md:block">
            <ModeToggle />
          </div>
          {showNav && (
            <NavMenuSheet>
              <Button variant="ghost" size="icon" className="hidden md:inline-flex xl:hidden" aria-label="Abrir menu">
                <Menu className="h-5 w-5" />
              </Button>
            </NavMenuSheet>
          )}
        </div>
      </div>
    </header>
  )
}
