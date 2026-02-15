"use client"

import { Calendar, Users2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSystemMode } from "@/components/system-mode-provider"
import { useRouter, usePathname } from "next/navigation"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function SystemModeSwitch() {
  const { mode, setMode } = useSystemMode()
  const router = useRouter()
  const pathname = usePathname()

  const handleSwitch = () => {
    // Redirecionar para home do módulo oposto
    // O modo será atualizado automaticamente pelo provider baseado na rota
    if (mode === "agendamentos") {
      router.push("/escalas")
    } else {
      router.push("/")
    }
  }

  // Não mostrar o switch em páginas públicas específicas
  const publicPaths = ["/disponibilidade/", "/escala/"]
  const isPublicPage = publicPaths.some(path => pathname.includes(path))
  
  if (isPublicPage) {
    return null
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSwitch}
            className="gap-2"
          >
            {mode === "agendamentos" ? (
              <>
                <Users2 className="h-4 w-4" />
                <span className="hidden sm:inline">Escalas</span>
              </>
            ) : (
              <>
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">Agendamentos</span>
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {mode === "agendamentos" 
            ? "Ir para o módulo de Escalas" 
            : "Ir para o módulo de Agendamentos"
          }
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
