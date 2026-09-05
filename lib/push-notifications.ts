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
import * as Notifications from "expo-notifications"
import { Platform } from "react-native"

import { SecureKeys, deleteSecureItem, getOrCreateDeviceId, getSecureItem, setSecureItem } from "@/lib/secure-storage"

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
  unregisterDevice: () => Promise<void>
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
} as const

export type NotificationChannelId =
  (typeof NOTIFICATION_CHANNELS)[keyof typeof NOTIFICATION_CHANNELS]

/** @deprecated pakai `NOTIFICATION_CHANNELS.default` */
export const DEFAULT_CHANNEL_ID = NOTIFICATION_CHANNELS.default

let handlerInstalled = false

/**
 * Dengarkan TAP notifikasi (foreground/background + cold start via
 * `getLastNotificationResponseAsync`) dan serahkan `data` payload ke
 * `onOpen`. Cold start diproses sekali per proses supaya notifikasi yang sama
 * tidak membuka layar dua kali setelah remount root layout.
 * Kembalikan fungsi unsubscribe.
 */
let coldStartHandled = false
export function subscribeNotificationOpened(onOpen: (data: unknown) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    onOpen(response.notification.request.content.data)
  })
  if (!coldStartHandled) {
    coldStartHandled = true
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) onOpen(response.notification.request.content.data)
      })
      .catch(() => {})
  }
  return () => sub.remove()
}

/**
 * Pasang handler foreground + channel Android. Idempoten; panggil sekali di
 * root layout setelah app siap.
 */
export async function setupNotifications(): Promise<void> {
  if (!handlerInstalled) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: true,
      }),
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
        "Status order, dana masuk/keluar rekening escrow, dan batas waktu pembayaran. Sangat disarankan tetap aktif.",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
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
}

/**
 * Minta izin (bila belum) dan ambil Expo push token.
 * `null` = tidak bisa (izin ditolak, emulator, tanpa EAS projectId, web).
 */
export async function getPushToken(): Promise<string | null> {
  if (Platform.OS === "web" || !Device.isDevice) return null

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
 */
export async function unregisterPushDevice(api: RegisterDeviceApi): Promise<void> {
  try {
    await api.unregisterDevice()
  } catch (err) {
    if (__DEV__) console.warn("[kahade/push] unregister gagal (diabaikan):", err)
  } finally {
    await deleteSecureItem(SecureKeys.pushToken)
  }
}
