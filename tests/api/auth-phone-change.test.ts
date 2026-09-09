import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ post: vi.fn() }))
vi.mock("@/lib/api/client", () => ({ http: { post: mocks.post } }))
vi.mock("@/lib/api/session", () => ({
  clearSession: vi.fn(),
  getDeviceId: vi.fn(async () => "redacted-device-id"),
  getDeviceInfo: vi.fn(() => "test-device"),
  startSession: vi.fn(),
}))

import { confirmPhoneChange, normalizePhoneChangeResult, requestPhoneChange } from "@/lib/api/auth"

describe("authenticated phone-change contract", () => {
  beforeEach(() => mocks.post.mockReset())

  it("requests an OTP with the typed security fields and required auth", async () => {
    mocks.post.mockResolvedValue({ message: "Verification code sent" })
    const body = {
      newPhoneNumber: "+6281234567890",
      currentPassword: "redacted-password",
      method: "WHATSAPP" as const,
      mfaCode: "123456",
    }
    await expect(requestPhoneChange(body)).resolves.toEqual({ message: "Verification code sent" })
    expect(mocks.post).toHaveBeenCalledWith("/v1/auth/phone-change/request", body, { auth: "required" })
  })

  it("confirms the OTP using the same phone and required auth", async () => {
    mocks.post.mockResolvedValue({ message: "Phone number updated" })
    const body = { newPhoneNumber: "+6281234567890", code: "654321" }
    await expect(confirmPhoneChange(body)).resolves.toEqual({ message: "Phone number updated" })
    expect(mocks.post).toHaveBeenCalledWith("/v1/auth/phone-change/confirm", body, { auth: "required" })
  })

  it.each([undefined, {}, { message: 42 }])("rejects malformed success responses without crashing a screen", (raw) => {
    expect(() => normalizePhoneChangeResult(raw)).toThrow(/respons/i)
  })
})
