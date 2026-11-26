"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { ArrowUpRight, CalendarDays, Check, Clock, Copy, MapPin, PartyPopper, Ticket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export interface EventInfo {
  title: string
  date: string | null
  time: string | null
  location: string | null
  mapUrl?: string | null
  deadline: string | null
}

/** "AAAA-MM-DD" → "sábado, 13 de dezembro" (sem fuso: é uma data de calendário). */
export function formatEventDate(date: string | null) {
  if (!date) return null
  const [y, m, d] = date.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

export function EventHeader({ event, price }: { event: EventInfo; price?: number }) {
  const date = formatEventDate(event.date)
  const chips = [
    date && { icon: CalendarDays, text: date.charAt(0).toUpperCase() + date.slice(1) },
    event.time && { icon: Clock, text: event.time },
    (event.location || event.mapUrl) && {
      icon: MapPin,
      text: event.location || "Ver localização",
      href: event.mapUrl || undefined,
    },
    price !== undefined && { icon: Ticket, text: `${brl(price)} por pessoa` },
  ].filter(Boolean) as { icon: React.ComponentType<{ className?: string }>; text: string; href?: string }[]

  return (
    <header className="relative overflow-hidden rounded-xl border bg-card px-6 py-8 text-center shadow-sm md:px-10">
      {/* Detalhes discretos: faixa no topo e brilho suave na cor do sistema */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/0 via-primary to-primary/0" />
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-32 w-2/3 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative flex flex-col items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
          <PartyPopper className="h-6 w-6" />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">Igreja Cidade Viva CG</p>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{event.title}</h1>
        </div>
        {chips.length > 0 && (
          <ul className="flex flex-wrap justify-center gap-2">
            {chips.map(({ icon: Icon, text, href }) => {
              const chip = "flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-sm text-foreground/80"
              return (
                <li key={text}>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir no Google Maps"
                      className={`${chip} transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground`}
                    >
                      <Icon className="h-3.5 w-3.5 text-primary" />
                      <span className="underline decoration-primary/40 underline-offset-4">{text}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </a>
                  ) : (
                    <span className={chip}>
                      <Icon className="h-3.5 w-3.5 text-primary" />
                      {text}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </header>
  )
}

interface PixInfo {
  payload: string
  receiver_name: string
  key: string
}

/** QR Code + "copia e cola" de um PIX já com valor. */
export function PixPayment({ pix, amount }: { pix: PixInfo; amount: number }) {
  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    QRCode.toDataURL(pix.payload, { width: 280, margin: 1, errorCorrectionLevel: "M" })
      .then(setQr)
      .catch(() => setQr(null))
  }, [pix.payload])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pix.payload)
      setCopied(true)
      toast.success("Código PIX copiado")
      setTimeout(() => setCopied(false), 3000)
    } catch {
      toast.error("Não foi possível copiar. Selecione o código e copie manualmente.")
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Valor do PIX</p>
        <p className="text-3xl font-bold">{brl(amount)}</p>
        <p className="text-sm text-muted-foreground mt-1">Para: {pix.receiver_name}</p>
      </div>

      {qr && (
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR Code do PIX" width={240} height={240} className="rounded-lg border bg-white p-2" />
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium">PIX copia e cola</p>
        <div className="rounded-md border bg-muted/40 p-3 text-xs font-mono break-all select-all">{pix.payload}</div>
        <Button onClick={copy} className="w-full" size="lg">
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          {copied ? "Copiado!" : "Copiar código PIX"}
        </Button>
      </div>
    </div>
  )
}
