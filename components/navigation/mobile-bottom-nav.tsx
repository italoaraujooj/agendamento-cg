"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { NavMenuSheet } from "./nav-menu-sheet"
import { isTokenPage, useNavItems } from "./use-nav-items"
import { cn } from "@/lib/utils"

/**
 * Barra de navegação inferior do celular: as quatro páginas mais usadas do
 * módulo + "Menu" com o resto. O atributo data-bottom-nav reserva o espaço
 * no fim da página (ver --bottom-nav-h em globals.css).
 */
export function MobileBottomNav() {
  const pathname = usePathname()
  const { primary } = useNavItems()

  if (isTokenPage(pathname)) return null

  const itemClass = (active: boolean) =>
    cn(
      "flex flex-col items-center justify-center gap-0.5 h-16 text-[11px] font-medium transition-colors",
      active ? "text-primary" : "text-muted-foreground active:text-foreground"
    )

  return (
    <nav
      data-bottom-nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 md:hidden border-t bg-background pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-5">
        {primary.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href} className={itemClass(item.active)} aria-current={item.active ? "page" : undefined}>
              <span className={cn("flex items-center justify-center rounded-full w-12 h-7 transition-colors", item.active && "bg-primary/10")}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="truncate max-w-full px-1">{item.label}</span>
            </Link>
          )
        })}
        <NavMenuSheet side="right">
          <button type="button" className={itemClass(false)}>
            <span className="flex items-center justify-center w-12 h-7">
              <Menu className="h-5 w-5" />
            </span>
            Menu
          </button>
        </NavMenuSheet>
      </div>
    </nav>
  )
}
