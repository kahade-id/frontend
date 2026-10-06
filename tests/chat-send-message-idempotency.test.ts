/** Fase 3: kunci idempotensi pesan harus tetap sama saat antrean/retry. */
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api/session", () => ({
  getAccessToken: () => Promise.resolve("token"),
  getRefreshToken: () => Promise.resolve(null),
  setAccessToken: () => Promise.resolve(),
  setRefreshToken: () => Promise.resolve(),
  getSessionRevision: () => 1,
  clearSession: () => Promise.resolve(),
  emitSessionExpired: () => undefined,
  getDeviceId: () => Promise.resolve("device-1"),
  getDeviceInfo: () => "Kahade/test",
  getAppVersion: () => "0.0.0",
}))

const fetchMock = vi.fn()
vi.stubGlobal("fetch", fetchMock)

import { sendChatMessage } from "@/lib/api/chat"

describe("sendChatMessage idempotency", () => {
  it("mengirim kembali Idempotency-Key dari antrean chat", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            id: "server-message-1",
            content: "Halo",
            messageType: "TEXT",
            fromUser: true,
            createdAt: "2026-10-06T00:00:00.000Z",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    )

    const message = await sendChatMessage(
      "room-1",
      { messageType: "TEXT", content: "Halo" },
      { idempotencyKey: "11111111-1111-4111-8111-111111111111" },
    )

    expect(message.id).toBe("server-message-1")
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(new Headers(init.headers).get("Idempotency-Key")).toBe(
      "11111111-1111-4111-8111-111111111111",
    )
  })
})
