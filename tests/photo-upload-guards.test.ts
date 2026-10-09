/**
 * Guard klien upload foto profil (UPF-03, UPF-06) + timeout adaptif (UPF-04).
 *
 * - validateAvatarAsset: tolak >2 MB / MIME tak didukung (pesan Indonesia).
 * - validateHeaderAsset: tolak >5 MB / MIME tak didukung (pesan Indonesia).
 * - UPF-06: MIME yang DILAPORKAN platform dan tidak didukung → tolak langsung,
 *   ekstensi tidak boleh mengesampingkannya.
 * - photoUploadTimeoutMs: delegasi rumus terpusat uploadTimeoutMs(bytes,
 *   "photo") — 60 dtk basis + waktu transfer @100 KB/s, cap 5 menit
 *   (audit 2026-10-09 B6: rumus lama 20 dtk basis membunuh upload avatar di
 *   4G lambat pada detik ~23).
 */
import { describe, expect, it } from "vitest"

import {
  AVATAR_COPY,
  HEADER_COPY,
  photoUploadTimeoutMs,
  validateAvatarAsset,
  validateHeaderAsset,
} from "@/lib/photo-upload-guards"
import type { PickedImage } from "@/lib/image-picker"

const MB = 1024 * 1024

function asset(over: Partial<PickedImage> = {}): PickedImage {
  return {
    uri: "file:///a.jpg",
    name: "a.jpg",
    mimeType: "image/jpeg",
    size: 500 * 1024,
    ...over,
  }
}

describe("validateAvatarAsset", () => {
  it("aset valid → null", () => {
    expect(validateAvatarAsset(asset())).toBeNull()
  })

  it("UPF-06: mime HEIC dilaporkan + ekstensi .jpg → TOLAK (jangan lolos ke server)", () => {
    expect(validateAvatarAsset(asset({ mimeType: "image/heic", name: "foto.jpg" }))).toBe(AVATAR_COPY)
  })

  it("mime tak dilaporkan + ekstensi didukung → lolos (fail-open)", () => {
    expect(validateAvatarAsset(asset({ mimeType: "", name: "foto.jpg" }))).toBeNull()
  })

  it("mime tak dilaporkan + ekstensi tak didukung → tolak", () => {
    expect(validateAvatarAsset(asset({ mimeType: "", name: "dokumen.pdf" }))).toBe(AVATAR_COPY)
  })

  it("mime didukung tapi ekstensi aneh → lolos (mime yang menentukan)", () => {
    expect(validateAvatarAsset(asset({ mimeType: "image/png", name: "foto.tidakjelas" }))).toBeNull()
  })

  it(">2 MB → tolak dengan pesan Indonesia", () => {
    expect(validateAvatarAsset(asset({ size: 2 * MB + 1 }))).toBe(AVATAR_COPY)
  })

  it("tepat 2 MB → lolos", () => {
    expect(validateAvatarAsset(asset({ size: 2 * MB }))).toBeNull()
  })

  it("webp didukung", () => {
    expect(validateAvatarAsset(asset({ mimeType: "image/webp", name: "a.webp" }))).toBeNull()
  })
})

describe("validateHeaderAsset (UPF-03)", () => {
  it("aset valid → null", () => {
    expect(validateHeaderAsset(asset())).toBeNull()
  })

  it(">5 MB → tolak dengan pesan Indonesia (bukan error Inggris server)", () => {
    expect(validateHeaderAsset(asset({ size: 5 * MB + 1 }))).toBe(HEADER_COPY)
  })

  it("tepat 5 MB → lolos", () => {
    expect(validateHeaderAsset(asset({ size: 5 * MB }))).toBeNull()
  })

  it("UPF-06: mime HEIC dilaporkan + ekstensi .jpg → tolak", () => {
    expect(validateHeaderAsset(asset({ mimeType: "image/heic", name: "sampul.jpg" }))).toBe(HEADER_COPY)
  })
})

describe("photoUploadTimeoutMs (UPF-04 — delegasi rumus terpusat, audit B6)", () => {
  it("tanpa info ukuran → 60 dtk", () => {
    expect(photoUploadTimeoutMs()).toBe(60_000)
    expect(photoUploadTimeoutMs(0)).toBe(60_000)
  })

  it("file kecil → minimal 60 dtk", () => {
    expect(photoUploadTimeoutMs(1000)).toBe(60_010)
  })

  it("1 MiB → ~70,5 dtk (60 dtk basis + waktu @100KB/s)", () => {
    expect(photoUploadTimeoutMs(MB)).toBeCloseTo(70_485.76, 1)
  })

  it("5 MiB → ~112,4 dtk", () => {
    expect(photoUploadTimeoutMs(5 * MB)).toBeCloseTo(112_428.8, 1)
  })

  it("file raksasa → di-cap 300 dtk (5 menit)", () => {
    expect(photoUploadTimeoutMs(50 * MB)).toBe(300_000)
  })

  it("avatar 2 MB di 4G lambat tidak lagi dibunuh di detik ~23 (regresi B6)", () => {
    // Rumus lama: 20 dtk + 2MB/100 = 32,9 dtk — tapi pengamatan nyata
    // (screenshot user) menunjukkan avatar digagalkan jauh lebih awal karena
    // deadline global 20 dtk. Rumus baru memberi 60 dtk + jatah transfer.
    expect(photoUploadTimeoutMs(2 * MB)).toBeGreaterThan(20_000)
  })
})
