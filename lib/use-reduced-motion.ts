/**
 * Kahade — useReducedMotion() (§8 motion, WCAG 2.3.3 "Animation from
 * Interactions", audit #2).
 *
 * Satu sumber kebenaran untuk preferensi "Kurangi Gerakan" (iOS Reduce
 * Motion, Android "Hapus animasi", web `prefers-reduced-motion`). Semua
 * primitif animasi di `components/ui` WAJIB membaca hook ini — komponen
 * turunan (Button, Chip, Card, dst) otomatis ikut tanpa perlu tahu.
 *
 * Kebijakan (§8 + kriteria audit #2):
 *   - Gerakan NON-esensial (scale press, translate/spring masuk-keluar,
 *     pulse skeleton/splash/status, grow chart, pop favorit) -> dimatikan
 *     atau diganti fade instan (`duration: 0`).
 *   - Gerakan ESENSIAL yang menyampaikan status (progress bar, loading
 *     indeterminate) -> tetap terlihat tetapi tanpa gerakan besar/berulang:
 *     nilai statis atau fade saja.
 *   - Perubahan state kontrol kecil (checkbox fill, switch thumb, radio dot)
 *     -> instan. Transformnya kecil, tetapi berulang ratusan kali per sesi.
 *
 * Kenapa dua sumber (non-obvious):
 *   - Reanimated `useReducedMotion()` membaca nilai secara SINKRON saat
 *     modul dimuat — frame pertama sudah benar, tidak ada "kedip" animasi
 *     lalu berhenti. Tapi nilainya statis: tidak ikut berubah bila user
 *     mengubah setelan sambil app terbuka.
 *   - `AccessibilityInfo` async (frame pertama belum tahu) tetapi punya
 *     event `reduceMotionChanged`. Kita pakai reanimated sebagai nilai awal
 *     dan AccessibilityInfo untuk pembaruan langsung. Di web RN-Web tidak
 *     mengirim event; reanimated sudah membaca `matchMedia` di sana.
 *
 * Helper `motionDuration(reduced, ms)` mengembalikan 0 saat reduced supaya
 * pola `Animated.timing({ duration })` cukup satu baris berubah dan callback
 * `start(({finished}) => ...)` tetap terpanggil (timing 0ms selesai instan).
 */
import { useEffect, useState } from "react"
import { AccessibilityInfo } from "react-native"
import { useReducedMotion as useReanimatedReducedMotion } from "react-native-reanimated"

export function useReducedMotion(): boolean {
  const initial = useReanimatedReducedMotion()
  const [reduced, setReduced] = useState(initial)

  useEffect(() => {
    let alive = true
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (alive) setReduced(v)
      })
      .catch(() => {
        // Platform tanpa API (web lama): pertahankan nilai reanimated.
      })
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced)
    return () => {
      alive = false
      sub.remove()
    }
  }, [])

  return reduced
}

/** Durasi animasi non-esensial: 0 saat Reduce Motion aktif. */
export function motionDuration(reduced: boolean, ms: number): number {
  return reduced ? 0 : ms
}
