/**
 * P1-5: usePolling menjeda saat overlay pemblokir menutupi layar (opt-in).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  setBlockingOverlayCount,
  hasBlockingOverlay,
  subscribeBlockingOverlay,
} from "@/lib/overlay-visibility"

describe("overlay-visibility", () => {
  beforeEach(() => {
    setBlockingOverlayCount(0)
  })

  it("hasBlockingOverlay false saat tidak ada overlay", () => {
    expect(hasBlockingOverlay()).toBe(false)
  })

  it("hasBlockingOverlay true saat overlay dibuka", () => {
    setBlockingOverlayCount(1)
    expect(hasBlockingOverlay()).toBe(true)
  })

  it("memberitahu subscriber saat berubah", () => {
    const listener = vi.fn()
    const unsub = subscribeBlockingOverlay(listener)
    setBlockingOverlayCount(1)
    expect(listener).toHaveBeenCalledTimes(1)
    // nilai sama → tidak emit lagi
    setBlockingOverlayCount(1)
    expect(listener).toHaveBeenCalledTimes(1)
    setBlockingOverlayCount(0)
    expect(listener).toHaveBeenCalledTimes(2)
    unsub()
    setBlockingOverlayCount(1)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it("clamp negatif ke 0", () => {
    setBlockingOverlayCount(-5)
    expect(hasBlockingOverlay()).toBe(false)
  })
})
