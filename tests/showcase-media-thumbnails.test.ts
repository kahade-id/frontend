/**
 * PERF-FIX (NP-001/LR-002): `showcaseMedia` memilih varian thumbnail untuk
 * feed (hemat kuota) dan full-res untuk viewer/detail.
 */
import { describe, expect, it } from "vitest"

import type { ShowcaseSocialItem } from "@/lib/api/showcase"
import { showcaseMedia } from "@/lib/showcase-social"

function itemWithImages(images: ShowcaseSocialItem["images"]): ShowcaseSocialItem {
  return {
    id: "item-1",
    title: "Tas",
    images,
    likeCount: 0,
    commentCount: 0,
    viewCount: 0,
    saveCount: 0,
    createdAt: "2026-09-28T00:00:00Z",
    updatedAt: "2026-09-28T00:00:00Z",
    author: { userId: "u1", username: "penjual", fullName: null },
  } as ShowcaseSocialItem
}

const FULL = "https://cdn.test/full.jpg"
const THUMB = "https://cdn.test/thumb.jpg"

describe("showcaseMedia — pemilihan thumbnail (NP-001/LR-002)", () => {
  it("feed (default): slide gambar memakai thumbnailUrl bila ada", () => {
    const item = itemWithImages([
      { id: "m1", kind: "image", imageUrl: FULL, thumbnailUrl: THUMB } as ShowcaseSocialItem["images"][number],
    ])
    const [slide] = showcaseMedia(item)
    expect(slide.url).toBe(THUMB)
    expect(slide.fullUrl).toBe(FULL)
  })

  it("feed: fallback ke imageUrl penuh bila thumbnailUrl kosong", () => {
    const item = itemWithImages([
      { id: "m1", kind: "image", imageUrl: FULL } as ShowcaseSocialItem["images"][number],
    ])
    const [slide] = showcaseMedia(item)
    expect(slide.url).toBe(FULL)
    expect(slide.fullUrl).toBe(FULL)
  })

  it("viewer/detail ({ thumbnails: false }): selalu imageUrl penuh", () => {
    const item = itemWithImages([
      { id: "m1", kind: "image", imageUrl: FULL, thumbnailUrl: THUMB } as ShowcaseSocialItem["images"][number],
    ])
    const [slide] = showcaseMedia(item, { thumbnails: false })
    expect(slide.url).toBe(FULL)
    expect(slide.fullUrl).toBe(FULL)
  })

  it("cache dipisah per mode — hasil feed & viewer tidak tertukar", () => {
    const item = itemWithImages([
      { id: "m1", kind: "image", imageUrl: FULL, thumbnailUrl: THUMB } as ShowcaseSocialItem["images"][number],
    ])
    const feed = showcaseMedia(item)
    const viewer = showcaseMedia(item, { thumbnails: false })
    const feedAgain = showcaseMedia(item)
    expect(feed[0].url).toBe(THUMB)
    expect(viewer[0].url).toBe(FULL)
    expect(feedAgain).toBe(feed) // referensi cache stabil
    expect(feedAgain).not.toBe(viewer)
  })

  it("video tidak terpengaruh mode thumbnail (url = berkas video)", () => {
    const item = itemWithImages([
      {
        id: "v1",
        kind: "video",
        imageUrl: "https://cdn.test/video.mp4",
        thumbnailUrl: "https://cdn.test/poster.jpg",
      } as ShowcaseSocialItem["images"][number],
    ])
    const [feed] = showcaseMedia(item)
    const [viewer] = showcaseMedia(item, { thumbnails: false })
    expect(feed.url).toBe("https://cdn.test/video.mp4")
    expect(feed.posterUrl).toBe("https://cdn.test/poster.jpg")
    expect(viewer.url).toBe(feed.url)
  })
})
