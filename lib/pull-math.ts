/**
 * Aritmetika murni untuk pull-to-refresh berbasis React Native PanResponder.
 *
 * Fungsi di file ini hanya berjalan di JS thread. Jangan tambahkan direktif
 * `worklet` dan jangan panggil dari RNGH/Reanimated: insiden force-close
 * sebelumnya berasal dari synchronous gesture state manager di UI/native
 * thread, bukan dari perhitungan jaraknya.
 */

/** Offset sub-piksel masih dianggap puncak. */
export const AT_TOP_EPSILON = 1
/** Gerak minimum sebelum parent mengambil responder dari scroller. */
export const PULL_CAPTURE_OFFSET = 6
/** Gerakan harus jelas lebih vertikal daripada horizontal. */
export const VERTICAL_DOMINANCE_RATIO = 1.15
/** Resistensi dan batas setelah ambang refresh. */
export const OVERPULL_RESISTANCE = 0.35
export const OVERPULL_MAX_RATIO = 1.6

export function isAtTop(offsetY: number, epsilon = AT_TOP_EPSILON): boolean {
  return Number.isFinite(offsetY) && offsetY <= epsilon
}

export function shouldCapturePull(input: {
  offsetY: number
  dy: number
  dx: number
  enabled: boolean
  refreshing: boolean
  touches?: number
  captureOffset?: number
}): boolean {
  const {
    offsetY,
    dy,
    dx,
    enabled,
    refreshing,
    touches = 1,
    captureOffset = PULL_CAPTURE_OFFSET,
  } = input
  if (
    !enabled ||
    refreshing ||
    touches !== 1 ||
    !isAtTop(offsetY) ||
    !Number.isFinite(dy) ||
    !Number.isFinite(dx) ||
    !Number.isFinite(captureOffset) ||
    captureOffset < 0
  )
    return false
  return (
    dy > captureOffset && Math.abs(dy) > Math.abs(dx) * VERTICAL_DOMINANCE_RATIO
  )
}

export function pullDistance(
  dy: number,
  threshold: number,
  resistance = OVERPULL_RESISTANCE,
  maxRatio = OVERPULL_MAX_RATIO,
): number {
  if (
    !Number.isFinite(dy) ||
    !Number.isFinite(threshold) ||
    threshold <= 0 ||
    dy <= 0
  )
    return 0
  if (dy <= threshold) return dy
  return Math.min(
    threshold + (dy - threshold) * resistance,
    threshold * maxRatio,
  )
}

export function reachedThreshold(distance: number, threshold: number): boolean {
  return (
    Number.isFinite(distance) &&
    Number.isFinite(threshold) &&
    threshold > 0 &&
    distance >= threshold
  )
}
