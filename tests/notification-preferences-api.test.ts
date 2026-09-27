/**
 * Tests kontrak preferensi notifikasi (item #25 digest + item #26 quiet hours).
 *
 * Kontrak Tim B (item #25):
 * - PUT /v1/notifications/preferences menerima `digestFrequency`
 *   ("off" | "daily" | "weekly"); "off" = perilaku lama.
 * - GET mengembalikan `digestFrequency` + `lastDigestSentAt`.
 *
 * Item #26:
 * - PUT menerima quietHoursEnabled/quietHoursStart/quietHoursEnd.
 *
 * Test ini memverifikasi lapisan API frontend meneruskan field-field
 * tersebut ke endpoint yang benar — bukan sekadar tipe yang cocok.
 */
import { afterEach, describe, expect, it, vi } from "vitest"

// Facade `@/lib/api/client` menarik rantai native (NetInfo dkk.) — mock
// http di-hoist sebelum import statis di bawah.
const mocks = vi.hoisted(() => ({
  put: vi.fn(),
  get: vi.fn(),
}))
vi.mock("@/lib/api/client", () => ({
  http: { put: mocks.put, get: mocks.get },
  seg: (s: string) => encodeURIComponent(s),
}))

import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/api/notifications"

afterEach(() => {
  vi.clearAllMocks()
})

describe("kontrak digest (item #25)", () => {
  it("PUT meneruskan digestFrequency ke /v1/notifications/preferences", async () => {
    mocks.put.mockResolvedValue({ digestFrequency: "daily" })
    await updateNotificationPreferences({ digestFrequency: "daily" })
    expect(mocks.put).toHaveBeenCalledWith(
      "/v1/notifications/preferences",
      { digestFrequency: "daily" },
      expect.objectContaining({ auth: "required" }),
    )
  })

  it.each(["off", "daily", "weekly"] as const)(
    "menerima nilai digestFrequency=%s",
    async (frequency) => {
      mocks.put.mockResolvedValue({})
      await updateNotificationPreferences({ digestFrequency: frequency })
      expect(mocks.put.mock.calls[0][1]).toMatchObject({ digestFrequency: frequency })
    },
  )

  it("GET memakai path preferensi yang sama", async () => {
    mocks.get.mockResolvedValue({ digestFrequency: "weekly", lastDigestSentAt: "2026-09-28T00:00:00Z" })
    const res = await getNotificationPreferences()
    expect(mocks.get).toHaveBeenCalledWith(
      "/v1/notifications/preferences",
      expect.objectContaining({ auth: "required" }),
    )
    // Field kontrak diteruskan apa adanya ke pemanggil (UI).
    expect(res.digestFrequency).toBe("weekly")
    expect(res.lastDigestSentAt).toBe("2026-09-28T00:00:00Z")
  })
})

describe("kontrak quiet hours (item #26)", () => {
  it("PUT meneruskan jadwal jangan-ganggu", async () => {
    mocks.put.mockResolvedValue({})
    await updateNotificationPreferences({
      quietHoursEnabled: true,
      quietHoursStart: "22:00",
      quietHoursEnd: "06:00",
    })
    expect(mocks.put).toHaveBeenCalledWith(
      "/v1/notifications/preferences",
      {
        quietHoursEnabled: true,
        quietHoursStart: "22:00",
        quietHoursEnd: "06:00",
      },
      expect.objectContaining({ auth: "required" }),
    )
  })
})
