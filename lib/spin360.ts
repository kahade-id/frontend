/**
 * Kahade — logika murni viewer 360° (batch 19, item 12).
 *
 * Dipisah dari <Spin360Viewer> agar bisa di-unit-test tanpa runtime
 * React Native (pola yang sama dipakai lib/wallet-history-grouping.ts).
 */

/** Px geser horizontal untuk satu putaran penuh (360°). */
export const SPIN_DRAG_PX_PER_TURN = 600

/**
 * Indeks frame dari akumulasi drag.
 * `deltaX` = px sejak frame awal (positif = geser kanan); hasil selalu dalam
 * [0, frameCount) — wrap-around di kedua arah.
 */
export function spinFrameIndex(startIndex: number, deltaX: number, frameCount: number): number {
  if (frameCount <= 0) return 0
  const steps = Math.round((deltaX / SPIN_DRAG_PX_PER_TURN) * frameCount)
  const next = (startIndex + steps) % frameCount
  return next < 0 ? next + frameCount : next
}
