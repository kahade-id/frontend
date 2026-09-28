/**
 * Test mega-batch FE-IMP-2 (2026-09-28): logika murni item profil & pencarian.
 *
 * - Item 61: heuristik toggle bio (`bioNeedsToggle` di lib/profile-bio).
 * - Item 70: pengurutan ulasan profil (`sortProfileRatings` di lib/ratings-sort).
 * - Item 75: URL & method hapus satu riwayat pencarian.
 * - Item 87: normalisasi respons pencarian lintas-room (`searchAllMessages`).
 */
import { afterEach, describe, expect, it, vi } from "vitest"

import { BIO_PREVIEW_CHARS, bioNeedsToggle } from "@/lib/profile-bio"
import { sortProfileRatings } from "@/lib/ratings-sort"
import type { Rating } from "@/lib/api/ratings"
import { deleteSearchHistoryItem } from "@/lib/api/search"
import { searchAllMessages } from "@/lib/api/chat"
import { setAccessToken, clearSession } from "@/lib/api/session"

// ------------------------------------------------------------------
// Item 61 — toggle bio
// ------------------------------------------------------------------

describe("bioNeedsToggle", () => {
  it("bio pendek tidak perlu toggle", () => {
    expect(bioNeedsToggle("Halo, saya Budi.")).toBe(false)
    expect(bioNeedsToggle("x".repeat(BIO_PREVIEW_CHARS))).toBe(false)
  })

  it("bio di atas ambang perlu toggle", () => {
    expect(bioNeedsToggle("x".repeat(BIO_PREVIEW_CHARS + 1))).toBe(true)
  })
})

// ------------------------------------------------------------------
// Item 70 — urutan ulasan profil
// ------------------------------------------------------------------

function rating(id: string, stars: number, createdAt: string): Rating {
  return { id, stars, createdAt }
}

const RATINGS: Rating[] = [
  rating("a", 5, "2026-09-20T10:00:00Z"),
  rating("b", 3, "2026-09-27T10:00:00Z"),
  rating("c", 5, "2026-09-25T10:00:00Z"),
  rating("d", 1, "2026-09-28T10:00:00Z"),
]

describe("sortProfileRatings", () => {
  it("newest: pertahankan urutan server (tidak diacak ulang)", () => {
    const ids = RATINGS.map((r) => r.id)
    expect(sortProfileRatings(RATINGS, "newest").map((r) => r.id)).toEqual(ids)
  })

  it("top: bintang tertinggi dulu, seri diputus tanggal terbaru", () => {
    expect(sortProfileRatings(RATINGS, "top").map((r) => r.id)).toEqual(["c", "a", "b", "d"])
  })

  it("tidak mengubah array asli", () => {
    const before = RATINGS.map((r) => r.id)
    sortProfileRatings(RATINGS, "top")
    expect(RATINGS.map((r) => r.id)).toEqual(before)
  })

  it("daftar kosong aman", () => {
    expect(sortProfileRatings([], "newest")).toEqual([])
    expect(sortProfileRatings([], "top")).toEqual([])
  })
})

// ------------------------------------------------------------------
// Item 75 & 87 — API search (fetch di-stub)
// ------------------------------------------------------------------

type FetchCall = { url: string; init: RequestInit }

const calls: FetchCall[] = []
function stubFetch(body: unknown) {
  calls.length = 0
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return new Response(JSON.stringify({ success: true, data: body }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  clearSession()
})

describe("deleteSearchHistoryItem", () => {
  it("memakai DELETE dengan query ter-encode di path", async () => {
    await setAccessToken("test-token")
    stubFetch({})
    await deleteSearchHistoryItem("sepatu lari")
    expect(calls).toHaveLength(1)
    expect(calls[0].init.method).toBe("DELETE")
    expect(calls[0].url).toContain("/v1/search/history/sepatu%20lari")
  })
})

describe("searchAllMessages", () => {
  it("menormalkan bentuk { results }", async () => {
    await setAccessToken("test-token")
    stubFetch({
      query: "kabel",
      results: [
        {
          message: {
            id: "m1",
            text: "kabel USB ready",
            messageType: "TEXT",
            fromUser: false,
            createdAt: "2026-09-28T00:00:00Z",
          },
          room: { id: "r1", counterpart: { username: "tokoa" } },
        },
      ],
    })
    const out = await searchAllMessages("kabel")
    expect(out.query).toBe("kabel")
    expect(out.results).toHaveLength(1)
    expect(out.results[0].room.id).toBe("r1")
    expect(calls[0].url).toContain("/v1/chat/search")
  })

  it("menormalkan bentuk legacy { messages }", async () => {
    await setAccessToken("test-token")
    stubFetch({ messages: [] })
    const out = await searchAllMessages("kabel")
    expect(out.results).toEqual([])
  })
})
