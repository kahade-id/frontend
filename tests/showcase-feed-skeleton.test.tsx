/**
 * Smoke test <ShowcaseFeedSkeleton> / <ShowcaseFeedItemSkeleton> (workstream D).
 *
 * Menjaga dua kontrak:
 *  1. Aksesibilitas — grup skeleton mengumumkan role progressbar "Memuat"
 *     (diwarisi dari <SkeletonGroup>), bukan puluhan blok kosong.
 *  2. Reduced motion — dengan `prefers-reduced-motion: reduce`, skeleton
 *     tetap dirender (placeholder statis, tanpa loop pulse).
 */
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import {
  ShowcaseFeedItemSkeleton,
  ShowcaseFeedSkeleton,
} from "@/components/ui/showcase-feed-skeleton"

let matchMediaMatches = false

beforeAll(() => {
  if (typeof window !== "undefined" && !window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: matchMediaMatches,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    })
  }
})

afterEach(() => {
  cleanup()
  matchMediaMatches = false
})

function renderInApp(node: React.ReactNode) {
  return render(<ThemeProvider>{node}</ThemeProvider>)
}

describe("ShowcaseFeedSkeleton", () => {
  it("satu kartu dirender tanpa crash", () => {
    const { container } = renderInApp(<ShowcaseFeedItemSkeleton />)
    expect(container.firstChild).not.toBeNull()
  })

  it("grup mengumumkan progressbar 'Memuat' (bukan blok kosong)", () => {
    renderInApp(<ShowcaseFeedSkeleton />)
    expect(screen.getByRole("progressbar", { name: "Memuat" })).toBeTruthy()
  })

  it("tetap dirender saat reduced motion aktif (placeholder statis)", () => {
    matchMediaMatches = true
    renderInApp(<ShowcaseFeedSkeleton count={2} />)
    expect(screen.getByRole("progressbar", { name: "Memuat" })).toBeTruthy()
  })
})
