/**
 * Workstream G — swipe-to-reply: logika pemicu gesture (murni, testable).
 *
 * Aturan (2026-10-08, temuan #11): translasi ≥ ambang ATAU fling cepat →
 * balas, KE ARAH MANA PUN. Dulu hanya geser kanan yang dihitung dan geser
 * kiri malah dijepit ke 0, jadi bubble tidak pernah bergerak. Sekarang
 * WhatsApp (geser kanan) dan Telegram (geser kiri) dua-duanya jalan.
 * Di bawah ambang → bukan balas (bubble snap-back).
 */
import { describe, expect, it } from "vitest"

import {
  clampSwipeReply,
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

  it("geser ke kiri (negatif) memicu SAMA seperti ke kanan", () => {
    expect(shouldTriggerSwipeReply(-50, 0)).toBe(false) // di bawah ambang
    expect(shouldTriggerSwipeReply(-SWIPE_REPLY_THRESHOLD_PX, 0)).toBe(true)
    expect(shouldTriggerSwipeReply(-SWIPE_REPLY_MAX_PX, 0)).toBe(true)
    // Fling cepat ke kiri memicu walau translasinya kecil.
    expect(shouldTriggerSwipeReply(-10, -SWIPE_REPLY_FLING_VELOCITY_PX_S)).toBe(true)
    expect(shouldTriggerSwipeReply(-10, -1200)).toBe(true)
  })

  it("konstanta waras: ambang < maks, fling positif", () => {
    expect(SWIPE_REPLY_THRESHOLD_PX).toBeGreaterThan(0)
    expect(SWIPE_REPLY_MAX_PX).toBeGreaterThan(SWIPE_REPLY_THRESHOLD_PX)
    expect(SWIPE_REPLY_FLING_VELOCITY_PX_S).toBeGreaterThan(0)
  })
})

describe("clampSwipeReply", () => {
  it("geser kanan dijepit ke +MAX", () => {
    expect(clampSwipeReply(5)).toBe(5)
    expect(clampSwipeReply(SWIPE_REPLY_MAX_PX)).toBe(SWIPE_REPLY_MAX_PX)
    expect(clampSwipeReply(500)).toBe(SWIPE_REPLY_MAX_PX)
  })

  it("geser kiri MENGIKUTI jari (tidak lagi dijepit ke 0) sampai -MAX", () => {
    expect(clampSwipeReply(-5)).toBe(-5)
    expect(clampSwipeReply(-40)).toBe(-40)
    expect(clampSwipeReply(-SWIPE_REPLY_MAX_PX)).toBe(-SWIPE_REPLY_MAX_PX)
    expect(clampSwipeReply(-500)).toBe(-SWIPE_REPLY_MAX_PX)
  })

  it("simetris: dua arah Pun sama", () => {
    expect(clampSwipeReply(-30)).toBe(-clampSwipeReply(30))
  })
})
