/**
 * Native cold-boot route restoration.
 *
 * Store only a pathname (never query parameters) in SecureStore, scope it to
 * the active session, and restore it only when the app starts from its icon.
 * In-process navigation and push/deep-link destinations remain authoritative.
 */
import { Platform } from "react-native"
import { createTrailingDebounce } from "@/lib/debounce"
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
 * P2 (audit perf/UX 2026-10-03): tulis rute terakhir DI-DEBOUNCE 500ms.
 *
 * `saveLastNativeRoute` dipanggil dari efek pathname — berpindah tab
 * beruntun (Etalase → Transaksi → Pesan) berarti satu penulisan SecureStore
 * per perpindahan, padahal hanya rute TERAKHIR yang berguna saat boot.
 * Debounce memangkasnya jadi satu penulisan per jendela 500ms.
 *
 * Risiko yang harus ditutup: OS bisa mematikan proses yang di-background
 * sebelum timer menyala. Karena itu tersedia `flushLastNativeRouteSave()`
 * yang dipanggil root layout saat app meninggalkan foreground — tidak ada
 * rute yang hilang.
 */
export const LAST_ROUTE_SAVE_DEBOUNCE_MS = 500

const debouncedSave = createTrailingDebounce<string>((path) => {
  // Kegagalan tulis sudah ditelan di dalam (best-effort) — jangan sampai
  // rejection tanpa handler dari timer.
  void saveLastNativeRoute(path).catch(() => undefined)
}, LAST_ROUTE_SAVE_DEBOUNCE_MS)

/** Versi debounce dari `saveLastNativeRoute` (dipakai root layout). */
export function saveLastNativeRouteDebounced(pathname: string): void {
  if (Platform.OS === "web") return
  debouncedSave.call(pathname)
}

/** Kirim penulisan yang tertunda sekarang (mis. app masuk background). */
export function flushLastNativeRouteSave(): void {
  debouncedSave.flush()
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
