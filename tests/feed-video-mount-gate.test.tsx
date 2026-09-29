/**
 * FE-016 — player video native JANGAN di-mount sebelum waktunya.
 *
 * `useVideoPlayer({ uri })` dapat memicu buffering walau `shouldPlay=false`,
 * jadi <FeedVideo> yang off-screen (shouldPlay=false, tanpa niat eksplisit)
 * tidak boleh me-mount player — cukup poster inert. Pengecualian:
 * - effectiveShouldPlay (kartu terlihat + lolos gerbang WiFi/niat),
 * - userInitiatedPlay (niat eksplisit: latch "Putar video" / viewer via ketuk),
 * - allowTapToggle (pratinjau upload: ketuk-toggle butuh player).
 */
import { describe, expect, it } from "vitest"

import { shouldMountVideoPlayer } from "@/components/ui/feed-video"

describe("FE-016 — shouldMountVideoPlayer", () => {
  it("tidak mount saat off-screen tanpa niat (kasus utama FE-016)", () => {
    expect(
      shouldMountVideoPlayer({ effectiveShouldPlay: false, userInitiatedPlay: false, allowTapToggle: false }),
    ).toBe(false)
  })

  it("mount saat kartu terlihat dan lolos gerbang", () => {
    expect(
      shouldMountVideoPlayer({ effectiveShouldPlay: true, userInitiatedPlay: false, allowTapToggle: false }),
    ).toBe(true)
  })

  it("mount saat ada niat eksplisit walau belum shouldPlay", () => {
    expect(
      shouldMountVideoPlayer({ effectiveShouldPlay: false, userInitiatedPlay: true, allowTapToggle: false }),
    ).toBe(true)
  })

  it("pratinjau upload (allowTapToggle) selalu mount — ketuk-toggle butuh player", () => {
    expect(
      shouldMountVideoPlayer({ effectiveShouldPlay: false, userInitiatedPlay: false, allowTapToggle: true }),
    ).toBe(true)
  })
})
