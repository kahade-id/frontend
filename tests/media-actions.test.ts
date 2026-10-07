/**
 * Aksi berkas media viewer — kontrak murni `lib/media-actions.ts`.
 *
 * Mengunci: sanitasi nama berkas, tebakan nama dari URL (query signature
 * tidak ikut menjadi nama), dan pelengkapan ekstensi dari MIME.
 * (Fungsi native — unduh/galeri/share — tidak diuji di Node.)
 */
import { describe, expect, it } from "vitest"

import { ensureFileExtension, inferFileName, sanitizeFileName } from "@/lib/media-actions"

describe("sanitizeFileName", () => {
  it("membuang pemisah path", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd")
    expect(sanitizeFileName("a\\b\\foto.jpg")).toBe("foto.jpg")
  })
  it("fallback bila kosong", () => {
    expect(sanitizeFileName("   ", "foto.jpg")).toBe("foto.jpg")
    expect(sanitizeFileName("")).toBe("berkas")
  })
  it("membatasi panjang 120 karakter", () => {
    expect(sanitizeFileName(`${"a".repeat(200)}.jpg`).length).toBeLessThanOrEqual(120)
  })
})

describe("inferFileName", () => {
  it("fileName eksplisit menang", () => {
    expect(inferFileName("https://cdn.id/abc123", "Struk Belanja.pdf")).toBe("Struk Belanja.pdf")
  })
  it("tebak dari path URL tanpa query signature", () => {
    expect(inferFileName("https://cdn.id/foto.jpg?X-Amz-Signature=abc&x=1")).toBe("foto.jpg")
  })
  it("fallback bila path tanpa nama berkas", () => {
    expect(inferFileName("https://cdn.id/", null, "berkas")).toBe("berkas")
  })
})

describe("ensureFileExtension", () => {
  it("tidak mengubah nama yang sudah berekstensi", () => {
    expect(ensureFileExtension("foto.jpg", "image/png")).toBe("foto.jpg")
  })
  it("menambah ekstensi dari MIME", () => {
    expect(ensureFileExtension("foto", "image/jpeg")).toBe("foto.jpg")
    expect(ensureFileExtension("video", "video/mp4")).toBe("video.mp4")
    expect(ensureFileExtension("dok", "application/pdf")).toBe("dok.pdf")
  })
  it("diam bila MIME tak dikenal", () => {
    expect(ensureFileExtension("arsip", "application/x-aneh")).toBe("arsip")
    expect(ensureFileExtension("arsip", null)).toBe("arsip")
  })
})
