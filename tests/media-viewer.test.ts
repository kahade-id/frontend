/**
 * Halaman media terpusat — kontrak `lib/media-viewer.ts`.
 *
 * Mengunci:
 *  - `classifyMedia`: MIME → tipe viewer (tanpa strip query signed URL).
 *  - `formatMediaClock`: jam pemutar M:SS / H:MM:SS, NaN-safe.
 *  - `mediaViewerHref` + `parseMediaViewerParams`: round-trip param rute,
 *    fail-closed dengan alasan akurat.
 *  - `isReadableTextFile` / `isOfficeDocument` / `isPdfMedia`: routing file viewer.
 */
import { describe, expect, it } from "vitest"

import {
  asMediaViewerType,
  classifyMedia,
  formatMediaClock,
  isOfficeDocument,
  isPdfMedia,
  isReadableTextFile,
  mediaViewerHref,
  parseMediaViewerParams,
} from "@/lib/media-viewer"

describe("classifyMedia", () => {
  it("image/* → photo", () => {
    expect(classifyMedia("image/jpeg")).toBe("photo")
    expect(classifyMedia("image/heic")).toBe("photo")
  })
  it("video/* → video", () => {
    expect(classifyMedia("video/mp4")).toBe("video")
    expect(classifyMedia("video/quicktime")).toBe("video")
  })
  it("audio/* → audio", () => {
    expect(classifyMedia("audio/mp4")).toBe("audio")
    expect(classifyMedia("audio/mpeg")).toBe("audio")
  })
  it("dokumen & tak dikenal → file", () => {
    expect(classifyMedia("application/pdf")).toBe("file")
    expect(classifyMedia("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("file")
    expect(classifyMedia("application/zip")).toBe("file")
    expect(classifyMedia(null)).toBe("file")
    expect(classifyMedia(undefined)).toBe("file")
    expect(classifyMedia("")).toBe("file")
  })
  it("fallback ekstensi bila MIME kosong", () => {
    expect(classifyMedia(null, "foto.JPG")).toBe("photo")
    expect(classifyMedia("", "klip.mp4")).toBe("video")
    expect(classifyMedia(null, "vn-123.m4a")).toBe("audio")
    expect(classifyMedia(null, "dokumen.pdf")).toBe("file")
    expect(classifyMedia(null, "tanpa-ekstensi")).toBe("file")
  })
})

describe("formatMediaClock", () => {
  it("detik → M:SS", () => {
    expect(formatMediaClock(0)).toBe("0:00")
    expect(formatMediaClock(7)).toBe("0:07")
    expect(formatMediaClock(65)).toBe("1:05")
    expect(formatMediaClock(754)).toBe("12:34")
  })
  it("≥1 jam → H:MM:SS", () => {
    expect(formatMediaClock(3723)).toBe("1:02:03")
  })
  it("NaN/negatif/null → 0:00 (jangan NaN:NaN)", () => {
    expect(formatMediaClock(NaN)).toBe("0:00")
    expect(formatMediaClock(-5)).toBe("0:00")
    expect(formatMediaClock(null)).toBe("0:00")
    expect(formatMediaClock(undefined)).toBe("0:00")
    expect(formatMediaClock(Infinity)).toBe("0:00")
  })
  it("pecahan detik dibulatkan ke bawah", () => {
    expect(formatMediaClock(61.9)).toBe("1:01")
  })
})

describe("asMediaViewerType", () => {
  it("menerima 5 tipe valid", () => {
    for (const t of ["photo", "video", "file", "audio", "location"]) {
      expect(asMediaViewerType(t)).toBe(t)
    }
  })
  it("menolak nilai asing", () => {
    expect(asMediaViewerType("IMAGE")).toBeNull()
    expect(asMediaViewerType("")).toBeNull()
    expect(asMediaViewerType(null)).toBeNull()
    expect(asMediaViewerType(42)).toBeNull()
  })
})

describe("mediaViewerHref + parseMediaViewerParams", () => {
  it("round-trip foto tunggal", () => {
    const href = mediaViewerHref({
      type: "photo",
      url: "https://cdn.example/foto.jpg?X-Amz-Signature=abc&x=1",
      title: "Foto",
      mimeType: "image/jpeg",
      fileName: "foto.jpg",
      fileSize: 12345,
      sentAt: "2026-10-07T10:00:00.000Z",
    }) as unknown as { params: Record<string, string> }
    const parsed = parseMediaViewerParams(href.params)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.type).toBe("photo")
    // Query signed URL dipertahankan verbatim.
    expect(parsed.value.url).toBe("https://cdn.example/foto.jpg?X-Amz-Signature=abc&x=1")
    expect(parsed.value.fileSize).toBe(12345)
    expect(parsed.value.sentAt).toBe("2026-10-07T10:00:00.000Z")
  })

  it("round-trip album + index", () => {
    const href = mediaViewerHref({
      type: "photo",
      url: "https://cdn.example/a.jpg",
      items: [
        { url: "https://cdn.example/a.jpg", fileName: "a.jpg" },
        { url: "https://cdn.example/b.jpg", fileName: "b.jpg" },
      ],
      index: 1,
    }) as unknown as { params: Record<string, string> }
    const parsed = parseMediaViewerParams(href.params)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.items).toHaveLength(2)
    expect(parsed.value.index).toBe(1)
  })

  it("round-trip video + varian kualitas", () => {
    const href = mediaViewerHref({
      type: "video",
      url: "https://cdn.example/v-720.mp4",
      durationSeconds: 95,
      variants: [
        { label: "720p", url: "https://cdn.example/v-720.mp4" },
        { label: "480p", url: "https://cdn.example/v-480.mp4" },
      ],
    }) as unknown as { params: Record<string, string> }
    const parsed = parseMediaViewerParams(href.params)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.variants).toHaveLength(2)
    expect(parsed.value.durationSeconds).toBe(95)
  })

  it("round-trip lokasi", () => {
    const href = mediaViewerHref({ type: "location", lat: -6.2, lng: 106.8, label: "Kantor" }) as unknown as {
      params: Record<string, string>
    }
    const parsed = parseMediaViewerParams(href.params)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.lat).toBeCloseTo(-6.2)
    expect(parsed.value.lng).toBeCloseTo(106.8)
  })

  it("menolak tipe tak dikenal dengan alasan akurat", () => {
    const parsed = parseMediaViewerParams({ type: "IMAGE", url: "https://x/y.jpg" })
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.reason).toContain("jenis konten")
  })

  it("menolak URL hilang dengan alasan akurat", () => {
    const parsed = parseMediaViewerParams({ type: "photo" })
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.reason).toContain("URL berkas")
  })

  it("menolak skema berbahaya (javascript:)", () => {
    const parsed = parseMediaViewerParams({ type: "photo", url: "javascript:alert(1)" })
    expect(parsed.ok).toBe(false)
  })

  it("menolak koordinat invalid", () => {
    expect(parseMediaViewerParams({ type: "location", lat: "999", lng: "1" }).ok).toBe(false)
    expect(parseMediaViewerParams({ type: "location" }).ok).toBe(false)
  })

  it("items JSON rusak → fallback ke url tunggal (jangan gagal total)", () => {
    const parsed = parseMediaViewerParams({
      type: "photo",
      url: "https://cdn.example/a.jpg",
      items: "{rusak",
    })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.url).toBe("https://cdn.example/a.jpg")
    expect(parsed.value.items).toBeUndefined()
  })
})

describe("routing file viewer", () => {
  it("isPdfMedia", () => {
    expect(isPdfMedia("application/pdf")).toBe(true)
    expect(isPdfMedia(null, "dok.PDF")).toBe(true)
    expect(isPdfMedia("image/png", "a.png")).toBe(false)
  })
  it("isReadableTextFile", () => {
    expect(isReadableTextFile("text/plain")).toBe(true)
    expect(isReadableTextFile("text/markdown")).toBe(true)
    expect(isReadableTextFile("application/json")).toBe(true)
    expect(isReadableTextFile(null, "catatan.md")).toBe(true)
    expect(isReadableTextFile(null, "data.csv")).toBe(true)
    expect(isReadableTextFile("application/pdf", "a.pdf")).toBe(false)
  })
  it("isOfficeDocument", () => {
    expect(
      isOfficeDocument("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    ).toBe(true)
    expect(isOfficeDocument(null, "laporan.xlsx")).toBe(true)
    expect(isOfficeDocument(null, "slide.pptx")).toBe(true)
    expect(isOfficeDocument("application/pdf", "a.pdf")).toBe(false)
  })
})
