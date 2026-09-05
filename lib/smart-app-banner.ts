/**
 * Kahade — logika Smart App Banner (murni, tanpa React).
 *
 * Dipisah dari komponennya supaya bisa diuji tanpa render: deteksi UA,
 * pemilihan store, dan aturan dismiss adalah tempat bug paling mungkin
 * bersembunyi, dan semuanya bergantung pada `window` yang tidak ada saat
 * static export berjalan di Node.
 *
 * Semua fungsi di sini aman dipanggil di server (mengembalikan nilai netral
 * bila `window`/`localStorage` tidak ada), sehingga tidak ada yang meledak
 * saat `expo export --platform web`.
 */

/** Berapa lama banner disembunyikan setelah pengguna menutupnya. */
export const DISMISS_DAYS = 7
const DISMISS_MS = DISMISS_DAYS * 24 * 60 * 60 * 1000

export const BANNER_STORAGE_KEY = "kahade.appbanner.dismissedAt"

export type MobileOS = "ios" | "android"

/**
 * TODO: GANTI DENGAN LINK STORE ASLI setelah akun Play Console dan Apple
 * Developer tersedia.
 *
 * Bentuk akhirnya nanti:
 *   android → https://play.google.com/store/apps/details?id=id.kahade
 *   ios     → https://apps.apple.com/id/app/kahade/id<APP_STORE_ID>
 *
 * Nilai Android di bawah sebenarnya sudah merupakan URL final yang benar
 * (Play memakai package name, yang sudah pasti `id.kahade`), tetapi halamannya
 * baru hidup setelah aplikasi dipublikasikan. iOS menunggu numeric App Store
 * ID yang baru terbit saat app record dibuat di App Store Connect.
 */
export const STORE_URLS: Record<MobileOS, string> = {
  android: "https://play.google.com/store/apps/details?id=id.kahade",
  ios: "https://apps.apple.com/id/app/kahade/id000000000",
}

/** True bila URL store masih placeholder (dipakai tes & laporan). */
export function isPlaceholderStoreUrl(url: string): boolean {
  return url.includes("id000000000")
}

/**
 * OS seluler dari user-agent, atau `null` untuk desktop/tidak dikenal.
 *
 * iPadOS 13+ menyamar sebagai "Macintosh" di UA-nya. Dibedakan lewat
 * `maxTouchPoints > 1`, satu-satunya sinyal yang tersisa — tanpa itu iPad
 * dianggap desktop dan banner tidak pernah muncul di sana.
 */
export function detectMobileOS(
  ua: string | undefined,
  maxTouchPoints = 0,
): MobileOS | null {
  if (!ua) return null
  if (/android/i.test(ua)) return "android"
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios"
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return "ios"
  return null
}

/**
 * True bila halaman berjalan sebagai PWA terpasang (standalone).
 * Pengguna yang sudah "memasang" tidak perlu diajak memasang lagi.
 */
export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  if (nav.standalone === true) return true
  return window.matchMedia?.("(display-mode: standalone)")?.matches === true
}

/**
 * True bila banner masih dalam masa tenang setelah ditutup.
 *
 * Nilai rusak/absen diperlakukan sebagai "tidak pernah ditutup" — kegagalan
 * di sini harus condong ke menampilkan banner, bukan menyembunyikannya
 * selamanya. `localStorage` dibungkus try/catch karena Safari melemparkan
 * SecurityError pada mode privat dan saat cookie pihak ketiga diblokir.
 */
export function isDismissActive(now: number = Date.now()): boolean {
  if (typeof window === "undefined") return false
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(BANNER_STORAGE_KEY)
  } catch {
    return false
  }
  if (!raw) return false
  const at = Number(raw)
  if (!Number.isFinite(at) || at <= 0) return false
  // Jam perangkat mundur (at > now) → anggap kedaluwarsa, jangan sembunyikan selamanya.
  if (at > now) return false
  return now - at < DISMISS_MS
}

/** Catat waktu dismiss. Diam-diam gagal bila storage tidak tersedia. */
export function recordDismiss(now: number = Date.now()): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(BANNER_STORAGE_KEY, String(now))
  } catch {
    /* mode privat Safari — banner akan muncul lagi saat reload, bisa diterima */
  }
}

/** Hapus catatan dismiss (dipakai tes & debugging manual di konsol). */
export function clearDismiss(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(BANNER_STORAGE_KEY)
  } catch {
    /* abaikan */
  }
}

/**
 * Keputusan tunggal: tampilkan banner atau tidak.
 * Dipisah agar seluruh matriks kondisi bisa diuji tanpa DOM.
 */
export function shouldShowBanner(input: {
  isWeb: boolean
  os: MobileOS | null
  standalone: boolean
  dismissed: boolean
}): boolean {
  const { isWeb, os, standalone, dismissed } = input
  if (!isWeb) return false // dibuka dari dalam app (native)
  if (os === null) return false // desktop browser
  if (standalone) return false // sudah terpasang sebagai PWA
  if (dismissed) return false // masih dalam masa tenang
  return true
}
