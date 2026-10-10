/**
 * SO-07 (audit etalase 2026-10-10): parser komentar meneruskan seal
 * verifikasi penulis — dulu dibuang sehingga <VerifiedSeal> di baris komentar
 * tidak pernah tampil. Juga mengunci kontrak placeholder soft-delete (SO-04).
 */
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api/client", () => ({
  http: { get: vi.fn(), post: vi.fn(), delete: vi.fn(), patch: vi.fn(), put: vi.fn() },
  seg: (value: string) => encodeURIComponent(value),
}))

import { parseShowcaseComment } from "@/lib/api/showcase"

const base = {
  id: "c1",
  showcaseId: "s1",
  content: "Keren!",
  createdAt: "2026-10-10T00:00:00.000Z",
}

describe("parseShowcaseComment — penulis", () => {
  it("meneruskan isKycVerified, badges, dan sealTier", () => {
    const parsed = parseShowcaseComment({
      ...base,
      author: {
        userId: "USR-1",
        username: "toko",
        isKycVerified: true,
        badges: [{ type: "KYC" }, { type: "BUSINESS" }, { nope: 1 }, null],
        sealTier: "gold",
      },
    })
    expect(parsed.author.isKycVerified).toBe(true)
    expect(parsed.author.badges).toEqual([{ type: "KYC" }, { type: "BUSINESS" }])
    expect(parsed.author.sealTier).toBe("gold")
    // Tier asing tidak diteruskan mentah (whitelist gold/blue/gray).
    expect(parseShowcaseComment({ ...base, author: { userId: "USR-9", username: "z", sealTier: "BUSINESS" } }).author.sealTier).toBeNull()
  })

  it("tanpa data seal → tidak mengarang (badges undefined, sealTier null, isKycVerified false)", () => {
    const parsed = parseShowcaseComment({ ...base, author: { userId: "USR-2", username: "x" } })
    expect(parsed.author.badges).toBeUndefined()
    expect(parsed.author.sealTier).toBeNull()
    expect(parsed.author.isKycVerified).toBe(false)
  })

  it("SO-04: placeholder soft-delete (content null + isDeleted) tetap diterima dengan content kosong", () => {
    const parsed = parseShowcaseComment({ ...base, content: null, isDeleted: true, author: { userId: "USR-3", username: "y" } })
    expect(parsed.isDeleted).toBe(true)
    expect(parsed.content).toBe("")
  })
})
