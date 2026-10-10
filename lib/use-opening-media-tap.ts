import { useCallback, useEffect, useRef, useState } from "react"

export type MediaTapPoint = { x: number; y: number }
export type OpeningMediaTap = { at: number; point: MediaTapPoint | null; onDoubleTap: () => void }
const DOUBLE_TAP_MS = 300
const TAP_SLOP = 12
const record = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === "object" ? value as Record<string, unknown> : null
const native = (event: unknown) => record(record(event)?.nativeEvent) ?? record(event)

export function mediaTapPoint(event: unknown): MediaTapPoint | null {
  const e = native(event)
  const touch = Array.isArray(e?.changedTouches) ? record(e.changedTouches[0]) : Array.isArray(e?.touches) ? record(e.touches[0]) : null
  const pos = touch ?? e
  const x = pos?.pageX ?? pos?.clientX, y = pos?.pageY ?? pos?.clientY
  return typeof x === "number" && typeof y === "number" && Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
}
const nearby = (a: MediaTapPoint | null, b: MediaTapPoint | null) => !a || !b || Math.hypot(a.x - b.x, a.y - b.y) <= TAP_SLOP

/**
 * FD-11 (audit etalase 2026-10-10): tamu yang mengetuk ganda di viewer —
 * `toggleLike` berujung `router.push(loginRequired)` yang dulu terjadi DI
 * BAWAH Modal viewer yang masih terbuka (layar login tidak terlihat). Tutup
 * viewer dulu, lalu teruskan ketuk-ganda pada tick berikutnya (setelah
 * Modal terlepas). Pengguna bersesi: tap diteruskan apa adanya.
 */
export function guardOpeningTapForGuest(
  tap: OpeningMediaTap | undefined,
  hasSession: boolean,
  closeViewer: () => void,
  defer: (fn: () => void) => void = (fn) => void setTimeout(fn, 0),
): OpeningMediaTap | undefined {
  if (!tap || hasSession) return tap
  return {
    ...tap,
    onDoubleTap: () => {
      closeViewer()
      defer(tap.onDoubleTap)
    },
  }
}

/** Observe, never capture responders: zoom/pan and normal media controls remain intact. */
export function useOpeningMediaTap(visible: boolean, openingTap?: OpeningMediaTap) {
  const seed = useRef<OpeningMediaTap | null>(openingTap ?? null)
  const active = useRef(false)
  const [pending, setPending] = useState(visible && !!openingTap)
  const cancel = useCallback(() => { seed.current = null; active.current = false; setPending(false) }, [])
  useEffect(() => {
    seed.current = visible ? openingTap ?? null : null
    active.current = false
    const remaining = seed.current ? DOUBLE_TAP_MS - (Date.now() - seed.current.at) : 0
    if (remaining <= 0 || remaining > DOUBLE_TAP_MS) { cancel(); return }
    setPending(true)
    const timeout = setTimeout(cancel, remaining)
    return () => clearTimeout(timeout)
  }, [visible, openingTap, cancel])
  const valid = useCallback((event: unknown) => {
    const current = seed.current, e = native(event)
    if (!current || Date.now() - current.at < 0 || Date.now() - current.at > DOUBLE_TAP_MS) return false
    if (Array.isArray(e?.touches) && e.touches.length > 1) return false
    if (e?.isPrimary === false || (typeof e?.button === "number" && e.button !== 0)) return false
    return nearby(current.point, mediaTapPoint(event))
  }, [])
  const start = useCallback((event: unknown) => {
    const target = record(record(event)?.target)
    const closest = target?.closest
    if (typeof closest === "function" && closest.call(target, "button, input, textarea, [role='button']")) { cancel(); return }
    if (!valid(event)) { cancel(); return }
    active.current = true
  }, [valid, cancel])
  const move = useCallback((event: unknown) => { if (active.current && !valid(event)) cancel() }, [valid, cancel])
  const end = useCallback((event: unknown) => {
    if (!active.current || !valid(event)) { cancel(); return }
    const callback = seed.current?.onDoubleTap
    cancel()
    callback?.()
  }, [valid, cancel])
  return {
    pending,
    handlers: { onTouchStart: start, onTouchMove: move, onTouchEnd: end, onTouchCancel: cancel,
      onPointerDown: start, onPointerMove: move, onPointerUp: end, onPointerCancel: cancel },
  }
}
