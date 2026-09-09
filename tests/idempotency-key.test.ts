/**
 * Test regresi `Idempotency-Key` di `lib/api/client.ts`.
 *
 * Sifat yang dikunci: SATU kunci per panggilan logis. Sebelumnya kunci dibuat
 * ulang di dalam `send()`, sehingga jalur 401 → refresh → kirim-ulang memakai
 * kunci BERBEDA — backend kehilangan satu-satunya cara mengenali kedua request
 * sebagai permintaan yang sama, padahal di situlah `Idempotency-Key` berguna
 * (mutasi keuangan: bayar pesanan, top-up, withdraw, transfer).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

let token = "token-lama"
let revision = 1

vi.mock("@/lib/api/session", () => ({
  getAccessToken: () => Promise.resolve(token),
  getRefreshToken: () => Promise.resolve(null),
  setAccessToken: (value: string) => {
    token = value
    return Promise.resolve()
  },
  setRefreshToken: () => Promise.resolve(),
  getSessionRevision: () => revision,
  clearSession: () => Promise.resolve(),
  emitSessionExpired: () => undefined,
  getDeviceId: () => Promise.resolve("device-1"),
  getDeviceInfo: () => "Kahade/test (test)",
  getAppVersion: () => "0.0.0",
}))

const fetchMock = vi.fn()
vi.stubGlobal("fetch", fetchMock)

const { http } = await import("@/lib/api/client")

const jsonResponse = (body: unknown, status = 200) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
    blob: () => Promise.resolve(new Blob()),
  } as Response)

beforeEach(() => {
  fetchMock.mockReset()
  token = "token-lama"
  revision = 1
})

function idempotencyKeys(): Array<string | undefined> {
  return fetchMock.mock.calls.map((call) => {
    const init = call[1] as { headers?: Record<string, string> }
    return init?.headers?.["Idempotency-Key"]
  })
}

describe("Idempotency-Key", () => {
  it("mutasi yang dikirim ulang setelah 401 memakai kunci yang SAMA", async () => {
    fetchMock
      .mockImplementationOnce(() => jsonResponse({ message: "expired" }, 401))
      .mockImplementationOnce(() => jsonResponse({ success: true, data: { accessToken: "token-baru" } }))
      .mockImplementationOnce(() => jsonResponse({ success: true, data: { ok: true } }))

    await http.post("/v1/wallet/transfer", { recipientId: "u1", amount: 1000, pin: "123456" })

    // panggilan: [1] mutasi 401, [2] refresh, [3] mutasi diulang
    const keys = idempotencyKeys()
    expect(keys).toHaveLength(3)
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/)
    expect(keys[2]).toBe(keys[0])
  })

  it("GET tidak diberi Idempotency-Key", async () => {
    fetchMock.mockImplementationOnce(() => jsonResponse({ success: true, data: [] }))
    await http.get("/v1/notifications")
    expect(idempotencyKeys()[0]).toBeUndefined()
  })

  it("kunci dari pemanggil dihormati, tidak ditimpa", async () => {
    fetchMock.mockImplementationOnce(() => jsonResponse({ success: true, data: {} }))
    await http.post("/v1/orders", { title: "x" }, { headers: { "Idempotency-Key": "kunci-pemanggil" } })
    expect(idempotencyKeys()[0]).toBe("kunci-pemanggil")
  })

  it("dua panggilan logis berbeda mendapat kunci berbeda", async () => {
    fetchMock.mockImplementation(() => jsonResponse({ success: true, data: {} }))
    await http.post("/v1/wallet/transfer", { amount: 1 })
    await http.post("/v1/wallet/transfer", { amount: 1 })
    const [first, second] = idempotencyKeys()
    expect(first).toBeTruthy()
    expect(second).not.toBe(first)
  })
})
