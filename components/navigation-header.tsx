"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"
import { AuthButton } from "@/components/auth/auth-button"
import { NavMenuSheet } from "@/components/navigation/nav-menu-sheet"
import { isTokenPage, useNavItems } from "@/components/navigation/use-nav-items"
import { cn } from "@/lib/utils"

/**
 * Cabeçalho do celular e de telas médias: logo, conta e (md) o menu completo.
 * Em telas largas a navegação fica na lateral (AppSidebar) e o cabeçalho some,
 * exceto nas páginas públicas por link, que não têm navegação.
 */
export default function NavigationHeader() {
  const pathname = usePathname()
  const { moduleLabel, homeHref } = useNavItems()
  const showNav = !isTokenPage(pathname)

  return (
    <header
      className={cn(
        "sticky top-0 z-50 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 pt-[env(safe-area-inset-top)]",
        showNav && "lg:hidden"
      )}
    >
      <div className="container mx-auto px-4 flex items-center gap-4 h-14">
        <Link href={homeHref} className="flex items-center gap-2.5 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-96.png" alt="" className="h-8 w-8 rounded-[9px]" />
          <span className="font-bold leading-tight">
            Cidade Viva CG
            <span className="block text-xs font-medium text-muted-foreground">{moduleLabel}</span>
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-1">
          <AuthButton />
          <div className="hidden md:block">
            <ModeToggle />
          </div>
          {showNav && (
            <NavMenuSheet>
              <Button variant="ghost" size="icon" className="hidden md:inline-flex" aria-label="Abrir menu">
                <Menu className="h-5 w-5" />
              </Button>
            </NavMenuSheet>
          )}
        </div>
      </div>
    </header>
  )
}
