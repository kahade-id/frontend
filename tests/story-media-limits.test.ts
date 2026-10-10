/**
 * Guard klien media story (audit 2026-10-09 C2 + video 2026-10-10).
 *
 * - validateStoryMediaAsset: foto >10 MB / video >50 MB / video >60 dtk /
 *   format di luar kontrak ditolak SEBELUM upload — pesan menyebut batasnya.
 * - `size`/`durationMs` absen/0 = platform tak melaporkan → fail-open ke
 *   validasi server.
 * - storyImageNeedsReencode: HEIC/HEIF (iPhone) wajib dikonversi ke JPEG
 *   (server 415 STORY_MEDIA_TYPE) — `resizePickedImage` saja tidak cukup.
 */
import { describe, expect, it } from "vitest"

import {
  STORY_MEDIA_MAX_BYTES,
  STORY_VIDEO_MAX_BYTES,
  STORY_VIDEO_MAX_DURATION_MS,
  normalizeStoryMime,
  storyImageNeedsReencode,
  storyMediaKindOf,
  validateStoryMediaAsset,
} from "@/lib/story-media-limits"
import type { PickedImage } from "@/lib/image-picker"

const MB = 1024 * 1024

function asset(over: Partial<PickedImage> = {}): PickedImage {
  return {
    uri: "file:///story.jpg",
    name: "story.jpg",
    mimeType: "image/jpeg",
    size: 2 * MB,
    ...over,
  }
}

function video(over: Partial<PickedImage> = {}): PickedImage {
  return asset({ uri: "file:///clip.mp4", name: "clip.mp4", mimeType: "video/mp4", size: 12 * MB, durationMs: 15_000, ...over })
}

describe("batas (selaras server)", () => {
  it("foto 10 MB, video 50 MB / 60 detik", () => {
    expect(STORY_MEDIA_MAX_BYTES).toBe(10 * MB)
    expect(STORY_VIDEO_MAX_BYTES).toBe(50 * MB)
    expect(STORY_VIDEO_MAX_DURATION_MS).toBe(60_000)
  })
})

describe("storyMediaKindOf", () => {
  it("mengenali foto, video, dan format di luar kontrak", () => {
    expect(storyMediaKindOf(asset())).toBe("image")
    expect(storyMediaKindOf(asset({ mimeType: "image/heic", name: "IMG_1.HEIC" }))).toBe("image")
    expect(storyMediaKindOf(video())).toBe("video")
    expect(storyMediaKindOf(video({ mimeType: "video/quicktime", name: "a.mov" }))).toBe("video")
    expect(storyMediaKindOf(asset({ mimeType: "image/gif", name: "a.gif" }))).toBe("unsupported")
    expect(storyMediaKindOf(asset({ mimeType: "video/x-msvideo", name: "a.avi" }))).toBe("unsupported")
  })

  it("MIME kosong (Android lama) → tebak dari ekstensi; tak dikenal → foto (fail-open)", () => {
    expect(storyMediaKindOf(asset({ mimeType: "", name: "clip.MP4" }))).toBe("video")
    expect(storyMediaKindOf(asset({ mimeType: "", name: "foto.png" }))).toBe("image")
    expect(storyMediaKindOf(asset({ mimeType: "", name: "tanpa-ekstensi" }))).toBe("image")
  })
})

describe("validateStoryMediaAsset — foto", () => {
  it("foto ≤ 10 MB → lolos", () => {
    expect(validateStoryMediaAsset(asset({ size: 10 * MB }))).toBeNull()
    expect(validateStoryMediaAsset(asset({ size: 1 * MB }))).toBeNull()
  })

  it("foto > 10 MB → ditolak dengan pesan menyebut batas 10 MB", () => {
    const err = validateStoryMediaAsset(asset({ size: 10 * MB + 1 }))
    expect(err).not.toBeNull()
    expect(err).toContain("10 MB")
  })

  it("kamera 4000 px mentah (~12 MB) → ditolak dini (regresi C2)", () => {
    expect(validateStoryMediaAsset(asset({ size: 12 * MB }))).toContain("10 MB")
  })

  it("size 0 / undefined (platform tak melaporkan) → fail-open", () => {
    expect(validateStoryMediaAsset(asset({ size: 0 }))).toBeNull()
    expect(validateStoryMediaAsset(asset({ size: undefined }))).toBeNull()
  })

  it("format di luar kontrak → pesan format", () => {
    expect(validateStoryMediaAsset(asset({ mimeType: "image/gif", name: "a.gif" }))).toContain("Format tidak didukung")
  })
})

describe("validateStoryMediaAsset — video", () => {
  it("video ≤ 50 MB & ≤ 60 dtk → lolos", () => {
    expect(validateStoryMediaAsset(video())).toBeNull()
    expect(validateStoryMediaAsset(video({ size: 50 * MB, durationMs: 60_000 }))).toBeNull()
  })

  it("video > 50 MB → pesan menyebut 50 MB", () => {
    expect(validateStoryMediaAsset(video({ size: 50 * MB + 1 }))).toContain("50 MB")
  })

  it("video > 60 detik → pesan menyebut 60 detik, walau ukurannya kecil", () => {
    expect(validateStoryMediaAsset(video({ size: 3 * MB, durationMs: 61_000 }))).toContain("60 detik")
  })

  it("durasi tak dilaporkan → fail-open (server yang memutuskan)", () => {
    expect(validateStoryMediaAsset(video({ durationMs: undefined }))).toBeNull()
  })
})

describe("normalizeStoryMime", () => {
  it("image/jpg (picker Android) → image/jpeg; lainnya apa adanya", () => {
    expect(normalizeStoryMime("image/jpg")).toBe("image/jpeg")
    expect(normalizeStoryMime("IMAGE/JPG")).toBe("image/jpeg")
    expect(normalizeStoryMime("image/png")).toBe("image/png")
    expect(normalizeStoryMime("video/quicktime")).toBe("video/quicktime")
    expect(normalizeStoryMime("")).toBe("")
  })
})

describe("storyImageNeedsReencode", () => {
  it("HEIC/HEIF → true; JPEG/PNG/WEBP → false", () => {
    expect(storyImageNeedsReencode(asset({ mimeType: "image/heic" }))).toBe(true)
    expect(storyImageNeedsReencode(asset({ mimeType: "", name: "IMG_2.heif" }))).toBe(true)
    expect(storyImageNeedsReencode(asset())).toBe(false)
    expect(storyImageNeedsReencode(asset({ mimeType: "image/webp" }))).toBe(false)
  })
})
