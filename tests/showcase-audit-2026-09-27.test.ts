/**
 * Test audit Etalase 2026-09-27 — logika murni dari fix P1/P2.
 *
 * Repo memakai Vitest (`npm test` = `vitest run`); file ini mengikuti
 * konvensi itu (bukan Jest — tidak ada runner Jest di repo ini).
 *
 * Cakupan per temuan:
 *  - SH-F-001: shouldClearLikeOverride — override like vs snapshot server
 *  - SH-F-002: pickPublicUserId — identitas publik untuk pencocokan peran
 *  - SH-F-003: mergeDeletedShowcase — gabungan daftar pulihkan server+lokal
 *  - SH-F-004: acquireShowcaseMutation — kunci in-flight follow (dipakai handleFollow)
 *  - SH-F-005: partitionAssetsBySize — ukuran tak-dikenal tidak fail-open
 *  - SH-F-006: resolveCreateAttempt — retry pakai kunci sama + DTO terkini
 *  - SH-F-008: routing notifikasi showcasecomment membawa ?comment=
 *  - SH-F-010: clampShowcaseCount + toSocialShowcaseItem (clamp & sort gambar)
 *  - SH-F-011: parseShowcaseItem mem-whitelist enum visibility
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), del: vi.fn() }))
vi.mock("@/lib/api/client", () => ({
  http: { get: mocks.get, post: mocks.post, delete: mocks.del },
  seg: (value: string) => encodeURIComponent(value),
}))

import { pickPublicUserId } from "@/lib/api/users"
import { getShowcaseDetail, parseShowcaseItem } from "@/lib/api/showcase"
import {
  clampShowcaseCount,
  shouldClearLikeOverride,
  toSocialShowcaseItem,
} from "@/lib/showcase-social"
import { mergeDeletedShowcase, restoreDaysLeft } from "@/lib/showcase-deleted"
import {
  acquireShowcaseMutation,
  partitionAssetsBySize,
  resolveCreateAttempt,
} from "@/lib/showcase-state"
import { routeForNotificationReference, routeForPushData } from "@/lib/notification-routing"

beforeEach(() => vi.resetAllMocks())

// ------------------------------------------------------------------
// SH-F-001: override like hanya dibuang bila nilai SERVER berubah.
// ------------------------------------------------------------------
describe("SH-F-001 shouldClearLikeOverride", () => {
  const server = { isLiked: false, likeCount: 5 }

  it("tidak clear saat objek berganti identitas tapi data server sama (load-more merge)", () => {
    expect(shouldClearLikeOverride(server, { isLiked: false, likeCount: 5 }, false)).toBe(false)
  })

  it("tidak clear saat hitungan komentar/delta membuat objek baru (nilai like sama)", () => {
    expect(shouldClearLikeOverride(server, { ...server }, false)).toBe(false)
  })

  it("clear saat likeCount server berubah (data definitif baru)", () => {
    expect(shouldClearLikeOverride(server, { isLiked: false, likeCount: 6 }, false)).toBe(true)
  })

  it("clear saat isLiked server berubah", () => {
    expect(shouldClearLikeOverride(server, { isLiked: true, likeCount: 6 }, false)).toBe(true)
  })

  it("TIDAK clear saat mutasi like masih berjalan — walau nilai server berbeda", () => {
    expect(shouldClearLikeOverride(server, { isLiked: true, likeCount: 6 }, true)).toBe(false)
  })

  it("tidak clear saat belum ada snapshot (observasi pertama, tak bisa buktikan perubahan)", () => {
    expect(shouldClearLikeOverride(undefined, { isLiked: true, likeCount: 9 }, false)).toBe(false)
  })
})

// ------------------------------------------------------------------
// SH-F-002: identitas publik untuk pencocokan peran (BUG#1).
// ------------------------------------------------------------------
describe("SH-F-002 pickPublicUserId", () => {
  it("mengutamakan userId publik di atas id internal", () => {
    expect(pickPublicUserId({ userId: "USR-ABC123", id: "cuid-xyz" })).toBe("USR-ABC123")
  })

  it("fallback ke id bila userId tidak ada", () => {
    expect(pickPublicUserId({ id: "cuid-xyz" })).toBe("cuid-xyz")
  })

  it("null bila keduanya tidak ada / input null", () => {
    expect(pickPublicUserId({})).toBe(null)
    expect(pickPublicUserId(null)).toBe(null)
    expect(pickPublicUserId(undefined)).toBe(null)
  })
})

// ------------------------------------------------------------------
// SH-F-003: merge daftar pulihkan server + lokal.
// ------------------------------------------------------------------
describe("SH-F-003 mergeDeletedShowcase", () => {
  const local = [
    { id: "a", title: "Lokal A", deletedAt: new Date(Date.now() - 2 * 864e5).toISOString(), coverUrl: "https://x/a.jpg" },
    { id: "b", title: "Lokal B", deletedAt: new Date(Date.now() - 1 * 864e5).toISOString() },
  ]

  it("dedupe per id: daysRemaining server menang, cover lokal dipertahankan", () => {
    const merged = mergeDeletedShowcase(local, [
      { id: "a", title: "Server A", daysRemaining: 27, restorable: true },
    ])
    const entry = merged.find((e) => e.id === "a")
    expect(entry).toMatchObject({ title: "Server A", daysRemaining: 27, coverUrl: "https://x/a.jpg" })
    expect(entry?.serverOnly).toBeUndefined()
  })

  it("entri server-only ditandai dan ikut tampil", () => {
    const merged = mergeDeletedShowcase(local, [
      { id: "c", title: "Dari HP lain", daysRemaining: 10, restorable: true },
    ])
    const entry = merged.find((e) => e.id === "c")
    expect(entry).toMatchObject({ id: "c", title: "Dari HP lain", daysRemaining: 10, serverOnly: true })
  })

  it("entri server dengan restorable:false / id tak valid dilewati", () => {
    const merged = mergeDeletedShowcase([], [
      { id: "x", title: "Tak bisa pulih", restorable: false },
      { id: "", title: "Tanpa id", restorable: true },
    ])
    expect(merged).toHaveLength(0)
  })

  it("lokal terbaru dulu, lalu entri server-only", () => {
    const merged = mergeDeletedShowcase(local, [
      { id: "c", title: "Server saja", daysRemaining: 5, restorable: true },
    ])
    expect(merged.map((e) => e.id)).toEqual(["b", "a", "c"])
  })

  it("daysRemaining server yang tak-hingga dihitung ulang dari deletedAt", () => {
    const deletedAt = new Date(Date.now() - 5 * 864e5).toISOString()
    const merged = mergeDeletedShowcase([], [
      { id: "d", title: "D", deletedAt, daysRemaining: Number.NaN, restorable: true },
    ])
    expect(merged[0]?.daysRemaining).toBe(restoreDaysLeft(deletedAt))
  })

  it("tanpa sesi / server kosong → daftar lokal tetap tampil", () => {
    expect(mergeDeletedShowcase(local, []).map((e) => e.id)).toEqual(["b", "a"])
  })
})

// ------------------------------------------------------------------
// SH-F-004: kunci in-flight (dipakai guard double-tap follow).
// ------------------------------------------------------------------
describe("SH-F-004 acquireShowcaseMutation (guard follow)", () => {
  it("akuisisi kedua saat terkunci mengembalikan null (tap kedua ditolak)", () => {
    const release = acquireShowcaseMutation("follow:test-handle")
    expect(release).not.toBeNull()
    expect(acquireShowcaseMutation("follow:test-handle")).toBeNull()
    release?.()
  })

  it("setelah release, akuisisi berhasil lagi", () => {
    const first = acquireShowcaseMutation("follow:test-handle-2")
    expect(first).not.toBeNull()
    first?.()
    const second = acquireShowcaseMutation("follow:test-handle-2")
    expect(second).not.toBeNull()
    second?.()
  })

  it("kunci per-handle: handle berbeda tidak saling mengunci", () => {
    const a = acquireShowcaseMutation("follow:alice")
    const b = acquireShowcaseMutation("follow:budi")
    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    a?.()
    b?.()
  })
})

// ------------------------------------------------------------------
// SH-F-005: ukuran tak-dikenal tidak fail-open.
// ------------------------------------------------------------------
describe("SH-F-005 partitionAssetsBySize", () => {
  const MAX = 5 * 1024 * 1024
  const asset = (size: number) => ({ size })

  it("size 0 / negatif masuk bucket unknownSize (bukan ok, bukan tooBig)", () => {
    const { ok, tooBig, unknownSize } = partitionAssetsBySize([asset(0), asset(-1)], MAX)
    expect(ok).toHaveLength(0)
    expect(tooBig).toHaveLength(0)
    expect(unknownSize).toHaveLength(2)
  })

  it("melebihi batas masuk tooBig; tepat di batas = ok", () => {
    const { ok, tooBig, unknownSize } = partitionAssetsBySize([asset(MAX), asset(MAX + 1)], MAX)
    expect(ok).toHaveLength(1)
    expect(tooBig).toHaveLength(1)
    expect(unknownSize).toHaveLength(0)
  })

  it("aset normal masuk ok", () => {
    const { ok } = partitionAssetsBySize([asset(1024)], MAX)
    expect(ok).toHaveLength(1)
  })
})

// ------------------------------------------------------------------
// SH-F-006: retry = kunci sama + DTO terkini.
// ------------------------------------------------------------------
describe("SH-F-006 resolveCreateAttempt", () => {
  it("percobaan pertama: kunci baru + DTO dari form saat ini", () => {
    const dto = { title: "Judul v1" }
    const attempt = resolveCreateAttempt(null, () => dto, () => "key-1")
    expect(attempt).toEqual({ key: "key-1", dto })
  })

  it("retry: kunci DIPERTAHANKAN tetapi DTO dibangun ulang (bukan DTO basi)", () => {
    const staleDto = { title: "Judul v1" }
    const first = resolveCreateAttempt(null, () => staleDto, () => "key-1")
    const freshDto = { title: "Judul v2 (diedit user)" }
    let newKeyCalled = false
    const retry = resolveCreateAttempt(first.key, () => freshDto, () => {
      newKeyCalled = true
      return "key-2"
    })
    expect(retry.key).toBe("key-1")
    expect(retry.dto).toBe(freshDto)
    expect(retry.dto).not.toBe(staleDto)
    expect(newKeyCalled).toBe(false)
  })
})

// ------------------------------------------------------------------
// SH-F-008: notifikasi komentar membawa ?comment=.
// ------------------------------------------------------------------
describe("SH-F-008 routing notifikasi showcasecomment", () => {
  it("commentId diteruskan ke param comment deep-link", () => {
    const route = routeForNotificationReference({
      referenceType: "showcasecomment",
      referenceId: "show-1",
      commentId: "cmt-9",
    }) as unknown as { pathname: string; params: Record<string, string> }
    expect(route.pathname).toBe("/showcase/[id]")
    expect(route.params.id).toBe("show-1")
    expect(route.params.comment).toBe("cmt-9")
  })

  it("tanpa commentId → detail polos (tanpa param comment)", () => {
    const route = routeForNotificationReference({
      referenceType: "showcasecomment",
      referenceId: "show-1",
    }) as unknown as { pathname: string; params: Record<string, string> }
    expect(route.params.id).toBe("show-1")
    expect(route.params).not.toHaveProperty("comment")
  })

  it("showcaselike tidak ikut membawa comment", () => {
    const route = routeForNotificationReference({
      referenceType: "showcaselike",
      referenceId: "show-1",
      commentId: "cmt-9",
    }) as unknown as { params: Record<string, string> }
    expect(route.params).not.toHaveProperty("comment")
  })

  it("routeForPushData meneruskan commentId dari payload push", () => {
    const route = routeForPushData({
      type: "showcasecomment",
      id: "show-2",
      commentId: "cmt-3",
    }) as unknown as { params: Record<string, string> }
    expect(route?.params?.comment).toBe("cmt-3")
  })

  it("routeForPushData menerima varian comment_id", () => {
    const route = routeForPushData({
      referenceType: "showcasecomment",
      referenceId: "show-2",
      comment_id: "cmt-4",
    }) as unknown as { params: Record<string, string> }
    expect(route?.params?.comment).toBe("cmt-4")
  })
})

// ------------------------------------------------------------------
// SH-F-010: clamp hitungan + sort gambar by sortOrder.
// ------------------------------------------------------------------
describe("SH-F-010 clampShowcaseCount & toSocialShowcaseItem", () => {
  it.each([
    ["negatif", -3, 0],
    ["NaN", Number.NaN, 0],
    ["Infinity", Number.POSITIVE_INFINITY, 0],
    ["string", "5", 0],
    ["pecahan dibulatkan ke bawah", 2.7, 2],
    ["nol tetap nol", 0, 0],
    ["positif lolos", 42, 42],
  ])("clamp %s → %d", (_name, input, expected) => {
    expect(clampShowcaseCount(input)).toBe(expected)
  })

  it("toSocialShowcaseItem: hitungan negatif/NaN di-clamp", () => {
    const item = toSocialShowcaseItem(
      {
        id: "s1",
        createdAt: "2026-09-27T00:00:00Z",
        likeCount: -3,
        commentCount: Number.NaN,
        viewCount: Number.POSITIVE_INFINITY,
      } as never,
      { id: "u1", username: "budi" },
    )
    expect(item.likeCount).toBe(0)
    expect(item.commentCount).toBe(0)
    expect(item.viewCount).toBe(0)
  })

  it("toSocialShowcaseItem: gambar diurutkan by sortOrder", () => {
    const item = toSocialShowcaseItem(
      {
        id: "s1",
        createdAt: "2026-09-27T00:00:00Z",
        images: [
          { id: "img-2", imageUrl: "https://x/2.jpg", sortOrder: 2 },
          { id: "img-0", imageUrl: "https://x/0.jpg", sortOrder: 0 },
          { id: "img-1", imageUrl: "https://x/1.jpg", sortOrder: 1 },
        ],
      } as never,
      { id: "u1", username: "budi" },
    )
    expect(item.images.map((i) => i.id)).toEqual(["img-0", "img-1", "img-2"])
  })

  it("toSocialShowcaseItem: sortOrder asing → fallback indeks", () => {
    const item = toSocialShowcaseItem(
      {
        id: "s1",
        createdAt: "2026-09-27T00:00:00Z",
        images: [
          { id: "a", imageUrl: "https://x/a.jpg", sortOrder: "rusak" },
          { id: "b", imageUrl: "https://x/b.jpg", sortOrder: 5 },
        ],
      } as never,
      { id: "u1", username: "budi" },
    )
    // "rusak" → indeksnya sendiri (0); 5 valid tetap 5.
    expect(item.images.map((i) => i.sortOrder)).toEqual([0, 5])
    expect(item.images.map((i) => i.id)).toEqual(["a", "b"])
  })
})

// ------------------------------------------------------------------
// SH-F-011: visibility di-whitelist (nilai asing ≠ publik).
// ------------------------------------------------------------------
describe("SH-F-011 parseShowcaseItem visibility", () => {
  const raw = (visibility: unknown) => ({
    id: "s1",
    visibility,
    author: { userId: "USR-1", username: "budi" },
  })

  it("PUBLIC/PRIVATE dipertahankan", () => {
    expect(parseShowcaseItem(raw("PUBLIC")).visibility).toBe("PUBLIC")
    expect(parseShowcaseItem(raw("PRIVATE")).visibility).toBe("PRIVATE")
  })

  it('nilai asing ("FOLLOWERS") → undefined, bukan fail-open publik', () => {
    expect(parseShowcaseItem(raw("FOLLOWERS")).visibility).toBeUndefined()
  })

  it("bukan string → undefined", () => {
    expect(parseShowcaseItem(raw(42)).visibility).toBeUndefined()
    expect(parseShowcaseItem(raw(null)).visibility).toBeUndefined()
  })

  it("getShowcaseDetail meneruskan whitelist yang sama", async () => {
    mocks.get.mockResolvedValue(raw("UNLISTED"))
    const item = await getShowcaseDetail("s1")
    expect(item.visibility).toBeUndefined()
  })
})
