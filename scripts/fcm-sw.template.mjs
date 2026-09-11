/**
 * Kahade — sumber service worker FCM Web.
 *
 * BUKAN file yang di-deploy: `scripts/gen-fcm-sw.mjs` membundle file ini
 * (+ package `firebase`) dengan esbuild menjadi `dist/firebase-messaging-sw.js`.
 *
 * KENAPA DIBUNDLE, BUKAN importScripts CDN (pola umum di tutorial):
 *   1. Tanpa ketergantungan runtime ke www.gstatic.com — push tetap diproses
 *      walau CDN lambat/diblokir, dan versi app & SW selalu identik (satu
 *      package `firebase` di package.json).
 *   2. Compat builds (`-compat.js`) adalah API beku; entry modular
 *      `firebase/messaging/sw` adalah jalur yang didukung Firebase ke depan.
 *
 * `__FCM_CONFIG__` diganti esbuild saat build (lihat gen-fcm-sw.mjs) dengan
 * config Firebase Web dari environment. Jangan import lib/web-push-config
 * di sini: file itu memakai `process.env` yang tidak ada di konteks SW.
 *
 * Kontrak payload dengan backend (sama untuk semua platform):
 *   data: { referenceType?, referenceId?, notificationId?, url? }
 * `url` (bila ada dan same-origin path) menang atas pemetaan reference —
 * backend boleh menunjuk ke layar mana pun tanpa menunggu rilis frontend.
 */
import { initializeApp } from "firebase/app"
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw"

/** @type {{ apiKey: string, authDomain: string, projectId: string, storageBucket: string, messagingSenderId: string, appId: string }} */
const firebaseConfig = __FCM_CONFIG__

initializeApp(firebaseConfig)
const messaging = getMessaging()

const ICON = "/apple-icon.png"
const DEFAULT_PATH = "/notifications"

/**
 * Cermin `routeForNotificationReference` (lib/notification-routing.ts) dalam
 * bentuk path string. Dijaga sejajar secara manual — bila menambah tipe di
 * sana, tambahkan di sini. Daftar sengaja minimal (tanpa query builder):
 * SW hanya butuh path tujuan, bukan objek Href.
 */
function normalizeType(t) {
  return String(t).replace(/[\s_-]/g, "").toLowerCase()
}

function pathForReference(referenceType, referenceId) {
  const type = referenceType ? normalizeType(referenceType) : ""
  const id = (referenceId ?? "").trim()
  const withId = (base, fallback) => (id ? `${base}/${encodeURIComponent(id)}` : fallback)
  switch (type) {
    case "order":
    case "transaction":
    case "escrow":
      return withId("/order", "/transactions")
    case "orderlink":
      return withId("/order-link", "/order-links")
    case "dispute":
      return withId("/dispute", "/disputes")
    case "wallettransaction":
    case "wallettx":
    case "topup":
    case "withdraw":
    case "withdrawal":
    case "transfer":
      return withId("/wallet-transaction", "/wallet")
    case "wallet":
      return "/wallet"
    case "chat":
    case "chatroom":
    case "message":
      return id ? `/chat/${encodeURIComponent(id)}` : "/chat"
    case "supportticket":
    case "ticket":
    case "support":
      return withId("/support", "/support")
    case "user":
    case "profile":
    case "follow":
    case "follower":
      return id ? `/user/${encodeURIComponent(id)}` : DEFAULT_PATH
    case "kyc":
    case "verification":
      return "/kyc"
    case "subscription":
      return "/subscriptions"
    case "referral":
      return "/referral"
    case "rating":
    case "review":
      return "/ratings"
    case "security":
    case "session":
    case "login":
      return "/security"
    default:
      return DEFAULT_PATH
  }
}

/** Hanya path same-origin (`/order/123`) yang diterima dari `data.url`. */
function safePath(url) {
  if (typeof url !== "string" || !url.startsWith("/")) return null
  // Tolak `//host` (protocol-relative → bisa kabur ke origin lain).
  if (url.startsWith("//")) return null
  return url
}

function targetPath(data) {
  return safePath(data?.url) ?? pathForReference(data?.referenceType, data?.referenceId)
}

onBackgroundMessage(messaging, (payload) => {
  const data = payload.data ?? {}
  // Payload DENGAN `notification` sudah ditampilkan otomatis oleh SDK —
  // menampilkannya lagi di sini = notifikasi GANDA. Hanya payload data-only
  // yang perlu ditampilkan manual.
  if (payload.notification) return undefined
  const title = "Kahade"
  const body = String(data.body ?? data.message ?? "Ada pembaruan baru.")
  return self.registration.showNotification(title, {
    body,
    icon: ICON,
    badge: ICON,
    tag: String(data.notificationId ?? data.referenceId ?? "kahade"),
    data: { ...data, url: targetPath(data) },
  })
})

// Klik notifikasi (baik otomatis-SDK maupun manual di atas) → buka/fokus app.
self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const path = targetPath(event.notification.data ?? {})
  const url = new URL(path, self.location.origin).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      const open = windows.find((c) => new URL(c.url).origin === self.location.origin)
      if (open) {
        try {
          // `navigate` hanya untuk same-origin — URL kita selalu same-origin.
          await open.navigate(url)
        } catch {
          /* tab lama / browser tanpa navigate: cukup fokus */
        }
        return open.focus()
      }
      return self.clients.openWindow(url)
    })(),
  )
})
