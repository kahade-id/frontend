/**
 * Kahade — push notification (expo-notifications) ⇄ backend
 * `POST /v1/notifications/register-device` & `/unregister-device`.
 *
 * Alur: izin -> token -> daftarkan ke backend -> simpan token di SecureStore.
 * Logout memanggil `unregisterPushDevice()` SEBELUM token auth dihapus
 * (endpoint butuh access-token) supaya perangkat lama tidak terus menerima
 * notifikasi transaksi milik akun yang sudah keluar.
 *
 * Keputusan non-obvious:
 *   - Token yang dikirim ke backend adalah **Expo push token**
 *     (`ExponentPushToken[...]`), bukan FCM/APNs mentah. Backend cukup memukul
 *     Expo Push API — satu jalur untuk Android & iOS. Kalau backend nanti
 *     ingin FCM/APNs langsung, ganti ke `getDevicePushTokenAsync()`;
 *     `RegisterDeviceDto.token` maxLength 512 muat untuk keduanya.
 *   - `projectId` diambil dari `Constants.expoConfig.extra.eas.projectId`
 *     (terisi otomatis oleh `eas init`). Tanpa EAS project, `getExpoPushTokenAsync`
 *     melempar — kita tangkap dan kembalikan `null`, bukan crash saat dev.
 *   - Emulator/simulator tidak punya push token (`Device.isDevice` false):
 *     langsung `null` tanpa memanggil API OS agar tidak muncul error merah
 *     di Expo Go.
 *   - Android wajib punya channel sebelum notifikasi tampil (API 26+). Ada
 *     DUA channel supaya pengguna bisa mematikan pengumuman tanpa ikut
 *     mematikan notifikasi uang: "transaksi" (MAX, escrow/order) dan
 *     "default" (DEFAULT, sisanya). Kalau hanya satu channel, satu-satunya
 *     pilihan pengguna yang terganggu promosi adalah mematikan semuanya —
 *     termasuk notifikasi dana masuk.
 *   - Handler foreground menampilkan banner + list (SDK 53+ memakai
 *     `shouldShowBanner/shouldShowList`, `shouldShowAlert` deprecated).
 *     Suara dimatikan di foreground: pengguna sedang melihat app; Banner
 *     in-app (§9.11) yang akan memberi konteks.
 *   - Fetch dilakukan lewat `api` yang di-inject pemanggil (`RegisterDeviceApi`),
 *     bukan `fetch` global, supaya modul ini tidak tahu base URL / header
 *     auth — konsisten dengan komponen UI yang bebas dependensi jaringan.
 */
import Constants from "expo-constants"
import * as Device from "expo-device"
import { Platform } from "react-native"

// PERF-FIX (bundle): `expo-notifications` (±1.6MB — modul native terbesar di
// boot graph) JANGAN diimpor statis. Modul ini diimpor banyak rute
// (settings, delete-account, notification-preferences, …) yang di native
// semuanya dievaluasi saat boot — import statis di sini berarti
// expo-notifications selalu dievaluasi saat boot padahal hanya dipakai di
// dalam fungsi async. Muat lazy via loadNotifications() di bawah.
type ExpoNotificationsModule = typeof import("expo-notifications")
let notificationsPromise: Promise<ExpoNotificationsModule> | null = null
function loadNotifications(): Promise<ExpoNotificationsModule> {
  if (!notificationsPromise) notificationsPromise = import("expo-notifications")
  return notificationsPromise
}

import { invalidateQueryCache, invalidateQueryPrefix } from "@/lib/query-cache"
import { refreshUnreadCount } from "@/lib/unread-count"
import { refreshChatUnreadCount } from "@/lib/chat-unread-count"
import {
  ensureLocalNotificationPrefs,
  localKindForPushData,
} from "@/lib/notification-local-prefs"
import { SecureKeys, deleteSecureItem, getOrCreateDeviceId, getSecureItem, setSecureItem } from "@/lib/secure-storage"
import { logWarn } from "@/lib/telemetry"
import {
  CONFIRM_RECEIPT_ACTION,
  ORDER_ACTION_CATEGORY,
} from "@/lib/order-confirm"

export type PushPlatform = "android" | "ios" | "web"

/** Body `RegisterDeviceDto` persis seperti OpenAPI */
export type RegisterDeviceDto = {
  token: string
  platform?: PushPlatform
  deviceId?: string
}

/** Klien HTTP minimal yang sudah membawa header Authorization */
export type RegisterDeviceApi = {
  registerDevice: (body: RegisterDeviceDto) => Promise<void>
  /**
   * BFI-111: `deviceId` WAJIB diteruskan ke backend
   * (`POST /v1/notifications/unregister-device` menolak body kosong dengan
   * 400 INVALID_DEVICE_ID). `unregisterPushDevice` di bawah mengisi argumen
   * ini dari `getOrCreateDeviceId()` — sumber yang SAMA dengan
   * `registerPushDevice` — sehingga implementasi cukup meneruskannya.
   */
  unregisterDevice: (deviceId: string) => Promise<void>
}

/**
 * Channel notifikasi Android (API 26+). Notifikasi TIDAK akan tampil kalau
 * channel-nya belum pernah dibuat, jadi semuanya dibuat saat boot di
 * `setupNotifications()`.
 *
 * Nilai `default` WAJIB sama dengan `defaultChannel` pada plugin
 * expo-notifications di app.json — itulah channel yang dipakai FCM saat
 * payload tidak menyertakan `channelId`. Dijaga mesin oleh `npm run check:push`.
 *
 * PENTING — channel bersifat sekali tulis. Setelah dibuat di perangkat,
 * `importance`, suara, dan getarnya dimiliki PENGGUNA: memanggil
 * `setNotificationChannelAsync` lagi dengan nilai berbeda TIDAK akan
 * mengubahnya (hanya `name`/`description` yang ikut). Kalau suatu saat
 * perlu perilaku berbeda, buat ID channel BARU (mis. "transaksi-v2");
 * mengubah nilai di sini saja tidak berpengaruh bagi pengguna lama.
 */
export const NOTIFICATION_CHANNELS = {
  /** Fallback: pengumuman, info produk, apa pun yang bukan uang. */
  default: "default",
  /** Status order & escrow — uang bergerak. Sengaja paling menonjol. */
  transaksi: "transaksi",
  /**
   * Channel yang dipakai backend (`getAndroidChannelId` di push.service):
   * tipe CHAT_* dan DISPUTE_* → "chat", ORDER_* → "orders", WALLET_* →
   * "wallet", SECURITY_* / KYC_* / SYSTEM_* → "security". SEBELUMNYA tidak
   * dibuat di klien: FCM jatuh ke channel "default" bila channel tujuan belum
   * ada, sehingga mis. push chat tampil tanpa kanal yang benar dan pengguna
   * tidak bisa mengatur chat terpisah dari pengumuman umum. "transaksi"
   * dipertahankan apa adanya (write-once; sudah ada di perangkat pengguna
   * lama).
   */
  chat: "chat",
  orders: "orders",
  wallet: "wallet",
  security: "security",
} as const

export type NotificationChannelId =
  (typeof NOTIFICATION_CHANNELS)[keyof typeof NOTIFICATION_CHANNELS]

let handlerInstalled = false

/**
 * Dengarkan TAP notifikasi (foreground/background + cold start via
 * `getLastNotificationResponseAsync`) dan serahkan `data` payload ke
 * `onOpen`. Cold start diproses sekali per proses supaya notifikasi yang sama
 * tidak membuka layar dua kali setelah remount root layout.
 * Kembalikan fungsi unsubscribe.
 */
/** Dari mana ketukan notifikasi berasal: tap saat app hidup vs cold start. */
export type NotificationOpenSource = "tap" | "cold-start"

let coldStartHandled = false
/**
 * B-10 (audit): cadangan IN-MEMORI untuk dedupe cold-start.
 *
 * Dedupe berbasis penyimpanan hanya bekerja bila baca+tulis sukses. Bila
 * penyimpanan gagal (KuotaExceeded di web, Keystore terkunci di native),
 * respons yang sama akan diterima lagi pada peluncuran berikutnya → satu tap
 * memicu dua navigasi. Identifier terakhir yang sudah ditangani karena itu
 * diingat juga di memori proses.
 */
let lastColdStartId: string | null = null
/**
 * Item #24: `actionIdentifier` diteruskan ke `onOpen` (default tap =
 * `Notifications.DEFAULT_ACTION_IDENTIFIER`). Aksi kategori — mis.
 * "Konfirmasi terima" — ditangani pemanggil (root layout), BUKAN sebagai
 * navigasi biasa.
 */
export function subscribeNotificationOpened(
  onOpen: (
    data: unknown,
    source: NotificationOpenSource,
    actionIdentifier: string,
  ) => void,
): () => void {
  // PERF-FIX (bundle): langganan dipasang setelah modul notifikasi selesai
  // dimuat (hitungan ms). Tap cold-start tetap terbaca via
  // getLastNotificationResponseAsync() — respons terakhir di-cache di level
  // OS, tidak hilang karena keterlambatan ms ini.
  let alive = true
  let sub: { remove(): void } | undefined
  // Tandai sinkron (seperti semula) agar cold-start hanya diproses sekali
  // per proses walau fungsi dipanggil dua kali sebelum import selesai.
  const doColdStart = !coldStartHandled
  coldStartHandled = true
  void loadNotifications()
    .then((Notifications) => {
      if (!alive) return
      sub = Notifications.addNotificationResponseReceivedListener((response) => {
        onOpen(
          response.notification.request.content.data,
          "tap",
          response.actionIdentifier ?? Notifications.DEFAULT_ACTION_IDENTIFIER,
        )
      })
      if (!doColdStart) return
      void Notifications.getLastNotificationResponseAsync()
        .then(async (response) => {
          if (!response) return
          // Satu respons hanya boleh menavigasi SEKALI per perangkat: respons
          // terakhir bisa dikembalikan lagi di peluncuran berikutnya (perilaku
          // platform), yang membuat app "selalu" mendarat di Notifikasi walau
          // dibuka dari ikon. Identifier yang sudah ditangani dilewati.
          const id = response.notification.request.identifier
          // B-10 (audit): cek memori lebih dulu — murah dan tetap bekerja saat
          // penyimpanan tidak bisa ditulis.
          if (lastColdStartId === id) return
          try {
            const handled = await getSecureItem(SecureKeys.lastNotificationResponse)
            if (handled === id) return
            await setSecureItem(SecureKeys.lastNotificationResponse, id)
          } catch (error) {
            // Storage gagal: tetap navigasi sekali ini, jangan blokir cold start —
            // tetapi catat supaya penanganan ganda punya jejak di log.
            logWarn("push:cold-start-dedupe", error)
          }
          lastColdStartId = id
          onOpen(
            response.notification.request.content.data,
            "cold-start",
            response.actionIdentifier ?? Notifications.DEFAULT_ACTION_IDENTIFIER,
          )
        })
        .catch((err) => logWarn("push:cold-start", err))
    })
    .catch((err) => logWarn("push:subscribe", err))
  return () => {
    alive = false
    sub?.remove()
  }
}

/**
 * P0-3 (audit FCM 2026-10-03): dengarkan rotasi token push.
 *
 * Expo push token bisa berubah di level OS (reinstall, rotasi, restore
 * backup). Tanpa listener ini backend tetap memegang token lama yang sudah
 * mati → push terkirim ke token mati → notifikasi hilang diam-diam.
 *
 * Callback menerima token baru dan mendaftarkan ulang dengan `force: true`
 * (lewati perbandingan idempoten karena token SUDAH berubah).
 * Kembalikan fungsi cleanup untuk dipanggil saat unmount.
 */
export function subscribePushTokenRefresh(api: RegisterDeviceApi): () => void {
  let alive = true
  let sub: { remove(): void } | undefined
  void loadNotifications()
    .then((Notifications) => {
      if (!alive) return
      sub = Notifications.addPushTokenListener(async (event) => {
        const next = event?.data
        if (typeof next !== "string" || !next) return
        try {
          await registerPushDevice(api, { force: true })
        } catch (err) {
          logWarn("push:token-refresh", err)
        }
      })
    })
    .catch((err) => logWarn("push:token-refresh-subscribe", err))
  return () => {
    alive = false
    sub?.remove()
  }
}

/**
 * Pasang handler foreground + channel Android. Idempoten; panggil sekali di
 * root layout setelah app siap.
 */
export async function setupNotifications(): Promise<void> {
  // PERF-FIX (bundle): expo-notifications dimuat lazy — lihat loadNotifications.
  const Notifications = await loadNotifications()
  if (!handlerInstalled) {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        // Toggle granular lokal (layar "Notifikasi Perangkat Ini"): jenis yang
        // dimatikan pengguna tidak memunculkan banner/tray saat app
        // foreground. Fail-open: tipe tak dikenal (`null`) tetap tampil.
        // Badge tetap dihitung — tab Notifikasi in-app tidak disembunyikan.
        let show = true
        try {
          const prefs = await ensureLocalNotificationPrefs()
          const kind = localKindForPushData(notification.request.content.data)
          show = kind === null ? true : prefs[kind]
        } catch (error) {
          logWarn("push:foreground-prefs", error)
        }
        return {
          shouldShowBanner: show,
          shouldShowList: show,
          shouldPlaySound: false,
          shouldSetBadge: true,
        }
      },
    })
    /**
     * R2 (audit ronde-2, butir #20): listener notifikasi FOREGROUND. Dulu
     * satu-satunya reaksi pada notifikasi yang tiba saat app terbuka adalah
     * banner sistem — data di layar yang sedang tampil tidak berubah sampai
     * pengguna menarik-refresh manual, seolah-olah app "tidak tahu" pesanan
     * lawan transaksi sudah dibayar/terverifikasi. Kini notifikasi masuk
     * menginvalidasi cache query: hook `useApiQuery` yang terpasang
     * (disubscribe di sana) langsung me-revalidate diam-diam di latar, dan
     * layar yang dibuka berikutnya selalu membaca data segar.
     */
    Notifications.addNotificationReceivedListener((notification) => {
      /**
       * PERF-FIX (state audit): invalidasi SELEKTIF per jenis push, bukan
       * global. Dulu setiap notifikasi foreground membangunkan SEMUA hook
       * query yang ter-mount (burst request + re-render di semua layar aktif).
       * `localKindForPushData` memetakan payload ke jenis toggle lokal yang
       * sudah ada; jenis tak dikenal (null) tetap fail-open ke global agar
       * tidak ada data basi yang lolos.
       */
      const kind = localKindForPushData(notification.request.content.data)
      if (kind === "chat") {
        invalidateQueryPrefix("chat")
        invalidateQueryPrefix("conversations")
        // NCC-011: badge tab chat naik segera saat push tiba di foreground —
        // jangan tunggu poll 60 detik / buka drawer.
        void refreshChatUnreadCount()
      } else if (kind === "transaction") {
        invalidateQueryPrefix("order")
        invalidateQueryPrefix("wallet")
        invalidateQueryPrefix("transaction")
        invalidateQueryPrefix("dispute")
        invalidateQueryPrefix("milestone")
        // NCC-011: badge tab notifikasi naik segera saat push tiba di
        // foreground (sebelumnya hanya via tap / AppState / poll 60 detik).
        void refreshUnreadCount()
      } else if (kind === "showcase") {
        invalidateQueryPrefix("showcase")
        invalidateQueryPrefix("feed")
      } else if (kind === "promo") {
        invalidateQueryPrefix("voucher")
        invalidateQueryPrefix("promo")
        invalidateQueryPrefix("campaign")
        invalidateQueryPrefix("subscription")
        invalidateQueryPrefix("referral")
        void refreshUnreadCount()
      } else {
        invalidateQueryCache()
        void refreshUnreadCount()
      }
    })
    handlerInstalled = true
  }

  if (Platform.OS === "android") {
    // Dibuat berurutan, bukan Promise.all: urutan pembuatan menentukan urutan
    // tampil di Setelan Android, dan "Transaksi & escrow" yang paling penting
    // sebaiknya di atas.
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.transaksi, {
      name: "Transaksi & escrow",
      description:
        "Status pesanan, dana masuk/keluar rekening escrow, dan batas waktu pembayaran. Sangat disarankan tetap aktif.",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      sound: "default",
      enableVibrate: true,
    })

    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.orders, {
      name: "Pesanan & escrow",
      description:
        "Status pesanan: pembayaran diterima, pengiriman, dan penyelesaian escrow.",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      sound: "default",
      enableVibrate: true,
    })

    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.wallet, {
      name: "Dompet",
      description: "Dana dompet: top-up, penarikan, transfer, dan pencairan escrow.",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      sound: "default",
      enableVibrate: true,
    })

    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.chat, {
      name: "Chat",
      description: "Pesan chat baru dari lawan transaksi atau admin.",
      importance: Notifications.AndroidImportance.HIGH,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      sound: "default",
      enableVibrate: true,
    })

    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.security, {
      name: "Keamanan",
      description:
        "Peringatan keamanan akun: login baru, perubahan kata sandi, dan verifikasi.",
      importance: Notifications.AndroidImportance.HIGH,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      sound: "default",
      enableVibrate: true,
    })

    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.default, {
      name: "Umum",
      description: "Pengumuman dan informasi lain di luar transaksi.",
      importance: Notifications.AndroidImportance.DEFAULT,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      sound: "default",
      enableVibrate: true,
    })
  }

  // Item #24 — kategori aksi push "Konfirmasi terima" (order). Dipasang di
  // SEMUA platform native (iOS butuh kategori terdaftar sebelum notifikasi
  // tiba; Android butuh untuk action button). Web tidak mendukung category
  // actions expo-notifications — lewati agar tidak melempar.
  //
  // Agar tombol muncul, backend HARUS menyertakan
  // `categoryId: "kahade-order-actions"` pada payload push tipe
  // ORDER_SHIPPED & sejenisnya (lihat lib/order-confirm.ts).
  if (Platform.OS !== "web") {
    try {
      await Notifications.setNotificationCategoryAsync(ORDER_ACTION_CATEGORY, [
        {
          identifier: CONFIRM_RECEIPT_ACTION,
          buttonTitle: "Konfirmasi terima",
          options: {
            // Aksi melepas dana escrow: WAJIB buka app (foreground) supaya
            // berjalan dalam sesi terverifikasi + verifikasi ulang via API.
            opensAppToForeground: true,
          },
        },
      ])
    } catch (error) {
      logWarn("push:notification-category", error)
    }
  }
}

/**
 * Baca status izin notifikasi perangkat TANPA meminta (tidak memicu prompt
 * izin ke pengguna). `true` = granted, `false` = ditolak/belum diberikan,
 * `null` = tidak bisa dibaca (web tanpa API Notification, emulator, error).
 *
 * Dipakai FE-IMP-3 #94: status efektif gabungan per jenis notifikasi
 * (perangkat + server) di layar Preferensi Notifikasi.
 */
export async function getDevicePushPermissionGranted(): Promise<boolean | null> {
  try {
    if (Platform.OS === "web") {
      if (typeof window === "undefined" || !("Notification" in window)) return null
      return window.Notification.permission === "granted"
    }
    if (!Device.isDevice) return null
    // PERF-FIX (bundle): expo-notifications dimuat lazy — lihat loadNotifications.
    const Notifications = await loadNotifications()
    const { status } = await Notifications.getPermissionsAsync()
    return status === "granted"
  } catch (err) {
    logWarn("push:read-permission", err)
    return null
  }
}

/**
 * Minta izin (bila belum) dan ambil Expo push token.
 * `null` = tidak bisa (izin ditolak, emulator, tanpa EAS projectId, web).
 */
export async function getPushToken(): Promise<string | null> {
  if (Platform.OS === "web" || !Device.isDevice) return null

  // PERF-FIX (bundle): expo-notifications dimuat lazy — lihat loadNotifications.
  const Notifications = await loadNotifications()
  const current = await Notifications.getPermissionsAsync()
  let status = current.status
  if (status !== "granted") {
    const asked = await Notifications.requestPermissionsAsync()
    status = asked.status
  }
  if (status !== "granted") return null

  const projectId: string | undefined =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
  try {
    const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)
    return data
  } catch (err) {
    if (__DEV__) console.warn("[kahade/push] gagal mengambil push token:", err)
    return null
  }
}

/**
 * Daftarkan perangkat ke backend. Melewati panggilan API bila token sama
 * dengan yang sudah terdaftar (dipanggil tiap app start — jangan spam).
 * Kembalikan token yang terdaftar, atau `null` bila tidak tersedia.
 */
export async function registerPushDevice(api: RegisterDeviceApi, opts?: { force?: boolean }): Promise<string | null> {
  const token = await getPushToken()
  if (!token) return null

  const previous = await getSecureItem(SecureKeys.pushToken)
  if (previous === token && !opts?.force) return token

  const deviceId = await getOrCreateDeviceId()
  await api.registerDevice({
    token,
    platform: Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web",
    deviceId,
  })
  await setSecureItem(SecureKeys.pushToken, token)
  return token
}

/**
 * Lepas pendaftaran — panggil saat logout SEBELUM `clearSession()`.
 * Kegagalan jaringan tidak melempar: logout harus tetap selesai.
 *
 * BFI-111: `deviceId` diambil dari `getOrCreateDeviceId()` — SUMBER YANG
 * SAMA dengan `registerPushDevice` — supaya backend bisa mencocokkan baris
 * `userDevice` yang didaftarkan dan meng-null-kan `pushToken`-nya. Tanpa
 * ini backend menjawab 400 INVALID_DEVICE_ID dan perangkat tetap menerima
 * push transaksi/chat setelah logout.
 */
export async function unregisterPushDevice(api: RegisterDeviceApi): Promise<void> {
  try {
    const deviceId = await getOrCreateDeviceId()
    await api.unregisterDevice(deviceId)
  } catch (err) {
    if (__DEV__) console.warn("[kahade/push] unregister gagal (diabaikan):", err)
  } finally {
    await deleteSecureItem(SecureKeys.pushToken)
  }
}
