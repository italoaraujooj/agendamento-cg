"use client"

import { usePathname } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import { BookOpen, Calendar, CalendarCheck, MapPin, Users, Home, Shield, Users2, CalendarDays, Megaphone } from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { useSystemMode } from "@/components/system-mode-provider"

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  active: boolean
}

/** Páginas públicas por link (sem navegação do app): disponibilidade e escala pessoal */
export function isTokenPage(pathname: string) {
  return pathname.startsWith("/disponibilidade") || pathname === "/escala" || pathname.startsWith("/escala/")
}

/**
 * Itens de navegação do módulo atual, compartilhados pelo cabeçalho (desktop),
 * pela barra inferior e pelo menu completo (celular).
 */
export function useNavItems() {
  const pathname = usePathname()
  const { isAdmin, isAuthenticated, hasPermission, ministryRoles } = useAuth()
  const { isEscalas } = useSystemMode()

  const item = (href: string, label: string, icon: LucideIcon, prefix = false): NavItem => ({
    href,
    label,
    icon,
    active: pathname === href || (prefix && pathname.startsWith(href + "/")),
  })

  const home = isEscalas ? item("/escalas", "Início", Home) : item("/", "Início", Home)
  // Página do servo: visível para todos, nos dois modos — quem não tem acesso ao
  // módulo de Escalas (a maioria dos servos) não teria outro caminho até ela.
  const minhaEscala = item("/minha-escala", "Minha Escala", CalendarCheck)
  // Manual de Serviço: para qualquer pessoa logada, nos dois módulos
  const manual = isAuthenticated ? item("/manual", "Manual", BookOpen) : null

  // Admin de agendamentos: qualquer permissão de gestão
  const canSeeAgendamentosAdmin =
    isAuthenticated &&
    (isAdmin || hasPermission("approve_bookings") || hasPermission("manage_external_rentals") || hasPermission("manage_avisos"))
  // Admin ou líder de algum ministério (as telas e APIs limitam aos ministérios que ele gerencia)
  const canSeeEscalasAdmin = isAuthenticated && (isAdmin || ministryRoles.length > 0)

  const admin = isEscalas
    ? canSeeEscalasAdmin ? item("/admin-escalas", "Admin", Shield, true) : null
    : canSeeAgendamentosAdmin ? item("/admin", "Admin", Shield, true) : null

  let items: NavItem[]
  let primary: NavItem[]

  if (isEscalas) {
    const ministerios = item("/ministerios", "Ministérios", Users2, true)
    const calendario = item("/calendario", "Calendário", CalendarDays)
    items = [home, minhaEscala, ...(manual ? [manual] : []), ministerios, calendario, ...(admin ? [admin] : [])]
    primary = [home, minhaEscala, calendario, admin ?? ministerios]
  } else {
    const ambientes = item("/environments", "Ambientes", MapPin)
    const agendar = item("/booking", "Agendar", Calendar)
    const reservas = item("/reservations", "Reservas", Users)
    const avisos = isAuthenticated ? item("/avisos", "Avisos", Megaphone) : null
    items = [home, minhaEscala, ...(manual ? [manual] : []), ambientes, agendar, reservas, ...(avisos ? [avisos] : []), ...(admin ? [admin] : [])]
    primary = [home, agendar, reservas, minhaEscala]
  }

  return {
    /** Todos os itens do módulo, na ordem do menu */
    items,
    /** Os quatro mais usados, para a barra inferior do celular */
    primary,
    moduleLabel: isEscalas ? "Escalas" : "Agendamentos",
    homeHref: home.href,
  }
}
