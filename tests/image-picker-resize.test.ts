/**
 * PERF-FIX (NP-003): resize foto klien sebelum upload (maks 1920px, JPEG 0.8).
 * expo-image-manipulator & expo-file-system di-mock — yang diuji adalah
 * wiring-nya: kapan resize dipicu, parameter apa yang dipakai, dan fail-open.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { PickedImage } from "@/lib/image-picker"
import { resizePickedImage, SHOWCASE_PHOTO_MAX_DIMENSION } from "@/lib/image-picker"

const manipulateAsync = vi.fn()
const fileInfo = vi.fn()

// image-picker.ts mengimpor expo-image-picker secara statis — modul aslinya
// menarik expo-modules-core (butuh global native). Test ini tidak memanggil
// fungsi picker, jadi mock kosong cukup agar impor tidak melempar.
vi.mock("expo-image-picker", () => ({}))

vi.mock("expo-image-manipulator", () => ({
  manipulateAsync: (...args: unknown[]) => manipulateAsync(...args),
  SaveFormat: { JPEG: "jpeg", PNG: "png" },
}))

vi.mock("expo-file-system", () => ({
  File: class {
    uri: string
    constructor(uri: string) {
      this.uri = uri
    }
    info() {
      return fileInfo(this.uri)
    }
  },
}))

const bigPhoto: PickedImage = {
  uri: "file:///photo-big.jpg",
  name: "photo-big.jpg",
  mimeType: "image/jpeg",
  size: 8_000_000,
  width: 4000,
  height: 3000,
}

const smallPhoto: PickedImage = {
  uri: "file:///photo-small.jpg",
  name: "photo-small.jpg",
  mimeType: "image/jpeg",
  size: 400_000,
  width: 800,
  height: 600,
}

beforeEach(() => {
  vi.clearAllMocks()
  manipulateAsync.mockResolvedValue({
    uri: "file:///cache/resized.jpg",
    width: 1920,
    height: 1440,
  })
  fileInfo.mockReturnValue({ exists: true, size: 850_000 })
})

describe("resizePickedImage (NP-003)", () => {
  it("mengecilkan foto besar ke 1920px + JPEG 0.8", async () => {
    const result = await resizePickedImage(bigPhoto)

    expect(manipulateAsync).toHaveBeenCalledWith(
      bigPhoto.uri,
      [{ resize: { width: SHOWCASE_PHOTO_MAX_DIMENSION } }],
      expect.objectContaining({ compress: 0.8, format: "jpeg" }),
    )
    expect(result.uri).toBe("file:///cache/resized.jpg")
    expect(result.name).toBe("photo-big.jpg")
    expect(result.mimeType).toBe("image/jpeg")
    expect(result.width).toBe(1920)
    expect(result.height).toBe(1440)
    // Ukuran HASIL resize — dipakai guard 5MB di uploadShowcasePhoto.
    expect(result.size).toBe(850_000)
  })

  it("mempertahankan aspect ratio (hanya width yang diberikan)", async () => {
    const portrait: PickedImage = { ...bigPhoto, width: 3000, height: 4000 }
    await resizePickedImage(portrait)
    expect(manipulateAsync).toHaveBeenCalledWith(
      portrait.uri,
      [{ resize: { width: 1920 } }],
      expect.anything(),
    )
  })

  it("foto yang sudah ≤1920px dikembalikan apa adanya (tanpa manipulator)", async () => {
    const result = await resizePickedImage(smallPhoto)
    expect(manipulateAsync).not.toHaveBeenCalled()
    expect(result).toBe(smallPhoto)
  })

  it("dimensi tak diketahui → dikembalikan apa adanya (fail-open)", async () => {
    const noDims: PickedImage = { ...bigPhoto, width: undefined, height: undefined }
    const result = await resizePickedImage(noDims)
    expect(manipulateAsync).not.toHaveBeenCalled()
    expect(result).toBe(noDims)
  })

  it("manipulator gagal → asset asli dikembalikan (fail-open)", async () => {
    manipulateAsync.mockRejectedValueOnce(new Error("native module missing"))
    const result = await resizePickedImage(bigPhoto)
    expect(result).toBe(bigPhoto)
  })

  it("stat ukuran gagal → size 0 (fail-open ke validasi server)", async () => {
    fileInfo.mockImplementationOnce(() => {
      throw new Error("stat failed")
    })
    const result = await resizePickedImage(bigPhoto)
    expect(result.size).toBe(0)
    expect(result.uri).toBe("file:///cache/resized.jpg")
  })

  it("batas custom dihormati", async () => {
    await resizePickedImage(bigPhoto, 1024)
    expect(manipulateAsync).toHaveBeenCalledWith(
      bigPhoto.uri,
      [{ resize: { width: 1024 } }],
      expect.anything(),
    )
  })
})
