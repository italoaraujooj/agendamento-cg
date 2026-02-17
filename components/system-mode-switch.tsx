"use client"

import { Calendar, Users2 } from "lucide-react"
import { useSystemMode } from "@/components/system-mode-provider"
import { useAuth } from "@/components/auth/auth-provider"
import { useRouter, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export function SystemModeSwitch() {
  const { mode } = useSystemMode()
  const { isAuthenticated } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // Não mostrar o switch em páginas públicas específicas
  const publicPaths = ["/disponibilidade", "/escala"]
  const isPublicPage = publicPaths.some(path => pathname.startsWith(path))

  // Esconder switch em páginas públicas ou para usuários não autenticados
  if (isPublicPage || !isAuthenticated) {
    return null
  }

  const handleSwitch = (target: "agendamentos" | "escalas") => {
    if (target === mode) return
    if (target === "escalas") {
      router.push("/escalas")
    } else {
      router.push("/")
    }
  }

  return (
    <div className="flex bg-muted rounded-lg p-0.5">
      <button
        onClick={() => handleSwitch("agendamentos")}
        aria-label="Agendamentos"
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition-all",
          mode === "agendamentos"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Calendar className="h-4 w-4" />
        <span className="hidden sm:inline">Agendamentos</span>
      </button>
      <button
        onClick={() => handleSwitch("escalas")}
        aria-label="Escalas"
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition-all",
          mode === "escalas"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Users2 className="h-4 w-4" />
        <span className="hidden sm:inline">Escalas</span>
      </button>
    </div>
  )
}
