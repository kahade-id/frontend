/**
 * Regression guard pull-to-refresh custom setelah insiden force-close.
 *
 * Kontrak produk: konten mengikuti tangan dan logo Kahade tampil. Kontrak
 * keselamatan: tidak boleh ada RNGH manual state manager/Reanimated worklet
 * pada jalur scroll, tidak boleh mematikan scroll, dan FlatList tidak boleh
 * dibungkus ScrollView kedua.
 */
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

import {
  AT_TOP_EPSILON,
  OVERPULL_MAX_RATIO,
  PULL_CAPTURE_OFFSET,
  isAtTop,
  pullDistance,
  reachedThreshold,
  shouldCapturePull,
} from "@/lib/pull-math"

const here = fileURLToPath(import.meta.url)
const root = resolve(here, "..", "..")
const read = (path: string) => readFileSync(resolve(root, path), "utf8")
const strip = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

const component = strip(read("components/ui/pull-to-refresh.tsx"))
const paginated = strip(read("components/ui/paginated-list.tsx"))
const faq = strip(read("app/faq.tsx"))
const search = strip(read("app/search.tsx"))

const THRESHOLD = 64

describe("keputusan capture — scroll biasa tidak pernah direbut", () => {
  it("hanya capture satu jari, di puncak, turun dominan vertikal", () => {
    expect(
      shouldCapturePull({
        offsetY: 0,
        dy: PULL_CAPTURE_OFFSET + 1,
        dx: 0,
        enabled: true,
        refreshing: false,
      }),
    ).toBe(true)
  })

  it("tidak capture ketika list sudah bergulir", () => {
    expect(
      shouldCapturePull({
        offsetY: 1_000,
        dy: 200,
        dx: 0,
        enabled: true,
        refreshing: false,
      }),
    ).toBe(false)
  })

  it("tidak capture scroll ke atas, swipe horizontal, multi-touch, disabled, atau refresh aktif", () => {
    const base = { offsetY: 0, enabled: true, refreshing: false }
    expect(shouldCapturePull({ ...base, dy: -50, dx: 0 })).toBe(false)
    expect(shouldCapturePull({ ...base, dy: 20, dx: 30 })).toBe(false)
    expect(shouldCapturePull({ ...base, dy: 20, dx: 0, touches: 2 })).toBe(
      false,
    )
    expect(shouldCapturePull({ ...base, dy: 20, dx: 0, enabled: false })).toBe(
      false,
    )
    expect(
      shouldCapturePull({ ...base, dy: 20, dx: 0, refreshing: true }),
    ).toBe(false)
  })

  it("menerima offset sub-piksel di puncak dan menolak koordinat non-finite", () => {
    expect(isAtTop(0.997)).toBe(true)
    expect(isAtTop(AT_TOP_EPSILON)).toBe(true)
    expect(isAtTop(AT_TOP_EPSILON + 0.01)).toBe(false)
    const base = { offsetY: 0, enabled: true, refreshing: false }
    expect(shouldCapturePull({ ...base, dy: Number.NaN, dx: 0 })).toBe(false)
    expect(shouldCapturePull({ ...base, dy: 20, dx: Number.NaN })).toBe(false)
    expect(shouldCapturePull({ ...base, dy: Number.POSITIVE_INFINITY, dx: 0 })).toBe(false)
  })
})

describe("jarak tarik — mengikuti tangan lalu melawan", () => {
  it("bergerak 1:1 sampai ambang", () => {
    expect(pullDistance(1, THRESHOLD)).toBe(1)
    expect(pullDistance(40, THRESHOLD)).toBe(40)
    expect(pullDistance(THRESHOLD, THRESHOLD)).toBe(THRESHOLD)
  })

  it("kontinu, melawan setelah ambang, dan dibatasi", () => {
    expect(pullDistance(THRESHOLD + 0.001, THRESHOLD)).toBeCloseTo(THRESHOLD, 2)
    expect(pullDistance(THRESHOLD * 2, THRESHOLD)).toBeLessThan(THRESHOLD * 2)
    expect(pullDistance(100_000, THRESHOLD)).toBe(
      THRESHOLD * OVERPULL_MAX_RATIO,
    )
  })

  it("menolak nilai negatif/tidak valid", () => {
    expect(pullDistance(-20, THRESHOLD)).toBe(0)
    expect(pullDistance(Number.NaN, THRESHOLD)).toBe(0)
    expect(pullDistance(20, 0)).toBe(0)
    expect(reachedThreshold(20, 0)).toBe(false)
  })

  it("refresh hanya terpicu bila posisi LEPAS masih melewati ambang", () => {
    expect(reachedThreshold(THRESHOLD - 0.1, THRESHOLD)).toBe(false)
    expect(reachedThreshold(THRESHOLD, THRESHOLD)).toBe(true)
  })
})

describe("arsitektur custom gesture yang aman", () => {
  it("memakai PanResponder + Animated bawaan React Native", () => {
    expect(component).toMatch(/\bPanResponder\.create\(/)
    expect(component).toMatch(/new Animated\.Value\(0\)/)
    expect(component).toMatch(/onMoveShouldSetPanResponderCapture/)
    expect(component).toMatch(/pull\.setValue\(distance\)/)
    expect(component).toMatch(/translateY: pull/)
  })

  it("tidak memakai jalur UI/native-thread penyebab force-close", () => {
    expect(component).not.toMatch(/react-native-gesture-handler/)
    expect(component).not.toMatch(/react-native-reanimated/)
    expect(component).not.toMatch(
      /\bGestureDetector\b|manualActivation|stateManager\./,
    )
    expect(component).not.toMatch(
      /useAnimatedScrollHandler|useSharedValue|runOnJS|["']worklet["']/,
    )
  })

  it("tidak pernah mematikan scroll", () => {
    expect(component).not.toMatch(
      /scrollEnabled\s*=|scrollLocked|setScrollEnabled/,
    )
  })

  it("memakai seluruh dy sejak touch-down agar posisi konten benar-benar 1:1", () => {
    expect(component).toMatch(/updatePull\(gesture\.dy\)/)
    expect(component).not.toMatch(/gesture\.dy\s*-/)
  })

  it("selalu settle pada release batal, terminate, dan reject", () => {
    expect(component).toMatch(/onPanResponderRelease/)
    expect(component).toMatch(/onPanResponderTerminate/)
    expect(component).toMatch(/onPanResponderReject/)
    expect(component.match(/springTo\(0\)/g)?.length).toBeGreaterThanOrEqual(4)
  })

  it("menangkap rejection dan menjaga request ganda", () => {
    expect(component).toMatch(/requestActive\.current/)
    expect(component).toMatch(/Promise\.resolve\(result\)/)
    expect(component).toMatch(/\.catch\(\(\) => undefined\)/)
  })

  it("FlatList virtual memakai surface yang sama tanpa nested ScrollView", () => {
    expect(component).toMatch(/function PullToRefreshFlatList/)
    expect(component).toMatch(/<PullGestureSurface[\s\S]*<FlatList/)
    expect(paginated).toMatch(/<PullToRefreshFlatList/)
    expect(faq).toMatch(/<PullToRefreshFlatList/)
    expect(search).toMatch(/<PullToRefreshFlatList/)
    for (const consumer of [paginated, faq, search]) {
      expect(consumer).not.toMatch(/<ScrollView/)
      expect(consumer).not.toMatch(/<RefreshControl/)
    }
  })
})
