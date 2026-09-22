/**
 * Sinyal "jangan menembak lagi dulu" dari backend (C-09 audit).
 *
 * Kenapa modul terpisah (non-obvious): `lib/use-polling.ts` hanya tahu bahwa
 * callback-nya SELESAI — bukan apakah berhasil. Callback polling yang menelan
 * galatnya sendiri (pola yang dipakai `lib/unread-count.ts` dan
 * `lib/use-qris-payment.ts`, karena mereka menampilkan status inline, bukan
 * melempar) membuat `retryAfterMs` dari `ApiError` tidak pernah terlihat oleh
 * loop polling: saat backend membalas 429/503 berantai, klien tetap menembak
 * pada interval tetap selama sesi pengguna.
 *
 * Solusinya: sinyalnya diambil dari TRANSPORT (satu-satunya tempat yang melihat
 * status 429/503 apa pun bentuk callback-nya) dan disimpan di sini. Loop
 * polling memakai `backpressureRemainingMs()` sebagai interval MINIMUM; respons
 * sukses menghapus cooldown.
 *
 * Keputusan non-obvious:
 *   - `Retry-After` dari server dihormati APA ADANYA (hanya dibatasi atas) —
 *     ia instruksi eksplisit, bukan sinyal untuk di-eksponensialkan sendiri.
 *   - Tanpa `Retry-After`, jeda tumbuh 2× per sinyal beruntun (5 s → 10 s → …)
 *     dengan batas `MAX_BACKOFF_MS`, dan setiap respons sukses meresetnya.
 *   - Batas atas 2 menit: cukup untuk melewati insiden singkat, tidak sampai
 *     membuat polling "mati" tanpa jejak.
 */

/** Jeda dasar bila server tidak mengirim `Retry-After`. */
export const DEFAULT_BACKOFF_MS = 5_000
/** Batas atas jeda (2 menit) — menjaga polling tetap hidup walau server sakit. */
export const MAX_BACKOFF_MS = 120_000
/** Batas eksponen (2^5 = 32×) supaya tidak meledak pada insiden panjang. */
const MAX_STEPS = 5

let consecutive = 0
let resumeAt = 0

/**
 * Catat sinyal tekanan balik. Mengembalikan jeda yang dipakai (ms) supaya
 * pemanggil bisa menguji/melog nilainya.
 */
export function recordBackpressure(retryAfterMs?: number, now = Date.now()): number {
  const instructed = typeof retryAfterMs === "number" && Number.isFinite(retryAfterMs) && retryAfterMs > 0
  consecutive = Math.min(consecutive + 1, MAX_STEPS)
  const delay = instructed
    ? Math.min(retryAfterMs, MAX_BACKOFF_MS)
    : Math.min(DEFAULT_BACKOFF_MS * 2 ** (consecutive - 1), MAX_BACKOFF_MS)
  resumeAt = now + delay
  return delay
}

/** Sisa cooldown (ms); 0 berarti boleh menembak lagi. */
export function backpressureRemainingMs(now = Date.now()): number {
  return Math.max(0, resumeAt - now)
}

/** Respons sukses = server sehat lagi. */
export function clearBackpressure(): void {
  consecutive = 0
  resumeAt = 0
}

/** Snapshot untuk log/test. */
export function backpressureSnapshot(now = Date.now()): { consecutive: number; remainingMs: number } {
  return { consecutive, remainingMs: backpressureRemainingMs(now) }
}
