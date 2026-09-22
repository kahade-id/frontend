/**
 * C-01/C-03/C-04 (audit 2026-09-20): kontrak cache query.
 *
 * Kelas bug yang dikunci di sini adalah bug yang TIDAK terlihat di layar:
 * entri yang tidak pernah dibuang (memori tumbuh selama sesi panjang), entri
 * milik akun sebelumnya yang masih terbaca setelah login/logout, penyegaran
 * latar yang penandanya tertinggal sehingga kunci itu berhenti disegarkan
 * selamanya, dan pemanggil imperatif yang melewatkan cache sehingga endpoint
 * yang sama ditembak berkali-kali.
 *
 * Semuanya perilaku murni `lib/query-cache.ts` (tanpa React), jadi diuji di
 * sini dengan waktu palsu — bukan lewat hook.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  CACHE_REVALIDATE_AFTER_MS,
  fetchViaQueryCache,
  invalidateQueryCache,
  markQueryRevalidating,
  QUERY_CACHE_MAX,
  QUERY_CACHE_TTL_MS,
  queryCacheSize,
  readQueryCacheEntry,
  releaseQueryRevalidation,
  writeQueryCache,
} from "@/lib/query-cache"
import { clearSession, startSession } from "@/lib/api/session"

const T0 = new Date("2026-09-22T00:00:00.000Z").getTime()

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(T0)
  invalidateQueryCache()
})

describe("C-03: TTL & batas ukuran cache", () => {
  it("hit di dalam TTL, miss (dan dibuang) setelah TTL", () => {
    writeQueryCache("wallet", { availableBalance: 1 })
    expect(readQueryCacheEntry<{ availableBalance: number }>("wallet")?.data).toEqual({
      availableBalance: 1,
    })

    vi.setSystemTime(T0 + QUERY_CACHE_TTL_MS + 1)
    expect(readQueryCacheEntry("wallet")).toBeNull()
    // Entri kedaluwarsa benar-benar dibuang, bukan hanya dilewati.
    expect(queryCacheSize()).toBe(0)
  })

  it("eviksi FIFO pada batas ukuran — kunci berparameter tinggi tidak menumpuk", () => {
    for (let i = 0; i < QUERY_CACHE_MAX; i += 1) writeQueryCache(`order-detail:${i}`, i)
    expect(queryCacheSize()).toBe(QUERY_CACHE_MAX)

    // Kunci ke-201 membuang entri TERTUA, bukan menambah ukuran.
    writeQueryCache("order-detail:baru", 999)
    expect(queryCacheSize()).toBe(QUERY_CACHE_MAX)
    expect(readQueryCacheEntry("order-detail:0")).toBeNull()
    expect(readQueryCacheEntry("order-detail:baru")?.data).toBe(999)
    expect(readQueryCacheEntry(`order-detail:${QUERY_CACHE_MAX - 1}`)?.data).toBe(
      QUERY_CACHE_MAX - 1,
    )
  })

  it("menulis ulang kunci yang sudah ada tidak menambah entri (tidak membuang yang lain)", () => {
    for (let i = 0; i < QUERY_CACHE_MAX; i += 1) writeQueryCache(`k${i}`, i)
    writeQueryCache("k0", "diperbarui")
    expect(queryCacheSize()).toBe(QUERY_CACHE_MAX)
    expect(readQueryCacheEntry("k0")?.data).toBe("diperbarui")
  })

  it("invalidateQueryCache(key) hanya membuang key itu; tanpa argumen mengosongkan semua", () => {
    writeQueryCache("a", 1)
    writeQueryCache("b", 2)
    invalidateQueryCache("a")
    expect(readQueryCacheEntry("a")).toBeNull()
    expect(readQueryCacheEntry("b")?.data).toBe(2)
    invalidateQueryCache()
    expect(queryCacheSize()).toBe(0)
  })
})

describe("C-11/C-01: cache terikat revisi sesi", () => {
  it("entri dari sesi sebelumnya tidak pernah terbaca sesi berikutnya", async () => {
    await startSession({ accessToken: "token-akun-a" })
    writeQueryCache("wallet", { availableBalance: 100 })
    expect(readQueryCacheEntry("wallet")?.data).toEqual({ availableBalance: 100 })

    // Login akun lain (atau logout): revisi sesi naik.
    await clearSession()
    await startSession({ accessToken: "token-akun-b" })

    expect(readQueryCacheEntry("wallet")).toBeNull()
    expect(queryCacheSize()).toBe(0)
  })

  it("logout (clearSession) saja sudah cukup membuat cache akun lama tidak terbaca", async () => {
    await startSession({ accessToken: "token-akun-a" })
    writeQueryCache("me", { username: "rahasia" })

    await clearSession()

    expect(readQueryCacheEntry("me")).toBeNull()
  })
})

describe("C-04: penanda penyegaran latar", () => {
  it("satu kunci hanya boleh punya satu penyegaran latar berjalan", () => {
    writeQueryCache("wallet", 1)
    expect(markQueryRevalidating("wallet")).toBe(true)
    expect(markQueryRevalidating("wallet")).toBe(false)
    releaseQueryRevalidation("wallet")
    expect(markQueryRevalidating("wallet")).toBe(true)
  })

  it("kunci tanpa entri tidak bisa ditandai", () => {
    expect(markQueryRevalidating("tidak-ada")).toBe(false)
  })

  it("entri yang lebih tua dari ambang SWR dikenali pemanggil lewat `at`", () => {
    writeQueryCache("wallet", 1)
    const fresh = readQueryCacheEntry("wallet")
    expect(Date.now() - (fresh?.at ?? 0)).toBeLessThan(CACHE_REVALIDATE_AFTER_MS)

    vi.setSystemTime(T0 + CACHE_REVALIDATE_AFTER_MS)
    const stale = readQueryCacheEntry("wallet")
    expect(Date.now() - (stale?.at ?? 0)).toBeGreaterThanOrEqual(CACHE_REVALIDATE_AFTER_MS)
    expect(stale?.revalidating).toBe(false)
  })
})

describe("C-02: jalur imperatif ikut memakai cache bersama", () => {
  it("cache segar → fetcher TIDAK dipanggil sama sekali", async () => {
    writeQueryCache("me", { username: "kahade" })
    const fetcher = vi.fn(async () => ({ username: "jaringan" }))

    const me = await fetchViaQueryCache("me", fetcher)

    expect(me).toEqual({ username: "kahade" })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("cache kosong/kedaluwarsa → fetch sekali lalu hasilnya masuk cache untuk pembaca berikutnya", async () => {
    const fetcher = vi.fn(async () => ({ username: "kahade" }))

    await expect(fetchViaQueryCache("me", fetcher)).resolves.toEqual({ username: "kahade" })
    await expect(fetchViaQueryCache("me", fetcher)).resolves.toEqual({ username: "kahade" })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(readQueryCacheEntry("me")?.data).toEqual({ username: "kahade" })

    // Setelah invalidasi (mis. habis mutasi uang) pembacaan berikutnya fetch lagi.
    invalidateQueryCache("me")
    await fetchViaQueryCache("me", fetcher)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it("meneruskan signal pemanggil ke fetcher (pembatalan tetap milik pemanggil)", async () => {
    const controller = new AbortController()
    const fetcher = vi.fn(async (signal: AbortSignal) => {
      expect(signal).toBe(controller.signal)
      return 1
    })

    await fetchViaQueryCache("hitung", fetcher, controller.signal)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it("error fetcher tidak menulis cache apa pun", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("jaringan mati")
    })

    await expect(fetchViaQueryCache("me", fetcher)).rejects.toThrow("jaringan mati")
    expect(queryCacheSize()).toBe(0)
  })
})
