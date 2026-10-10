/**
 * FD-11 (audit etalase 2026-10-10): tamu yang mengetuk ganda di viewer —
 * viewer ditutup DULU, baru ketuk-ganda (→ layar login) diteruskan pada tick
 * berikutnya; pengguna bersesi tidak tersentuh.
 */
import { describe, expect, it, vi } from "vitest"

import { guardOpeningTapForGuest, type OpeningMediaTap } from "@/lib/use-opening-media-tap"

const tap = (): OpeningMediaTap => ({ at: 1, point: null, onDoubleTap: vi.fn() })

describe("guardOpeningTapForGuest", () => {
  it("bersesi → objek tap yang sama (tidak dibungkus)", () => {
    const t = tap()
    expect(guardOpeningTapForGuest(t, true, () => undefined)).toBe(t)
    expect(guardOpeningTapForGuest(undefined, false, () => undefined)).toBeUndefined()
  })

  it("tamu → closeViewer dipanggil lebih dulu, onDoubleTap asli ditunda lewat defer", () => {
    const t = tap()
    const order: string[] = []
    const close = () => order.push("close")
    const deferred: (() => void)[] = []
    const guarded = guardOpeningTapForGuest(t, false, close, (fn) => { order.push("defer"); deferred.push(fn) })!
    guarded.onDoubleTap()
    expect(order).toEqual(["close", "defer"])
    expect(t.onDoubleTap).not.toHaveBeenCalled()
    deferred.forEach((fn) => fn())
    expect(t.onDoubleTap).toHaveBeenCalledTimes(1)
    // Field lain (at/point) diteruskan apa adanya.
    expect(guarded.at).toBe(1)
  })

  it("defer bawaan = setTimeout 0", () => {
    vi.useFakeTimers()
    const t = tap()
    guardOpeningTapForGuest(t, false, () => undefined)!.onDoubleTap()
    expect(t.onDoubleTap).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(t.onDoubleTap).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
