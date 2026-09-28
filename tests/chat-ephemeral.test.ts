/**
 * Batch 43 FE-CHAT: pesan sementara & sekali-lihat (lapisan murni).
 */
import { describe, expect, it } from "vitest"
import {
  EPHEMERAL_DURATION_OPTIONS,
  ephemeralCountdownLabel,
  ephemeralDurationLabel,
  isMessageExpired,
  isViewOnceConsumed,
  isViewOnceMessage,
} from "@/lib/chat-ephemeral"

describe("ephemeralDurationLabel", () => {
  it("opsi standar", () => {
    expect(ephemeralDurationLabel(0)).toBe("Mati")
    expect(ephemeralDurationLabel(null)).toBe("Mati")
    expect(ephemeralDurationLabel(300)).toBe("5 menit")
    expect(ephemeralDurationLabel(604800)).toBe("7 hari")
  })
  it("nilai arbitrer", () => {
    expect(ephemeralDurationLabel(45)).toBe("45 detik")
    expect(ephemeralDurationLabel(1800)).toBe("30 menit")
    expect(ephemeralDurationLabel(7200)).toBe("2 jam")
    expect(ephemeralDurationLabel(172800)).toBe("2 hari")
  })
  it("opsi dalam rentang backend 5..604800", () => {
    for (const o of EPHEMERAL_DURATION_OPTIONS) {
      if (o.seconds > 0) {
        expect(o.seconds).toBeGreaterThanOrEqual(5)
        expect(o.seconds).toBeLessThanOrEqual(604800)
      }
    }
  })
})

describe("isMessageExpired", () => {
  it("true bila expiresAt lewat", () => {
    const past = new Date(Date.now() - 1000).toISOString()
    expect(isMessageExpired({ expiresAt: past })).toBe(true)
  })
  it("false bila belum / tidak ada", () => {
    const future = new Date(Date.now() + 60000).toISOString()
    expect(isMessageExpired({ expiresAt: future })).toBe(false)
    expect(isMessageExpired({})).toBe(false)
    expect(isMessageExpired(null)).toBe(false)
  })
})

describe("ephemeralCountdownLabel", () => {
  it("format ringkas", () => {
    const now = Date.now()
    expect(ephemeralCountdownLabel(new Date(now + 30_000).toISOString(), now)).toBe("segera")
    expect(ephemeralCountdownLabel(new Date(now + 5 * 60000).toISOString(), now)).toBe("5 mnt")
    expect(ephemeralCountdownLabel(new Date(now + 3 * 3600000).toISOString(), now)).toBe("3 jam")
    expect(ephemeralCountdownLabel(new Date(now + 2 * 86400000).toISOString(), now)).toBe("2 hari")
  })
  it("null bila tidak ada / sudah lewat / invalid", () => {
    expect(ephemeralCountdownLabel(null)).toBeNull()
    expect(ephemeralCountdownLabel(new Date(Date.now() - 1).toISOString())).toBeNull()
    expect(ephemeralCountdownLabel("bukan-tanggal")).toBeNull()
  })
})

describe("view-once helpers", () => {
  it("isViewOnceMessage", () => {
    expect(isViewOnceMessage({ viewOnce: true })).toBe(true)
    expect(isViewOnceMessage({ viewOnce: false })).toBe(false)
    expect(isViewOnceMessage(null)).toBe(false)
  })
  it("isViewOnceConsumed", () => {
    expect(isViewOnceConsumed({ viewOnceViewedAt: new Date().toISOString() })).toBe(true)
    expect(isViewOnceConsumed({ viewOnceViewedAt: null })).toBe(false)
  })
})
