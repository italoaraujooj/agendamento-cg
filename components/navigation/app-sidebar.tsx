"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ModeToggle } from "@/components/mode-toggle"
import { AuthButton } from "@/components/auth/auth-button"
import { SystemModeSwitch } from "@/components/system-mode-switch"
import { isTokenPage, useNavItems } from "./use-nav-items"
import { cn } from "@/lib/utils"

/**
 * Lateral flutuante (card) das telas largas (lg+). O atributo data-sidebar faz o
 * body reservar a largura dela (ver globals.css). No celular e em telas médias a
 * navegação fica no cabeçalho + barra inferior.
 */
export function AppSidebar() {
  const pathname = usePathname()
  const { items, moduleLabel, homeHref } = useNavItems()

  if (isTokenPage(pathname)) return null

  return (
    <aside
      data-sidebar
      aria-label="Navegação principal"
      className="hidden lg:flex fixed z-40 left-4 top-4 bottom-4 w-60 flex-col gap-1 rounded-card bg-sidebar text-sidebar-foreground shadow-card p-3"
    >
      <Link href={homeHref} className="flex items-center gap-2.5 px-2 pt-1 pb-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-96.png" alt="" className="h-9 w-9 rounded-[10px]" />
        <span className="font-bold leading-tight">
          Cidade Viva CG
          <span className="block text-xs font-medium text-muted-foreground">{moduleLabel}</span>
        </span>
      </Link>

      <SystemModeSwitch className="mb-2" labelClassName="inline" />

      <nav className="flex flex-col gap-0.5 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-[15px] font-medium transition-colors",
                item.active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-2 border-t pt-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <AuthButton />
          <ModeToggle />
        </div>
      </div>
    </aside>
  )
}
