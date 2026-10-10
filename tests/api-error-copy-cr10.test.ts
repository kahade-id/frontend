/**
 * CR-10 (audit etalase 2026-10-10): pesan transport jujur & spesifik —
 * socket putus saat online ≠ "Tidak ada koneksi internet"; timeout =
 * "Koneksi lambat, coba lagi." (CLAUDE.md). Diuji di boundary HTTP tunggal
 * (lib/api/client.ts) dengan fetch yang gagal, plus `userMessage`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ApiError, DEFAULT_ERROR_MESSAGES, NETWORK_COPY, userMessage } from "@/lib/api/errors"
import { http } from "@/lib/api/client"
import { initConnectivity } from "@/lib/connectivity"
import { __setNetInfoState } from "../tests/stubs/netinfo"

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Network request failed") }))
})
afterEach(() => {
  vi.unstubAllGlobals()
  __setNetInfoState({ isConnected: true, isInternetReachable: true, type: "wifi" })
})

describe("userMessage — copy transport", () => {
  it("TIMEOUT → 'Koneksi lambat, coba lagi.'", () => {
    expect(DEFAULT_ERROR_MESSAGES.TIMEOUT).toBe("Koneksi lambat, coba lagi.")
    expect(userMessage(new ApiError({ code: "TIMEOUT", message: DEFAULT_ERROR_MESSAGES.TIMEOUT }))).toBe(
      "Koneksi lambat, coba lagi.",
    )
  })

  it("NETWORK default = koneksi terputus (bukan klaim offline); copy klien offline dihormati", () => {
    expect(userMessage(new ApiError({ code: "NETWORK", message: DEFAULT_ERROR_MESSAGES.NETWORK }))).toBe(
      "Koneksi terputus. Periksa jaringan lalu coba lagi.",
    )
    expect(userMessage(new ApiError({ code: "NETWORK", message: NETWORK_COPY.offline }))).toBe(
      "Tidak ada koneksi internet. Periksa jaringan lalu coba lagi.",
    )
    // Wording teknis (bukan karangan klien) tetap jatuh ke default.
    expect(
      userMessage(new ApiError({ code: "NETWORK", message: "ECONNRESET", clientMessage: false })),
    ).toBe(DEFAULT_ERROR_MESSAGES.NETWORK)
  })
})

describe("client.ts — fetch gagal", () => {
  it("online (NetInfo tidak bilang offline) → 'Koneksi terputus…'", async () => {
    await expect(http.get("/v1/ping", { auth: "none", retry: 0 })).rejects.toMatchObject({
      code: "NETWORK",
      message: "Koneksi terputus. Periksa jaringan lalu coba lagi.",
    })
  })

  it("NetInfo memverifikasi offline → 'Tidak ada koneksi internet…' (GET tidak digerbang OfflineError)", async () => {
    // Snapshot offline dipasang SEBELUM init: fetch() awal NetInfo mengisi
    // `online=false`, lalu request GET gagal di transport.
    __setNetInfoState({ isConnected: false, isInternetReachable: false, type: "none" })
    initConnectivity()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await expect(http.get("/v1/ping", { auth: "none", retry: 0 })).rejects.toMatchObject({
      code: "NETWORK",
      message: NETWORK_COPY.offline,
    })
  })
})
