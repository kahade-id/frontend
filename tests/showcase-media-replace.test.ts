import { describe, expect, it } from "vitest"
import { buildMediaReplacePayload } from "@/lib/showcase-media-replace"
import type { ShowcaseImage } from "@/lib/api/users"

const img = (over: Partial<ShowcaseImage> = {}): ShowcaseImage => ({
  id: "img-1",
  imageUrl: "https://x/1.jpg",
  fileKey: "uploads/a.jpg",
  sortOrder: 0,
  kind: "image",
  ...over,
})

describe("buildMediaReplacePayload (item 15)", () => {
  it("membawa fileKey owner-only untuk gambar", () => {
    expect(buildMediaReplacePayload([img(), img({ id: "img-2", fileKey: "uploads/b.jpg" })])).toEqual([
      { fileKey: "uploads/a.jpg", kind: "image" },
      { fileKey: "uploads/b.jpg", kind: "image" },
    ])
  })

  it("null bila ada gambar tanpa fileKey (jangan sentuh media)", () => {
    expect(buildMediaReplacePayload([img({ fileKey: undefined })])).toBeNull()
  })

  it("null untuk item bervideo (butuh thumbnailFileKey yang tidak ada di owner response)", () => {
    expect(buildMediaReplacePayload([img({ kind: "video" })])).toBeNull()
  })

  it("null untuk spin360 tanpa groupKey/groupOrder", () => {
    expect(buildMediaReplacePayload([img({ kind: "spin360" })])).toBeNull()
    expect(
      buildMediaReplacePayload([img({ kind: "spin360", groupKey: "g1", groupOrder: 0 })]),
    ).toEqual([{ fileKey: "uploads/a.jpg", kind: "spin360", groupKey: "g1", groupOrder: 0 }])
  })

  it("null untuk daftar kosong", () => {
    expect(buildMediaReplacePayload([])).toBeNull()
  })
})
