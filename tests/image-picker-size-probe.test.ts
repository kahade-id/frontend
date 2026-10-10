/**
 * CR-09 (audit etalase 2026-10-10): ukuran video dibaca dari metadata
 * sistem berkas — TIDAK memuat seluruh berkas ke memori (`fetch(uri).blob()`).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { PickedImage } from "@/lib/image-picker"
import { probePickedFileSize } from "@/lib/image-picker"

const fileInfo = vi.fn()
const getInfoAsync = vi.fn()

vi.mock("expo-image-picker", () => ({}))
// Stub vitest memasang Platform.OS = "web" (jalur blob: URL sudah di memori);
// yang diuji di sini adalah jalur native — metadata sistem berkas.
vi.mock("react-native", () => ({
  Platform: { OS: "android", select: (o: Record<string, unknown>) => o.android ?? o.default },
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
vi.mock("expo-file-system/legacy", () => ({
  getInfoAsync: (...args: unknown[]) => getInfoAsync(...args),
}))

const video: PickedImage = { uri: "file:///video.mp4", name: "video.mp4", mimeType: "video/mp4", size: 0 }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("fetch tidak boleh dipanggil") }))
})

describe("probePickedFileSize", () => {
  it("size dari picker dipakai langsung tanpa menyentuh sistem berkas", async () => {
    await expect(probePickedFileSize({ ...video, size: 123 })).resolves.toBe(123)
    expect(fileInfo).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it("size 0 → File.info() (metadata), bukan membaca byte", async () => {
    fileInfo.mockReturnValue({ exists: true, size: 90_000_000 })
    await expect(probePickedFileSize(video)).resolves.toBe(90_000_000)
    expect(fileInfo).toHaveBeenCalledWith("file:///video.mp4")
    expect(fetch).not.toHaveBeenCalled()
  })

  it("File API gagal (content://) → legacy getInfoAsync; tetap tanpa fetch", async () => {
    fileInfo.mockImplementation(() => { throw new Error("unsupported scheme") })
    getInfoAsync.mockResolvedValue({ exists: true, size: 4_200 })
    await expect(probePickedFileSize({ ...video, uri: "content://media/1" })).resolves.toBe(4_200)
    expect(getInfoAsync).toHaveBeenCalledWith("content://media/1")
    expect(fetch).not.toHaveBeenCalled()
  })

  it("keduanya gagal → 0 (pemanggil menolak dengan pesan jelas)", async () => {
    fileInfo.mockReturnValue({ exists: false, size: undefined })
    getInfoAsync.mockRejectedValue(new Error("nope"))
    await expect(probePickedFileSize(video)).resolves.toBe(0)
  })
})
