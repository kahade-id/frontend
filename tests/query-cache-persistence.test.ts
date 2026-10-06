import { beforeEach, describe, expect, it, vi } from "vitest"

const storage = vi.hoisted(() => ({
  files: new Map<string, string>(),
  secure: new Map<string, string>(),
}))

vi.mock("react-native", () => ({
  Platform: { OS: "ios", select: (values: Record<string, unknown>) => values.ios ?? values.default },
}))

vi.mock("expo-secure-store", () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  getItemAsync: async (key: string) => storage.secure.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    storage.secure.set(key, value)
  },
  deleteItemAsync: async (key: string) => {
    storage.secure.delete(key)
  },
}))

vi.mock("expo-file-system", () => ({
  Paths: { cache: "cache://" },
  File: class MockFile {
    readonly uri: string

    constructor(directory: string, name: string) {
      this.uri = `${directory}${name}`
    }

    get exists() {
      return storage.files.has(this.uri)
    }

    create() {
      if (!storage.files.has(this.uri)) storage.files.set(this.uri, "")
    }

    async text() {
      return storage.files.get(this.uri) ?? ""
    }

    async write(value: string) {
      storage.files.set(this.uri, value)
    }

    delete() {
      storage.files.delete(this.uri)
    }
  },
}))

beforeEach(() => {
  storage.files.clear()
  storage.secure.clear()
  vi.resetModules()
})

describe("persisted query cache", () => {
  it("tidak menyimpan respons tanpa sesi yang sudah terautentikasi", async () => {
    const persistence = await import("@/lib/query-cache-persistence")
    await persistence.persistQueryCacheEntry("public-or-private", { value: "no session" }, Date.now())
    await persistence.flushPersistedQueryCache()
    expect(storage.files.size).toBe(0)
    await expect(persistence.readPersistedQueryCacheEntry("public-or-private")).resolves.toBeNull()
  })

  it("memulihkan respons dari file setelah modul/aplikasi dimulai ulang", async () => {
    const session = await import("@/lib/api/session")
    await session.startSession({ accessToken: "token-akun-a" })
    const persistence = await import("@/lib/query-cache-persistence")

    await persistence.persistQueryCacheEntry("wallet", { availableBalance: 42 }, Date.now())
    await persistence.flushPersistedQueryCache()
    expect(storage.files.size).toBe(1)

    // Simulasikan proses baru: Map memory modul hilang, file + SecureStore tetap.
    vi.resetModules()
    const restarted = await import("@/lib/query-cache-persistence")
    await expect(restarted.readPersistedQueryCacheEntry("wallet")).resolves.toMatchObject({
      data: { availableBalance: 42 },
    })
  })

  it("cache akun lama tidak terbaca pada sesi baru dan dibuang saat cache baru ditulis", async () => {
    const session = await import("@/lib/api/session")
    await session.startSession({ accessToken: "token-akun-a" })
    let persistence = await import("@/lib/query-cache-persistence")
    await persistence.persistQueryCacheEntry("profile", { username: "akun-a" }, Date.now())
    await persistence.flushPersistedQueryCache()

    await session.startSession({ accessToken: "token-akun-b" })
    persistence = await import("@/lib/query-cache-persistence")
    await expect(persistence.readPersistedQueryCacheEntry("profile")).resolves.toBeNull()

    await persistence.persistQueryCacheEntry("profile", { username: "akun-b" }, Date.now())
    await persistence.flushPersistedQueryCache()
    const saved = JSON.parse([...storage.files.values()][0] ?? "{}") as {
      entries?: Array<{ scope: string; data: { username: string } }>
    }
    expect(saved.entries).toHaveLength(1)
    expect(saved.entries?.[0]?.scope).toContain("account:")
    expect(saved.entries?.[0]?.data.username).toBe("akun-b")
  })

  it("invalidasi key/prefix menghapus salinan persisten", async () => {
    const session = await import("@/lib/api/session")
    await session.startSession({ accessToken: "token-akun-a" })
    const persistence = await import("@/lib/query-cache-persistence")
    await persistence.persistQueryCacheEntry("orders:list", [1], Date.now())
    await persistence.persistQueryCacheEntry("orders:detail:1", { id: 1 }, Date.now())
    await persistence.persistQueryCacheEntry("wallet", { balance: 10 }, Date.now())
    await persistence.flushPersistedQueryCache()

    await persistence.invalidatePersistedQueryCache((key) => key.startsWith("orders:"))
    await expect(persistence.readPersistedQueryCacheEntry("orders:list")).resolves.toBeNull()
    await expect(persistence.readPersistedQueryCacheEntry("orders:detail:1")).resolves.toBeNull()
    await expect(persistence.readPersistedQueryCacheEntry("wallet")).resolves.toMatchObject({
      data: { balance: 10 },
    })
  })

  it("writeQueryCache menulis ke disk dan invalidasi prefix publik menghapusnya", async () => {
    const session = await import("@/lib/api/session")
    await session.startSession({ accessToken: "token-akun-a" })
    const queryCache = await import("@/lib/query-cache")
    const persistence = await import("@/lib/query-cache-persistence")

    queryCache.writeQueryCache("messages:room-1", [{ id: "m1" }])
    queryCache.writeQueryCache("wallet", { balance: 10 })
    await queryCache.flushPersistedQueryCache()
    await expect(persistence.readPersistedQueryCacheEntry("messages:room-1")).resolves.toMatchObject({
      data: [{ id: "m1" }],
    })

    queryCache.invalidateQueryPrefix("messages:")
    await queryCache.flushPersistedQueryCache()
    await expect(persistence.readPersistedQueryCacheEntry("messages:room-1")).resolves.toBeNull()
    await expect(persistence.readPersistedQueryCacheEntry("wallet")).resolves.toMatchObject({
      data: { balance: 10 },
    })

    await session.clearSession()
    await queryCache.flushPersistedQueryCache()
    expect(storage.files.size).toBe(0)
  })
})
