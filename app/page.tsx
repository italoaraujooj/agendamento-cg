import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { Calendar, CalendarCheck, MapPin, Users, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface Shortcut {
  href: string
  title: string
  description: string
  icon: LucideIcon
  /** Ilustração 3D (Fluent Emoji 3D, MIT) em public/3d */
  art: string
  /** Colunas na grade de 6 (telas sm+) */
  span: string
  primary?: boolean
}

const SHORTCUTS: Shortcut[] = [
  { href: "/booking", title: "Agendar espaço", description: "Escolha o ambiente, o dia e o horário para seu ministério ou evento", icon: Calendar, art: "/3d/calendario.webp", span: "sm:col-span-6 lg:col-span-4", primary: true },
  { href: "/minha-escala", title: "Minha Escala", description: "Veja quando você serve e confirme sua presença", icon: CalendarCheck, art: "/3d/maos.webp", span: "sm:col-span-6 lg:col-span-2" },
  { href: "/reservations", title: "Reservas", description: "Agenda de todos os ambientes", icon: Users, art: "/3d/prancheta.webp", span: "sm:col-span-3" },
  { href: "/environments", title: "Ambientes", description: "Espaços disponíveis e capacidades", icon: MapPin, art: "/3d/igreja.webp", span: "sm:col-span-3" },
]

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 space-y-6 max-w-5xl">
      <div className="space-y-1">
        <h1 className="text-[28px] sm:text-[34px] font-bold tracking-[-0.02em] leading-tight">Agendamentos</h1>
        <p className="text-muted-foreground">Reserve os espaços da igreja e acompanhe sua escala.</p>
      </div>

      {/* Atalhos em grade bento: cartões inteiros clicáveis, com ilustração 3D no canto */}
      <div className="grid gap-4 sm:grid-cols-6">
        {SHORTCUTS.map(({ href, title, description, icon: Icon, art, span, primary }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "group relative flex flex-col justify-between gap-6 overflow-hidden rounded-card p-5 sm:p-6 shadow-card transition-transform active:scale-[0.99]",
              primary ? "bg-brand text-brand-foreground min-h-44" : "bg-card hover:bg-card/80 min-h-36",
              span
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={art}
              alt=""
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute right-4 top-4 transition-transform group-hover:-rotate-3 group-hover:scale-105",
                primary ? "h-20 w-20 sm:h-24 sm:w-24" : "h-14 w-14 sm:h-16 sm:w-16"
              )}
            />
            <span
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl",
                primary ? "bg-brand-foreground/10" : "bg-brand-soft text-brand-soft-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 pr-16">
              <span className={cn("flex items-center gap-1 font-semibold", primary ? "text-xl" : "text-[17px]")}>
                {title}
                <ChevronRight className="h-4 w-4 opacity-60 transition-transform group-hover:translate-x-0.5" />
              </span>
              <span className={cn("block text-sm mt-0.5", primary ? "text-brand-foreground/80" : "text-muted-foreground")}>
                {description}
              </span>
            </span>
          </Link>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Ao utilizar este sistema, você concorda com nossa{" "}
        <Link href="/privacy" className="text-primary hover:underline font-medium">
          Política de Privacidade
        </Link>
      </p>
    </div>
  )
}
