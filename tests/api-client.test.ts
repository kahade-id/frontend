/**
 * H-01 (audit 2026-09-20): logika transport paling kritis — 401→refresh→
 * replay, single-flight refresh, "429/offline TIDAK logout", pembatalan
 * respons lama lewat revision sesi, retry-backoff GET-only, dan dedupe GET —
 * sebelumnya nol test. Semua diuji di sini dengan `vi.stubGlobal("fetch")`
 * pada boundary HTTP tunggal app (lib/api/client.ts).
 *
 * Platform stub vitest = web → token tersimpan di memory (lihat
 * tests/secure-storage-web.test.ts), jadi test tidak menyentuh storage nyata.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ApiError } from "@/lib/api/errors"
import { http } from "@/lib/api/client"
import {
  clearSession,
  getAccessToken,
  getSessionRevision,
  onSessionExpired,
  setAccessToken,
  setRefreshToken,
  startSession,
} from "@/lib/api/session"

// ------------------------------------------------------------------
// Util respons
// ------------------------------------------------------------------

type FetchCall = { url: string; init: RequestInit & { headers: Record<string, string> } }

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  })
}

const ok = (data: unknown) => jsonResponse(200, { success: true, data })
const REFRESH_PATH = "/v1/auth/refresh"

/**
 * Mock fetch berbasis rute: `refresh` menangani /v1/auth/refresh; `others`
 * adalah antrean FIFO untuk path lain (setiap panggilan mengambil satu).
 */
function installFetch(options: {
  refresh: (() => Response | Promise<Response>) | Response
  others?: (Response | (() => Response | Promise<Response>))[]
}) {
  const calls: FetchCall[] = []
  const queue = [...(options.others ?? [])]
  const impl = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init: { ...(init ?? {}), headers: { ...((init?.headers as Record<string, string>) ?? {}) } } })
    const produce = url.includes(REFRESH_PATH) ? options.refresh : queue.shift()
    if (!produce) throw new Error(`fetch tak terduga: ${url} (antrean habis)`)
    const value = typeof produce === "function" ? await produce() : produce
    return value
  })
  vi.stubGlobal("fetch", impl)
  return {
    impl,
    calls,
    moneyCalls: () => calls.filter((c) => !c.url.includes(REFRESH_PATH)),
    refreshCalls: () => calls.filter((c) => c.url.includes(REFRESH_PATH)),
    next: () => queue.shift() ?? ok(null),
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(async () => {
  await clearSession()
  await setAccessToken("access-lama")
  await setRefreshToken("refresh-lama")
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

// ------------------------------------------------------------------
// 401 → refresh → replay
// ------------------------------------------------------------------

describe("401 → refresh → replay", () => {
  it("replay berbagi Idempotency-Key yang sama dan memakai token baru", async () => {
    const fetchMock = installFetch({
      refresh: ok({ accessToken: "access-baru", refreshToken: "refresh-baru" }),
      others: [jsonResponse(401, { success: false, message: "token kedaluwarsa" }), ok({ id: "pay-1" })],
    })

    const result = await http.post<{ id: string }, { amount: number }>(
      "/v1/wallet/topup",
      { amount: 50_000 },
      { auth: "required" },
    )
    expect(result).toEqual({ id: "pay-1" })

    const money = fetchMock.moneyCalls()
    expect(money).toHaveLength(2)
    const [first, second] = money
    // Kunci idempotensi SATU per panggilan logis — percobaan ulang harus
    // dikenali backend sebagai permintaan yang sama (nyawa double-charge).
    expect(first.init.headers["Idempotency-Key"]).toBeTruthy()
    expect(second.init.headers["Idempotency-Key"]).toBe(first.init.headers["Idempotency-Key"])
    expect(first.init.headers.Authorization).toBe("Bearer access-lama")
    expect(second.init.headers.Authorization).toBe("Bearer access-baru")
    expect(fetchMock.refreshCalls()).toHaveLength(1)

    // token baru tersimpan (rotasi refresh ikut dipersist)
    expect(await getAccessToken()).toBe("access-baru")
  })

  it("401 kedua setelah refresh → logout (UNAUTHORIZED + sesi dibersihkan)", async () => {
    const expired = vi.fn()
    const unsubscribe = onSessionExpired(expired)
    installFetch({
      refresh: ok({ accessToken: "access-baru" }),
      others: [jsonResponse(401, {}), jsonResponse(401, {})],
    })

    await expect(http.post("/v1/wallet/topup", {}, { auth: "required" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    })
    expect(await getAccessToken()).toBeNull()
    expect(expired).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it("refresh 401/403 → null → logout; refresh 429/5xx → TIDAK logout", async () => {
    // 429: throttle bukan akhir sesi — token & revision harus utuh.
    const fetchMock = installFetch({
      refresh: () => jsonResponse(429, { success: false, message: "tunggu" }, { "Retry-After": "2" }),
      others: [jsonResponse(401, {})],
    })
    const revisionBefore = getSessionRevision()

    const error = await http
      .get("/v1/wallet/me", { auth: "required" })
      .then(() => null, (e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe("RATE_LIMITED")
    expect((error as ApiError).retryAfterMs).toBe(2000) // UI bisa menghitung mundur
    expect(await getAccessToken()).toBe("access-lama") // TIDAK dilogoutkan
    expect(getSessionRevision()).toBe(revisionBefore)
    expect(fetchMock.refreshCalls()).toHaveLength(1)

    // 401 dari endpoint refresh = refresh token mati → baru boleh logout.
    installFetch({
      refresh: () => jsonResponse(401, { success: false }),
      others: [jsonResponse(401, {})],
    })
    await expect(http.get("/v1/wallet/me", { auth: "required" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    })
    expect(await getAccessToken()).toBeNull()
  })
})

describe("single-flight refresh", () => {
  it("dua request 401 paralel hanya menembak SATU refresh", async () => {
    const gate = deferred<void>()
    let refreshCount = 0
    const fetchMock = installFetch({
      refresh: async () => {
        refreshCount += 1
        await gate.promise // tahan supaya kedua request masuk ke flight yang sama
        return ok({ accessToken: "access-baru" })
      },
      others: [
        jsonResponse(401, {}),
        jsonResponse(401, {}),
        () => ok({ a: 1 }),
        () => ok({ b: 2 }),
      ],
    })

    // Lepas refresh setelah kedua request pasti menunggunya.
    setTimeout(() => gate.resolve(), 10)
    const [resA, resB] = await Promise.all([
      http.post("/v1/a", {}, { auth: "required" }),
      http.post("/v1/b", {}, { auth: "required" }),
    ])
    expect(resA).toEqual({ a: 1 })
    expect(resB).toEqual({ b: 2 })
    expect(refreshCount).toBe(1)
    expect(fetchMock.refreshCalls()).toHaveLength(1)
  })
})

describe("revision sesi membatalkan respons lama", () => {
  it("login baru saat request terbang → request lama menolak ABORTED, nilai dibuang", async () => {
    const gate = deferred<Response>()
    installFetch({ refresh: ok({ accessToken: "x" }), others: [() => gate.promise] })

    const pending = http.get("/v1/wallet/me", { auth: "required" })
    pending.catch(() => undefined) // cegah unhandled rejection sebelum assertion
    // Akun lain login di tengah penerbangan (mis. logout→login cepat).
    await startSession({ accessToken: "access-akun-baru", refreshToken: "rt-baru" })
    gate.resolve(ok({ saldo: 999 })) // data akun LAMA tiba

    await expect(pending).rejects.toMatchObject({ code: "ABORTED" })
    // token akun baru tidak tertimpa data/refresh lama
    expect(await getAccessToken()).toBe("access-akun-baru")
  })
})

describe("dedupe GET in-flight", () => {
  it("dua GET identik bersamaan → satu fetch, hasil dibagi", async () => {
    const gate = deferred<Response>()
    const fetchMock = installFetch({ refresh: ok({}), others: [() => gate.promise] })

    const p1 = http.get("/v1/notifications", { auth: "required" })
    const p2 = http.get("/v1/notifications", { auth: "required" })
    gate.resolve(ok([{ id: "n1" }]))
    expect(await p1).toEqual([{ id: "n1" }])
    expect(await p2).toEqual([{ id: "n1" }])
    expect(fetchMock.moneyCalls()).toHaveLength(1)
  })
})

describe("retry & timeout", () => {
  it("GET retry≤2 dengan backoff 400ms×n untuk error transient", async () => {
    vi.useFakeTimers()
    const fetchMock = installFetch({
      refresh: ok({}),
      others: [jsonResponse(500, {}), jsonResponse(503, {}), ok({ pulih: true })],
    })

    const pending = http.get("/v1/wallet/me", { auth: "required", retry: 2 })
    // Satu lompatan 1.500ms mencakup backoff 400ms + 800ms; timer yang baru
    // terdaftar saat window berjalan ikut dieksekusi advanceTimersByTimeAsync.
    await vi.advanceTimersByTimeAsync(1_500)
    await expect(pending).resolves.toEqual({ pulih: true })
    expect(fetchMock.moneyCalls()).toHaveLength(3)
  })

  it("MUTASI tidak pernah di-retry otomatis meski diminta retry besar", async () => {
    const fetchMock = installFetch({ refresh: ok({}), others: [jsonResponse(500, {})] })
    await expect(
      http.post("/v1/wallet/withdraw", {}, { auth: "required", retry: 5 }),
    ).rejects.toMatchObject({ code: "SERVER" })
    expect(fetchMock.moneyCalls()).toHaveLength(1)
  })

  it("timeout mencakup pembacaan body → ApiError TIMEOUT", async () => {
    vi.useFakeTimers()
    installFetch({ refresh: ok({}), others: [() => new Promise<Response>(() => undefined)] })

    const pending = http.get("/v1/wallet/me", { auth: "required", timeoutMs: 5_000 })
    // Rejection terjadi DI TENGAH advanceTimersByTimeAsync — tanpa handler
    // yang terpasang lebih dulu, Node mencatatnya sebagai unhandled rejection
    // walau assertion di bawah pasti menangkapnya.
    pending.catch(() => undefined)
    await vi.advanceTimersByTimeAsync(5_001)
    await expect(pending).rejects.toMatchObject({ code: "TIMEOUT" })
  })

  it("AbortSignal pemanggil → ApiError ABORTED sebelum fetch", async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      http.get("/v1/wallet/me", { auth: "required", signal: controller.signal }),
    ).rejects.toMatchObject({ code: "ABORTED" })
  })
})
