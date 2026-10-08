/**
 * Audit chat D10 + D11 — rencana lompat ke pesan dan geometri thread.
 *
 * Yang dikunci: setiap cabang "pesan tidak bisa dijangkau" punya perilaku
 * dan ALASAN sendiri (dulu semuanya satu toast generik "belum termuat"),
 * dan perkiraan tinggi baris/offset untuk `getItemLayout` masuk akal.
 */
import { describe, expect, it } from "vitest"

import {
  JUMP_MAX_PAGES,
  findThreadRowIndex,
  planJump,
  type JumpRow,
} from "@/lib/chat-jump"
import {
  ROW_HEIGHT_FALLBACK,
  buildRowGeometry,
  estimateRowHeight,
} from "@/lib/chat-thread-layout"

const msg = (id: string, isDeleted = false): JumpRow => ({
  kind: "msg",
  key: id,
  message: { id, isDeleted },
})
const rows: JumpRow[] = [
  { kind: "day", key: "day-1" },
  msg("m1"),
  msg("m2"),
  { kind: "unread", key: "unread-separator" },
  msg("m3"),
  msg("gone", true),
]

describe("findThreadRowIndex", () => {
  it("memberi indeks BARIS (hari/pemisah ikut dihitung), bukan indeks pesan", () => {
    expect(findThreadRowIndex(rows, "m1")).toBe(1)
    // Bug lama: messages.findIndex memberi 2 untuk m3; indeks baris yang benar 4.
    expect(findThreadRowIndex(rows, "m3")).toBe(4)
    expect(findThreadRowIndex(rows, "tidak-ada")).toBe(-1)
  })
})

describe("planJump", () => {
  const base = { rows, canLoadOlder: true, pagesLoaded: 0 }

  it("pesan ada di thread → gulir ke baris itu", () => {
    expect(planJump({ ...base, messageId: "m3" })).toEqual({ kind: "scroll", index: 4 })
  })

  it("asal kutipan DIKETAHUI sudah dihapus → dijelaskan, tidak melompat/memuat", () => {
    expect(planJump({ ...base, messageId: "m1", knownDeleted: true })).toEqual({
      kind: "blocked",
      reason: "deleted",
    })
    // Bahkan bila belum termuat: tidak ada gunanya mencari pesan yang terhapus.
    expect(planJump({ ...base, messageId: "xyz", knownDeleted: true })).toEqual({
      kind: "blocked",
      reason: "deleted",
    })
  })

  it("tombstone di thread (terhapus) bukan tujuan lompat", () => {
    expect(planJump({ ...base, messageId: "gone" })).toEqual({ kind: "blocked", reason: "deleted" })
  })

  it("belum termuat + riwayat masih ada → muat halaman lama", () => {
    expect(planJump({ ...base, messageId: "lama" })).toEqual({ kind: "load-older" })
    expect(planJump({ ...base, messageId: "lama", pagesLoaded: JUMP_MAX_PAGES - 1 })).toEqual({
      kind: "load-older",
    })
  })

  it("anggaran halaman habis → 'di luar jangkauan' (bukan memuat tanpa ujung)", () => {
    expect(planJump({ ...base, messageId: "lama", pagesLoaded: JUMP_MAX_PAGES })).toEqual({
      kind: "blocked",
      reason: "out-of-range",
    })
    expect(planJump({ ...base, messageId: "lama", pagesLoaded: 3, maxPages: 3 })).toEqual({
      kind: "blocked",
      reason: "out-of-range",
    })
  })

  it("riwayat habis tanpa ketemu → 'tidak ditemukan' (kedaluwarsa/dihapus server)", () => {
    expect(planJump({ ...base, messageId: "lama", canLoadOlder: false })).toEqual({
      kind: "blocked",
      reason: "not-found",
    })
  })

  it("disembunyikan di perangkat ini ('hapus untuk saya') → alasan khusus", () => {
    expect(
      planJump({ ...base, messageId: "tersembunyi", hiddenIds: new Set(["tersembunyi"]) }),
    ).toEqual({ kind: "blocked", reason: "hidden" })
  })

  it("pesan yang ADA di thread menang atas hiddenIds yang basi", () => {
    expect(planJump({ ...base, messageId: "m2", hiddenIds: new Set(["m2"]) })).toEqual({
      kind: "scroll",
      index: 2,
    })
  })
})

describe("estimateRowHeight", () => {
  it("belum ada yang terukur → fallback", () => {
    expect(estimateRowHeight(new Map())).toBe(ROW_HEIGHT_FALLBACK)
  })

  it("memakai rata-rata baris terukur (thread bergambar ≫ thread teks)", () => {
    expect(estimateRowHeight(new Map([["a", 200], ["b", 100]]))).toBe(150)
  })

  it("dijepit: satu foto raksasa / satu baris kecil tidak menyeret perkiraan", () => {
    expect(estimateRowHeight(new Map([["a", 5000]]))).toBe(320)
    expect(estimateRowHeight(new Map([["a", 4]]))).toBe(40)
  })
})

describe("buildRowGeometry", () => {
  it("offset kumulatif dari header; baris terukur memakai tinggi asli", () => {
    const heights = new Map([["a", 100], ["b", 50]])
    const g = buildRowGeometry(["a", "b", "c"], heights, 64)
    expect(g.offsets).toEqual([64, 164, 214])
    // "c" belum terukur → rata-rata (75).
    expect(g.lengths).toEqual([100, 50, 75])
  })

  it("tanpa data: semua baris memakai fallback dan offset naik teratur", () => {
    const g = buildRowGeometry(["a", "b"], new Map())
    expect(g.offsets).toEqual([0, ROW_HEIGHT_FALLBACK])
    expect(g.lengths).toEqual([ROW_HEIGHT_FALLBACK, ROW_HEIGHT_FALLBACK])
  })

  it("header ikut dihitung: tanpa itu lompatan kasar mendarat setinggi header di atas sasaran", () => {
    const withHeader = buildRowGeometry(["a"], new Map([["a", 80]]), 64)
    const without = buildRowGeometry(["a"], new Map([["a", 80]]), 0)
    expect((withHeader.offsets[0] ?? 0) - (without.offsets[0] ?? 0)).toBe(64)
  })

  it("daftar besar dibangun sekali dan tetap cepat (O(n), bukan O(n²))", () => {
    const keys = Array.from({ length: 5_000 }, (_, i) => `k${i}`)
    const heights = new Map(keys.slice(0, 1_000).map((k) => [k, 90] as const))
    const t0 = performance.now()
    const g = buildRowGeometry(keys, heights, 64)
    const elapsed = performance.now() - t0
    expect(g.offsets).toHaveLength(5_000)
    expect(g.offsets[4_999]).toBeGreaterThan(g.offsets[1_000] ?? 0)
    // Anggaran longgar (CI lambat) — O(n²) pada 5.000 baris akan jauh melewatinya.
    expect(elapsed).toBeLessThan(200)
  })
})
