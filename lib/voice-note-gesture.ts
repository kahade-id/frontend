/**
 * Kahade — matematika gestur voice note ala WhatsApp (audit chat C7, MURNI).
 *
 * Tahan tombol mic → merekam. Selagi menahan:
 *   - geser KE ATAS sejauh `VOICE_LOCK_DISTANCE_PX` → rekaman TERKUNCI
 *     (jari boleh diangkat; kirim/buang lewat tombol),
 *   - geser KE KIRI sejauh `VOICE_CANCEL_DISTANCE_PX` lalu lepas → BATAL,
 *   - lepas begitu saja → kirim.
 *
 * Aturan yang mudah salah, dikunci di sini supaya bisa diuji tanpa perangkat:
 *
 *   - SUMBU DIKUNCI SEKALI: begitu gerakan melewati zona mati, sumbu dominan
 *     (atas/kiri) ditetapkan dan bertahan sampai jari diangkat. Tanpa ini jari
 *     yang bergeser ke atas lalu sedikit ke kiri menaikkan progres batal dan
 *     rekaman terbuang tanpa disengaja.
 *   - Hanya ARAH yang bermakna dihitung: geser ke kanan/bawah = 0 (kembali ke
 *     titik awal membatalkan niat mengunci/membatalkan).
 *   - Batal diputuskan saat LEPAS berdasarkan posisi SAAT ITU (jari yang
 *     dikembalikan ke tengah menyelamatkan rekaman); kunci terjadi SEGERA
 *     begitu ambang tercapai (umpan balik haptic di momen itu).
 */

/** Lama menahan (ms) sebelum rekaman dimulai — membedakan tap dari tahan. */
export const VOICE_HOLD_MS = 250
/** Zona mati (px) sebelum sumbu dominan ditetapkan. */
export const VOICE_AXIS_DEAD_ZONE_PX = 12
/** Jarak geser ke atas (px) untuk mengunci. */
export const VOICE_LOCK_DISTANCE_PX = 84
/** Jarak geser ke kiri (px) untuk membatalkan saat dilepas. */
export const VOICE_CANCEL_DISTANCE_PX = 112
/**
 * Rekaman terkunci yang lebih panjang dari ini (ms) meminta konfirmasi sebelum
 * dibuang — pola sama dengan lembar perekam (B3O-22).
 */
export const VOICE_DISCARD_CONFIRM_MS = 5_000

export type VoiceDragAxis = "none" | "up" | "left"

export type VoiceDragResult = {
  axis: VoiceDragAxis
  /** 0..1 — seberapa dekat ke kunci (hanya bermakna di sumbu "up"). */
  lockProgress: number
  /** 0..1 — seberapa dekat ke batal (hanya bermakna di sumbu "left"). */
  cancelProgress: number
  /** Ambang kunci tercapai. */
  lock: boolean
  /** Ambang batal tercapai (menentukan hasil bila dilepas sekarang). */
  cancel: boolean
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

/**
 * Terjemahkan translasi jari (`dx`, `dy` relatif titik awal tahan) menjadi
 * progres kunci/batal. `previousAxis` = sumbu yang sudah ditetapkan pada
 * panggilan sebelumnya dalam gestur yang sama (histeresis).
 */
export function resolveVoiceDrag(
  dx: number,
  dy: number,
  previousAxis: VoiceDragAxis = "none",
): VoiceDragResult {
  const left = Math.max(0, -dx)
  const up = Math.max(0, -dy)
  let axis = previousAxis
  if (axis === "none" && Math.max(left, up) >= VOICE_AXIS_DEAD_ZONE_PX) {
    axis = up > left ? "up" : "left"
  }
  const lockProgress = axis === "up" ? clamp01(up / VOICE_LOCK_DISTANCE_PX) : 0
  const cancelProgress = axis === "left" ? clamp01(left / VOICE_CANCEL_DISTANCE_PX) : 0
  return {
    axis,
    lockProgress,
    cancelProgress,
    lock: lockProgress >= 1,
    cancel: cancelProgress >= 1,
  }
}

export type VoicePhase = "idle" | "arming" | "holding" | "locked"

export type VoiceReleaseAction = "send" | "cancel" | "keep-recording" | "ignore"

/**
 * Apa yang terjadi saat jari DIANGKAT.
 *   - belum ada tahan yang valid (`arming`)  → "ignore" (itu hanya tap),
 *   - menahan                                → lewat ambang kiri = "cancel", selain itu "send",
 *   - terkunci                               → "keep-recording" (lanjut, kirim lewat tombol).
 */
export function resolveVoiceRelease(
  phase: VoicePhase,
  drag: Pick<VoiceDragResult, "cancel">,
): VoiceReleaseAction {
  switch (phase) {
    case "holding":
      return drag.cancel ? "cancel" : "send"
    case "locked":
      return "keep-recording"
    default:
      return "ignore"
  }
}

/** Membuang rekaman terkunci selama ini (ms) perlu konfirmasi dulu. */
export function needsDiscardConfirm(durationMs: number): boolean {
  return durationMs >= VOICE_DISCARD_CONFIRM_MS
}
