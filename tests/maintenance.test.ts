/**
 * Tests untuk lib/api/maintenance.ts (item #29 — mode pemeliharaan).
 *
 * Kontrak backend (Tim B):
 * - GET /v1/public/maintenance (tanpa auth) → { enabled, message }
 * - Saat aktif, request non-admin menerima 503 + body { message }.
 *
 * Perilaku yang diuji:
 * - Parsing respons endpoint (enabled/message, nilai aneh → default aman).
 * - Fail-open: jaringan gagal → aplikasi TIDAK diblokir.
 * - Dedupe: pemanggilan konkuren hanya memicu satu request.
 * - Verifikasi 503: hanya masuk mode maintenance bila endpoint
 *   mengonfirmasi enabled=true (503 transien tidak mengusir pengguna).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// maintenance.ts menarik @/lib/telemetry (logWarn) — mock agar test tidak
// bergantung pada rantai native telemetry.
vi.mock("@/lib/telemetry", () => ({ logWarn: vi.fn() }))

import { ApiError } from "@/lib/api/errors"
import {
  checkMaintenance,
  clearMaintenance,
  getMaintenancePhaseForTest,
  getMaintenanceStatus,
  isMaintenanceError,
  maintenanceMessageFromError,
  resetMaintenanceForTest,
  verifyMaintenanceFrom503,
} from "@/lib/api/maintenance"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  resetMaintenanceForTest()
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe("getMaintenanceStatus — parsing kontrak", () => {
  it("membaca enabled=true + message dari server", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ enabled: true, message: "Sedang pemeliharaan" }))
    const status = await getMaintenanceStatus()
    expect(status).toEqual({ enabled: true, message: "Sedang pemeliharaan" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("/v1/public/maintenance")
    expect(init.method).toBe("GET")
  })

  it("enabled=false dengan message kosong → message null", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ enabled: false, message: "" }))
    await expect(getMaintenanceStatus()).resolves.toEqual({ enabled: false, message: null })
  })

  it("nilai aneh diabaikan secara aman (fail-closed parsing)", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ enabled: 1, message: 42 }))
    await expect(getMaintenanceStatus()).resolves.toEqual({ enabled: false, message: null })
    fetchMock.mockResolvedValue(jsonResponse(null))
    await expect(getMaintenanceStatus()).resolves.toEqual({ enabled: false, message: null })
  })

  it("HTTP non-200 melempar (bukan fail-open diam-diam)", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "x" }, 500))
    await expect(getMaintenanceStatus()).rejects.toThrow()
  })

  it("jaringan gagal melempar — keputusan fail-open ada di pemanggil", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"))
    await expect(getMaintenanceStatus()).rejects.toThrow()
  })
})

describe("checkMaintenance — store global", () => {
  it("fail-open: jaringan gagal dari phase unknown → phase ok, return false", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"))
    await expect(checkMaintenance()).resolves.toBe(false)
    expect(getMaintenancePhaseForTest()).toBe("ok")
  })

  it("maintenance aktif: return true + phase maintenance + pesan tersimpan", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ enabled: true, message: "Upgrade database" }),
    )
    await expect(checkMaintenance()).resolves.toBe(true)
    expect(getMaintenancePhaseForTest()).toBe("maintenance")
  })

  it("maintenance nonaktif: return false + phase ok", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ enabled: false, message: null }))
    await expect(checkMaintenance()).resolves.toBe(false)
    expect(getMaintenancePhaseForTest()).toBe("ok")
  })

  it("dedupe: dua pemanggilan konkuren hanya satu request", async () => {
    fetchMock.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(jsonResponse({ enabled: false })), 20)),
    )
    const [a, b] = await Promise.all([checkMaintenance(), checkMaintenance()])
    expect(a).toBe(false)
    expect(b).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("clearMaintenance mengembalikan phase ke ok", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ enabled: true, message: "x" }))
    await checkMaintenance()
    expect(getMaintenancePhaseForTest()).toBe("maintenance")
    clearMaintenance()
    expect(getMaintenancePhaseForTest()).toBe("ok")
  })
})

describe("verifyMaintenanceFrom503 — 503 transien tidak memblokir", () => {
  it("masuk mode maintenance bila endpoint mengonfirmasi enabled=true", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ enabled: true, message: "Maintenance rutin" }))
    verifyMaintenanceFrom503()
    // Tunggu microtask drain (verify memanggil checkMaintenance async).
    await new Promise((r) => setTimeout(r, 10))
    expect(getMaintenancePhaseForTest()).toBe("maintenance")
  })

  it("TETAP ok bila endpoint bilang tidak maintenance (503 transien)", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ enabled: false, message: null }))
    verifyMaintenanceFrom503()
    await new Promise((r) => setTimeout(r, 10))
    expect(getMaintenancePhaseForTest()).toBe("ok")
  })

  it("fail-open bila verifikasi gagal jaringan", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"))
    verifyMaintenanceFrom503()
    await new Promise((r) => setTimeout(r, 10))
    expect(getMaintenancePhaseForTest()).toBe("ok")
  })
})

describe("helper error 503", () => {
  it("isMaintenanceError hanya true untuk ApiError status 503", () => {
    const e503 = new ApiError({ code: "SERVER", message: "x", status: 503 })
    const e500 = new ApiError({ code: "SERVER", message: "x", status: 500 })
    expect(isMaintenanceError(e503)).toBe(true)
    expect(isMaintenanceError(e500)).toBe(false)
    expect(isMaintenanceError(new Error("biasa"))).toBe(false)
    expect(isMaintenanceError(null)).toBe(false)
  })

  it("maintenanceMessageFromError mengambil pesan body 503", () => {
    const err = new ApiError({ code: "SERVER", message: "Sedang pemeliharaan", status: 503 })
    expect(maintenanceMessageFromError(err)).toBe("Sedang pemeliharaan")
    const noMsg = new ApiError({ code: "SERVER", message: "   ", status: 503 })
    expect(maintenanceMessageFromError(noMsg)).toBeNull()
    expect(maintenanceMessageFromError(new Error("x"))).toBeNull()
  })
})
