/**
 * Aksi berkas media viewer — kontrak murni `lib/media-actions.ts`.
 *
 * Mengunci: sanitasi nama berkas, tebakan nama dari URL (query signature
 * tidak ikut menjadi nama), dan pelengkapan ekstensi dari MIME.
 * (Fungsi native — unduh/galeri/share — tidak diuji di Node.)
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
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

// ── Audit Pesan 2026-10-10 (#4): unduhan memeriksa status HTTP ──────────
import { assertDownloadStatus, MediaActionError } from "@/lib/media-actions"

describe("assertDownloadStatus", () => {
  const reasonOf = (status: number) => {
    try {
      assertDownloadStatus(status)
      return "ok"
    } catch (err) {
      return err instanceof MediaActionError ? err.reason : "bukan-MediaActionError"
    }
  }
  it("2xx dan status tidak dilaporkan → lolos", () => {
    expect(() => assertDownloadStatus(200)).not.toThrow()
    expect(() => assertDownloadStatus(206)).not.toThrow()
    expect(() => assertDownloadStatus(undefined)).not.toThrow()
  })
  it("404 → not-found dengan pesan jujur", () => {
    expect(reasonOf(404)).toBe("not-found")
    expect(() => assertDownloadStatus(404)).toThrow(/tidak ditemukan/)
  })
  it("401/403/410 → tautan kedaluwarsa (arahan buka ulang dari chat)", () => {
    for (const s of [401, 403, 410]) {
      expect(reasonOf(s)).toBe("network")
      expect(() => assertDownloadStatus(s)).toThrow(/kedaluwarsa/)
    }
  })
  it("5xx → server bermasalah; 4xx lain → menyebut kode status", () => {
    expect(() => assertDownloadStatus(503)).toThrow(/Server sedang bermasalah \(503\)/)
    expect(() => assertDownloadStatus(418)).toThrow(/server menjawab 418/)
  })
  it("kedua jalur unduhan (resumable & langsung) memanggil pemeriksa yang sama", () => {
    const src = readFileSync(resolve(__dirname, "..", "lib/media-actions.ts"), "utf8")
    expect(src.match(/assertDownloadStatus\(result\.status\)/g)?.length).toBe(2)
  })
})
