/**
 * Kahade — mode aplikasi E-Commerce ⇄ E-Wallet.
 *
 * Satu preferensi (`appMode`) mengubah isi lima slot navbar yang sama, bukan
 * dua navbar. File ini murni: tidak mengimpor expo-router atau ikon, supaya
 * rencana navigasi bisa diuji tanpa stub router.
 *
 * Aturan pindah mode (tidak meninggalkan shell mode lain sebagai target Back):
 *   - tab → tab: `navigate`
 *   - tab → stack: `push`, lalu park tab primer mode baru
 *   - stack → tab: `dismissTo` bila ada, kalau tidak `navigate`, lalu park
 *   - stack → stack: `replace`, lalu park tab primer mode baru
 *   - profil sendiri: tetap di tempat, hanya park tab primer mode baru
 *   - /home dan /discover: masuk ke slot primer mode baru
 *   - rute netral lain: tetap, park tab primer
 *
 * Park = `navigation.navigate(tabName)` pada navigator tab yang didaftarkan
 * layout `(tabs)`. Navbar stack tidak boleh mendaftar — cleanup-nya akan
 * menghapus navigator yang masih dipakai.
 */
import { setUiPrefs, useUiPrefs, type UiPrefs } from "@/lib/ui-prefs"

export type AppMode = UiPrefs["appMode"]

export type ShellSlotId = "primary" | "secondary" | "tertiary" | "more"

/** Nama route di dalam <Tabs>. `more` adalah halaman lainnya. */
export type ShellTabName =
  | "showcase"
  | "transactions"
  | "chat"
  | "wallet"
  | "vouchers"
  | "wallet-history"
  | "more"

export type ShellDestination = {
  id: ShellSlotId
  /** Kunci stabil di navbar. */
  key: "primary" | "secondary" | "tertiary" | "more" | "discover"
  label: string
  accessibilityLabel: string
  href: string
  /** Tab yang diparkir bila tujuan ini sendiri adalah layar tab. */
  tab: ShellTabName | null
}

const COMMERCE_MORE: ShellDestination = {
  id: "more",
  key: "more",
  label: "Lainnya",
  accessibilityLabel: "Tab Lainnya",
  href: "/more",
  tab: "more",
}

const WALLET_MORE: ShellDestination = {
  id: "more",
  key: "more",
  label: "Lainnya",
  accessibilityLabel: "Tab Lainnya",
  href: "/more",
  tab: "more",
}

export const SHELL_DESTINATIONS: Record<
  AppMode,
  Record<ShellSlotId, ShellDestination> & { profile?: ShellDestination }
> = {
  commerce: {
    primary: {
      id: "primary",
      key: "primary",
      label: "Etalase",
      accessibilityLabel: "Tab Etalase",
      href: "/showcase",
      tab: "showcase",
    },
    secondary: {
      id: "secondary",
      key: "secondary",
      label: "Transaksi",
      accessibilityLabel: "Tab Transaksi",
      href: "/transactions",
      tab: "transactions",
    },
    tertiary: {
      id: "tertiary",
      key: "tertiary",
      label: "Pesan",
      accessibilityLabel: "Tab Pesan",
      href: "/chat",
      tab: "chat",
    },
    more: COMMERCE_MORE,
    profile: COMMERCE_MORE,
  },
  wallet: {
    primary: {
      id: "primary",
      key: "primary",
      label: "Wallet",
      accessibilityLabel: "Tab Wallet",
      href: "/wallet",
      tab: "wallet",
    },
    secondary: {
      id: "secondary",
      key: "secondary",
      label: "Promo",
      accessibilityLabel: "Tab Promo",
      href: "/vouchers",
      tab: "vouchers",
    },
    tertiary: {
      id: "tertiary",
      key: "tertiary",
      label: "History",
      accessibilityLabel: "Tab History",
      href: "/wallet-history",
      tab: "wallet-history",
    },
    more: WALLET_MORE,
    profile: WALLET_MORE,
  },
}

const TAB_PATHS = new Set([
  "/home",
  "/showcase",
  "/transactions",
  "/chat",
  "/wallet",
  "/vouchers",
  "/wallet-history",
  "/more",
])

/** Jendela shift dianggap "baru" — layar tujuan yang mount di dalamnya ikut animasi masuk. */
export const MODE_SHIFT_FRESH_MS = 700

export type ModeShift = {
  from: AppMode
  to: AppMode
  dir: 1 | -1
  /** Tujuan navigasi; null bila kita tetap di layar yang sama (profil). */
  href: string | null
  at: number
}

export type ModeNavPlan =
  | { kind: "stay"; parkTab: ShellTabName | null }
  | {
      kind: "go"
      href: string
      method: "navigate" | "push" | "replace" | "leave-to-tab"
      parkTab: ShellTabName | null
    }

export type ModeNavigator = {
  push: (href: string) => void
  replace: (href: string) => void
  navigate: (href: string) => void
  dismissTo?: (href: string) => void
}

type ShellTabNavigator = {
  navigate: (name: string) => void
  isReady?: () => boolean
}

let shift: ModeShift | null = null
let shiftGeneration = 0
const shiftListeners = new Set<() => void>()
let shellTabNavigator: ShellTabNavigator | null = null
/** Tab yang harus terbuka saat navigator tab baru terpasang (stack sempat melepasnya). */
let pendingPark: ShellTabName | null = null

export function shellSlots(mode: AppMode): readonly ShellDestination[] {
  const table = SHELL_DESTINATIONS[mode]
  return [table.primary, table.secondary, table.tertiary, table.more]
}

export function primaryTabFor(mode: AppMode): ShellTabName {
  return mode === "wallet" ? "wallet" : "showcase"
}

/** Path tanpa query/hash dan tanpa trailing slash (kecuali root). */
export function normalizeShellPath(path: string): string {
  const base = path.split("?")[0]?.split("#")[0] ?? "/"
  if (base.length > 1 && base.endsWith("/")) return base.slice(0, -1)
  return base || "/"
}

/**
 * Cocok persis atau sebagai prefix segmen (`/chat` cocok `/chat/room`,
 * `/wallet` TIDAK cocok `/wallet-history`, `/showcase` TIDAK cocok
 * `/showcase-management`).
 */
export function pathMatchesBase(path: string, base: string): boolean {
  const current = normalizeShellPath(path)
  const target = normalizeShellPath(base)
  return current === target || current.startsWith(`${target}/`)
}

function isExactTabPath(path: string): boolean {
  return TAB_PATHS.has(normalizeShellPath(path))
}

const COMMERCE_SHELL_SLOTS: Record<string, ShellSlotId> = {
  "/showcase": "primary",
  "/transactions": "secondary",
  "/chat": "tertiary",
  "/more": "more",
}

const WALLET_SHELL_SLOTS: Record<string, ShellSlotId> = {
  "/wallet": "primary",
  "/vouchers": "secondary",
  "/wallet-history": "tertiary",
  "/more": "more",
}

/**
 * Slot yang sedang ditonjolkan.
 * Bottom navbar HANYA muncul di tepat 8 halaman shell:
 * 4 di mode commerce (/showcase, /transactions, /chat, /more) dan
 * 4 di mode wallet (/wallet, /vouchers, /wallet-history, /more).
 * Profil publik (termasuk profil sendiri) dan halaman detail/chat room tidak menampilkan bar.
 */
export function activeShellSlot(path: string, mode: AppMode): ShellSlotId | null {
  const current = normalizeShellPath(path)
  const map = mode === "commerce" ? COMMERCE_SHELL_SLOTS : WALLET_SHELL_SLOTS
  return map[current] ?? null
}

function parkTabFor(mode: AppMode, dest: ShellDestination | null): ShellTabName {
  if (dest?.tab && isExactTabPath(dest.href)) return dest.tab
  return primaryTabFor(mode)
}

function methodFor(
  path: string,
  dest: ShellDestination,
): "navigate" | "push" | "replace" | "leave-to-tab" {
  const destIsTab = dest.tab != null && isExactTabPath(dest.href)
  const hereIsTab = isExactTabPath(path)
  if (destIsTab && hereIsTab) return "navigate"
  if (destIsTab && !hereIsTab) return "leave-to-tab"
  if (!destIsTab && hereIsTab) return "push"
  return "replace"
}

/**
 * Rencana pindah mode dari path saat ini. Tidak memanggil router — pemanggil
 * (hook) yang mengeksekusi, supaya tes bisa memeriksa method tanpa stub.
 */
export function planModeChange(path: string, to: AppMode): ModeNavPlan {
  const current = normalizeShellPath(path)
  const primary = SHELL_DESTINATIONS[to].primary
  if (current === "/more") {
    return { kind: "stay", parkTab: primaryTabFor(to) }
  }
  // Cocokkan ke kedua tabel: path commerce tidak pernah cocok slot wallet.
  const fromSlot = matchingSlot(current)
  if (fromSlot == null) {
    if (current === "/home" || current === "/discover") {
      return {
        kind: "go",
        href: primary.href,
        method: isExactTabPath(current) ? "navigate" : "leave-to-tab",
        parkTab: primary.tab ?? primaryTabFor(to),
      }
    }
    return { kind: "stay", parkTab: primaryTabFor(to) }
  }
  const dest = SHELL_DESTINATIONS[to][fromSlot.id]
  if (dest.href === current) {
    return { kind: "stay", parkTab: primaryTabFor(to) }
  }
  return {
    kind: "go",
    href: dest.href,
    method: methodFor(current, dest),
    parkTab: parkTabFor(to, dest),
  }
}

/**
 * Tekan slot di mode yang sedang aktif. Tidak memarkir tab saat mendorong
 * layar stack — Back harus kembali ke tab yang tadi terbuka, bukan ke primer
 * mode. Park hanya saat tujuan sendiri adalah tab.
 */
export function planSlotPress(path: string, dest: ShellDestination): ModeNavPlan {
  if (!dest) return { kind: "stay", parkTab: null }
  const current = normalizeShellPath(path)
  if (current === normalizeShellPath(dest.href)) {
    return { kind: "stay", parkTab: null }
  }
  const method = methodFor(current, dest)
  const parkTab = dest.tab && isExactTabPath(dest.href) ? dest.tab : null
  return { kind: "go", href: dest.href, method, parkTab }
}

function matchingSlot(path: string): ShellDestination | null {
  for (const mode of ["commerce", "wallet"] as const) {
    const slotId = activeShellSlot(path, mode)
    if (slotId) return SHELL_DESTINATIONS[mode][slotId]
  }
  return null
}

export function applyModeNavigation(plan: ModeNavPlan, nav: ModeNavigator): void {
  if (plan.kind === "go") {
    if (plan.method === "leave-to-tab") {
      // Park dulu supaya tab yang terbuka saat stack ditutup sudah mode baru.
      parkShellTab(plan.parkTab)
      if (typeof nav.dismissTo === "function") nav.dismissTo(plan.href)
      else nav.navigate(plan.href)
      return
    }
    if (plan.method === "push") nav.push(plan.href)
    else if (plan.method === "replace") nav.replace(plan.href)
    else nav.navigate(plan.href)
  }
  parkShellTab(plan.parkTab)
}

export function markModeShift(from: AppMode, to: AppMode, href: string | null, now = Date.now()): void {
  shiftGeneration += 1
  shift = {
    from,
    to,
    dir: to === "wallet" ? 1 : -1,
    href,
    at: now,
  }
  for (const listener of shiftListeners) listener()
}

export function getModeShift(): ModeShift | null {
  return shift
}

export function getModeShiftGeneration(): number {
  return shiftGeneration
}

export function subscribeModeShift(listener: () => void): () => void {
  shiftListeners.add(listener)
  return () => {
    shiftListeners.delete(listener)
  }
}

export function modeShiftIsFresh(now = Date.now()): boolean {
  return shift != null && now - shift.at < MODE_SHIFT_FRESH_MS
}

export function registerShellTabNavigator(nav: ShellTabNavigator | null): void {
  shellTabNavigator = nav
  if (nav) flushPark()
}

function flushPark(): void {
  const nav = shellTabNavigator
  const name = pendingPark
  if (!nav || !name) return
  if (nav.isReady && !nav.isReady()) return
  pendingPark = null
  nav.navigate(name)
}

/**
 * Pindahkan tab yang tertutup ke slot mode baru. Bila navigator belum
 * terpasang (layar tab sempat terlepas saat stack terbuka), permintaan
 * disimpan dan dijalankan saat layout tab mendaftar lagi.
 */
export function parkShellTab(name: ShellTabName | null): void {
  if (!name) return
  pendingPark = name
  flushPark()
}

export function resetAppModeForTest(): void {
  shift = null
  shiftGeneration = 0
  shellTabNavigator = null
  pendingPark = null
  shiftListeners.clear()
}

export function useAppMode(): AppMode {
  const { prefs } = useUiPrefs()
  return prefs.appMode
}

export function setAppMode(mode: AppMode): void {
  setUiPrefs({ appMode: mode })
}
