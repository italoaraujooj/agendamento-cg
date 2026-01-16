"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Moon, Sun } from "lucide-react"

export function ModeToggle() {
  const { theme, setTheme, systemTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Evitar hidratação mismatch esperando o componente montar
  useEffect(() => {
    setMounted(true)
  }, [])

  const effective = theme === "system" ? systemTheme : theme
  const isDark = effective === "dark"

  // Não renderizar até estar montado para evitar hidratação mismatch
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label="Alternar tema"
        disabled
      >
        <div className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Alternar tema"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}


