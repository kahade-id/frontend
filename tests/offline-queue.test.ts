/**
 * Tests untuk allowlist antrean offline (item #27).
 *
 * Kontrak keamanan: HANYA aksi sosial (suka etalase, ikuti user) yang boleh
 * diantrekan saat offline. Semua yang lain — terutama uang (top-up, tarik,
 * transfer, order, escrow) — harus fail-closed, tidak boleh antre.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@react-native-community/netinfo", () => ({
  default: {
    addEventListener: () => () => {},
    fetch: () => Promise.resolve({ isConnected: true, isInternetReachable: true }),
  },
  addEventListener: () => () => {},
  fetch: () => Promise.resolve({ isConnected: true, isInternetReachable: true }),
}))

import { isQueueableSocialAction } from "@/lib/offline-queue"
import { OfflineError } from "@/lib/api/errors"

describe("lib/offline-queue allowlist", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("mengizinkan suka/ikuti (POST & DELETE)", () => {
    expect(isQueueableSocialAction("POST", "/v1/showcase/abc123/like")).toBe(true)
    expect(isQueueableSocialAction("DELETE", "/v1/showcase/abc123/like")).toBe(true)
    expect(isQueueableSocialAction("POST", "/v1/users/budi/follow")).toBe(true)
    expect(isQueueableSocialAction("DELETE", "/v1/users/budi/follow")).toBe(true)
  })

  it("menolak method non-mutasi walau path sosial", () => {
    expect(isQueueableSocialAction("GET", "/v1/showcase/abc123/like")).toBe(false)
    expect(isQueueableSocialAction("PUT", "/v1/users/budi/follow")).toBe(false)
  })

  it("menolak SEMUA path uang/transaksi (fail-closed)", () => {
    const moneyPaths = [
      "/v1/wallet/topup",
      "/v1/wallet/withdraw",
      "/v1/wallet/transfer",
      "/v1/orders",
      "/v1/orders/xyz/complete",
      "/v1/orders/xyz/confirm",
      "/v1/escrow/release",
      "/v1/disputes",
    ]
    for (const path of moneyPaths) {
      expect(isQueueableSocialAction("POST", path), path).toBe(false)
    }
  })

  it("chat tetap ditolak dari antrean sosial — antrean chat memakai jalur terpisah", () => {
    expect(isQueueableSocialAction("POST", "/v1/chat/rooms/room-1/messages")).toBe(false)
    expect(isQueueableSocialAction("POST", "/v1/chat/rooms/room-1/read")).toBe(false)
  })

  it("copy aksi offline yang ditolak tenang dan menyatakan tidak diantrekan", () => {
    const message = new OfflineError().message.toLowerCase()
    expect(message).toContain("offline")
    expect(message).toContain("tidak dapat diantrekan")
    expect(message).toContain("coba lagi setelah tersambung")
    expect(message).not.toMatch(/error|kesalahan|gagal/)
  })

  it("menolak path tak dikenal", () => {
    expect(isQueueableSocialAction("POST", "/v1/admin/ban")).toBe(false)
    expect(isQueueableSocialAction("POST", "/v1/showcase/abc123/like/extra")).toBe(false)
  })
})
