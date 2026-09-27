/**
 * GAP-B3 (G150): validasi lampiran pesan sengketa.
 *
 * Diuji lapisan murni `lib/dispute-attachments.ts` (tanpa RN):
 * - batas 5 berkas / 10 MB per berkas / 20 MB total ditegakkan terhadap
 *   keseluruhan antrean (bukan per aksi pilih),
 * - MIME di luar kontrak backend ditolak,
 * - heuristik berkas sensitif (G145),
 * - kedaluwarsa signed URL dengan toleransi skew (G139),
 * - kunci konteks sengketa (G144),
 * - label pihak pengirim lampiran (G141).
 */
import { describe, expect, it } from "vitest"

import {
  attachmentPartyOf,
  attachmentTypeLabel,
  DISPUTE_ATTACHMENT_MAX_FILE_BYTES,
  DISPUTE_ATTACHMENT_MAX_FILES,
  DISPUTE_ATTACHMENT_MAX_TOTAL_BYTES,
  DISPUTE_ATTACHMENT_MIME_TYPES,
  isAttachmentUrlExpired,
  isSensitiveAttachment,
  sameDisputeContext,
  validateDisputeAttachments,
  type DisputeAttachmentCandidate,
} from "@/lib/dispute-attachments"

function candidate(partial: Partial<DisputeAttachmentCandidate>): DisputeAttachmentCandidate {
  return {
    name: "bukti.jpg",
    mimeType: "image/jpeg",
    size: 1024,
    ...partial,
  }
}

describe("validateDisputeAttachments — kontrak backend", () => {
  it("menerima berkas valid dalam batas", () => {
    const result = validateDisputeAttachments([candidate({})])
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })

  it("menolak lebih dari 5 berkas total (termasuk antrean)", () => {
    const existing = { count: 4, bytes: 0 }
    const result = validateDisputeAttachments(
      [candidate({ name: "a.jpg" }), candidate({ name: "b.jpg" })],
      existing,
    )
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes(`${DISPUTE_ATTACHMENT_MAX_FILES}`))).toBe(true)
  })

  it("menolak berkas > 10 MB", () => {
    const result = validateDisputeAttachments([
      candidate({ name: "besar.mp4", mimeType: "video/mp4", size: DISPUTE_ATTACHMENT_MAX_FILE_BYTES + 1 }),
    ])
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes("10 MB"))).toBe(true)
  })

  it("menolak total > 20 MB walau tiap berkas ≤ 10 MB", () => {
    const big = DISPUTE_ATTACHMENT_MAX_FILE_BYTES // 10 MB
    const result = validateDisputeAttachments(
      [
        candidate({ name: "a.mp4", mimeType: "video/mp4", size: big }),
        candidate({ name: "b.mp4", mimeType: "video/mp4", size: big }),
        candidate({ name: "c.mp4", mimeType: "video/mp4", size: big }),
      ],
      { count: 0, bytes: 0 },
    )
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes("20 MB"))).toBe(true)
    expect(DISPUTE_ATTACHMENT_MAX_TOTAL_BYTES).toBe(20 * 1024 * 1024)
  })

  it("menolak MIME di luar 9 tipe kontrak backend", () => {
    for (const mime of ["image/gif", "application/zip", "audio/mpeg", "text/plain"]) {
      const result = validateDisputeAttachments([candidate({ name: "x", mimeType: mime })])
      expect(result.ok).toBe(false)
    }
    // 9 MIME kontrak tetap diterima
    expect(DISPUTE_ATTACHMENT_MIME_TYPES).toHaveLength(9)
    for (const mime of DISPUTE_ATTACHMENT_MIME_TYPES) {
      const result = validateDisputeAttachments([candidate({ name: "x", mimeType: mime })])
      expect(result.ok).toBe(true)
    }
  })

  it("size 0 (platform tidak melapor) tetap lolos — server validasi ulang", () => {
    const result = validateDisputeAttachments([candidate({ size: 0 })])
    expect(result.ok).toBe(true)
  })
})

describe("isSensitiveAttachment (G145)", () => {
  it("mendeteksi nama dokumen identitas", () => {
    expect(isSensitiveAttachment("KTP-saya.jpg")).toBe(true)
    expect(isSensitiveAttachment("foto_npwp.png")).toBe(true)
    expect(isSensitiveAttachment("scan ijazah.pdf")).toBe(true)
    expect(isSensitiveAttachment("SIM A.jpg")).toBe(true)
  })

  it("tidak false-positive pada nama biasa", () => {
    expect(isSensitiveAttachment("bukti-transfer.jpg")).toBe(false)
    expect(isSensitiveAttachment("unboxing.mp4")).toBe(false)
    expect(isSensitiveAttachment("")).toBe(false)
  })
})

describe("isAttachmentUrlExpired (G139)", () => {
  const now = Date.now()
  it("URL jauh dari kedaluwarsa → tidak expired", () => {
    expect(
      isAttachmentUrlExpired(new Date(now + 240_000).toISOString(), now),
    ).toBe(false)
  })

  it("URL kedaluwarsa < skew (30 dtk) → dianggap expired", () => {
    expect(
      isAttachmentUrlExpired(new Date(now + 10_000).toISOString(), now),
    ).toBe(true)
  })

  it("URL sudah lewat / tak valid → expired", () => {
    expect(isAttachmentUrlExpired(new Date(now - 1000).toISOString(), now)).toBe(true)
    expect(isAttachmentUrlExpired(undefined, now)).toBe(true)
    expect(isAttachmentUrlExpired("bukan-tanggal", now)).toBe(true)
  })
})

describe("sameDisputeContext (G144)", () => {
  const ctx = { disputeId: "d1", role: "buyer", status: "OPEN" }
  it("sama persis → true", () => {
    expect(sameDisputeContext(ctx, { ...ctx })).toBe(true)
  })

  it("role/status/disputeId berubah → false", () => {
    expect(sameDisputeContext(ctx, { ...ctx, role: "seller" })).toBe(false)
    expect(sameDisputeContext(ctx, { ...ctx, status: "RESOLVED" })).toBe(false)
    expect(sameDisputeContext(ctx, { ...ctx, disputeId: "d2" })).toBe(false)
  })
})

describe("attachmentPartyOf (G141)", () => {
  it("admin → moderator; diri sendiri → self", () => {
    expect(attachmentPartyOf({ adminId: "a1" })).toBe("moderator")
    expect(attachmentPartyOf({ senderId: "u1", myUserId: "u1" })).toBe("self")
  })

  it("buyer/seller dikenali dari id order", () => {
    const base = { myUserId: "u9", buyerId: "b1", sellerId: "s1" }
    expect(attachmentPartyOf({ ...base, senderId: "b1" })).toBe("buyer")
    expect(attachmentPartyOf({ ...base, senderId: "s1" })).toBe("seller")
    expect(attachmentPartyOf({ ...base, senderId: "x" })).toBe("unknown")
  })
})

describe("attachmentTypeLabel", () => {
  it("melabeli gambar/PDF/video/berkas", () => {
    expect(attachmentTypeLabel("image/png")).toBe("Gambar")
    expect(attachmentTypeLabel("application/pdf")).toBe("PDF")
    expect(attachmentTypeLabel("video/mp4")).toBe("Video")
    expect(attachmentTypeLabel("")).toBe("Berkas")
  })
})
