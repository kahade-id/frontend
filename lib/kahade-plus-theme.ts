/**
 * Kahade — tema eksklusif Kahade+ (benefit 5).
 *
 * Cakupan yang dikerjakan:
 *   - Pilihan warna aksen eksklusif. Override disuntikkan sebagai CSS variable
 *     `--color-accent-*` lewat <ThemeProvider> (bukan `--color-primary-*`:
 *     primary adalah identitas brand hitam/putih yang dijaga §2.1 tokens —
 *     aksen adalah momen premium yang memang dirancang bisa bervariasi).
 *   - Preferensi disimpan lokal (SecureKeys.kahadePlusTheme) dan dipertahankan
 *     walau langganan berakhir; yang dikunci langganan adalah PEMAKAIAN
 *     (`effectiveThemeId`), bukan penyimpanannya — berlangganan lagi
 *     mengembalikan pilihan lama otomatis.
 *   - Ikon aplikasi custom: id ikon disimpan berdampingan sebagai preferensi,
 *     TETAPI pergantian ikon launcher saat runtime TIDAK didukung Expo
 *     managed workflow (butuh alternate icons native + rebuild). Nilai ini
 *     siap dipakai modul native di masa depan; layar picker menuliskannya
 *     jujur sebagai "butuh pembaruan aplikasi".
 *
 * Sinkron backend: BELUM ADA endpoint kontrak untuk preferensi tema, jadi
 * murni lokal. Bila backend menambahkannya, baca/tulis di `select()` dan
 * `loadThemeChoice()` modul ini saja.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react"

import { getSecureItem, setSecureItem, SecureKeys } from "@/lib/secure-storage"
import { logWarn } from "@/lib/telemetry"
import { getKahadePlusSnapshot, useKahadePlus } from "@/lib/use-kahade-plus"

export type KahadePlusAccent = {
  fill: string
  text: string
  bgSoft: string
  onFill: string
}

export type KahadePlusThemeDef = {
  /** Id stabil — yang disimpan di storage. */
  id: string
  name: string
  description: string
  /** Id gaya ikon aplikasi pendamping (lihat catatan modul soal runtime). */
  appIconId: string
  colors: { light: KahadePlusAccent; dark: KahadePlusAccent }
}

/** Tema default = tanpa override (identitas brand standar). */
export const DEFAULT_THEME_ID = "default"

export const KAHADE_PLUS_THEMES: KahadePlusThemeDef[] = [
  {
    id: "gold",
    name: "Emas Kahade+",
    description: "Aksen emas khas anggota premium.",
    appIconId: "icon-gold",
    colors: {
      light: { fill: "#C9A227", text: "#8C6D1F", bgSoft: "#FBF3DC", onFill: "#FFFFFF" },
      dark: { fill: "#E3B93B", text: "#EBCB6B", bgSoft: "#3A2E0C", onFill: "#1A1405" },
    },
  },
  {
    id: "ocean",
    name: "Samudra",
    description: "Aksen biru laut yang tenang.",
    appIconId: "icon-ocean",
    colors: {
      light: { fill: "#1D6FE0", text: "#155BB5", bgSoft: "#E3EFFD", onFill: "#FFFFFF" },
      dark: { fill: "#5B9BF5", text: "#8FBCF8", bgSoft: "#0E2547", onFill: "#04101F" },
    },
  },
  {
    id: "orchid",
    name: "Anggrek",
    description: "Aksen ungu anggrek yang berani.",
    appIconId: "icon-orchid",
    colors: {
      light: { fill: "#8B46C7", text: "#6F35A3", bgSoft: "#F1E7FB", onFill: "#FFFFFF" },
      dark: { fill: "#B07FE8", text: "#C9A6F0", bgSoft: "#2C1845", onFill: "#170B26" },
    },
  },
  {
    id: "forest",
    name: "Pinus",
    description: "Aksen hijau pinus yang sejuk.",
    appIconId: "icon-forest",
    colors: {
      light: { fill: "#1F7A4D", text: "#176138", bgSoft: "#E2F3E9", onFill: "#FFFFFF" },
      dark: { fill: "#4CAF7D", text: "#7CCBA0", bgSoft: "#0C2E1D", onFill: "#04160D" },
    },
  },
]

export function findKahadePlusTheme(id: string | null | undefined): KahadePlusThemeDef | null {
  if (!id || id === DEFAULT_THEME_ID) return null
  return KAHADE_PLUS_THEMES.find((t) => t.id === id) ?? null
}

/** CSS variable aksen untuk <ThemeProvider> — kosong bila tema default. */
export function kahadePlusAccentVars(
  id: string | null | undefined,
  mode: "light" | "dark",
): Record<string, string> {
  const theme = findKahadePlusTheme(id)
  if (!theme) return {}
  const c = theme.colors[mode]
  return {
    "--color-accent-fill": c.fill,
    "--color-accent-text": c.text,
    "--color-accent-soft": c.bgSoft,
    "--color-accent-foreground": c.onFill,
  }
}

// ---------------------------------------------------------------------------
// Store pilihan (module-level + useSyncExternalStore, pola ui-prefs).
// ---------------------------------------------------------------------------

let selectedId: string = DEFAULT_THEME_ID
let loaded = false
let loadPromise: Promise<void> | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribeStore(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSelectedId(): string {
  return selectedId
}

function loadThemeChoice(): Promise<void> {
  if (!loadPromise) {
    loadPromise = getSecureItem(SecureKeys.kahadePlusTheme)
      .then((stored) => {
        if (stored && (stored === DEFAULT_THEME_ID || findKahadePlusTheme(stored))) {
          selectedId = stored
        }
        loaded = true
        emit()
      })
      .catch((error) => {
        logWarn("kahade-plus-theme:load", error)
        loaded = true
        emit()
      })
  }
  return loadPromise
}

export function isKahadePlusThemeLoaded(): boolean {
  return loaded
}

/** Pastikan pilihan tema dibaca dari storage — idempoten. */
export function ensureKahadePlusThemeLoaded(): void {
  void loadThemeChoice()
}

/** Langganan ke perubahan pilihan tema (untuk pemakaian di luar hook). */
export function subscribeKahadePlusThemeStore(listener: () => void): () => void {
  return subscribeStore(listener)
}

/** Id tema tersimpan (preferensi perangkat). */
export function getKahadePlusThemeSelection(): string {
  return selectedId
}

/**
 * Id tema yang EFEKTIF dipakai UI — tanpa hook (untuk <ThemeProvider> yang
 * berada di luar konteks navigasi). Pilihan eksklusif hanya efektif bila
 * langganan aktif; selain itu fallback "default" otomatis.
 */
export function getEffectiveKahadePlusThemeId(): string {
  const exclusive = findKahadePlusTheme(selectedId) !== null
  return exclusive && getKahadePlusSnapshot().isActive ? selectedId : DEFAULT_THEME_ID
}

export type KahadePlusThemeState = {
  /** Semua pilihan eksklusif (tanpa "default" — itu diwakili pilihan kosong). */
  themes: KahadePlusThemeDef[]
  /** Id yang tersimpan (preferensi perangkat, bisa eksklusif walau expired). */
  selectedId: string
  /**
   * Id yang EFEKTIF dipakai UI: pilihan eksklusif hanya bila langganan aktif,
   * selain itu fallback ke "default". Otomatis — tanpa aksi user.
   */
  effectiveThemeId: string
  /** true bila user boleh memilih tema eksklusif sekarang. */
  canUse: boolean
  /** true bila pilihan tersimpan adalah tema eksklusif tapi sedang fallback. */
  isFallback: boolean
  select: (id: string) => void
}

export function useKahadePlusTheme(): KahadePlusThemeState {
  const stored = useSyncExternalStore(subscribeStore, getSelectedId)
  const { isActive } = useKahadePlus()

  useEffect(() => {
    void loadThemeChoice()
  }, [])

  const select = useCallback((id: string) => {
    const next = id === DEFAULT_THEME_ID || findKahadePlusTheme(id) ? id : DEFAULT_THEME_ID
    selectedId = next
    emit()
    void setSecureItem(SecureKeys.kahadePlusTheme, next).catch((error) =>
      logWarn("kahade-plus-theme:save", error),
    )
  }, [])

  return useMemo(() => {
    const exclusive = findKahadePlusTheme(stored) !== null
    const effectiveThemeId = exclusive && isActive ? stored : DEFAULT_THEME_ID
    return {
      themes: KAHADE_PLUS_THEMES,
      selectedId: stored,
      effectiveThemeId,
      canUse: isActive,
      isFallback: exclusive && !isActive,
      select,
    }
  }, [stored, isActive, select])
}
