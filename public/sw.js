/* Kahade static PWA shell service worker.
 *
 * Deliberately does not cache API responses, authenticated pages, or anything
 * under /v1/. The shell is only a resilience layer for the public web app;
 * wallet/order data must always come from the network.
 *
 * FCM has its own worker at /firebase-messaging-sw.js with the narrower
 * /firebase-messaging/ scope. Keeping the scopes separate is required: two
 * root-scope workers would replace each other unpredictably.
 */
const SHELL_CACHE = "kahade-shell-v2"
const SHELL_ASSETS = ["/", "/icon-192.png", "/icon-512.png"]
const ALWAYS_NETWORK = new Set(["/sw.js", "/register-sw.js", "/manifest.json", "/firebase-messaging-sw.js"])

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)))
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== "GET" || url.origin !== self.location.origin) return
  if (ALWAYS_NETWORK.has(url.pathname)) return
  if (url.pathname.startsWith("/v1/") || url.pathname.startsWith("/api/")) return
  if (request.headers.has("authorization") || request.headers.has("cookie")) return

  // Hashed bundles/assets can be served cache-first. Documents stay
  // network-first so a deployment is visible without a forced reload.
  if (request.destination === "script" || request.destination === "style" || request.destination === "font") {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) void caches.open(SHELL_CACHE).then((cache) => cache.put(request, response.clone()))
          return response
        }),
      ),
    )
    return
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() => caches.match("/")),
    )
  }
})
