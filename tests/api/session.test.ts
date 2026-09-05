import { beforeEach, describe, expect, it, vi } from "vitest"
const storage = vi.hoisted(() => ({
  values: new Map<string, string>(),
  set: vi.fn(),
  get: vi.fn(),
  clear: vi.fn(),
}))
vi.mock("react-native", () => ({ Platform: { OS: "web" } }))
vi.mock("expo-device", () => ({ osName: "Web" }))
vi.mock("@/lib/runtime-info", () => ({ installedAppVersion: () => "1.0.0" }))
vi.mock("@/lib/secure-storage", () => ({
  SecureKeys: {
    accessToken: "access",
    refreshToken: "refresh",
    pinHash: "pin",
    biometricEnabled: "bio",
    pushToken: "push",
    sessionSignedOut: "signedOut",
  },
  getSecureItem: storage.get,
  setSecureItem: storage.set,
  deleteSecureItem: async (key: string) => {
    storage.values.delete(key)
  },
  clearSession: storage.clear,
  getOrCreateDeviceId: async () => "device",
}))
let session: typeof import("@/lib/api/session")
beforeEach(async () => {
  vi.resetModules()
  storage.values.clear()
  storage.get.mockImplementation(async (key: string) => storage.values.get(key) ?? null)
  storage.set.mockImplementation(async (key: string, value: string) => {
    storage.values.set(key, value)
  })
  storage.clear.mockImplementation(async () => {
    for (const key of ["access", "refresh", "pin", "bio", "push"]) storage.values.delete(key)
  })
  session = await import("@/lib/api/session")
})
describe("session persistence and account isolation", () => {
  it("publishes tokens only after persistence and emits reactive snapshots", async () => {
    const snapshots: unknown[] = []
    const unsubscribe = session.subscribeSession(() => snapshots.push(session.getSessionSnapshot()))
    await session.startSession({ accessToken: "new", refreshToken: "refresh" })
    expect(snapshots).toEqual([null, "new"])
    expect(storage.values.get("access")).toBe("new")
    unsubscribe()
  })
  it("clears account-specific PIN, biometric and push state on a new login", async () => {
    storage.values.set("pin", "old-hash")
    storage.values.set("bio", "1")
    storage.values.set("push", "old-token")
    storage.values.set("signedOut", "1")
    await session.startSession({ accessToken: "new" })
    for (const key of ["pin", "bio", "push", "signedOut"])
      expect(storage.values.has(key)).toBe(false)
  })
  it("rolls back partial token writes on storage failure", async () => {
    storage.set.mockImplementation(async (key: string, value: string) => {
      if (key === "refresh") throw new Error("keystore full")
      storage.values.set(key, value)
    })
    await expect(
      session.startSession({ accessToken: "partial", refreshToken: "fails" }),
    ).rejects.toThrow("keystore full")
    expect(session.getSessionSnapshot()).toBeNull()
    expect(storage.values.has("access")).toBe(false)
    expect(storage.values.get("signedOut")).toBe("1")
  })
  it("a slow bootstrap read cannot revive a logged-out account", async () => {
    let finish!: (token: string) => void
    storage.get.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve
        }),
    )
    const read = session.getAccessToken()
    await session.clearSession()
    finish("stale")
    expect(await read).toBeNull()
    expect(session.getSessionSnapshot()).toBeNull()
  })
  it("a refresh token write never publishes over a newer login", async () => {
    await session.startSession({ accessToken: "old" })
    const refresh = session.setAccessToken("old-refreshed")
    const login = session.startSession({ accessToken: "new" })
    await Promise.all([refresh, login])
    expect(session.getSessionSnapshot()).toBe("new")
    expect(storage.values.get("access")).toBe("new")
  })
  it("logout wins against a queued login and blocks cookie auto-restoration", async () => {
    const login = session.startSession({ accessToken: "discard" })
    const logout = session.clearSession()
    await Promise.all([login, logout])
    expect(session.getSessionSnapshot()).toBeNull()
    expect(storage.values.has("access")).toBe(false)
    expect(storage.values.get("signedOut")).toBe("1")
  })
  it("reads the secure access token once, not on every request", async () => {
    storage.values.set("access", "cached")
    await Promise.all([session.getAccessToken(), session.getAccessToken()])
    await session.getAccessToken()
    expect(storage.get).toHaveBeenCalledTimes(1)
  })
})
