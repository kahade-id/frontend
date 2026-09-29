/**
 * FE-068 — prefetch 1 gambar tetangga (maju/mundur) saat halaman galeri
 * berubah. Hanya gambar (video dilewati), hormati mode hemat data.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Image } from "expo-image"
import { prefetchNeighborImages } from "@/lib/prefetch-neighbors"

vi.mock("expo-image", () => ({
  Image: { prefetch: vi.fn(() => Promise.resolve(true)) },
}))

const mockedPrefetch = vi.mocked(Image.prefetch)

beforeEach(() => {
  mockedPrefetch.mockClear()
})

describe("FE-068 — prefetchNeighborImages", () => {
  it("prefetch 1 ke depan + 1 ke belakang", () => {
    prefetchNeighborImages(["a", "b", "c", "d"], 1, false)
    expect(mockedPrefetch).toHaveBeenCalledTimes(2)
    expect(mockedPrefetch).toHaveBeenCalledWith("a", "memory-disk")
    expect(mockedPrefetch).toHaveBeenCalledWith("c", "memory-disk")
  })

  it("tepi daftar: hanya tetangga yang ada", () => {
    prefetchNeighborImages(["a", "b"], 0, false)
    expect(mockedPrefetch).toHaveBeenCalledTimes(1)
    expect(mockedPrefetch).toHaveBeenCalledWith("b", "memory-disk")
  })

  it("undefined (slide video) dilewati", () => {
    prefetchNeighborImages([undefined, "b", undefined], 1, false)
    expect(mockedPrefetch).not.toHaveBeenCalled()
  })

  it("mode hemat data: tidak ada prefetch sama sekali", () => {
    prefetchNeighborImages(["a", "b", "c"], 1, true)
    expect(mockedPrefetch).not.toHaveBeenCalled()
  })

  it("kegagalan prefetch tidak melempar", () => {
    mockedPrefetch.mockRejectedValueOnce(new Error("offline"))
    expect(() => prefetchNeighborImages(["a", "b", "c"], 1, false)).not.toThrow()
  })
})
