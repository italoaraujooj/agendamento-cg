"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Share, SquarePlus, X } from "lucide-react"

// Evento não padronizado do Chrome/Android
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const DISMISS_KEY = "pwa-install-dismissed-at"
const DISMISS_DAYS = 30
const SHOW_DELAY_MS = 3000

function wasRecentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY))
    return !!at && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari iOS
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIosSafari() {
  const ua = navigator.userAgent
  const isIos = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1)
  // Outros navegadores no iOS (Chrome, Firefox, Instagram...) não oferecem "Adicionar à Tela de Início"
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Instagram|FBAN|FBAV/.test(ua)
  return isIos && isSafari
}

/**
 * Convite para instalar o app na tela inicial do celular.
 * Android/Chrome: usa o prompt nativo. iOS/Safari: mostra o passo a passo.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [mode, setMode] = useState<"android" | "ios" | null>(null)

  useEffect(() => {
    if (isStandalone() || wasRecentlyDismissed()) return

    let timer: ReturnType<typeof setTimeout> | undefined

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      timer = setTimeout(() => setMode("android"), SHOW_DELAY_MS)
    }
    const onInstalled = () => {
      setMode(null)
      setDeferred(null)
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall)
    window.addEventListener("appinstalled", onInstalled)

    if (isIosSafari()) {
      timer = setTimeout(() => setMode("ios"), SHOW_DELAY_MS)
    }

    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener("beforeinstallprompt", onBeforeInstall)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      // Armazenamento indisponível — apenas fecha
    }
    setMode(null)
  }

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    setDeferred(null)
    if (outcome === "accepted") setMode(null)
    else dismiss()
  }

  if (!mode) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 md:hidden animate-in slide-in-from-bottom-4">
      <div className="mx-auto max-w-md rounded-xl border bg-background shadow-lg p-4">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-96.png" alt="" className="h-12 w-12 rounded-xl flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Instale o app Cidade Viva</p>
            {mode === "android" ? (
              <p className="text-xs text-muted-foreground mt-0.5">
                Acesse agendamentos e sua escala direto da tela inicial, sem loja de aplicativos.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Toque em <Share className="inline h-3.5 w-3.5 -mt-0.5" aria-label="Compartilhar" /> e
                depois em <strong>Adicionar à Tela de Início</strong>{" "}
                <SquarePlus className="inline h-3.5 w-3.5 -mt-0.5" aria-hidden />
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="text-muted-foreground hover:text-foreground p-1 -m-1"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {mode === "android" && (
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={dismiss}>
              Agora não
            </Button>
            <Button size="sm" onClick={install}>
              <Download className="mr-2 h-4 w-4" />
              Instalar
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
