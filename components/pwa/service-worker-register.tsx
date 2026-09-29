"use client"

import { useEffect } from "react"

/** Registra o service worker do PWA (apenas em produção). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return

    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Falha ao registrar service worker:", error)
    })
  }, [])

  return null
}
