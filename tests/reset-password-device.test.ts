/**
 * Kontrak Wave 1 (2026-09-28): POST /v1/auth/reset-password kini WAJIB
 * menyertakan deviceId (device id per-install yang sama dipakai alur auth
 * lain). Tanpa deviceId backend menolak — reset kata sandi pecah.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api/client", () => ({
  http: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

vi.mock("@/lib/api/session", () => ({
  startSession: vi.fn(),
  clearSession: vi.fn(),
  getDeviceId: vi.fn(async () => "device-install-123"),
  getDeviceInfo: vi.fn(() => "test-device"),
}))

import { http } from "@/lib/api/client"
import { resetPassword } from "@/lib/api/auth"

const post = http.post as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

describe("resetPassword deviceId (kontrak Wave 1)", () => {
  it("selalu mengirim deviceId per-install ke /v1/auth/reset-password", async () => {
    post.mockResolvedValue({ message: "OK" })
    await resetPassword({ tempToken: "tmp-1", newPassword: "SandiBaru123" })
    expect(post).toHaveBeenCalledWith(
      "/v1/auth/reset-password",
      expect.objectContaining({
        tempToken: "tmp-1",
        newPassword: "SandiBaru123",
        deviceId: "device-install-123",
      }),
      { auth: "none" },
    )
  })

  it("deviceId tetap dikirim walau ada location opsional", async () => {
    post.mockResolvedValue({ message: "OK" })
    await resetPassword({
      tempToken: "tmp-2",
      newPassword: "SandiBaru123",
      location: { latitude: -6.2, longitude: 106.8 },
    })
    const body = post.mock.calls[0][1] as Record<string, unknown>
    expect(body.deviceId).toBe("device-install-123")
    expect(body.location).toEqual({ latitude: -6.2, longitude: 106.8 })
  })
})
