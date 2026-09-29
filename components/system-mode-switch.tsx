"use client"

import { Calendar, Users2 } from "lucide-react"
import { useSystemMode } from "@/components/system-mode-provider"
import { useAuth } from "@/components/auth/auth-provider"
import { useRouter, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { isTokenPage } from "@/components/navigation/use-nav-items"

interface SystemModeSwitchProps {
  className?: string
  /** Visibilidade do texto dos botões (no cabeçalho, só em telas largas) */
  labelClassName?: string
  onNavigate?: () => void
}

export function SystemModeSwitch({ className, labelClassName = "hidden 2xl:inline", onNavigate }: SystemModeSwitchProps) {
  const { mode } = useSystemMode()
  const { isAuthenticated, canAccessEscalas } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // Esconder switch em páginas públicas por link ou para usuários não autenticados
  if (isTokenPage(pathname) || !isAuthenticated) {
    return null
  }

  // Com um módulo só, não há o que alternar
  if (!canAccessEscalas()) return null

  const handleSwitch = (target: "agendamentos" | "escalas") => {
    if (target === mode) return
    onNavigate?.()
    if (target === "escalas") {
      router.push("/escalas")
    } else {
      router.push("/")
    }
  }

  const buttonClass = (active: boolean) =>
    cn(
      "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition-all",
      active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
    )

  return (
    <div className={cn("flex bg-muted rounded-lg p-0.5", className)}>
      <button
        onClick={() => handleSwitch("agendamentos")}
        aria-label="Agendamentos"
        title="Agendamentos"
        className={buttonClass(mode === "agendamentos")}
      >
        <Calendar className="h-4 w-4" />
        <span className={labelClassName}>Agendamentos</span>
      </button>
      <button
        onClick={() => handleSwitch("escalas")}
        aria-label="Escalas"
        title="Escalas"
        className={buttonClass(mode === "escalas")}
      >
        <Users2 className="h-4 w-4" />
        <span className={labelClassName}>Escalas</span>
      </button>
    </div>
  )
}
