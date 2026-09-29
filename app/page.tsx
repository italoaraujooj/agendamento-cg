import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { Calendar, CalendarCheck, MapPin, Users, ChevronRight } from "lucide-react"

interface Shortcut {
  href: string
  title: string
  description: string
  icon: LucideIcon
  primary?: boolean
}

const SHORTCUTS: Shortcut[] = [
  { href: "/booking", title: "Agendar espaço", description: "Reserve um ambiente para seu ministério ou evento", icon: Calendar, primary: true },
  { href: "/minha-escala", title: "Minha Escala", description: "Veja quando você serve e confirme sua presença", icon: CalendarCheck },
  { href: "/reservations", title: "Reservas", description: "Agenda de todos os ambientes", icon: Users },
  { href: "/environments", title: "Ambientes", description: "Espaços disponíveis e capacidades", icon: MapPin },
]

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-5xl">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold">Agendamentos</h1>
        <p className="text-muted-foreground">Reserve os espaços da igreja e acompanhe sua escala.</p>
      </div>

      {/* Atalhos: cartões inteiros clicáveis, em lista no celular e grade no desktop */}
      <div className="grid gap-3 sm:grid-cols-2">
        {SHORTCUTS.map(({ href, title, description, icon: Icon, primary }) => (
          <Link
            key={href}
            href={href}
            className={
              primary
                ? "group flex items-center gap-4 rounded-xl p-4 bg-brand text-brand-foreground shadow-sm hover:bg-brand/90 transition-colors"
                : "group flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm hover:border-primary/40 hover:bg-muted/40 transition-colors"
            }
          >
            <span
              className={
                primary
                  ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-foreground/10"
                  : "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand/15 text-primary"
              }
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{title}</span>
              <span className={primary ? "block text-sm text-brand-foreground/80" : "block text-sm text-muted-foreground"}>
                {description}
              </span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5" />
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
