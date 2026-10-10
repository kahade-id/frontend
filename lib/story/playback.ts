/**
 * Kahade — logika pemutaran story (murni, tanpa React/Reanimated).
 *
 * Dipisah dari viewer supaya aturan navigasi (tap kiri/kanan, batas awal/akhir,
 * pindah ke penulis berikutnya, geser antar penulis) bisa diuji tanpa perangkat.
 *
 * Keputusan non-obvious:
 *   - Durasi foto/teks TETAP (5 detik). Video (2026-10-10) memakai durasi
 *     berkas dari server (`durationMs`), dibatasi 1–60 dtk; bila modul video
 *     tidak tersedia (APK lama) video diperlakukan seperti foto (poster 5 dtk).
 *   - Zona tap: 35% kiri = mundur, 35% kanan = maju, 30% tengah = tidak
 *     melakukan apa-apa. Sengaja tidak simetris di tengah supaya tap yang
 *     meleset saat ingin mundur tidak langsung memajukan story.
 *   - Tekan-tahan (pause) TIDAK diatur di sini; viewer menghitung waktu
 *     pause sendiri lewat `remainingSegmentMs`.
 */

export const STORY_SEGMENT_MS = 5_000
/** Batas durasi segmen video — selaras `STORY_VIDEO_MAX_DURATION_MS` kontrak. */
export const STORY_VIDEO_SEGMENT_MIN_MS = 1_000
export const STORY_VIDEO_SEGMENT_MAX_MS = 60_000

/**
 * Durasi segmen untuk satu story. Video memakai `durationMs` server (dibatasi
 * 1–60 dtk) HANYA bila pemutar tersedia; selain itu 5 detik seperti foto.
 */
export function segmentDurationMs(
  story: { kind: "image" | "video" | "text"; durationMs: number | null },
  opts: { videoPlayable?: boolean } = {},
): number {
  if (story.kind !== "video" || opts.videoPlayable === false) return STORY_SEGMENT_MS
  const d = story.durationMs
  if (typeof d !== "number" || !Number.isFinite(d) || d <= 0) return STORY_SEGMENT_MS
  return Math.min(STORY_VIDEO_SEGMENT_MAX_MS, Math.max(STORY_VIDEO_SEGMENT_MIN_MS, Math.round(d)))
}

export type SwipeAuthorAction = "next" | "prev" | "none"

/** Fraksi lebar layar yang harus digeser sebelum berpindah penulis. */
export const SWIPE_AUTHOR_DISTANCE_RATIO = 0.3
/** Kecepatan (px/dtk) yang cukup untuk berpindah walau jarak belum terpenuhi (flick). */
export const SWIPE_AUTHOR_VELOCITY = 800

/**
 * Geser horizontal antar penulis (ala Instagram): kiri = penulis berikutnya,
 * kanan = sebelumnya. Jarak ≥ 30% lebar ATAU flick cepat. Geser ke arah yang
 * tidak punya tetangga = "none" (viewer memantulkan kembali).
 */
export function swipeAuthorAction(
  translationX: number,
  velocityX: number,
  width: number,
  opts: { hasNext: boolean; hasPrev: boolean },
): SwipeAuthorAction {
  if (!Number.isFinite(translationX) || !Number.isFinite(velocityX)) return "none"
  const threshold = Math.max(1, width) * SWIPE_AUTHOR_DISTANCE_RATIO
  const goNext = translationX <= -threshold || velocityX <= -SWIPE_AUTHOR_VELOCITY
  const goPrev = translationX >= threshold || velocityX >= SWIPE_AUTHOR_VELOCITY
  if (goNext && !goPrev) return opts.hasNext ? "next" : "none"
  if (goPrev && !goNext) return opts.hasPrev ? "prev" : "none"
  return "none"
}

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
