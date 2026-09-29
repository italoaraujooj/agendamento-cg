import type React from "react"
import type { Metadata, Viewport } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import "./globals.css"
import NavigationHeader from "@/components/navigation-header"
import Footer from "@/components/footer"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/components/auth/auth-provider"
import { SystemModeProvider } from "@/components/system-mode-provider"
import { AutoMigrateBookings } from "@/components/auth/auto-migrate"
import { CompleteProfileModal } from "@/components/auth/complete-profile-modal"
import { Toaster } from "@/components/ui/sonner"
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register"
import { InstallPrompt } from "@/components/pwa/install-prompt"
import { MobileBottomNav } from "@/components/navigation/mobile-bottom-nav"

export const metadata: Metadata = {
  title: "Cidade Viva CG - Agendamentos e Escalas",
  description: "Agendamento de espaços e escalas de ministérios da Igreja Cidade Viva Campina Grande",
  applicationName: "Cidade Viva CG",
  appleWebApp: {
    capable: true,
    title: "Cidade Viva",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  // Permite usar env(safe-area-inset-*) na barra inferior (iPhone com app instalado)
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcf8f0" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
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
        {/* Script que roda antes do React para detectar link de recuperação de senha */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var hash = window.location.hash;
            if (hash.indexOf('type=recovery') !== -1 && hash.indexOf('access_token=') !== -1) {
              var params = new URLSearchParams(hash.substring(1));
              var at = params.get('access_token');
              var rt = params.get('refresh_token');
              if (at && rt) {
                try { sessionStorage.setItem('sb_recovery_at', at); sessionStorage.setItem('sb_recovery_rt', rt); } catch(e) {}
                window.location.replace('/resetar-senha');
              }
            }
          })();
        ` }} />
      </head>
      <body className="bg-background min-h-screen flex flex-col">
        <ThemeProvider>
          <AuthProvider>
            <SystemModeProvider>
              <AutoMigrateBookings />
              <CompleteProfileModal />
              <NavigationHeader />
              <main className="flex-1">
                {children}
              </main>
              <Footer />
              <MobileBottomNav />
              <Toaster />
              <InstallPrompt />
              <ServiceWorkerRegister />
            </SystemModeProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
