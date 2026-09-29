"use client"

import { Button } from "@/components/ui/button"
import { CalendarPlus, Copy } from "lucide-react"
import { toast } from "sonner"

/**
 * Assinar a escala no calendário do celular/computador (feed ICS).
 * O calendário se atualiza sozinho quando a escala muda.
 */
export function CalendarSubscribe({ calendarToken }: { calendarToken: string }) {
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const httpsUrl = `${origin}/api/escalas/ics/${calendarToken}`
  const webcalUrl = httpsUrl.replace(/^https?:/, "webcal:")
  const googleUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(httpsUrl)
      toast.success("Link do calendário copiado")
    } catch {
      toast.error("Não foi possível copiar")
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" asChild>
        <a href={googleUrl} target="_blank" rel="noopener noreferrer">
          <CalendarPlus className="mr-1.5 h-4 w-4" />
          Google Agenda
        </a>
      </Button>
      <Button size="sm" variant="outline" asChild>
        <a href={webcalUrl}>
          <CalendarPlus className="mr-1.5 h-4 w-4" />
          iPhone / Outlook
        </a>
      </Button>
      <Button size="sm" variant="ghost" onClick={copy} title="Copiar link do calendário">
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  )
}
