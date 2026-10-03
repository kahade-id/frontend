/**
 * P2 (audit perf/UX 2026-10-03): LRU untuk cache konkretisasi href root layout.
 *
 * Perilaku lama (`Map` + `clear()` saat >100 entri) membuang SELURUH cache
 * yang hangat ketika satu href baru muncul — pekerjaan regex/encode ulang di
 * jalur panas tap notifikasi. Kontrak LRU yang dikunci di sini:
 *   - entri yang baru DIPAKAI tidak pernah dibuang lebih dulu,
 *   - yang dibuang saat penuh adalah yang paling lama dipakai,
 *   - `null` (hasil konkretisasi yang valid-gagal) IKUT ter-cache.
 */
import { describe, expect, it } from "vitest"

import { LruCache } from "@/lib/lru-cache"

describe("LruCache", () => {
  it("menyimpan & mengembalikan nilai (termasuk null)", () => {
    const cache = new LruCache<string | null>(3)
    cache.set("a", "satu")
    cache.set("b", null)

    expect(cache.get("a")).toBe("satu")
    expect(cache.get("b")).toBeNull()
    expect(cache.get("tidak-ada")).toBeUndefined()
    expect(cache.has("b")).toBe(true)
  })

  it("membuang entri paling lama, bukan seluruh cache", () => {
    const cache = new LruCache<number>(3)
    cache.set("a", 1)
    cache.set("b", 2)
    cache.set("c", 3)
    cache.set("d", 4)

    expect(cache.size).toBe(3)
    expect(cache.has("a")).toBe(false) // paling lama
    expect(cache.get("b")).toBe(2)
    expect(cache.get("c")).toBe(3)
    expect(cache.get("d")).toBe(4)
  })

  it("entri yang baru dibaca dipindah ke posisi terbaru (LRU sejati)", () => {
    const cache = new LruCache<number>(3)
    cache.set("a", 1)
    cache.set("b", 2)
    cache.set("c", 3)

    // "a" dipakai lagi → sekarang "b" yang paling lama.
    expect(cache.get("a")).toBe(1)

    cache.set("d", 4)
    expect(cache.has("b")).toBe(false)
    expect(cache.has("a")).toBe(true)
    expect(cache.keys()).toEqual(["c", "a", "d"])
  })

  it("menimpa nilai lama tanpa menambah entri", () => {
    const cache = new LruCache<number>(2)
    cache.set("a", 1)
    cache.set("a", 2)
    expect(cache.size).toBe(1)
    expect(cache.get("a")).toBe(2)
  })

  it("clear mengosongkan semuanya", () => {
    const cache = new LruCache<number>(2)
    cache.set("a", 1)
    cache.clear()
    expect(cache.size).toBe(0)
    expect(cache.get("a")).toBeUndefined()
  })

  it("maxSize < 1 ditolak (fail-closed, bukan cache tanpa batas)", () => {
    expect(() => new LruCache<number>(0)).toThrow()
  })
})
