"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Bell, BellOff, BellRing, Loader2, Share } from "lucide-react"
import { toast } from "sonner"

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on"

interface PushOptInProps {
  /** Link pessoal da escala, para identificar a pessoa sem login */
  schedule?: { periodToken: string; s: string; k: string }
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

function isIos() {
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1)
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

async function getRegistration() {
  if (!("serviceWorker" in navigator)) return null
  return (await navigator.serviceWorker.getRegistration()) ?? null
}

/**
 * Ativar/desativar notificações push neste dispositivo.
 * No iPhone, só funciona com o app instalado na Tela de Início (iOS 16.4+).
 */
export function PushOptIn({ schedule }: PushOptInProps) {
  const [state, setState] = useState<State>("loading")
  const [busy, setBusy] = useState(false)

  const register = async (subscription: PushSubscription) => {
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: subscription.toJSON(), schedule }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || "Erro ao ativar notificações")
    }
  }

  useEffect(() => {
    ;(async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
      if (!supported) {
        setState(isIos() && !isStandalone() ? "ios-install" : "unsupported")
        return
      }
      if (Notification.permission === "denied") {
        setState("denied")
        return
      }
      const reg = await getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        // Mantém o dispositivo vinculado à pessoa atual (ex.: outra conta neste aparelho)
        register(sub).catch(() => {})
        setState("on")
      } else {
        setState(reg ? "off" : "unsupported")
      }
    })().catch(() => setState("unsupported"))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const enable = async () => {
    if (!PUBLIC_KEY) return
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off")
        return
      }
      const reg = await getRegistration()
      if (!reg) throw new Error("App ainda carregando. Tente de novo em alguns segundos.")
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY),
      })
      try {
        await register(sub)
      } catch (error) {
        await sub.unsubscribe()
        throw error
      }
      setState("on")
      toast.success("Notificações ativadas neste dispositivo")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao ativar notificações")
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    setBusy(true)
    try {
      const reg = await getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setState("off")
      toast.success("Notificações desativadas neste dispositivo")
    } catch {
      toast.error("Erro ao desativar notificações")
    } finally {
      setBusy(false)
    }
  }

  if (!PUBLIC_KEY || state === "loading" || state === "unsupported") return null

  if (state === "ios-install") {
    return (
      <p className="text-sm text-muted-foreground flex items-start gap-2">
        <BellRing className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <span>
          Para receber notificações no iPhone, toque em{" "}
          <Share className="inline h-3.5 w-3.5 -mt-0.5" aria-label="Compartilhar" /> e em{" "}
          <strong>Adicionar à Tela de Início</strong>, depois abra o app por lá.
        </span>
      </p>
    )
  }

  if (state === "denied") {
    return (
      <p className="text-sm text-muted-foreground flex items-start gap-2">
        <BellOff className="h-4 w-4 mt-0.5 flex-shrink-0" />
        Notificações bloqueadas. Libere nas configurações do navegador para este site.
      </p>
    )
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground flex items-center gap-2">
        {state === "on" ? <BellRing className="h-4 w-4 text-primary" /> : <Bell className="h-4 w-4" />}
        {state === "on"
          ? "Notificações ativas neste dispositivo."
          : "Receba um aviso no celular quando for escalado e antes de servir."}
      </p>
      <Button
        size="sm"
        variant={state === "on" ? "outline" : "default"}
        onClick={state === "on" ? disable : enable}
        disabled={busy}
      >
        {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
        {state === "on" ? "Desativar" : "Ativar notificações"}
      </Button>
    </div>
  )
}
