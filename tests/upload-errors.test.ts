/**
 * Audit upload 2026-10-09 — kontrak pesan kegagalan upload.
 *
 * Akar bug yang diuji: semua kegagalan upload (timeout, 413, 500, socket
 * putus di 4G tak stabil) dilaporkan "Tidak ada koneksi internet". Kini:
 *   - offline HANYA bila terverifikasi NetInfo;
 *   - transport gagal saat online = "koneksi terputus", bukan offline;
 *   - timeout = "Koneksi lambat, coba lagi";
 *   - 413 = "File terlalu besar (maks X MB)" dengan batas per purpose;
 *   - 5xx = "Server bermasalah".
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const connectivity = vi.hoisted(() => {
  let offline = false
  return {
    isOfflineKnown: () => offline,
    setOffline(next: boolean) {
      offline = next
    },
    reset() {
      offline = false
    },
  }
})
vi.mock("@/lib/connectivity", () => ({
  isOfflineKnown: connectivity.isOfflineKnown,
}))

import { ApiError, OfflineError } from "@/lib/api/errors"
import {
  UPLOAD_OFFLINE_COPY,
  UPLOAD_SERVER_COPY,
  UPLOAD_TIMEOUT_COPY,
  UPLOAD_UNSTABLE_COPY,
  uploadMessage,
  uploadSizeLimitBytes,
  uploadTooLargeMessage,
  uploadTimeoutMs,
} from "@/lib/upload-errors"

beforeEach(() => connectivity.reset())

describe("uploadMessage — klasifikasi per tipe kegagalan", () => {
  it("offline terverifikasi (pra-upload) → pesan offline, tanpa NetInfo terputya", () => {
    connectivity.setOffline(true)
    const err = new ApiError({
      code: "NETWORK",
      backendCode: "OFFLINE_VERIFIED",
      message: "tidak dipakai — copy terpusat",
      clientMessage: true,
    })
    expect(uploadMessage(err)).toBe(UPLOAD_OFFLINE_COPY)
  })

  it("OfflineError (gerbang fail-closed sebelum kirim) → pesan offline", () => {
    expect(uploadMessage(new OfflineError())).toBe(UPLOAD_OFFLINE_COPY)
  })

  it("transport gagal (NETWORK) saat perangkat ONLINE → JANGAN klaim offline", () => {
    connectivity.setOffline(false)
    const err = new ApiError({ code: "NETWORK", message: "socket reset", clientMessage: true })
    expect(uploadMessage(err)).toBe(UPLOAD_UNSTABLE_COPY)
    expect(uploadMessage(err)).not.toContain("Tidak ada koneksi internet")
  })

  it("transport gagal (NETWORK) saat perangkat offline → pesan offline", () => {
    connectivity.setOffline(true)
    const err = new ApiError({ code: "NETWORK", message: "socket reset", clientMessage: true })
    expect(uploadMessage(err)).toBe(UPLOAD_OFFLINE_COPY)
  })

  it("TIMEOUT → 'Koneksi lambat, coba lagi' (bukan 'server terlalu lama')", () => {
    const err = new ApiError({ code: "TIMEOUT", message: "pesan lama diabaikan" })
    expect(uploadMessage(err)).toBe(UPLOAD_TIMEOUT_COPY)
    expect(uploadMessage(err)).not.toContain("Server terlalu lama")
  })

  it("413 dengan batas → menyebut 'maks X MB'", () => {
    const err = new ApiError({ code: "PAYLOAD_TOO_LARGE", status: 413, message: "too large", clientMessage: false })
    expect(uploadMessage(err, { purpose: "SHOWCASE_IMAGE" })).toBe(
      "File terlalu besar (maks 5 MB). Pilih file yang lebih kecil.",
    )
    expect(uploadMessage(err, { purpose: "AVATAR" })).toBe(
      "File terlalu besar (maks 2 MB). Pilih file yang lebih kecil.",
    )
    expect(uploadMessage(err, { purpose: "CHAT_ATTACHMENT" })).toBe(
      "File terlalu besar (maks 50 MB). Pilih file yang lebih kecil.",
    )
    expect(uploadMessage(err, { purpose: "SHOWCASE_VIDEO" })).toBe(
      "File terlalu besar (maks 100 MB). Pilih file yang lebih kecil.",
    )
  })

  it("413 tanpa batas yang diketahui → copy generik (jangan mengarang angka)", () => {
    // 413 dari server: clientMessage false (copy upload layer yang dipakai).
    const err = new ApiError({ code: "PAYLOAD_TOO_LARGE", status: 413, message: "too large", clientMessage: false })
    expect(uploadMessage(err, { purpose: "MILESTONE_EVIDENCE" })).toBe(
      "File terlalu besar. Pilih file yang lebih kecil.",
    )
  })

  it("maxBytes eksplisit pemanggil menang atas purpose", () => {
    const err = new ApiError({ code: "PAYLOAD_TOO_LARGE", status: 413, message: "too large", clientMessage: false })
    expect(uploadMessage(err, { purpose: "AVATAR", maxBytes: 3 * 1024 * 1024 })).toBe(
      "File terlalu besar (maks 3 MB). Pilih file yang lebih kecil.",
    )
  })

  it("5xx → 'Server bermasalah'", () => {
    expect(uploadMessage(new ApiError({ code: "SERVER", status: 500, message: "boom" }))).toBe(UPLOAD_SERVER_COPY)
    expect(uploadMessage(new ApiError({ code: "SERVER", status: 503, message: "boom" }))).toBe(UPLOAD_SERVER_COPY)
  })

  it("copy klien spesifik backend (FILE_TOO_LARGE, dsb.) diteruskan apa adanya", () => {
    const err = new ApiError({
      code: "BAD_REQUEST",
      status: 400,
      backendCode: "MIME_TYPE_MISMATCH",
      message: "Format berkas tidak didukung. Untuk video gunakan MP4, MOV, atau WebM.",
      clientMessage: true,
    })
    expect(uploadMessage(err)).toBe(err.message)
  })

  it("copy VIDEO_TOO_LARGE (413) lebih spesifik dari 'maks X MB' — tetap dipakai", () => {
    const err = new ApiError({
      code: "PAYLOAD_TOO_LARGE",
      status: 413,
      backendCode: "VIDEO_TOO_LARGE",
      message: "Ukuran video melebihi batas maksimal 100 MB. Maksimal 100 MB / 180 detik.",
      clientMessage: true,
    })
    expect(uploadMessage(err, { purpose: "SHOWCASE_VIDEO" })).toBe(err.message)
  })

  it("error non-ApiError saat online → JANGAN klaim offline", () => {
    expect(uploadMessage(new Error("boom"))).toBe(UPLOAD_UNSTABLE_COPY)
  })

  it("error non-ApiError saat offline terverifikasi → pesan offline", () => {
    connectivity.setOffline(true)
    expect(uploadMessage(new Error("boom"))).toBe(UPLOAD_OFFLINE_COPY)
  })

  it("FORBIDDEN (403, pesan server) → fallback userMessage default", () => {
    const err = new ApiError({
      code: "FORBIDDEN",
      status: 403,
      message: "backend msg",
      clientMessage: false,
    })
    expect(uploadMessage(err)).toBe("Anda tidak memiliki akses untuk tindakan ini.")
  })

  it("FORBIDDEN dengan pesan klien → pesan klien lolos (audit A1: jangan buang pesan klien)", () => {
    const err = new ApiError({
      code: "FORBIDDEN",
      status: 403,
      message: "Foto sudah digunakan oleh etalase lain.",
      clientMessage: true,
    })
    expect(uploadMessage(err)).toBe("Foto sudah digunakan oleh etalase lain.")
  })
})

describe("uploadSizeLimitBytes / uploadTooLargeMessage", () => {
  it("eksplisit > purpose > tak tahu", () => {
    expect(uploadSizeLimitBytes({ maxBytes: 99 })).toBe(99)
    expect(uploadSizeLimitBytes({ purpose: "HEADER" })).toBe(5 * 1024 * 1024)
    expect(uploadSizeLimitBytes({})).toBeUndefined()
    expect(uploadTooLargeMessage({})).toBe("File terlalu besar. Pilih file yang lebih kecil.")
  })

  it("format MB desimal memakai koma Indonesia", () => {
    expect(uploadTooLargeMessage({ maxBytes: 2.5 * 1024 * 1024 })).toBe(
      "File terlalu besar (maks 2,5 MB). Pilih file yang lebih kecil.",
    )
  })
})

describe("uploadTimeoutMs — proporsional ukuran (audit B4/B6)", () => {
  it("foto: basis 60 dtk, cap 5 menit", () => {
    expect(uploadTimeoutMs(0, "photo")).toBe(60_000)
    expect(uploadTimeoutMs(undefined, "photo")).toBe(60_000)
    // 2 MB ≈ +20,9 dtk transfer (100 KB/s)
    expect(uploadTimeoutMs(2 * 1024 * 1024, "photo")).toBeCloseTo(60_000 + 2 * 1024 * 1024 / 100, -1)
    // 5 MB cap? belum — 110 dtk < 300 dtk
    expect(uploadTimeoutMs(5 * 1024 * 1024, "photo")).toBe(60_000 + 5 * 1024 * 1024 / 100)
    // file raksasa → cap 300 dtk
    expect(uploadTimeoutMs(100 * 1024 * 1024, "photo")).toBe(300_000)
  })

  it("video: basis 120 dtk, cap 30 menit (100 MB butuh >17 menit transfer)", () => {
    expect(uploadTimeoutMs(0, "video")).toBe(120_000)
    // 100 MB @ 100 KB/s ≈ 17,4 menit transfer + 2 menit proses < cap 30 mnt
    expect(uploadTimeoutMs(100 * 1024 * 1024, "video")).toBe(
      120_000 + 100 * 1024 * 1024 / 100,
    )
    // file > ~270 MB melewati cap
    expect(uploadTimeoutMs(500 * 1024 * 1024, "video")).toBe(1_800_000)
  })

  it("video 100 MB @ 100 KB/s tidak lagi dibunuh timeout 20 dtk (regresi B4)", () => {
    expect(uploadTimeoutMs(100 * 1024 * 1024, "video")).toBeGreaterThan(20_000)
  })
})
