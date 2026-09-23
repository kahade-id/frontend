/**
 * Test K-01 (audit Etalase): unit untuk logika murni fitur Etalase yang
 * sebelumnya NOL pengujian — padahal bug paginasi A-01 dan harga B-01/D-05
 * tepat di lapisan ini.
 *
 * Cakupan:
 *  1. showcasePriceLabel — table-driven: satu sumber harga untuk feed,
 *     detail, dan manajemen (B-01/D-05).
 *  2. showcaseCoverOf — resolver cover kanonik (E-01/C-07).
 *  3. toSocialShowcaseItem — normalisasi mentah → sosial, defensif (C-07).
 *  4. Feed-logic — invariant kursor keyset & penggabungan (A-01/A-02).
 *  5. Store preferensi sosial — saved/like-override/dirty-flag (A-06…A-08).
 *     React hooks TIDAK diuji di sini (butuh renderer); fungsi store murni.
 */
import { beforeEach, describe, expect, it } from "vitest"

import { showcasePriceLabel } from "@/lib/showcase-labels"
import { showcaseCoverOf, toSocialShowcaseItem } from "@/lib/showcase-social"
import {
  emptyFeedPageState,
  interleave,
  mergeById,
  resetFeedPageState,
  sameFeedFilter,
} from "@/lib/showcase-feed-logic"
import {
  getShowcaseLikeOverride,
  isShowcaseSaved,
  markShowcaseFeedDirty,
  setShowcaseLikeState,
  showcaseFeedDirtyVersion,
  toggleShowcaseSaved,
} from "@/lib/showcase-social-prefs"

const OWNER = { id: "u1", username: "budi", fullName: "Budi" }

describe("showcasePriceLabel (B-01/D-05)", () => {
  const cases: Array<{
    name: string
    item: { priceMin?: number | null; priceMax?: number | null }
    expect: string | null
  }> = [
    { name: "tanpa harga → null", item: {}, expect: null },
    { name: "null eksplisit → null", item: { priceMin: null, priceMax: null }, expect: null },
    { name: "min==max → harga tunggal (BUKAN rentang ganda)", item: { priceMin: 5000, priceMax: 5000 }, expect: "Rp 5.000" },
    { name: "rentang → satu kali Rp", item: { priceMin: 5_000, priceMax: 25_000 }, expect: "Rp 5.000 – 25.000" },
    { name: "hanya min → Mulai", item: { priceMin: 10_000 }, expect: "Mulai Rp 10.000" },
    { name: "hanya max → Hingga (B-01: data tidak dibuang!)", item: { priceMax: 500_000 }, expect: "Hingga Rp 500.000" },
    { name: "max 0 dianggap tidak diisi → jatuh ke sisi min ('Mulai')", item: { priceMin: 1000, priceMax: 0 }, expect: "Mulai Rp 1.000" },
  ]
  for (const c of cases) {
    it(c.name, () => {
      expect(showcasePriceLabel(c.item)).toBe(c.expect)
    })
  }
})

describe("showcaseCoverOf (E-01)", () => {
  it("coverImageUrl menang atas images[0]", () => {
    expect(
      showcaseCoverOf({
        id: "1",
        coverImageUrl: "cover.jpg",
        images: [{ id: "g", imageUrl: "first.jpg", sortOrder: 0 }],
        imageUrl: "legacy.jpg",
        createdAt: "",
      } as never),
    ).toContain("cover.jpg")
  })
  it("images[0] dipakai bila cover tidak ada (bentuk kanonik baru)", () => {
    expect(
      showcaseCoverOf({
        id: "1",
        images: [{ id: "g", imageUrl: "first.jpg", sortOrder: 0 }],
        createdAt: "",
      } as never),
    ).toContain("first.jpg")
  })
  it("fallback: imageUrl lama lalu fileKey", () => {
    expect(showcaseCoverOf({ id: "1", imageUrl: "legacy.jpg", createdAt: "" } as never)).toContain(
      "legacy.jpg",
    )
    expect(showcaseCoverOf({ id: "1", fileKey: "key-only.jpg", createdAt: "" } as never)).toContain(
      "key-only.jpg",
    )
  })
  it("tanpa sumber apa pun → undefined (bukan string kosong)", () => {
    expect(showcaseCoverOf({ id: "1", createdAt: "" } as never)).toBeUndefined()
  })
})

describe("toSocialShowcaseItem (C-07/J-04)", () => {
  it("judul kosong → fallback netral lokal (BUKAN kata Inggris 'Showcase')", () => {
    const social = toSocialShowcaseItem(
      { id: "1", createdAt: "2026-01-01" } as never,
      OWNER,
    )
    expect(social.title).toBe("Tanpa judul")
    expect(social.title).not.toBe("Showcase")
  })
  it("membangun images dari cover ketika arrays kosong", () => {
    const social = toSocialShowcaseItem(
      { id: "1", coverImageUrl: "c.jpg", createdAt: "2026-01-01" } as never,
      OWNER,
    )
    expect(social.images).toHaveLength(1)
    expect(social.images[0].imageUrl).toContain("c.jpg")
  })
  it("isSelf → isOwner true (paritas B-05 pemberi bendera lapor)", () => {
    const own = toSocialShowcaseItem({ id: "1", createdAt: "" } as never, OWNER, true)
    expect(own.isOwner).toBe(true)
    const other = toSocialShowcaseItem({ id: "1", createdAt: "" } as never, OWNER, false)
    expect(other.isOwner).toBeUndefined()
  })
  it("penulis jatuh ke pemilik endpoint bila author tidak disertakan", () => {
    const social = toSocialShowcaseItem({ id: "1", createdAt: "" } as never, OWNER)
    expect(social.author.username).toBe("budi")
    expect(social.author.fullName).toBe("Budi")
  })
})

describe("feed page-state (A-01/A-02)", () => {
  it("resetFeedPageState membuang kursor DAN flag — refresh mulai dari halaman 1", () => {
    const state = emptyFeedPageState()
    state.cursors.latest = "abc"
    state.cursors.popular = "def"
    state.hasMore.latest = true
    state.hasMore.popular = true
    resetFeedPageState(state)
    expect(state.cursors).toEqual({ latest: null, popular: null })
    expect(state.hasMore).toEqual({ latest: false, popular: false })
  })
  it("sameFeedFilter: ganti search/category = himpunan lain → kursor tidak sah", () => {
    expect(sameFeedFilter({}, {})).toBe(true)
    expect(sameFeedFilter({ search: "x" }, { search: "x" })).toBe(true)
    expect(sameFeedFilter({ search: "x" }, { search: undefined })).toBe(false)
    expect(sameFeedFilter({ category: "Jasa" }, {})).toBe(false)
  })
  it("interleave: dedupe id dan utamakan sisi populer", () => {
    const latest = [
      { id: "a" }, { id: "b" }, { id: "c" },
    ] as never[]
    const popular = [{ id: "b" }, { id: "d" }] as never[]
    const out = interleave(latest, popular)
    expect(out.map((i: { id: string }) => i.id)).toEqual(["b", "a", "d", "c"])
  })
  it("mergeById: item lama mempertahankan posisi; yang baru di-append", () => {
    const prev = [{ id: "a", v: 1 }, { id: "b", v: 2 }] as never[]
    const incoming = [{ id: "b", v: 99 }, { id: "c", v: 3 }] as never[]
    const merged = mergeById(prev, incoming)
    expect(merged.map((i: { id: string }) => i.id)).toEqual(["a", "b", "c"])
    expect((merged[1] as unknown as { v: number }).v).toBe(99) // versi terbaru menang, posisi tetap
  })
})

describe("store preferensi sosial (A-06/A-07/A-08)", () => {
  beforeEach(() => {
    // Store session-only global — bersihkan jejak antar test.
    setShowcaseLikeState("__none__", { isLiked: false, likeCount: 0 })
  })

  it("toggleSave bersifat idempoten-balik", () => {
    expect(isShowcaseSaved("i1")).toBe(false)
    toggleShowcaseSaved("i1")
    expect(isShowcaseSaved("i1")).toBe(true)
    toggleShowcaseSaved("i1")
    expect(isShowcaseSaved("i1")).toBe(false)
  })
  it("override suka menyimpan nilai FINAL server lintas layar", () => {
    expect(getShowcaseLikeOverride("i2")).toBeUndefined()
    setShowcaseLikeState("i2", { isLiked: true, likeCount: 42 })
    expect(getShowcaseLikeOverride("i2")).toEqual({ isLiked: true, likeCount: 42 })
  })
  it("markShowcaseFeedDirty menaikkan versi (A-08: feed segar saat fokus)", () => {
    const v0 = showcaseFeedDirtyVersion()
    markShowcaseFeedDirty()
    const v1 = showcaseFeedDirtyVersion()
    expect(v1).toBeGreaterThan(v0)
    markShowcaseFeedDirty()
    expect(showcaseFeedDirtyVersion()).toBeGreaterThan(v1)
  })
})
