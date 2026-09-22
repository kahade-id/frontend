/**
 * Tests untuk lib/pull-math.ts (K-01)
 * Memverifikasi kalkulasi murni pull-to-refresh: offset, dominansi arah, dan resistensi.
 */
import { describe, expect, it } from "vitest"
import {
  AT_TOP_EPSILON,
  isAtTop,
  OVERPULL_MAX_RATIO,
  OVERPULL_RESISTANCE,
  pullDistance,
  reachedThreshold,
  shouldCapturePull,
} from "@/lib/pull-math"

describe("isAtTop", () => {
  it("mengidentifikasi posisi di puncak scroller", () => {
    expect(isAtTop(0)).toBe(true)
    expect(isAtTop(AT_TOP_EPSILON)).toBe(true)
    expect(isAtTop(-10)).toBe(true) // overscroll ke atas
  })

  it("menolak offset yang sudah ter-scroll ke bawah", () => {
    expect(isAtTop(AT_TOP_EPSILON + 0.1)).toBe(false)
    expect(isAtTop(100)).toBe(false)
  })

  it("menolak nilai non-finite", () => {
    expect(isAtTop(NaN)).toBe(false)
    expect(isAtTop(Infinity)).toBe(false)
  })
})

describe("shouldCapturePull", () => {
  it("menangkap tarikan vertikal ke bawah saat di puncak", () => {
    expect(
      shouldCapturePull({
        offsetY: 0,
        dy: 20,
        dx: 5,
        enabled: true,
        refreshing: false,
      }),
    ).toBe(true)
  })

  it("menolak jika tidak di puncak atau sedang me-refresh", () => {
    expect(
      shouldCapturePull({
        offsetY: 10,
        dy: 20,
        dx: 0,
        enabled: true,
        refreshing: false,
      }),
    ).toBe(false)

    expect(
      shouldCapturePull({
        offsetY: 0,
        dy: 20,
        dx: 0,
        enabled: true,
        refreshing: true,
      }),
    ).toBe(false)

    expect(
      shouldCapturePull({
        offsetY: 0,
        dy: 20,
        dx: 0,
        enabled: false,
        refreshing: false,
      }),
    ).toBe(false)
  })

  it("menolak jika gerakan didominasi horizontal (scroll swipe)", () => {
    expect(
      shouldCapturePull({
        offsetY: 0,
        dy: 10,
        dx: 15,
        enabled: true,
        refreshing: false,
      }),
    ).toBe(false)
  })

  it("menolak jika sentuhan multi-touch (> 1 jari)", () => {
    expect(
      shouldCapturePull({
        offsetY: 0,
        dy: 20,
        dx: 0,
        enabled: true,
        refreshing: false,
        touches: 2,
      }),
    ).toBe(false)
  })
})

describe("pullDistance", () => {
  it("mengembalikan nilai linear di bawah ambang", () => {
    expect(pullDistance(30, 60)).toBe(30)
    expect(pullDistance(60, 60)).toBe(60)
  })

  it("menerapkan resistensi di atas ambang", () => {
    const threshold = 60
    const over = 40
    const expected = threshold + over * OVERPULL_RESISTANCE
    expect(pullDistance(threshold + over, threshold)).toBe(expected)
  })

  it("membatasi pada overpull max ratio", () => {
    const threshold = 60
    const max = threshold * OVERPULL_MAX_RATIO
    expect(pullDistance(1000, threshold)).toBe(max)
  })

  it("menangani nilai batas non-positif/non-finite", () => {
    expect(pullDistance(-10, 60)).toBe(0)
    expect(pullDistance(10, -60)).toBe(0)
    expect(pullDistance(NaN, 60)).toBe(0)
  })
})

describe("reachedThreshold", () => {
  it("mendeteksi apakah jarak tarikan sudah melewati ambang refresh", () => {
    expect(reachedThreshold(59, 60)).toBe(false)
    expect(reachedThreshold(60, 60)).toBe(true)
    expect(reachedThreshold(70, 60)).toBe(true)
    expect(reachedThreshold(NaN, 60)).toBe(false)
  })
})
