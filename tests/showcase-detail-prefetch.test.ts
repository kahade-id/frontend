/**
 * FE-080 — cache prefetch detail etalase dibatasi (LRU terurut-insersi) +
 * entri kedaluwarsa disapu saat write.
 *
 * Sebelum perbaikan: `Map` tanpa eviksi tumbuh tanpa batas bila pengguna
 * menelusuri banyak kartu (setiap press-in = satu entri) tanpa membuka
 * detail, dan entri basi menumpuk sampai ada yang mengonsumsinya.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { getShowcaseDetail, type ShowcaseSocialItem } from "@/lib/api/showcase"
import {
  SHOWCASE_DETAIL_PREFETCH_MAX_ENTRIES,
  SHOWCASE_DETAIL_PREFETCH_TTL_MS,
  clearShowcaseDetailPrefetch,
  consumePrefetchedShowcaseDetail,
  prefetchShowcaseDetail,
} from "@/lib/showcase-detail-prefetch"

vi.mock("@/lib/api/showcase", () => ({
  getShowcaseDetail: vi.fn(),
}))

const mockedGetDetail = vi.mocked(getShowcaseDetail)
const item = (id: string) => ({ id }) as ShowcaseSocialItem
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  clearShowcaseDetailPrefetch()
  mockedGetDetail.mockReset()
  mockedGetDetail.mockImplementation(async (id: string) => item(id))
})

describe("FE-080 — batas ukuran & expiry cache prefetch", () => {
  it("prefetch → consume tetap mengembalikan item (perilaku lama utuh)", async () => {
    prefetchShowcaseDetail("a")
    await flush()
    expect(consumePrefetchedShowcaseDetail("a")).toMatchObject({ id: "a" })
    // Sekali pakai: konsumsi kedua = null.
    expect(consumePrefetchedShowcaseDetail("a")).toBeNull()
  })

  it("tidak melebihi MAX_ENTRIES — entri tertua dieviksi", async () => {
    const total = SHOWCASE_DETAIL_PREFETCH_MAX_ENTRIES + 10
    const half = Math.floor(total / 2)
    // Dua gelombang dengan flush di antaranya: gelombang pertama settle
    // dulu supaya gelombang kedua men-eviksi entri yang sudah settle
    // (penanda in-flight sengaja tidak dieviksi — lihat test di bawah).
    for (let i = 0; i < half; i++) prefetchShowcaseDetail(`id-${i}`)
    await flush()
    for (let i = half; i < total; i++) prefetchShowcaseDetail(`id-${i}`)
    await flush()
    // 10 tertua hilang, 50 terbaru bertahan.
    for (let i = 0; i < 10; i++) {
      expect(consumePrefetchedShowcaseDetail(`id-${i}`)).toBeNull()
    }
    let alive = 0
    for (let i = 10; i < total; i++) {
      if (consumePrefetchedShowcaseDetail(`id-${i}`) !== null) alive++
    }
    expect(alive).toBe(SHOWCASE_DETAIL_PREFETCH_MAX_ENTRIES)
  })

  it("entri kedaluwarsa disapu saat write berikutnya", async () => {
    // `now` relatif terhadap waktu nyata — implementasi men-stamp `at`
    // dengan Date.now() saat promise settle.
    const t0 = Date.now()
    prefetchShowcaseDetail("old2", t0)
    await flush()
    // Sanity: entri segar bisa dikonsumsi (sekali pakai → terhapus).
    expect(consumePrefetchedShowcaseDetail("old2", t0 + 1)).toMatchObject({ id: "old2" })
    prefetchShowcaseDetail("old2", t0)
    await flush()
    // Write jauh setelah TTL → sweepExpired membuang "old2".
    prefetchShowcaseDetail("new", t0 + SHOWCASE_DETAIL_PREFETCH_TTL_MS + 1_000)
    await flush()
    expect(
      consumePrefetchedShowcaseDetail("old2", t0 + SHOWCASE_DETAIL_PREFETCH_TTL_MS + 2_000),
    ).toBeNull()
    expect(consumePrefetchedShowcaseDetail("new")).toMatchObject({ id: "new" })
  })

  it("penanda in-flight tidak dieviksi (tidak memicu fetch ganda)", async () => {
    let resolveSlow!: (value: ShowcaseSocialItem) => void
    mockedGetDetail.mockImplementation((id: string) =>
      id === "slow" ? new Promise<ShowcaseSocialItem>((r) => (resolveSlow = r)) : Promise.resolve(item(id)),
    )
    prefetchShowcaseDetail("slow")
    for (let i = 0; i < SHOWCASE_DETAIL_PREFETCH_MAX_ENTRIES + 5; i++) {
      prefetchShowcaseDetail(`other-${i}`)
    }
    await flush()
    // "slow" masih in-flight → belum bisa dikonsumsi, tapi penandanya utuh.
    expect(mockedGetDetail).toHaveBeenCalledTimes(SHOWCASE_DETAIL_PREFETCH_MAX_ENTRIES + 6)
    resolveSlow(item("slow"))
    await flush()
    expect(consumePrefetchedShowcaseDetail("slow")).toMatchObject({ id: "slow" })
  })
})
