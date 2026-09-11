/**
 * Kahade — FCM Web Push, IMPLEMENTASI BROWSER.
 *
 * Dipilih otomatis oleh Metro untuk target web (lihat `lib/web-push.ts`
 * untuk penjelasan split platform). Satu-satunya file aplikasi yang boleh
 * import `firebase/*`.
 *
 * Alur: cek dukungan → izin Notification → daftar service worker →
 * getToken(VAPID) → daftarkan ke backend sebagai `platform: "web"`.
 * Backend mengirim ke token ini lewat FCM HTTP v1 seperti biasa; tidak ada
 * ketergantungan ke Expo Push Service di jalur web.
 *
 * Keputusan non-obvious:
 *   - Semua fungsi aman dipanggil saat prerender SSR (`typeof window` guard):
 *     `expo export` mengeksekusi modul ini di Node. Tanpa guard, build web
 *     gagal dengan `window is not defined`.
 *   - Tanpa env Firebase (`isWebPushConfigured()` false) semua fungsi
 *     mengembalikan null/no-op — web app tetap fully usable, hanya push yang
 *     mati. Ini disengaja: kredensial Firebase Web dibuat terpisah dari
 *     google-services.json/Info.plist dan mungkin belum ada saat deploy awal.
 *   - Izin hanya diminta dari user gesture (tombol di Welcome / Preferensi
 *     Notifikasi). Browser (terutama Safari) mengabaikan/memblokir
 *     `requestPermission()` yang dipanggil saat boot tanpa interaksi.
 *   - Registrasi SW ditunggu `navigator.serviceWorker.ready`: `getToken()`
 *     dengan registrasi yang belum `active` gagal dengan error samar
 *     ("messaging/failed-service-worker-registration").
 *   - Pesan foreground DITAMPILKAN sebagai system Notification (bukan hanya
 *     diteruskan ke callback): pengguna yang sedang membuka tab lain tetap
 *     melihatnya. Klik notifikasi → `onOpen(data, "tap")` → root layout
 *     menavigasi, sama seperti tap push native.
 */

import { getApps, initializeApp, type FirebaseApp } from "firebase/app"
import { deleteToken, getMessaging, getToken, isSupported, onMessage } from "firebase/messaging"

import type { RegisterDeviceApi } from "@/lib/push-notifications"
import {
  SecureKeys,
  deleteSecureItem,
  getOrCreateDeviceId,
  getSecureItem,
  setSecureItem,
} from "@/lib/secure-storage"
import { getFirebaseWebConfig } from "@/lib/web-push-config"

export type { WebPushOpenSource } from "@/lib/web-push"

/** Path service worker hasil `scripts/gen-fcm-sw.mjs` (scope root `/`). */
export const FCM_SERVICE_WORKER_URL = "/firebase-messaging-sw.js"

/** Ikon notifikasi browser — PNG (SVG tidak didukung semua browser). */
const NOTIFICATION_ICON = "/apple-icon.png"

let app: FirebaseApp | null = null

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof navigator !== "undefined"
}

function getApp(): FirebaseApp | null {
  if (!isBrowser()) return null
  const config = getFirebaseWebConfig()
  if (!config) return null
  if (!app) {
    const { vapidKey: _vapidKey, ...firebaseConfig } = config
    app = getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig)
  }
  return app
}

/**
 * Minta izin (bila belum diputuskan) dan ambil token FCM Web.
 * `null` = tidak bisa (belum dikonfigurasi, browser tak mendukung,
 * bukan secure context, izin ditolak, SW gagal). Tidak pernah melempar.
 */
export async function getWebPushToken(): Promise<string | null> {
  try {
    if (!isBrowser()) return null
    if (!(await isSupported().catch(() => false))) return null
    // getToken memakai PushManager + IndexedDB: butuh HTTPS (localhost OK).
    if (!window.isSecureContext) return null
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return null

    const config = getFirebaseWebConfig()
    const firebaseApp = getApp()
    if (!config || !firebaseApp) return null

    if (Notification.permission === "denied") return null
    if (Notification.permission === "default") {
      const answer = await Notification.requestPermission()
      if (answer !== "granted") return null
    }

    const registration = await navigator.serviceWorker.register(FCM_SERVICE_WORKER_URL)
    // `register()` resolve sebelum worker aktif; `ready` menunggu active.
    const ready = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("service worker timeout")), 15_000),
      ),
    ]).catch(() => registration)

    const messaging = getMessaging(firebaseApp)
    return await getToken(messaging, {
      vapidKey: config.vapidKey,
      serviceWorkerRegistration: ready,
    })
  } catch (err) {
    if (__DEV__) console.warn("[kahade/web-push] gagal mengambil token FCM Web:", err)
    return null
  }
}

/**
 * Daftarkan token FCM Web ke backend (mirror `registerPushDevice` native).
 * Melewati panggilan API bila token sama dengan yang tersimpan, kecuali
 * `force`. Kembalikan token, atau `null` bila tidak tersedia.
 */
export async function registerWebPushDevice(
  api: RegisterDeviceApi,
  opts?: { force?: boolean },
): Promise<string | null> {
  const token = await getWebPushToken()
  if (!token) return null

  const previous = await getSecureItem(SecureKeys.pushToken).catch(() => null)
  if (previous === token && !opts?.force) return token

  const deviceId = await getOrCreateDeviceId()
  await api.registerDevice({ token, platform: "web", deviceId })
  await setSecureItem(SecureKeys.pushToken, token).catch(() => undefined)
  return token
}

/**
 * Lepas pendaftaran — panggil saat logout SEBELUM `clearSession()`.
 * Selain melepas di backend (seperti native), token FCM-nya sendiri dihapus
 * supaya token basi tidak bisa dipakai bila backend gagal melepas.
 * Kegagalan tidak melempar: logout harus tetap selesai.
 */
export async function unregisterWebPushDevice(api: RegisterDeviceApi): Promise<void> {
  try {
    const firebaseApp = getApp()
    if (firebaseApp && (await isSupported().catch(() => false))) {
      await deleteToken(getMessaging(firebaseApp)).catch(() => undefined)
    }
  } catch {
    /* lanjut ke pelepasan backend */
  }
  try {
    await api.unregisterDevice()
  } catch (err) {
    if (__DEV__) console.warn("[kahade/web-push] unregister gagal (diabaikan):", err)
  } finally {
    await deleteSecureItem(SecureKeys.pushToken).catch(() => undefined)
  }
}

/**
 * Dengarkan pesan FCM saat app terbuka (foreground).
 *
 * Firebase TIDAK menampilkan notifikasi otomatis untuk pesan foreground —
 * itu tanggung jawab kita. Setiap pesan ditampilkan sebagai system
 * Notification; kliknya memanggil `onOpen(data, "tap")`, pesan yang tiba
 * memanggil `onOpen(data, "foreground")` (untuk refresh badge/unread tanpa
 * navigasi). Kembalikan fungsi unsubscribe.
 */
export function subscribeWebPushMessages(
  onOpen: (data: unknown, source: "foreground" | "tap") => void,
): () => void {
  if (!isBrowser()) return () => undefined
  const firebaseApp = getApp()
  if (!firebaseApp) return () => undefined

  let unsubscribe: (() => void) | undefined
  void isSupported()
    .then((supported) => {
      if (!supported) return
      unsubscribe = onMessage(getMessaging(firebaseApp), (payload) => {
        const data = payload.data ?? {}
        onOpen(data, "foreground")
        try {
          if (!("Notification" in window) || Notification.permission !== "granted") return
          const title = payload.notification?.title ?? "Kahade"
          const body = payload.notification?.body ?? ""
          const notification = new Notification(title, {
            body: body || undefined,
            icon: payload.notification?.image ?? NOTIFICATION_ICON,
            badge: NOTIFICATION_ICON,
            tag: String(
              (data as Record<string, unknown>).notificationId ??
                (data as Record<string, unknown>).referenceId ??
                "kahade",
            ),
            data,
          })
          notification.onclick = () => {
            try {
              window.focus()
            } catch {
              /* abaikan */
            }
            notification.close()
            onOpen(data, "tap")
          }
        } catch (err) {
          if (__DEV__) console.warn("[kahade/web-push] foreground notification gagal:", err)
        }
      })
    })
    .catch(() => undefined)

  return () => {
    try {
      unsubscribe?.()
    } catch {
      /* abaikan */
    }
  }
}
