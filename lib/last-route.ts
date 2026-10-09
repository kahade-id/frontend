/**
 * Native cold-boot route restoration.
 *
 * Store only a pathname (never query parameters) in SecureStore, scope it to
 * the active session, and restore it only when the app starts from its icon.
 * In-process navigation and push/deep-link destinations remain authoritative.
 */
import { Platform } from "react-native"
import { deleteSecureItem, getSecureItem, SecureKeys, setSecureItem } from "@/lib/secure-storage"
import { getSessionRevision } from "@/lib/api/session"
import { PRE_SESSION_AUTH_PATHS } from "@/lib/protected-routes"

const neverRestore = new Set([
  "/",
  "/index",
  "/home",
  "/login-required",
  "/prepare-navigation",
  "/verify-email",
  "/deletion-status",
  "/payment/finish",
  "/social-link-confirm",
])

export function safeNativeRoutePath(pathname: string): string | null {
  if (!pathname || !pathname.startsWith("/") || pathname.startsWith("//")) return null
  // `usePathname` already excludes search params, but strip defensively so no
  // caller can persist query data such as account, token, or draft values.
  const pathnameOnly = pathname.split(/[?#]/, 1)[0] ?? ""
  const segments = pathnameOnly
    .split("/")
    .filter(Boolean)
    .filter((segment) => !(/^\([^/]+\)$/).test(segment))
  if (segments.some((segment) => segment === "." || segment === ".." || /[\\\s]/.test(segment))) {
    return null
  }
  const normalized = `/${segments.join("/")}`
  if (!normalized || neverRestore.has(normalized)) return null
  if (PRE_SESSION_AUTH_PATHS.some((route) => normalized === route || normalized.startsWith(`${route}/`))) {
    return null
  }
  return normalized
}

let saveQueue: Promise<unknown> = Promise.resolve()

/** Persist the latest safe native path; writes are ordered across fast tab changes. */
export function saveLastNativeRoute(pathname: string): Promise<void> {
  if (Platform.OS === "web") return Promise.resolve()
  const path = safeNativeRoutePath(pathname)
  if (!path) return Promise.resolve()
  const revision = getSessionRevision()
  const write = async () => {
    if (revision !== getSessionRevision()) return
    await setSecureItem(SecureKeys.lastNativeRoute, path)
    // Logout/account-switch can race a SecureStore write. Clear again after
    // it settles so a former account's screen can never survive the logout.
    if (revision !== getSessionRevision()) await deleteSecureItem(SecureKeys.lastNativeRoute)
  }
  const next = saveQueue.then(write, write)
  saveQueue = next.catch(() => undefined)
  return next.then(() => undefined)
}

/**
 * 2026-10-08 (temuan #15): rute terakhir DITULIS SEGERA — tidak lagi
 * di-debounce.
 *
 * Dulu penulisan ditahan 500ms (`createTrailingDebounce`) untuk menggabung
 * perpindahan tab beruntun, lalu di-flush saat `AppState` meninggalkan
 * foreground. Itu mengasumsikan penulisan selesai sebelum proses mati —
 * padahal `SecureStore.setItemAsync` ASINKRON. Saat pengguna menutup app
 * dari app switcher (atau OS mematikannya), JS mati nyaris seketika; janji
 * `setItemAsync` tidak pernah selesai dan rute terakhir HILANG. Maka boot
 * berikutnya jatuh ke `ROUTES.home` (Etalase) — persis keluhan "harus kill
 * aplikasi berulang kali": ia hanya pernah berhasil kalau kebetulan
 * pengguna diam >500ms di halaman itu sehingga timer menyala lebih dulu.
 *
 * Kenapa menulis segera aman: perubahan `pathname` itu JARANG dan selalu
 * dipicu pengguna (satu ketukan = satu rute), bukan per-frame seperti
 * scroll. Satu penulisan Keychain/Keystore per navigasi tidak terukur;
 * yang mahal justru kehilangan rute.
 *
 * Penggabungannya kini lewat DEDUPE (`lastSubmittedPath`), bukan timer:
 * render ulang yang tidak mengubah path (sumber utama "beruntun" itu) tidak
 * menulis apa-apa.
 */
let lastSubmittedPath: string | null = null

/** Catat rute terakhir SEGERA (dipakai root layout tiap pathname berubah). */
export function saveLastNativeRouteDebounced(pathname: string): void {
  if (Platform.OS === "web") return
  if (lastSubmittedPath === pathname) return
  lastSubmittedPath = pathname
  // Kegagalan tulis ditelan: persistensi rute bersifat best-effort, dan
  // kegagalan menyimpan tidak boleh mengganggu navigasi.
  void saveLastNativeRoute(pathname).catch(() => undefined)
}

/**
 * Kirim ulang rute terakhir yang tercatat (mis. app masuk background).
 *
 * Dengan penulisan segera, biasanya tidak ada yang tertunda. Ini tetap
 * dipertahankan sebagai jaring pengaman untuk satu kasus nyata: proses
 * dimatikan TEPAT di antara "pathname berubah" dan "setItemAsync selesai" —
 * kirim ulang di kesempatan terakhir (`AppState` → inactive/background)
 * memberi penulisan itu jendela kedua.
 */
export function flushLastNativeRouteSave(): void {
  if (Platform.OS === "web") return
  if (lastSubmittedPath === null) return
  void saveLastNativeRoute(lastSubmittedPath).catch(() => undefined)
}

/** Hanya untuk test: lupakan nilai yang pernah dikirim (reset dedupe). */
export function __resetLastRouteDedupe(): void {
  lastSubmittedPath = null
}

/** Return a validated path only on native; invalid/old entries fail closed. */
export async function getLastNativeRoute(): Promise<string | null> {
  if (Platform.OS === "web") return null
  const saved = await getSecureItem(SecureKeys.lastNativeRoute)
  if (!saved) return null
  const path = safeNativeRoutePath(saved)
  if (path) return path
  await deleteSecureItem(SecureKeys.lastNativeRoute).catch(() => undefined)
  return null
}

let restoreSuppressed = false
const suppressionListeners = new Set<() => void>()

/** Mark that a cold-start deep link/push owns the first destination this boot. */
export function suppressLastRouteRestore(): void {
  if (restoreSuppressed) return
  restoreSuppressed = true
  for (const listener of suppressionListeners) listener()
}

export function isLastRouteRestoreSuppressed(): boolean {
  return restoreSuppressed
}

export function subscribeLastRouteRestore(listener: () => void): () => void {
  suppressionListeners.add(listener)
  return () => suppressionListeners.delete(listener)
}
