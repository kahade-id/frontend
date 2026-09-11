/**
 * Kahade — FCM Web Push, STUB NATIVE.
 *
 * File ini yang di-bundle ke Android/iOS; implementasi browser-nya ada di
 * `lib/web-push.web.ts` dan dipilih otomatis oleh Metro lewat resolusi
 * ekstensi platform (`.web.ts` menang di web, file ini menang di native).
 *
 * KENAPA DIPISAH (bukan `if (Platform.OS === "web")` dalam satu file):
 * `firebase/messaging` tidak mendukung React Native dan akan error saat
 * di-bundle/dijalankan di Hermes. Dengan split file, package `firebase`
 * TIDAK PERNAH masuk bundle native — tidak menambah ukuran, tidak ada risiko
 * crash. Jangan menambahkan import firebase ke file ini.
 *
 * KONTRAK: signature di sini HARUS sama persis dengan `.web.ts` (TypeScript
 * me-resolve import `@/lib/web-push` ke file ini saat typecheck, jadi
 * ketidakcocokan akan tertangkap sebagai type error di call site web).
 */

import type { RegisterDeviceApi } from "@/lib/push-notifications"

/** Asal pesan web push: diterima saat app terbuka vs diketuk pengguna. */
export type WebPushOpenSource = "foreground" | "tap"

/** Native: tidak ada token web. Selalu `null`, tidak pernah melempar. */
export async function getWebPushToken(): Promise<string | null> {
  return null
}

/** Native: no-op. Selalu `null`, tidak pernah melempar. */
export async function registerWebPushDevice(
  _api: RegisterDeviceApi,
  _opts?: { force?: boolean },
): Promise<string | null> {
  return null
}

/** Native: no-op. Tidak pernah melempar. */
export async function unregisterWebPushDevice(_api: RegisterDeviceApi): Promise<void> {
  return undefined
}

/**
 * Native: tidak ada listener; kembalikan unsubscribe no-op agar call site
 * (root layout) tidak perlu branch platform.
 */
export function subscribeWebPushMessages(
  _onOpen: (data: unknown, source: WebPushOpenSource) => void,
): () => void {
  return () => undefined
}
