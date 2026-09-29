/**
 * Kahade — sisa mesin mode aplikasi E-Commerce ⇄ E-Wallet.
 *
 * REVISI 2026-09-28 (NAV-011): pemilih mode (<ModeSwitcher>) sudah MATI
 * total sejak redesign navigasi 2026-09-27 — tidak di-render di mana pun,
 * tidak ada UI yang menulis preferensi `appMode` lagi. Seluruh mesin
 * pengalih yang mati ikut dihapus: `setAppMode`, `planModeChange`,
 * `planSlotPress`, `applyModeNavigation`, `parkShellTab`/`flushPark`/
 * `registerShellTabNavigator`, dan tabel slot shell (`SHELL_DESTINATIONS`,
 * `resolveShellBar`, dkk). Kode parkir tab (`nav.navigate(name)`) adalah
 * jebakan: bila suatu saat kepanggil ia membajak tab aktif.
 *
 * Yang TERSISA dan masih hidup:
 *   - protokol event "mode shift" (`markModeShift`/`subscribeModeShift`/…)
 *     yang dipakai <ModeShiftFade> (components/ui/mode-switcher.tsx) —
 *     wrapper animasi reveal yang masih di-render di 6+ layar;
 *   - `useAppMode()` — pembaca preferensi (tidak ada penulis lagi);
 *   - helper path murni (`normalizeShellPath`, `pathMatchesBase`).
 */

import { useUiPref, type UiPrefs } from "@/lib/ui-prefs"

export type AppMode = UiPrefs["appMode"]

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

let shift: ModeShift | null = null
let shiftGeneration = 0
const shiftListeners = new Set<() => void>()

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

export function resetAppModeForTest(): void {
  shift = null
  shiftGeneration = 0
  shiftListeners.clear()
}

export function useAppMode(): AppMode {
  // R1-002: selector per-key — tulis preferensi lain tidak membangunkan.
  return useUiPref("appMode")
}
