/**
 * Item 59 (FE-IMP-1, strict 2026-09-28): keputusan putar/jeda video galeri.
 *
 * Aturan:
 * - `gated` (hemat data & video belum diminta pengguna) → jangan pernah putar.
 * - Mode hemat data AKTIF → autoplay (sinyal scroll-driven `autoplaySignal`)
 *   SELALU false, bahkan setelah video dimuat manual. Video hanya diputar
 *   dari aksi eksplisit pengguna (`userPlay`: ketuk poster "Putar video"
 *   atau ketuk video), yang dicabut saat pengguna pindah slide.
 * - Mode hemat data MATI → autoplay bila sinyal aktif, ATAU niat eksplisit
 *   pengguna (`userPlay`) — permukaan tanpa autoplay tetap bisa memutar.
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
  // FD-02 (audit etalase 2026-10-10): niat eksplisit pengguna SELALU memutar
  // bila tidak gated. Dulu di luar mode hemat data hanya sinyal autoplay yang
  // dihitung, sehingga tombol putar di permukaan tanpa autoplay (tab Etalase
  // profil, kartu terkait) tidak melakukan apa-apa.
  if (input.userPlay) return true
  return !input.dataSaver && input.autoplaySignal
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

/** React forwardRef/memo (expo-video web) adalah object, bukan function. */
export function supportsVideoModule(mod: { VideoView?: unknown; useVideoPlayer?: unknown } | null): boolean {
  const view = mod?.VideoView
  const component = typeof view === "function" || (
    typeof view === "object" && view !== null && "$$typeof" in view &&
    (view.$$typeof === Symbol.for("react.forward_ref") || view.$$typeof === Symbol.for("react.memo"))
  )
  return component && typeof mod?.useVideoPlayer === "function"
}
