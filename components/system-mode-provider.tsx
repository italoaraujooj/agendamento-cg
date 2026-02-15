"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { usePathname } from "next/navigation"

export type SystemMode = "agendamentos" | "escalas"

interface SystemModeContextType {
  mode: SystemMode
  setMode: (mode: SystemMode) => void
  isAgendamentos: boolean
  isEscalas: boolean
}

const SystemModeContext = createContext<SystemModeContextType | undefined>(undefined)

const STORAGE_KEY = "system-mode"

// Rotas que pertencem ao módulo de escalas
const ESCALAS_ROUTES = [
  "/escalas",
  "/ministerios",
  "/calendario",
  "/admin-escalas",
  "/disponibilidade",
]

// Determina o modo baseado na rota atual
function getModeFromPathname(pathname: string): SystemMode {
  const isEscalasRoute = ESCALAS_ROUTES.some(route =>
    pathname === route || pathname.startsWith(`${route}/`)
  )
  return isEscalasRoute ? "escalas" : "agendamentos"
}

interface SystemModeProviderProps {
  children: ReactNode
}

export function SystemModeProvider({ children }: SystemModeProviderProps) {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  // O modo é derivado diretamente da rota atual
  const mode = getModeFromPathname(pathname)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Atualiza o localStorage quando o modo muda (para preferência futura)
  useEffect(() => {
    if (mounted) {
      localStorage.setItem(STORAGE_KEY, mode)
    }
  }, [mode, mounted])

  const setMode = (newMode: SystemMode) => {
    // Esta função agora é apenas para compatibilidade
    // O modo real é controlado pela navegação
    localStorage.setItem(STORAGE_KEY, newMode)
  }

  const value: SystemModeContextType = {
    mode,
    setMode,
    isAgendamentos: mode === "agendamentos",
    isEscalas: mode === "escalas",
  }

  // Evitar flash de conteúdo errado durante hidratação
  if (!mounted) {
    return (
      <SystemModeContext.Provider value={{ ...value, mode: "agendamentos" }}>
        {children}
      </SystemModeContext.Provider>
    )
  }

  return (
    <SystemModeContext.Provider value={value}>
      {children}
    </SystemModeContext.Provider>
  )
}

export function useSystemMode() {
  const context = useContext(SystemModeContext)
  if (context === undefined) {
    throw new Error("useSystemMode must be used within a SystemModeProvider")
  }
  return context
}
