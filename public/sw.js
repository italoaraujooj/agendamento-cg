/*
 * Service worker do PWA Cidade Viva CG.
 *
 * Escopo deliberadamente pequeno:
 * - Assets estáticos com hash (/_next/static) e ícones: cache-first, com
 *   limite de entradas: a cada deploy os arquivos ganham nomes novos, e os
 *   antigos (que não serão mais pedidos) saem do cache, do mais antigo
 *   para o mais novo, quando o limite é ultrapassado.
 * - Navegação: sempre pela rede; sem conexão, mostra a página /offline.
 * - Nunca cacheia /api, respostas do Supabase nem páginas renderizadas,
 *   para não exibir escalas/agendamentos desatualizados nem dados de
 *   outra sessão após logout.
 */

// Trocar a versão apaga todos os caches anteriores no "activate"
const VERSION = "v2"
const STATIC_CACHE = `cv-static-${VERSION}`
const OFFLINE_CACHE = `cv-offline-${VERSION}`
const OFFLINE_URL = "/offline"
// Um deploy usa algumas dezenas de arquivos; 150 cobre a versão atual com folga
const MAX_STATIC_ENTRIES = 150

/** Remove as entradas mais antigas (ordem de inserção) além do limite */
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  const excess = keys.length - maxEntries
  if (excess > 0) await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)))
}

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
              if (response.ok) {
                cache
                  .put(request, response.clone())
                  .then(() => trimCache(STATIC_CACHE, MAX_STATIC_ENTRIES))
                  .catch(() => {})
              }
              return response
            })
        )
      )
    )
  }
  // Demais requisições (API, Supabase, imagens dinâmicas): seguem direto para a rede
})

// ─── Notificações push ─────────────────────────────────────────────────────
// Payload enviado pelo servidor (lib/push.ts): { title, body, url, tag? }
self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: "Cidade Viva CG", body: event.data ? event.data.text() : "" }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Cidade Viva CG", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-96.png",
      tag: data.tag,
      renotify: !!data.tag,
      data: { url: data.url || "/" },
    })
  )
})

// Toque na notificação: reaproveita uma janela do app já aberta ou abre uma nova
self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && "navigate" in client) {
          return client.navigate(target).then((c) => (c || client).focus())
        }
      }
      return self.clients.openWindow(target)
    })
  )
})
