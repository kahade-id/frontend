/**
 * Guard klien upload foto story (audit 2026-10-09, butir C2).
 *
 * - validateStoryMediaAsset: tolak >10 MB (batas server, integrasi_backend.md
 *   §4; 413 STORY_MEDIA_TOO_LARGE) SEBELUM upload — pesan menyebut batasnya.
 * - `size` absen/0 = platform tak melaporkan → fail-open ke validasi server.
 */
import { describe, expect, it } from "vitest"

import { STORY_MEDIA_MAX_BYTES, validateStoryMediaAsset } from "@/lib/story-media-limits"
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

describe("STORY_MEDIA_MAX_BYTES", () => {
  it("= 10 MB (selaras batas server integrasi_backend.md §4)", () => {
    expect(STORY_MEDIA_MAX_BYTES).toBe(10 * MB)
  })
})

describe("validateStoryMediaAsset", () => {
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
})
