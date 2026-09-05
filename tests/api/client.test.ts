import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
const state = vi.hoisted(() => ({
  token: "original" as string | null,
  revision: 0,
  clear: vi.fn(),
  expired: vi.fn(),
  set: vi.fn(),
}))
vi.mock("react-native", () => ({ Platform: { OS: "web" } }))
vi.mock("@/lib/api/config", () => ({
  API_BASE_URL: "https://api.kahade.id",
  API_TIMEOUT_MS: 1000,
  HEADER_DEVICE_ID: "X-Device-Id",
  HEADER_DEVICE_INFO: "X-Device-Info",
  HEADER_APP_VERSION: "X-App-Version",
  HEADER_PLATFORM: "X-Platform",
}))
vi.mock("@/lib/api/session", () => ({
  getAccessToken: async () => state.token,
  getRefreshToken: async () => null,
  getSessionRevision: () => state.revision,
  getDeviceId: async () => "test-device",
  getDeviceInfo: () => "test",
  getAppVersion: () => "1.0.0",
  setAccessToken: async (token: string) => {
    state.token = token
    state.set(token)
  },
  setRefreshToken: vi.fn(),
  clearSession: async () => {
    state.token = null
    state.revision += 1
    state.clear()
  },
  emitSessionExpired: state.expired,
}))
let client: typeof import("@/lib/api/client")
let fetchMock: ReturnType<typeof vi.fn>
const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 })
const failure = (status: number) =>
  new Response(
    JSON.stringify({
      success: false,
      message: "Rejected",
      data: null,
      errors: { code: "REJECTED" },
    }),
    { status },
  )
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}
beforeEach(async () => {
  vi.resetModules()
  state.token = "original"
  state.revision = 0
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
  client = await import("@/lib/api/client")
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
describe("shared HTTP client", () => {
  it("encodes query and path segments", () => {
    expect(
      client.buildUrl("/v1/search", { q: "a & b", enabled: false, n: 0, ignored: undefined }),
    ).toBe("https://api.kahade.id/v1/search?q=a%20%26%20b&enabled=false&n=0")
    expect(client.seg("a/b")).toBe("a%2Fb")
    expect(() => client.seg("..")).toThrow()
  })
  it("rejects absolute URLs before sending credentials", () =>
    expect(() => client.buildUrl("https://evil.example")).toThrow())
  it("decodes real envelopes and sends device/auth headers", async () => {
    fetchMock.mockResolvedValueOnce(ok({ balance: 42 }))
    expect(await client.http.get("/v1/wallet", { auth: "required" })).toEqual({ balance: 42 })
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      credentials: "include",
      headers: { Authorization: "Bearer original", "X-Device-Id": "test-device" },
    })
  })
  it("adds a UUID v4 idempotency key to mutations", async () => {
    fetchMock.mockResolvedValueOnce(ok({ id: "message-1" }))
    await client.http.post("/v1/chat/rooms/room-1/messages", { text: "hello" }, { auth: "required" })
    const key = fetchMock.mock.calls[0][1].headers["Idempotency-Key"] as string
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
  it("deduplicates simultaneous identical GET requests", async () => {
    fetchMock.mockResolvedValueOnce(ok({ id: "1" }))
    const result = await Promise.all([
      client.http.get("/v1/users/me"),
      client.http.get("/v1/users/me"),
    ])
    expect(result[0]).toEqual(result[1])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it("does not persist GET responses as a stale cache", async () => {
    fetchMock.mockImplementation(async () => ok({ id: "1" }))
    await client.http.get("/v1/users/me")
    await client.http.get("/v1/users/me")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it("leaves multipart boundaries to fetch", async () => {
    const data = new FormData()
    data.append("file", new Blob(["test"]), "image.png")
    fetchMock.mockResolvedValueOnce(ok({ fileKey: "test" }))
    await client.http.post("/v1/upload/direct", undefined, {
      formData: data,
      headers: { "content-type": "wrong" },
    })
    expect(fetchMock.mock.calls[0][1].body).toBe(data)
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty("content-type")
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty("Content-Type")
  })
  it("catches accidental JSON encoding of FormData", async () => {
    await expect(client.http.post("/v1/upload/direct", new FormData())).rejects.toThrow("formData")
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it("honors a signal cancelled before the request", async () => {
    const abort = new AbortController()
    abort.abort()
    await expect(client.http.get("/v1/users/me", { signal: abort.signal })).rejects.toMatchObject({
      code: "ABORTED",
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it("cancels while reading the body, not just fetching headers", async () => {
    const abort = new AbortController()
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: () => new Promise(() => undefined) })
    const pending = client.http.get("/v1/users/me", { signal: abort.signal })
    const assertion = expect(pending).rejects.toMatchObject({ code: "ABORTED" })
    await flush()
    abort.abort()
    await assertion
  })
  it("times out a stalled response body", async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: () => new Promise(() => undefined) })
    const pending = client.http.get("/v1/users/me", { timeoutMs: 10 })
    const assertion = expect(pending).rejects.toMatchObject({ code: "TIMEOUT" })
    await flush()
    await vi.advanceTimersByTimeAsync(11)
    await assertion
  })
  it("does not refresh when login credentials are wrong", async () => {
    fetchMock.mockResolvedValueOnce(failure(401))
    await expect(
      client.http.post("/v1/auth/login", { password: "wrong" }, { auth: "none" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(state.clear).not.toHaveBeenCalled()
  })
  it("refreshes once for concurrent 401s and retries with new token", async () => {
    fetchMock.mockImplementation(async (url, init) => {
      if (url.endsWith("/refresh")) return ok({ accessToken: "new" })
      return init.headers.Authorization === "Bearer new" ? ok({ id: "x" }) : failure(401)
    })
    await Promise.all([client.http.get("/v1/users/me"), client.http.get("/v1/wallet")])
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith("/refresh"))).toHaveLength(1)
    expect(state.set).toHaveBeenCalledWith("new")
  })
  it("expires a session if the refreshed token is also rejected", async () => {
    fetchMock.mockImplementation(async (url) =>
      url.endsWith("/refresh") ? ok({ accessToken: "new" }) : failure(401),
    )
    await expect(client.http.get("/v1/users/me")).rejects.toMatchObject({ code: "UNAUTHORIZED" })
    expect(state.clear).toHaveBeenCalledTimes(1)
    expect(state.expired).toHaveBeenCalledTimes(1)
  })
  it.each([429, 500, 503])("preserves the session on refresh HTTP %s", async (status) => {
    fetchMock.mockImplementation(async (url) => failure(url.endsWith("/refresh") ? status : 401))
    await expect(client.http.get("/v1/users/me")).rejects.toMatchObject({ status })
    expect(state.clear).not.toHaveBeenCalled()
  })
  it("never retries financial mutations on transient failures", async () => {
    fetchMock.mockResolvedValueOnce(failure(503))
    await expect(
      client.http.post("/v1/wallet/transfer", { amount: 1000 }, { retry: 2 }),
    ).rejects.toMatchObject({ code: "SERVER" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it("drops protected responses from the previous account", async () => {
    let complete!: (response: Response) => void
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        complete = resolve
      }),
    )
    const pending = client.http.get("/v1/users/me")
    const assertion = expect(pending).rejects.toMatchObject({ code: "ABORTED" })
    await flush()
    state.revision += 1
    complete(ok({ fullName: "previous account" }))
    await assertion
  })
  it("does not resurrect a session when logout races with refresh", async () => {
    let complete!: (response: Response) => void
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        complete = resolve
      }),
    )
    const pending = client.refreshAccessToken()
    const assertion = expect(pending).rejects.toMatchObject({ code: "ABORTED" })
    await flush()
    state.revision += 1
    complete(ok({ accessToken: "old-account" }))
    await assertion
    expect(state.set).not.toHaveBeenCalled()
  })
})
