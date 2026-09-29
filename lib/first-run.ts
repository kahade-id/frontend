/**
 * Kahade — flag "sekali-tampil" first-run (journey U5, 2026-09-29).
 *
 * Pola mengikuti lib/coach-mark.ts: flag "1" di SecureStore (bukan karena
 * rahasia, tapi itu storage persisten yang terpasang). Level perangkat,
 * TIDAK dihapus `clearSession()` — logout bukan alasan mengulang orientasi.
 * Semua key terdaftar di WEB_PERSISTENT_KEYS agar bertahan di web.
 *
 * - feedOrientationSeen: U5-005 — overlay orientasi 3 kartu di feed.
 * - pushRationaleSeen: U5-003 — bottom sheet rationale izin notifikasi di
 *   feed pada login pertama (pengganti layar welcome yang dihapus).
 * - sellerEscrowBannerSeen: U5-013 — banner edukasi escrow untuk penjual
 *   saat pertama kali membuka detail order sebagai penjual.
 * - webGuestBannerDismissed: U5-017 — banner "mode tamu" web di-dismiss.
 */
import { getSecureItem, SecureKeys, setSecureItem } from "@/lib/secure-storage"

async function hasFlag(key: (typeof SecureKeys)[keyof typeof SecureKeys]): Promise<boolean> {
  try {
    return (await getSecureItem(key)) === "1"
  } catch {
    // Gagal baca = anggap belum: konsekuensinya hanya tampil sekali lagi.
    return false
  }
}

async function markFlag(key: (typeof SecureKeys)[keyof typeof SecureKeys]): Promise<void> {
  try {
    await setSecureItem(key, "1")
  } catch (err) {
    if (__DEV__) console.warn("[kahade/first-run] gagal menyimpan flag:", err)
  }
}

/** U5-005 — overlay orientasi feed sudah pernah tampil/ditutup? */
export function hasSeenFeedOrientation(): Promise<boolean> {
  return hasFlag(SecureKeys.feedOrientationSeen)
}
/** U5-005 — tandai overlay orientasi feed sudah dilihat. */
export function markFeedOrientationSeen(): Promise<void> {
  return markFlag(SecureKeys.feedOrientationSeen)
}

/** U5-003 — sheet rationale notifikasi sudah pernah tampil/ditutup? */
export function hasSeenPushRationale(): Promise<boolean> {
  return hasFlag(SecureKeys.pushRationaleSeen)
}
/** U5-003 — tandai sheet rationale notifikasi sudah dilihat. */
export function markPushRationaleSeen(): Promise<void> {
  return markFlag(SecureKeys.pushRationaleSeen)
}

/** U5-013 — banner escrow penjual sudah pernah tampil/ditutup? */
export function hasSeenSellerEscrowBanner(): Promise<boolean> {
  return hasFlag(SecureKeys.sellerEscrowBannerSeen)
}
/** U5-013 — tandai banner escrow penjual sudah dilihat. */
export function markSellerEscrowBannerSeen(): Promise<void> {
  return markFlag(SecureKeys.sellerEscrowBannerSeen)
}

/** U5-017 — banner mode tamu web sudah di-dismiss? */
export function hasDismissedWebGuestBanner(): Promise<boolean> {
  return hasFlag(SecureKeys.webGuestBannerDismissed)
}
/** U5-017 — tandai banner mode tamu web di-dismiss. */
export function markWebGuestBannerDismissed(): Promise<void> {
  return markFlag(SecureKeys.webGuestBannerDismissed)
}
