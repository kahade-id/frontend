/**
 * Kahade — logika ajakan instalasi web (murni, tanpa React).
 *
 * Ajakan toko hanya boleh tampil bila URL distribusi resmi sudah dikonfigurasi.
 * Jangan menampilkan tautan tebakan atau placeholder: pengguna harus mendapat
 * halaman toko yang benar, bukan 404 atau listing milik pihak lain.
 */

export const DISMISS_DAYS = 7
const DISMISS_MS = DISMISS_DAYS * 24 * 60 * 60 * 1000

export const BANNER_STORAGE_KEY = "kahade.appbanner.dismissedAt"

export type MobileOS = "ios" | "android"

/**
 * Diisi oleh release configuration setelah listing benar-benar publik.
 * `null` membuat kartu instalasi tidak dirender sampai URL terverifikasi.
 */
export const STORE_URLS: Record<MobileOS, string | null> = {
  android: null,
  ios: null,
}

export function isAvailableStoreUrl(url: string | null | undefined): url is string {
  return typeof url === "string" && /^https:\/\/(play\.google\.com|apps\.apple\.com)\//.test(url)
}

/**
 * OS seluler dari user-agent, atau `null` untuk desktop/tidak dikenal.
 * iPadOS 13+ menyamar sebagai Macintosh; maxTouchPoints membedakannya.
 */
export function detectMobileOS(ua: string | undefined, maxTouchPoints = 0): MobileOS | null {
  if (!ua) return null
  if (/android/i.test(ua)) return "android"
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios"
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return "ios"
  return null
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  if (nav.standalone === true) return true
  return window.matchMedia?.("(display-mode: standalone)")?.matches === true
}

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
  if (!Number.isFinite(at) || at <= 0 || at > now) return false
  return now - at < DISMISS_MS
}

export function recordDismiss(now: number = Date.now()): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(BANNER_STORAGE_KEY, String(now))
  } catch {
    // Banner akan muncul lagi bila storage privat tidak tersedia.
  }
}

export function clearDismiss(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(BANNER_STORAGE_KEY)
  } catch {
    // abaikan
  }
}

export function shouldShowBanner(input: {
  isWeb: boolean
  os: MobileOS | null
  standalone: boolean
  dismissed: boolean
}): boolean {
  const { isWeb, os, standalone, dismissed } = input
  if (!isWeb || os === null || standalone || dismissed) return false
  return true
}
