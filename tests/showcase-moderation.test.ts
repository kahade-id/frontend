/**
 * BE-1/BE-2/BEC-01 (audit etalase 2026-10-10): field moderasi pemilik dari
 * backend → status UI "takedown"/"restricted" (terkunci di server), lengkap
 * dengan alasan, waktu, dan batas RESTRICTED. RESTORED = normal kembali.
 */
import { describe, expect, it } from "vitest"

import {
  isModerationLocked,
  needsModerationAttention,
  normalizeModerationStatus,
  resolveShowcaseModeration,
} from "@/lib/showcase-moderation"

describe("normalizeModerationStatus", () => {
  it("enforcement backend → takedown/restricted; RESTORED → approved", () => {
    expect(normalizeModerationStatus("TAKEDOWN")).toBe("takedown")
    expect(normalizeModerationStatus("restricted")).toBe("restricted")
    expect(normalizeModerationStatus("RESTORED")).toBe("approved")
    expect(normalizeModerationStatus(undefined)).toBe("unknown")
  })
})

describe("resolveShowcaseModeration", () => {
  it("TAKEDOWN: alasan + waktu, terkunci, butuh perhatian", () => {
    const info = resolveShowcaseModeration({
      id: "s1",
      moderationStatus: "TAKEDOWN",
      moderationReason: "Melanggar ketentuan barang",
      moderatedAt: "2026-10-10T08:00:00.000Z",
      moderationReportId: "r1",
    })
    expect(info).toEqual({
      status: "takedown",
      reason: "Melanggar ketentuan barang",
      reviewedAt: "2026-10-10T08:00:00.000Z",
    })
    expect(isModerationLocked(info)).toBe(true)
    expect(needsModerationAttention(info)).toBe(true)
  })

  it("RESTRICTED: membawa batas waktu", () => {
    const info = resolveShowcaseModeration({
      moderationStatus: "RESTRICTED",
      moderatedAt: "2026-10-10T08:00:00.000Z",
      moderationUntil: "2026-10-17T08:00:00.000Z",
    })
    expect(info.status).toBe("restricted")
    expect(info.until).toBe("2026-10-17T08:00:00.000Z")
    expect(isModerationLocked(info)).toBe(true)
  })

  it("tanpa field moderasi → unknown, tidak terkunci, tidak ada notice", () => {
    const info = resolveShowcaseModeration({ id: "s1", title: "Sepatu", isActive: true })
    expect(info).toEqual({ status: "unknown" })
    expect(isModerationLocked(info)).toBe(false)
    expect(needsModerationAttention(info)).toBe(false)
  })

  it("status item biasa (`status: ACTIVE`) tidak terbaca sebagai moderasi", () => {
    expect(resolveShowcaseModeration({ status: "ACTIVE" }).status).toBe("approved")
    expect(isModerationLocked(resolveShowcaseModeration({ status: "ACTIVE" }))).toBe(false)
  })
})
