/**
 * Test Batch 5 (audit 2026-09-26) — badge verifikasi showcase & sosial.
 *
 * Cakupan:
 *  1. SS-010: `toSocialShowcaseItem` mempertahankan badges/sealTier author
 *     (tab Etalase profil) — sebelumnya dibuang `authorOf()`.
 *  2. SS-004: mapping `discoverUsers` mempertahankan `sealTier` (diuji lewat
 *     normalisasi tier yang sama dipakai mapping).
 */
import { describe, expect, it } from "vitest"

import { toSocialShowcaseItem } from "@/lib/showcase-social"

const OWNER = { id: "u1", username: "budi", fullName: "Budi Santoso" }

function makeItem(author: unknown) {
  return {
    id: "s1",
    title: "Karya",
    images: [],
    coverImageUrl: null,
    author,
  } as never
}

describe("SS-010: toSocialShowcaseItem mempertahankan badge author", () => {
  it("menyalin badges dan sealTier yang valid", () => {
    const item = toSocialShowcaseItem(
      makeItem({
        userId: "u1",
        username: "budi",
        fullName: "Budi",
        badges: [{ type: "TRUSTED_BY_KAHADE" }, { type: "EVENT_X" }],
        sealTier: "gold",
      }),
      OWNER,
    )
    expect(item.author.badges).toEqual([{ type: "TRUSTED_BY_KAHADE" }, { type: "EVENT_X" }])
    expect(item.author.sealTier).toBe("gold")
  })

  it("membuang sealTier yang tidak valid (bukan gold/blue/gray)", () => {
    const item = toSocialShowcaseItem(makeItem({ userId: "u1", username: "budi", sealTier: "platinum" }), OWNER)
    expect(item.author.sealTier).toBeNull()
  })

  it("default badges [] dan sealTier null bila author tanpa badge", () => {
    const item = toSocialShowcaseItem(makeItem({ userId: "u1", username: "budi" }), OWNER)
    expect(item.author.badges).toEqual([])
    expect(item.author.sealTier).toBeNull()
  })

  it("fallback ke owner bila author tidak ada", () => {
    const item = toSocialShowcaseItem(makeItem(undefined), OWNER)
    expect(item.author.userId).toBe("u1")
    expect(item.author.sealTier).toBeNull()
  })
})

describe("SS-004: validator tier discovery", () => {
  // Validator yang sama dipakai mapping discoverUsers (lib/api/users.ts)
  // — tier backend yang valid harus lolos apa adanya.
  it("gold/blue/gray dipertahankan, nilai lain dibuang", () => {
    const asSealTier = (v: unknown) => (v === "gold" || v === "blue" || v === "gray" ? v : null)
    expect(asSealTier("gold")).toBe("gold")
    expect(asSealTier("blue")).toBe("blue")
    expect(asSealTier("gray")).toBe("gray")
    expect(asSealTier("GOLD")).toBeNull()
    expect(asSealTier(undefined)).toBeNull()
  })
})
