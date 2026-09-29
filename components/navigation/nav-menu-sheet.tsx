"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { User } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { ModeToggle } from "@/components/mode-toggle"
import { SystemModeSwitch } from "@/components/system-mode-switch"
import { CalendarStatusIndicator } from "@/components/calendar-status-indicator"
import { useAuth } from "@/components/auth/auth-provider"
import { useSystemMode } from "@/components/system-mode-provider"
import { useNavItems } from "./use-nav-items"
import { cn } from "@/lib/utils"

/** Menu completo (celular e telas médias): troca de módulo, todas as páginas, perfil e tema */
export function NavMenuSheet({ children, side = "right" }: { children: ReactNode; side?: "left" | "right" | "bottom" }) {
  const [open, setOpen] = useState(false)
  const { items } = useNavItems()
  const { isAuthenticated } = useAuth()
  const { isEscalas } = useSystemMode()

  const linkClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
      active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
    )

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side={side} className="w-80 max-w-[85vw] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-96.png" alt="" className="h-7 w-7 rounded-md" />
            Cidade Viva CG
          </SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-5">
          <SystemModeSwitch className="w-full" labelClassName="inline" onNavigate={() => setOpen(false)} />

          <nav className="space-y-1">
            {items.map((item) => {
              const Icon = item.icon
              return (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={linkClass(item.active)}>
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="border-t pt-4 space-y-1">
            {isAuthenticated && (
              <Link href="/profile" onClick={() => setOpen(false)} className={linkClass(false)}>
                <User className="h-5 w-5" />
                Perfil e integrações
              </Link>
            )}
            <div className="flex items-center justify-between rounded-lg px-3 py-1 text-sm font-medium">
              <span>Tema</span>
              <ModeToggle />
            </div>
            {!isEscalas && <CalendarStatusIndicator className="w-full justify-start" />}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
