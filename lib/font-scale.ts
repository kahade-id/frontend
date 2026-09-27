/**
 * Kahade — skala ukuran font A-/A+ (item #28).
 *
 * Preferensi aksesibilitas level perangkat: pengguna bisa memperkecil/
 * memperbesar SEMUA teks aplikasi antara 0.85x–1.3x dari type scale §3.2.
 * Diterapkan konsisten di SATU titik: `components/ui/text.tsx` (satu-satunya
 * jalan merender teks — lihat header file itu), sehingga tidak ada layar
 * yang terlewat dan tidak ada yang ter-scale dua kali.
 *
 * Keputusan non-obvious:
 *   - Modul sendiri (bukan `lib/ui-prefs.ts`): blob uiPrefs milik alur lain
 *     dan file itu sedang dikerjakan tim lain — modul terpisah = nol risiko
 *     konflik, satu key SecureStore sendiri.
 *   - `variant="inherit"` TIDAK di-scale (di text.tsx): teks nested mewarisi
 *     ukuran parent yang SUDAH di-scale — men-scale lagi = ganda.
 *   - Clamp di baca DAN tulis: nilai korup di storage tidak boleh merusak
 *     layout (fail-safe ke 1.0).
 *   - Persist di SecureStore (web: localStorage — non-sensitif, seperti
 *     themePreference). Gagal tulis tidak dilempar: state memori tetap benar
 *     untuk sesi ini (pola yang sama dengan ui-prefs).
 *   - Tidak menyentuh `allowFontScaling`/Dynamic Type OS: itu preferensi
 *     sistem yang tetap berlaku DI ATAS skala ini.
 */
import { useSyncExternalStore } from "react"

import { getSecureItem, setSecureItem, SecureKeys } from "@/lib/secure-storage"
import { logWarn } from "@/lib/telemetry"

/** Batas skala: 0.85x (A-) sampai 1.3x (A+). */
export const FONT_SCALE_MIN = 0.85
export const FONT_SCALE_MAX = 1.3
export const FONT_SCALE_DEFAULT = 1
/** Langkah tiap ketuk A- / A+. */
export const FONT_SCALE_STEP = 0.05

/**
 * Clamp nilai apa pun ke rentang valid. Non-number/NaN/Infinity → default.
 * Dipakai saat baca storage (data korup fail-safe) dan sebelum tulis.
 */
export function clampFontScale(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : FONT_SCALE_DEFAULT
  return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, n))
}

let scale: number = FONT_SCALE_DEFAULT
const listeners = new Set<() => void>()
let loadPromise: Promise<void> | null = null

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Muat dari storage sekali (dipanggil malas saat hook pertama dipakai). */
function ensureLoaded() {
  if (loadPromise) return
  loadPromise = (async () => {
    try {
      const raw = await getSecureItem(SecureKeys.fontScale)
      if (raw != null) {
        const parsed = Number(raw)
        const next = clampFontScale(Number.isFinite(parsed) ? parsed : FONT_SCALE_DEFAULT)
        if (next !== scale) {
          scale = next
          emit()
        }
      }
    } catch (err) {
      logWarn("font-scale: gagal memuat preferensi", { error: String(err) })
    }
  })()
}

/** Nilai skala saat ini (untuk pemakaian non-React). */
export function getFontScale(): number {
  ensureLoaded()
  return scale
}

/** Simpan skala baru (di-clamp), persist, dan beri tahu semua subscriber. */
export function setFontScale(next: number): void {
  const clamped = clampFontScale(next)
  if (clamped === scale) return
  scale = clamped
  emit()
  void (async () => {
    try {
      await setSecureItem(SecureKeys.fontScale, String(clamped))
    } catch (err) {
      logWarn("font-scale: gagal menyimpan preferensi", { error: String(err) })
    }
  })()
}

/** Naikkan satu langkah (A+). Mengembalikan nilai akhir. */
export function increaseFontScale(): number {
  // Pembulatan 2 desimal: 0.1 + 0.2 problem floating point.
  const next = clampFontScale(Math.round((scale + FONT_SCALE_STEP) * 100) / 100)
  setFontScale(next)
  return next
}

/** Turunkan satu langkah (A-). Mengembalikan nilai akhir. */
export function decreaseFontScale(): number {
  const next = clampFontScale(Math.round((scale - FONT_SCALE_STEP) * 100) / 100)
  setFontScale(next)
  return next
}

/** Kembalikan ke 100%. */
export function resetFontScale(): void {
  setFontScale(FONT_SCALE_DEFAULT)
}

/** Hook React: skala saat ini, re-render otomatis saat berubah. */
export function useFontScale(): number {
  ensureLoaded()
  return useSyncExternalStore(subscribe, () => scale, () => scale)
}
