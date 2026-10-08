/**
 * Bug 1 (2026-10-08) — `useSafeAnimatedStyle`: updater yang melempar tidak boleh
 * menjatuhkan layar. Style jatuh ke fallback dan galatnya tercatat di telemetri.
 *
 * Stub Reanimated (tests/stubs) menjalankan updater langsung di JS thread, jadi
 * test ini memeriksa KONTRAK pembungkus (nilai balik + pencatatan), bukan
 * perilaku UI thread. Perilaku UI thread dikunci oleh
 * tests/chat-bubble-worklet-closures.test.ts.
 */
import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { getTelemetryBuffer } from "@/lib/telemetry"
import { useSafeAnimatedStyle } from "@/lib/use-safe-animated-style"

const FALLBACK = { opacity: 1, transform: [{ translateX: 0 }] }

describe("useSafeAnimatedStyle", () => {
  it("updater normal → style dari updater (fallback tidak dipakai)", () => {
    const { result } = renderHook(() =>
      useSafeAnimatedStyle(
        () => {
          "worklet"
          return { opacity: 0.4, transform: [{ translateX: 3 }] }
        },
        FALLBACK,
      ),
    )
    expect(result.current).toEqual({ opacity: 0.4, transform: [{ translateX: 3 }] })
  })

  it("updater yang melempar → fallback, dan galat tercatat sebagai reanimated:worklet-fallback", () => {
    const before = getTelemetryBuffer().length
    const { result } = renderHook(() =>
      useSafeAnimatedStyle(
        () => {
          "worklet"
          throw new Error("Tried to synchronously call a Remote Function")
        },
        FALLBACK,
      ),
    )
    expect(result.current).toEqual(FALLBACK)
    const added = getTelemetryBuffer().slice(before)
    expect(added.some((e) => e.scope === "reanimated:worklet-fallback" && e.level === "error")).toBe(
      true,
    )
  })

  it("galat yang sama dicatat sekali saja (updater berjalan tiap frame)", () => {
    const message = "unik-untuk-test-dedupe-worklet"
    const before = getTelemetryBuffer().length
    for (let i = 0; i < 3; i++) {
      renderHook(() =>
        useSafeAnimatedStyle(
          () => {
            "worklet"
            throw new Error(message)
          },
          FALLBACK,
        ),
      )
    }
    const added = getTelemetryBuffer()
      .slice(before)
      .filter((e) => e.scope === "reanimated:worklet-fallback" && e.message === message)
    expect(added).toHaveLength(1)
  })
})
