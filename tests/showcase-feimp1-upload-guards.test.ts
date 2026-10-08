/**
 * FE-IMP-1 item 53/60/60b: guard upload terpusat + kondisi di draft karya.
 *
 * - uploadShowcasePhoto: tolak >5MB SEBELUM upload (pesan jelas).
 * - uploadShowcaseVideo: tolak >100MB / >180 dtk SEBELUM upload.
 * - ShowcaseDraft: field condition ikut autosave + meaningful-check.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  uploadDirect: vi.fn(),
  uploadDirectVideo: vi.fn(),
  secureStore: new Map<string, string>(),
  toFormData: vi.fn().mockImplementation(() => {
    const fd = { append: vi.fn() }
    return Promise.resolve(fd)
  }),
}))

vi.mock("@/lib/api/client", () => ({
  http: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
  seg: (value: string) => encodeURIComponent(value),
}))
// showcase-upload.ts memakai `api` dari `@/lib/api` (index) — namespace
// `upload`-nya berasal dari `@/lib/api/upload`, jadi modul itulah yang di-mock.
vi.mock("@/lib/api/upload", () => ({
  uploadDirect: (...args: unknown[]) => mocks.uploadDirect(...args),
  // NP-006: video memakai jalur chunked/resumable (≤ 8MB tetap single-shot
  // di dalamnya) — satu titik masuk `uploadChunkedVideo`.
  uploadChunkedVideo: (...args: unknown[]) => mocks.uploadDirectVideo(...args),
  cleanupUploads: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@/lib/image-picker", () => ({
  pickedImageToFormData: (...args: unknown[]) => mocks.toFormData(...args),
  // NP-003: resize sebelum guard — identitas (tanpa dimensi = tak di-resize).
  resizePickedImage: (asset: unknown) => Promise.resolve(asset),
}))
vi.mock("@/lib/secure-storage", () => ({
  getSecureItem: (key: string) => Promise.resolve(mocks.secureStore.get(key) ?? null),
  setSecureItem: (key: string, value: string) => {
    mocks.secureStore.set(key, value)
    return Promise.resolve()
  },
  deleteSecureItem: (key: string) => {
    mocks.secureStore.delete(key)
    return Promise.resolve()
  },
  SecureKeys: { showcaseDraft: "showcaseDraft" },
}))

import { uploadShowcasePhoto, uploadShowcaseVideo } from "@/lib/showcase-upload"
import {
  saveShowcaseDraft,
  loadShowcaseDraft,
  clearShowcaseDraft,
  isDraftMeaningful,
} from "@/lib/showcase-draft"
import { isApiError } from "@/lib/api/errors"

const photo = (size: number) => ({
  uri: "file:///a.jpg",
  name: "a.jpg",
  mimeType: "image/jpeg",
  size,
})
const video = (size: number, durationMs?: number) => ({
  uri: "file:///a.mp4",
  name: "a.mp4",
  mimeType: "video/mp4",
  size,
  durationMs,
})

beforeEach(() => {
  mocks.uploadDirect.mockReset()
  mocks.uploadDirectVideo.mockReset()
  mocks.secureStore.clear()
  mocks.toFormData.mockImplementation(() => {
    const fd = { append: vi.fn() }
    return Promise.resolve(fd)
  })
})

describe("item 60: guard foto 5MB terpusat", () => {
  it("foto <=5MB lolos ke upload server", async () => {
    mocks.uploadDirect.mockResolvedValue({ fileKey: "k1" })
    const res = await uploadShowcasePhoto(photo(5 * 1024 * 1024))
    expect(res).toEqual({ kind: "fileKey", fileKey: "k1" })
    expect(mocks.uploadDirect).toHaveBeenCalledTimes(1)
  })

  it("foto >5MB ditolak SEBELUM upload dengan pesan jelas", async () => {
    await expect(uploadShowcasePhoto(photo(5 * 1024 * 1024 + 1))).rejects.toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
    })
    expect(mocks.uploadDirect).not.toHaveBeenCalled()
    try {
      await uploadShowcasePhoto(photo(6 * 1024 * 1024))
      expect.unreachable()
    } catch (err) {
      expect(isApiError(err)).toBe(true)
      expect((err as Error).message).toContain("5 MB")
    }
  })

  it("size=0 (platform tak melaporkan) fail-open ke validasi server", async () => {
    mocks.uploadDirect.mockResolvedValue({ fileKey: "k1" })
    await uploadShowcasePhoto(photo(0))
    expect(mocks.uploadDirect).toHaveBeenCalledTimes(1)
  })
})

describe("item 60b: guard video 100MB / 180 dtk", () => {
  it("video dalam batas lolos", async () => {
    mocks.uploadDirectVideo.mockResolvedValue({ fileKey: "v1", thumbnailFileKey: "t1" })
    const res = await uploadShowcaseVideo(video(100 * 1024 * 1024, 180 * 1000))
    expect(res.fileKey).toBe("v1")
    expect(mocks.uploadDirectVideo).toHaveBeenCalledTimes(1)
  })

  it("video >100MB ditolak SEBELUM upload", async () => {
    await expect(uploadShowcaseVideo(video(100 * 1024 * 1024 + 1, 10_000))).rejects.toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
    })
    expect(mocks.uploadDirectVideo).not.toHaveBeenCalled()
  })

  it("video >180 dtk ditolak SEBELUM upload", async () => {
    try {
      await uploadShowcaseVideo(video(10 * 1024 * 1024, 181 * 1000))
      expect.unreachable()
    } catch (err) {
      expect(isApiError(err)).toBe(true)
      expect((err as { code?: string }).code).toBe("VALIDATION")
      expect((err as Error).message).toContain("3 menit")
    }
    expect(mocks.uploadDirectVideo).not.toHaveBeenCalled()
  })

  it("durationMs undefined (tak dilaporkan) fail-open ke validasi server", async () => {
    mocks.uploadDirectVideo.mockResolvedValue({ fileKey: "v1", thumbnailFileKey: "t1" })
    await uploadShowcaseVideo(video(10 * 1024 * 1024))
    expect(mocks.uploadDirectVideo).toHaveBeenCalledTimes(1)
  })
})

describe("item 53: kondisi di draft karya", () => {
  it("condition ikut tersimpan dan dimuat kembali", async () => {
    await saveShowcaseDraft({
      title: "Tas",
      description: "",
      category: "",
      priceMin: null,
      priceMax: null,
      isPublic: true,
      condition: "BEKAS",
    })
    const loaded = await loadShowcaseDraft()
    expect(loaded?.condition).toBe("BEKAS")
  })

  it("draft lama tanpa condition → '' (fail-closed)", async () => {
    mocks.secureStore.set(
      "showcaseDraft",
      JSON.stringify({ title: "Tas", savedAt: new Date().toISOString() }),
    )
    const loaded = await loadShowcaseDraft()
    expect(loaded?.condition).toBe("")
  })

  it("condition saja sudah membuat draft meaningful", () => {
    expect(
      isDraftMeaningful({
        title: "",
        description: "",
        category: "",
        priceMin: null,
        priceMax: null,
        isPublic: true,
        condition: "BARU",
        savedAt: new Date().toISOString(),
      }),
    ).toBe(true)
  })

  it("clear menghapus draft", async () => {
    await saveShowcaseDraft({
      title: "Tas",
      description: "",
      category: "",
      priceMin: null,
      priceMax: null,
      isPublic: true,
      condition: "",
    })
    await clearShowcaseDraft()
    expect(await loadShowcaseDraft()).toBeNull()
  })
})
