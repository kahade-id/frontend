/**
 * UX-04 (audit etalase 2026-10-10): judul error daftar/feed jujur —
 * offline ≠ "Terjadi kesalahan" (CLAUDE.md).
 */
import { describe, expect, it } from "vitest"

import { ApiError, DEFAULT_ERROR_MESSAGES, NETWORK_COPY, OfflineError } from "@/lib/api/errors"
import { loadErrorTitle } from "@/lib/load-error-title"

const api = (code: ApiError["code"], message = "x") => new ApiError({ code, message })

describe("loadErrorTitle", () => {
  it("offline terverifikasi (OfflineError / NETWORK dengan copy offline) → 'Tidak ada koneksi internet'", () => {
    expect(loadErrorTitle(new OfflineError())).toBe("Tidak ada koneksi internet")
    expect(loadErrorTitle(api("NETWORK", NETWORK_COPY.offline))).toBe("Tidak ada koneksi internet")
  })

  it("socket putus saat online → 'Koneksi terputus'; timeout → 'Koneksi lambat'", () => {
    expect(loadErrorTitle(api("NETWORK", DEFAULT_ERROR_MESSAGES.NETWORK))).toBe("Koneksi terputus")
    expect(loadErrorTitle(api("TIMEOUT"))).toBe("Koneksi lambat")
  })

  it("5xx / 429 punya judul sendiri; selain itu undefined (pemanggil pakai judul konteks)", () => {
    expect(loadErrorTitle(api("SERVER"))).toBe("Server sedang bermasalah")
    expect(loadErrorTitle(api("RATE_LIMITED"))).toBe("Terlalu banyak permintaan")
    expect(loadErrorTitle(api("VALIDATION"))).toBeUndefined()
    expect(loadErrorTitle(new Error("boom"))).toBeUndefined()
  })
})
