/**
 * AP-01 (audit etalase 2026-10-10): status offline tanpa cache diumumkan
 * sebagai "Tidak ada koneksi internet", bukan "Tidak ada hasil".
 */
import { describe, expect, it } from "vitest"

import { buildResultMessage } from "@/lib/search-ui"

describe("buildResultMessage — offline", () => {
  it("offline menang atas hitungan nol (tidak berbohong 'Tidak ada hasil')", () => {
    expect(buildResultMessage({ enabled: true, loading: false, count: 0, offline: true })).toBe("Tidak ada koneksi internet")
  })

  it("offline menang atas error, tetapi tidak saat loading / belum aktif", () => {
    expect(buildResultMessage({ enabled: true, loading: false, count: 0, error: "x", offline: true })).toBe(
      "Tidak ada koneksi internet",
    )
    expect(buildResultMessage({ enabled: true, loading: true, count: 0, offline: true })).toBe("")
    expect(buildResultMessage({ enabled: false, loading: false, count: 0, offline: true })).toBe("")
  })

  it("online: perilaku lama tidak berubah", () => {
    expect(buildResultMessage({ enabled: true, loading: false, count: 0 })).toBe("Tidak ada hasil")
  })
})
