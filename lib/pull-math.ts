/**
 * Kahade — aritmetika keputusan <PullToRefresh> (murni, tanpa React).
 *
 * Kenapa berada di file terpisah (bukan inline di komponen): setiap baris di
 * bawah dieksekusi di dalam worklet `Gesture.Pan()` pada UI thread, sehingga
 * tidak bisa di-log, tidak bisa di-mock, dan kesalahan di sini tidak terlihat
 * sebagai galat — melainkan sebagai layar yang "tidak bisa di-scroll".
 * Membungkusnya sebagai fungsi murni membuat aturan main-nya bisa diuji di Node
 * (tests/pull-to-refresh.test.ts) tanpa perangkat.
 *
 * Direktif `"worklet"` di tiap fungsi WAJIB (bukan hiasan): pemanggilnya
 * hidup di `Gesture.Pan()` yang dikompilasi Reanimated ke UI thread. Tanpa
 * direktif itu, `@babel/core` + plugin Reanimated hanya MENANGKAP fungsinya
 * sebagai nilai closure (`__closure={… decidePull:decidePull …}`) dan
 * pemanggilannya tidak terjamin ada di runtime UI thread. Dengan direktif itu
 * fungsi ikut dikompilasi sebagai worklet, dan tetap berupa fungsi JS biasa
 * saat diimpor dari Node (tests/pull-to-refresh.test.ts) — direktifnya hanya
 * string literal di awal badan fungsi.
 *
 * Konteks audit 2026-09-08 (docs/audit/PULL-TO-REFRESH-2026-09-08.md):
 * laporan "ga bisa di scroll" berakar pada SATU keputusan, yaitu kapan pan boleh
 * mengambil alih gerakan. Salah jawab di keputusan itu menghasilkan dua
 * kegagalan yang berlawanan — scroll diblokir di tengah list (laporan
 * pertama), atau tarikan tidak pernah aktif sama sekali (laporan kedua).
 */

/**
 * Toleransi "sedang di puncak", dalam px.
 *
 * Non-obvious: membandingkan `contentOffset.y > 0` secara ketat TERLIHAT benar
 * tapi salah di perangkat nyata — ScrollView melaporkan offset sub-piksel
 * (0.33, 0.997) saat berada di puncak, terutama setelah fling berhenti atau
 * setelah `contentContainerStyle` berubah tinggi. Tanpa epsilon, offset 0.33
 * sudah cukup untuk membuat tarikan selamanya dianggap "belum di puncak" ->
 * pull-to-refresh mati dan (di versi sebelumnya) layar terkunci di posisi itu.
 */
export const AT_TOP_EPSILON = 1

/** Tarik turun minimal (px, sejak sentuh) sebelum pan boleh AKTIF di puncak. */
export const PULL_ACTIVATE_OFFSET = 10

/** Gerakan horizontal/vertikal yang membuktikan "ini scroll, bukan tarikan". */
export const FAIL_OFFSET_Y = 8
export const FAIL_OFFSET_X = 20

/** Setelah ambang: perlawanan 0.35, dibatasi 1.6x ambang. */
export const OVERPULL_RESISTANCE = 0.35
export const OVERPULL_MAX_RATIO = 1.6

export type PullDecision = "activate" | "fail" | "hold"

/** Benar bila offset masih dianggap "di puncak" (lihat AT_TOP_EPSILON). */
export function isAtTop(offsetY: number, epsilon = AT_TOP_EPSILON): boolean {
  "worklet"
  return offsetY <= epsilon
}

/**
 * Keputusan sekali-per-gesture: apakah pan mengambil alih (`activate`),
 * mundur permanen (`fail`), atau menunggu (`hold`).
 *
 * "Belum di puncak" SELALU menghasilkan `fail`, bukan `hold`, begitu gerakan
 * melewati ambang kecil: bila dibiarkan `hold`, pan tetap terdaftar dan ikut
 * menahan antrean gesture sepanjang sentuhan — itulah penyebab scroll terasa
 * tersendat/beku pada laporan pengguna. Sebaliknya, di puncak gerakan ke atas
 * juga harus `fail` supaya scroll turun bisa langsung berjalan.
 */
export function decidePull(input: {
  offsetY: number
  dy: number
  dx: number
  activateOffset?: number
  /**
   * Tarikan tidak boleh dimulai sama sekali (mis. refresh sedang berjalan).
   * Hasilnya `fail`, BUKAN `hold`: pan yang dibiarkan menggantung di status
   * UNDETERMINED tetap terdaftar di antrean gesture sepanjang sentuhan, dan di
   * Android itu sudah cukup untuk membuat scroll terasa tersendat. `fail`
   * melepas sentuhan ke scroll native seketika.
   */
  blocked?: boolean
}): PullDecision {
  "worklet"
  const { offsetY, dy, dx, activateOffset = PULL_ACTIVATE_OFFSET, blocked = false } = input
  if (blocked) return "fail"
  if (!isAtTop(offsetY)) {
    return Math.abs(dy) > FAIL_OFFSET_Y || Math.abs(dx) > FAIL_OFFSET_X ? "fail" : "hold"
  }
  if (dy > activateOffset) return "activate"
  if (dy < -FAIL_OFFSET_Y || Math.abs(dx) > FAIL_OFFSET_X) return "fail"
  return "hold"
}

/**
 * Jarak perpindahan konten (px) untuk jarak tarik `dy`.
 *
 * `dy <= 0` -> 0 (bukan nilai negatif: konten tidak boleh "mendorong" ke atas,
 * itu tugas scroll). 1:1 sampai ambang, lalu perlawanan + batas atas, supaya
 * tarikan lanjutan tidak memperbesar indikator tanpa batas.
 */
export function pullDistance(
  dy: number,
  threshold: number,
  resistance = OVERPULL_RESISTANCE,
  maxRatio = OVERPULL_MAX_RATIO,
): number {
  "worklet"
  if (!(threshold > 0) || dy <= 0) return 0
  if (dy <= threshold) return dy
  return Math.min(threshold + (dy - threshold) * resistance, threshold * maxRatio)
}

/** Ambang tercapai? Dipakai untuk memicu refresh SEKALI per gesture. */
export function reachedThreshold(distance: number, threshold: number): boolean {
  "worklet"
  return threshold > 0 && distance >= threshold
}
