/**
 * ST-002 (PERF-FIX 2026-09-29): session restore non-blocking, fail-closed.
 *
 * Mengunci dua fase `lib/auth-restore.ts`:
 *   Fase 1 (`planSessionRestore`) — HANYA bacaan lokal, tanpa jaringan:
 *     - flag signed-out → "signed-out", tanpa satu pun panggilan fetch
 *     - access token tersimpan → "cached", tanpa satu pun panggilan fetch
 *     - tanpa access token → "verify" (render optimistis + refresh background)
 *   Fase 2 (`verifySessionInBackground`):
 *     - SUKSES (200): token baru tersimpan, snapshot terbit, TIDAK ada
 *       pembersihan sesi dan TIDAK ada emit session-expired.
 *     - GAGAL AUTH (401/403): FAIL-CLOSED — sesi dibersihkan total
 *       (token hilang dari storage + memory) dan `emitSessionExpired`
 *       dipancarkan supaya root layout melempar ke login. Konten
 *       terautentikasi tidak pernah ditampilkan dengan sesi invalid.
 *     - GAGAL JARINGAN (throw): FAIL-OPEN — sesi TIDAK disentuh, tidak ada
 *       emit; kegagalan hanya tercatat di telemetri.
 *
 * Platform stub vitest = web → secure storage memory-only; fetch di-stub
 * per-test pada boundary HTTP tunggal `refreshAccessToken`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  planSessionRestore,
  verifySessionInBackground,
} from "@/lib/auth-restore"
import {
  clearSession,
  getAccessToken,
  getSessionRevision,
  getSessionSnapshot,
  onSessionExpired,
  setAccessToken,
  setRefreshToken,
} from "@/lib/api/session"
import { deleteSecureItem, getSecureItem, SecureKeys, setSecureItem } from "@/lib/secure-storage"

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}
const ok = (data: unknown) => jsonResponse(200, { success: true, data })
const REFRESH_PATH = "/v1/auth/refresh"

/** Stub fetch; catat semua panggilan agar "tanpa jaringan" bisa dibuktikan. */
function installFetch(impl: (url: string) => Response | Promise<Response>) {
  const calls: string[] = []
  const mock = vi.fn(async (input: unknown) => {
    const url = String(input)
    calls.push(url)
    return impl(url)
  })
  vi.stubGlobal("fetch", mock)
  return { calls, refreshCalls: () => calls.filter((u) => u.includes(REFRESH_PATH)) }
}

beforeEach(async () => {
  await clearSession()
  // clearSession() menandai "signed out" — untuk skenario "pengguna masih
  // punya sesi / instalasi baru", flag itu harus dihapus dulu (di dunia
  // nyata flag hanya ada setelah logout eksplisit).
  await deleteSecureItem(SecureKeys.sessionSignedOut)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ------------------------------------------------------------------
// Fase 1: perencanaan — lokal saja, tanpa jaringan
// ------------------------------------------------------------------

describe("ST-002 fase 1: planSessionRestore tidak menyentuh jaringan", () => {
  it("flag signed-out → 'signed-out' tanpa panggilan fetch", async () => {
    await setSecureItem(SecureKeys.sessionSignedOut, "1")
    const { refreshCalls } = installFetch(() => {
      throw new Error("fetch tidak boleh dipanggil di fase 1")
    })

    const plan = await planSessionRestore()

    expect(plan).toEqual({ kind: "signed-out" })
    expect(refreshCalls()).toHaveLength(0)
  })

  it("access token tersimpan → 'cached' tanpa panggilan fetch", async () => {
    await setAccessToken("token-lama")
    const { refreshCalls } = installFetch(() => {
      throw new Error("fetch tidak boleh dipanggil di fase 1")
    })

    const plan = await planSessionRestore()

    expect(plan).toEqual({ kind: "cached" })
    expect(refreshCalls()).toHaveLength(0)
    // Token tidak diganggu fase 1.
    expect(await getAccessToken()).toBe("token-lama")
  })

  it("tanpa access token → 'verify' (render optimistis + refresh background)", async () => {
    const { refreshCalls } = installFetch(() => {
      throw new Error("fetch tidak boleh dipanggil di fase 1")
    })

    const plan = await planSessionRestore()

    expect(plan).toEqual({ kind: "verify" })
    expect(refreshCalls()).toHaveLength(0)
  })
})

// ------------------------------------------------------------------
// Fase 2: verifikasi background
// ------------------------------------------------------------------

describe("ST-002 fase 2: refresh SUKSES", () => {
  it("token baru tersimpan; tanpa pembersihan sesi; tanpa session-expired", async () => {
    const expired = vi.fn()
    const unsub = onSessionExpired(expired)
    const revisionBefore = getSessionRevision()
    installFetch((url) =>
      url.includes(REFRESH_PATH)
        ? ok({ accessToken: "token-baru", refreshToken: "refresh-baru" })
        : jsonResponse(404, {}),
    )

    const outcome = await verifySessionInBackground()

    expect(outcome).toEqual({ ok: true, token: "token-baru" })
    // Token baru terbit ke snapshot (guard rute lolos) dan tersimpan.
    expect(getSessionSnapshot()).toBe("token-baru")
    expect(await getAccessToken()).toBe("token-baru")
    expect(await getSecureItem(SecureKeys.refreshToken)).toBe("refresh-baru")
    // Sesi TIDAK dibersihkan: revisi tidak naik, tidak ada emit expired.
    expect(getSessionRevision()).toBe(revisionBefore)
    expect(expired).not.toHaveBeenCalled()
    unsub()
  })
})

describe("ST-002 fase 2: refresh GAGAL AUTH (401) → fail-closed", () => {
  it("sesi dibersihkan total + session-expired di-emit (lempar ke login)", async () => {
    const expired = vi.fn()
    const unsub = onSessionExpired(expired)
    await setRefreshToken("refresh-basi")
    installFetch((url) =>
      url.includes(REFRESH_PATH)
        ? jsonResponse(401, { success: false, message: "refresh token revoked" })
        : jsonResponse(404, {}),
    )

    const outcome = await verifySessionInBackground()

    expect(outcome).toEqual({ ok: false, reason: "invalid" })
    // FAIL-CLOSED: tidak ada token tersisa di memory maupun storage.
    expect(getSessionSnapshot()).toBeNull()
    expect(await getAccessToken()).toBeNull()
    expect(await getSecureItem(SecureKeys.accessToken)).toBeNull()
    expect(await getSecureItem(SecureKeys.refreshToken)).toBeNull()
    // ...dan root layout diberi sinyal untuk melempar pengguna ke login.
    expect(expired).toHaveBeenCalledTimes(1)
    unsub()
  })

  it("403 diperlakukan sama dengan 401 (refresh invalid)", async () => {
    const expired = vi.fn()
    const unsub = onSessionExpired(expired)
    installFetch((url) =>
      url.includes(REFRESH_PATH)
        ? jsonResponse(403, { success: false, message: "forbidden" })
        : jsonResponse(404, {}),
    )

    const outcome = await verifySessionInBackground()

    expect(outcome).toEqual({ ok: false, reason: "invalid" })
    expect(expired).toHaveBeenCalledTimes(1)
    unsub()
  })
})

describe("ST-002 fase 2: refresh GAGAL JARINGAN → fail-open", () => {
  it("sesi TIDAK dibersihkan; tidak ada session-expired; hanya tercatat", async () => {
    const expired = vi.fn()
    const unsub = onSessionExpired(expired)
    const revisionBefore = getSessionRevision()
    await setAccessToken("token-lama")
    await setRefreshToken("refresh-lama")
    installFetch(() => {
      throw new TypeError("Network request failed")
    })

    const outcome = await verifySessionInBackground()

    expect(outcome.ok).toBe(false)
    expect(outcome).toMatchObject({ reason: "network" })
    // FAIL-OPEN: token lama tetap ada — kegagalan jaringan bukan bukti
    // sesi invalid, jadi pengguna TIDAK di-logout.
    expect(getSessionSnapshot()).toBe("token-lama")
    expect(await getAccessToken()).toBe("token-lama")
    expect(getSessionRevision()).toBe(revisionBefore)
    expect(expired).not.toHaveBeenCalled()
    unsub()
  })
})
