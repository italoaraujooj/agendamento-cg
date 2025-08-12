import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import "./globals.css"
import NavigationHeader from "@/components/navigation-header"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"

export const metadata: Metadata = {
  title: "Sistema de Agendamento - Igreja Cidade Viva Campina Grande",
  description: "Sistema para agendamento de espaços",
  generator: "v0.dev",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
      </head>
      <body className="bg-background min-h-screen">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <NavigationHeader />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
