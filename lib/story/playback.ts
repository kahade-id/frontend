/**
 * Kahade — logika pemutaran story (murni, tanpa React/Reanimated).
 *
 * Dipisah dari viewer supaya aturan navigasi (tap kiri/kanan, batas awal/akhir,
 * pindah ke penulis berikutnya) bisa diuji tanpa perangkat.
 *
 * Keputusan non-obvious:
 *   - Durasi per story TETAP (5 detik), bukan dari panjang video: fitur ini
 *     hanya foto/teks. Progress bar memakai durasi ini untuk setiap segmen.
 *   - Zona tap: 35% kiri = mundur, 35% kanan = maju, 30% tengah = tidak
 *     melakukan apa-apa. Sengaja tidak simetris di tengah supaya tap yang
 *     meleset saat ingin mundur tidak langsung memajukan story.
 *   - Tekan-tahan (pause) TIDAK diatur di sini; viewer menghitung waktu
 *     pause sendiri lewat `progressTarget` (lihat di bawah).
 */

export const STORY_SEGMENT_MS = 5_000

export const TAP_BACK_ZONE = 0.35
export const TAP_FORWARD_ZONE = 0.65

export type TapAction = "back" | "forward" | "none"

/** Tentukan aksi dari posisi tap relatif terhadap lebar layar (0..1). */
export function tapActionAt(ratioX: number): TapAction {
  if (!Number.isFinite(ratioX)) return "none"
  if (ratioX < TAP_BACK_ZONE) return "back"
  if (ratioX > TAP_FORWARD_ZONE) return "forward"
  return "none"
}

export type PlaybackStep =
  | { kind: "index"; index: number }
  | { kind: "next-author" }
  | { kind: "prev-author" }
  | { kind: "close" }

/**
 * Langkah berikutnya saat "maju". Di story terakhir penulis → pindah ke
 * penulis berikutnya; bila tidak ada, tutup viewer.
 */
export function stepForward(index: number, total: number, hasNextAuthor: boolean): PlaybackStep {
  if (total <= 0) return hasNextAuthor ? { kind: "next-author" } : { kind: "close" }
  if (index < total - 1) return { kind: "index", index: index + 1 }
  return hasNextAuthor ? { kind: "next-author" } : { kind: "close" }
}

/**
 * Langkah saat "mundur". Di story pertama → kembali ke penulis sebelumnya bila
 * ada; kalau tidak, tetap di story pertama (tidak menutup — mengikuti WhatsApp).
 */
export function stepBack(index: number, hasPrevAuthor: boolean): PlaybackStep {
  if (index > 0) return { kind: "index", index: index - 1 }
  return hasPrevAuthor ? { kind: "prev-author" } : { kind: "index", index: 0 }
}

/**
 * Sisa durasi segmen (ms) untuk progress bar, dari fraksi yang sudah dilewati.
 * Dipakai saat melanjutkan setelah tekan-tahan: animasi jalan dari titik
 * berhenti, bukan dari nol.
 */
export function remainingSegmentMs(progress: number, durationMs = STORY_SEGMENT_MS): number {
  const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0))
  return Math.round((1 - p) * durationMs)
}

/** Indeks story yang harus diputar ketika viewer dibuka dengan `startAt` (dibatasi ke rentang). */
export function clampIndex(index: number, total: number): number {
  if (total <= 0) return 0
  if (!Number.isFinite(index)) return 0
  return Math.min(total - 1, Math.max(0, Math.floor(index)))
}
