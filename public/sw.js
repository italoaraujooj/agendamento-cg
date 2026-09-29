/*
 * Service worker do PWA Cidade Viva CG.
 *
 * Escopo deliberadamente pequeno:
 * - Assets estáticos com hash (/_next/static) e ícones: cache-first.
 * - Navegação: sempre pela rede; sem conexão, mostra a página /offline.
 * - Nunca cacheia /api, respostas do Supabase nem páginas renderizadas,
 *   para não exibir escalas/agendamentos desatualizados nem dados de
 *   outra sessão após logout.
 */

const VERSION = "v1"
const STATIC_CACHE = `cv-static-${VERSION}`
const OFFLINE_CACHE = `cv-offline-${VERSION}`
const OFFLINE_URL = "/offline"

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png"]))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== OFFLINE_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((response) => response || Response.error())
      )
    )
    return
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then(
          (cached) =>
            cached ||
            fetch(request).then((response) => {
              if (response.ok) cache.put(request, response.clone())
              return response
            })
        )
      )
    )
  }
  // Demais requisições (API, Supabase, imagens dinâmicas): seguem direto para a rede
})
