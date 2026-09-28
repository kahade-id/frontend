/**
 * Item 59 (FE-IMP-1, strict 2026-09-28): keputusan putar/jeda video galeri.
 *
 * Aturan:
 * - `gated` (hemat data & video belum diminta pengguna) → jangan pernah putar.
 * - Mode hemat data AKTIF → autoplay (sinyal scroll-driven `autoplaySignal`)
 *   SELALU false, bahkan setelah video dimuat manual. Video hanya diputar
 *   dari aksi eksplisit pengguna (`userPlay`: ketuk poster "Putar video"
 *   atau ketuk video), yang dicabut saat pengguna pindah slide.
 * - Mode hemat data MATI → perilaku lama: autoplay bila sinyal aktif.
 *
 * Diekstrak sebagai fungsi murni supaya bisa diuji tanpa JSX.
 */
export interface VideoPlayInput {
  /** Mode hemat data & video belum diminta → tampilkan poster saja. */
  gated: boolean
  /** Preferensi hemat data pengguna sedang aktif. */
  dataSaver: boolean
  /** Sinyal autoplay scroll-driven: slide aktif & terlihat & tak di-pause. */
  autoplaySignal: boolean
  /** Niat putar eksplisit pengguna (latch), sudah memperhitungkan pause. */
  userPlay: boolean
}

export function resolveVideoShouldPlay(input: VideoPlayInput): boolean {
  if (input.gated) return false
  if (input.dataSaver) return input.userPlay
  return input.autoplaySignal
}

/**
 * Toggle niat putar untuk ketuk-tunggal pada slide video dalam mode hemat
 * data. Di luar mode hemat data, ketuk-tunggal tetap toggle `paused` biasa
 * (ditangani pemanggil) — fungsi ini hanya untuk jalur hemat data.
 *
 * @param currentlyPlaying apakah video sedang diputar karena niat eksplisit
 * @returns `{ latch, paused }` baru untuk video tersebut
 */
export function toggleDataSaverPlayIntent(currentlyPlaying: boolean): {
  latch: boolean
  paused: boolean
} {
  return currentlyPlaying ? { latch: false, paused: true } : { latch: true, paused: false }
}
