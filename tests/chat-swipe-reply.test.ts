/**
 * Workstream G — swipe-to-reply: logika pemicu gesture (murni, testable).
 *
 * Aturan: translasi kanan ≥ ambang ATAU fling cepat ke kanan → balas.
 * Geser kiri / di bawah ambang → bukan balas (bubble snap-back).
 */
import { describe, expect, it } from "vitest"

import {
  SWIPE_REPLY_FLING_VELOCITY_PX_S,
  SWIPE_REPLY_MAX_PX,
  SWIPE_REPLY_THRESHOLD_PX,
  shouldTriggerSwipeReply,
} from "@/lib/chat-bubble"

describe("shouldTriggerSwipeReply", () => {
  it("di bawah ambang translasi & kecepatan → false (snap-back)", () => {
    expect(shouldTriggerSwipeReply(30, 100)).toBe(false)
    expect(shouldTriggerSwipeReply(0, 0)).toBe(false)
  })

  it("tepat di ambang translasi → true", () => {
    expect(shouldTriggerSwipeReply(SWIPE_REPLY_THRESHOLD_PX, 0)).toBe(true)
  })

  it("melewati ambang translasi → true", () => {
    expect(shouldTriggerSwipeReply(SWIPE_REPLY_MAX_PX, 0)).toBe(true)
  })

  it("fling cepat ke kanan memicu walau translasi kecil", () => {
    expect(shouldTriggerSwipeReply(10, SWIPE_REPLY_FLING_VELOCITY_PX_S)).toBe(true)
    expect(shouldTriggerSwipeReply(10, 1200)).toBe(true)
  })

  it("geser ke kiri (negatif) tidak pernah memicu", () => {
    expect(shouldTriggerSwipeReply(-50, 0)).toBe(false)
    expect(shouldTriggerSwipeReply(-50, -1200)).toBe(false)
  })

  it("konstanta waras: ambang < maks, fling positif", () => {
    expect(SWIPE_REPLY_THRESHOLD_PX).toBeGreaterThan(0)
    expect(SWIPE_REPLY_MAX_PX).toBeGreaterThan(SWIPE_REPLY_THRESHOLD_PX)
    expect(SWIPE_REPLY_FLING_VELOCITY_PX_S).toBeGreaterThan(0)
  })
})
