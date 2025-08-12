"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Calendar, MapPin, Users, Home } from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"

export default function NavigationHeader() {
  const pathname = usePathname()

  const navItems = [
    {
      href: "/",
      label: "Início",
      icon: Home,
      active: pathname === "/",
    },
    {
      href: "/environments",
      label: "Ambientes",
      icon: MapPin,
      active: pathname === "/environments",
    },
    {
      href: "/booking",
      label: "Agendar",
      icon: Calendar,
      active: pathname === "/booking",
    },
    {
      href: "/reservations",
      label: "Reservas",
      icon: Users,
      active: pathname === "/reservations",
    },
  ]

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            <span className="font-bold text-sm sm:text-base md:text-xl">Agendamento - Cidade Viva CG</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <Button
                  key={item.href}
                  asChild
                  variant={item.active ? "default" : "ghost"}
                  className="flex items-center gap-2"
                >
                  <Link href={item.href}>
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </Button>
              )
            })}
            <ModeToggle />
          </nav>

          {/* Mobile Navigation */}
          <nav className="md:hidden flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <Button key={item.href} asChild variant={item.active ? "default" : "ghost"} size="sm">
                  <Link href={item.href}>
                    <Icon className="h-4 w-4" />
                  </Link>
                </Button>
              )
            })}
            <ModeToggle />
          </nav>
        </div>
      </div>
    </header>
  )
}
