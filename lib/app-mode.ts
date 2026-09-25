/**
 * Kahade — mode aplikasi E-Commerce ⇄ E-Wallet.
 *
 * Satu preferensi (`appMode`) mengubah isi lima slot navbar yang sama, bukan
 * dua navbar. File ini murni: tidak mengimpor expo-router atau ikon, supaya
 * rencana navigasi bisa diuji tanpa stub router.
 *
 * Aturan pindah mode (revisi 2026-09-26 — ganti mode TIDAK memindahkan halaman):
 *   - halaman shell (8 halaman + /more): TETAP di tempat, tanpa park. Yang
 *     berganti hanya isi navbar — lihat `planModeChange`.
 *   - /home dan /discover (bukan milik mode mana pun): masuk ke slot primer
 *     mode baru (`navigate` bila itu tab, `leave-to-tab` bila stack).
 *   - rute di luar shell (detail, form, profil sendiri): tetap di tempat;
 *     park tab primer mode baru hanya menyiapkan tab yang terbuka saat stack
 *     ini ditutup, tanpa mengubah apa yang sedang terlihat.
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
 *
 * Catatan (2026-09-25): fungsi ini hanya melihat daftar halaman MODE YANG
 * AKTIF. Untuk memutuskan apakah bar tampil di halaman milik mode lain —
 * kasus "navbar etalase hilang" — pakai `resolveShellBar()` di bawah.
 */
export function activeShellSlot(path: string, mode: AppMode): ShellSlotId | null {
  const current = normalizeShellPath(path)
  const map = mode === "commerce" ? COMMERCE_SHELL_SLOTS : WALLET_SHELL_SLOTS
  return map[current] ?? null
}

/**
 * Mode yang "memiliki" halaman shell ini; `null` bila path bukan halaman shell.
 *
 * `/more` sengaja `null`: halaman itu ada di KEDUA peta dan dipakai bersama
 * (kartu pengalih mode ada di sana), jadi mode aktifnya ditentukan pemanggil.
 */
export function shellPageMode(path: string): AppMode | null {
  const current = normalizeShellPath(path)
  const commerce = COMMERCE_SHELL_SLOTS[current]
  const wallet = WALLET_SHELL_SLOTS[current]
  if (commerce && wallet) return null
  if (commerce) return "commerce"
  if (wallet) return "wallet"
  return null
}

export type ShellBarResolution = { mode: AppMode; slot: ShellSlotId }

/**
 * Slot + mode efektif bottom navbar untuk `path`.
 *
 * Bug yang diperbaiki (2026-09-25): `activeShellSlot(path, mode)` hanya
 * mengenal daftar halaman mode yang SEDANG aktif, sehingga membuka /showcase
 * (halaman mode commerce) dengan preferensi `appMode` = "wallet" membuat bar
 * hilang SELURUHNYA — tidak ada navbar sama sekali di halaman itu. Gejalanya
 * makin membingungkan karena dokumen HTML hasil export (dan render pertama
 * saat hydration) memakai preferensi default `commerce`: bar terlihat, lalu
 * lenyap begitu `loadUiPrefs()` selesai membaca localStorage — persis keluhan
 * "di-refresh muncul sebentar lalu hilang".
 *
 * Aturan yang berlaku sekarang — HALAMAN yang menentukan isi bar:
 *   - halaman milik satu mode (mis. /showcase) memakai slot mode pemiliknya,
 *     apa pun preferensi tersimpan: /showcase di mode wallet = bar commerce
 *     dengan slot primer (Etalase) aktif, sehingga pengguna tetap bisa
 *     berpindah halaman;
 *   - `/more` dipakai kedua mode → mengikuti mode aktif;
 *   - rute non-shell (detail, form, chat room) → null, bar tetap disembunyikan.
 *
 * Preferensi `appMode` sengaja TIDAK ditulis ulang di sini: halaman hanya
 * memakai bar miliknya, bukan mengubah pilihan mode pengguna.
 */
export function resolveShellBar(path: string, mode: AppMode): ShellBarResolution | null {
  const effective = shellPageMode(path) ?? mode
  const slot = activeShellSlot(path, effective)
  return slot ? { mode: effective, slot } : null
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
  /*
   * Halaman shell (termasuk /more): TETAP DI TEMPAT dan TANPA park.
   * `parkShellTab()` bernavigasi di navigator tab, jadi memarkir tab primer
   * mode baru sama saja dengan memindahkan layar — itulah sebabnya dulu
   * menggeser mode di /more mengirim pengguna ke /wallet.
   */
  if (current === "/more" || matchingSlot(current) != null) {
    return { kind: "stay", parkTab: null }
  }
  // /home dan /discover bukan milik mode mana pun — masuk ke primer mode baru.
  if (current === "/home" || current === "/discover") {
    return {
      kind: "go",
      href: primary.href,
      method: isExactTabPath(current) ? "navigate" : "leave-to-tab",
      parkTab: primary.tab ?? primaryTabFor(to),
    }
  }
  // Rute di luar shell (detail, form, profil sendiri): yang terlihat tidak
  // berubah; park hanya menyiapkan tab terbuka saat stack ini ditutup.
  return { kind: "stay", parkTab: primaryTabFor(to) }
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
