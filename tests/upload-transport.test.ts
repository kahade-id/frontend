/**
 * Audit upload 2026-10-09 — transport multipart XHR terpusat
 * (`uploadFileWithProgress`).
 *
 * Diuji dengan XMLHttpRequest palsu (Node tidak punya XHR): progress jujur,
 * timeout adaptif, cek NetInfo pra-upload, klasifikasi error per tipe
 * (413/5xx/timeout/network/abort/401), retry transien + backoff, dan
 * "JANGAN klaim offline tanpa verifikasi NetInfo".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const connectivity = vi.hoisted(() => {
  let offline = false
  return {
    isOfflineKnown: () => offline,
    setOffline(next: boolean) {
      offline = next
    },
    reset() {
      offline = false
    },
  }
})
vi.mock("@/lib/connectivity", () => ({
  isOfflineKnown: connectivity.isOfflineKnown,
}))

const session = vi.hoisted(() => {
  let token = "token-1" as string | null
  let fresh = "token-fresh" as string | null
  let refreshCalls = 0
  return {
    get refreshCalls() {
      return refreshCalls
    },
    setToken(t: string | null) {
      token = t
    },
    setFresh(t: string | null) {
      fresh = t
    },
    getAccessToken: async () => token,
    refreshAccessToken: async () => {
      refreshCalls += 1
      return fresh
    },
    reset() {
      token = "token-1"
      fresh = "token-fresh"
      refreshCalls = 0
    },
  }
})
vi.mock("@/lib/api/session", () => ({
  clearSession: async () => undefined,
  emitSessionExpired: () => undefined,
  getAccessToken: session.getAccessToken,
  getAppVersion: () => "1.0.0",
  getDeviceId: async () => "device-1",
  getDeviceInfo: () => "test",
  getRefreshToken: async () => "refresh-1",
  getSessionRevision: () => 1,
  refreshAccessToken: session.refreshAccessToken,
  setAccessToken: async () => undefined,
  setRefreshToken: async () => undefined,
}))
// refreshAccessToken dipanggil via client.ts (bukan session) — override hanya
// fungsi itu agar refresh tidak menyentuh jaringan asli (fetch ke API nyata).
vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>()
  return { ...actual, refreshAccessToken: session.refreshAccessToken }
})

import { isApiError } from "@/lib/api/errors"
import { UPLOAD_OFFLINE_COPY, UPLOAD_TIMEOUT_COPY, UPLOAD_UNSTABLE_COPY, uploadTimeoutMs } from "@/lib/upload-errors"
import { uploadFileWithProgress } from "@/lib/api/upload"

// ---------------------------------------------------------------------------
// XMLHttpRequest palsu
// ---------------------------------------------------------------------------

type ProgressEvent = { loaded: number; total: number; lengthComputable: boolean }

class FakeXHR {
  static instances: FakeXHR[] = []
  upload: { onprogress: ((e: ProgressEvent) => void) | null } = { onprogress: null }
  timeout = 0
  status = 0
  responseText = ""
  method = ""
  url = ""
  headers: Record<string, string> = {}
  sentBody: unknown = null
  aborted = false
  ontimeout: (() => void) | null = null
  onerror: (() => void) | null = null
  onload: (() => void) | null = null
  onabort: (() => void) | null = null

  open(method: string, url: string) {
    this.method = method
    this.url = url
  }
  setRequestHeader(key: string, value: string) {
    this.headers[key] = value
  }
  send(body: unknown) {
    this.sentBody = body
    FakeXHR.instances.push(this)
  }
  abort() {
    this.aborted = true
    this.onabort?.()
  }
  /** Kirim respons HTTP (status + body) — panggil setelah `send`. */
  respond(status: number, body: string, progress?: number) {
    if (progress != null && this.upload.onprogress) {
      this.upload.onprogress({ loaded: progress, total: 100, lengthComputable: true })
    }
    this.status = status
    this.responseText = body
    this.onload?.()
  }
  fireTimeout() {
    this.ontimeout?.()
  }
  fireError() {
    this.onerror?.()
  }
  static last(): FakeXHR {
    return this.instances[this.instances.length - 1]
  }
  static reset() {
    this.instances = []
  }
}

const fakeXhr = FakeXHR as unknown as typeof XMLHttpRequest

/**
 * `run()` transport bersifat async (getAccessToken → sendOnce), jadi XHR
 * muncul pada microtask berikutnya — tunggu n XHR sebelum berinteraksi.
 */
async function waitForXhrCount(n: number): Promise<void> {
  for (let i = 0; i < 500; i++) {
    if (FakeXHR.instances.length >= n) return
    await new Promise((r) => setTimeout(r, 1))
  }
  throw new Error(`Menunggu ${n} XHR, hanya ada ${FakeXHR.instances.length}`)
}

beforeEach(() => {
  FakeXHR.reset()
  connectivity.reset()
  session.reset()
  vi.stubGlobal("XMLHttpRequest", fakeXhr)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const okBody = JSON.stringify({ fileKey: "fk-1", fileUrl: "https://cdn/fk-1", thumbnailFileKey: "th-1" })

describe("uploadFileWithProgress — sukses & progress jujur", () => {
  it("200 → objek respons apa adanya + field direkt", async () => {
    const p = uploadFileWithProgress({} as unknown as FormData)
    await waitForXhrCount(1)
    FakeXHR.last().respond(200, okBody, 42)
    await expect(p).resolves.toMatchObject({ fileKey: "fk-1", thumbnailFileKey: "th-1" })
    const xhr = FakeXHR.last()
    expect(xhr.method).toBe("POST")
    expect(xhr.headers["Authorization"]).toBe("Bearer token-1")
    expect(xhr.headers["Content-Type"]).toBeUndefined() // XHR isi boundary sendiri
  })

  it("melaporkan progress fraksi 0–1 dari xhr.upload.onprogress", async () => {
    const seen: number[] = []
    const p = uploadFileWithProgress({} as unknown as FormData, {
      onProgress: (f) => seen.push(f),
    })
    await waitForXhrCount(1)
    const xhr = FakeXHR.last()
    xhr.upload.onprogress?.({ loaded: 10, total: 100, lengthComputable: true })
    xhr.upload.onprogress?.({ loaded: 90, total: 100, lengthComputable: true })
    xhr.respond(200, okBody)
    await p
    expect(seen).toEqual([0.1, 0.9])
  })

  it("body bukan objek JSON → PARSE (fail-closed)", async () => {
    const p = uploadFileWithProgress({} as unknown as FormData)
    await waitForXhrCount(1)
    FakeXHR.last().respond(200, "html garbage")
    await expect(p).rejects.toMatchObject({ code: "PARSE" })
  })

  it("Idempotency-Key diteruskan bila diberikan (kebutuhan chat BFE-001)", async () => {
    const p = uploadFileWithProgress({} as unknown as FormData, { idempotencyKey: "uuid-abc" })
    await waitForXhrCount(1)
    FakeXHR.last().respond(200, okBody)
    await p
    expect(FakeXHR.last().headers["Idempotency-Key"]).toBe("uuid-abc")
  })
})

describe("uploadFileWithProgress — timeout adaptif (audit B4/B6)", () => {
  it("tanpa fileBytes → basis foto 60 dtk (bukan 20 dtk default fetch)", async () => {
    const p = uploadFileWithProgress({} as unknown as FormData)
    await waitForXhrCount(1)
    FakeXHR.last().respond(200, okBody)
    await p
    expect(FakeXHR.last().timeout).toBe(60_000)
  })

  it("fileBytes menentukan deadline: 5 MB foto → 60 dtk + 51,2 dtk transfer", async () => {
    const p = uploadFileWithProgress({} as unknown as FormData, { fileBytes: 5 * 1024 * 1024 })
    await waitForXhrCount(1)
    FakeXHR.last().respond(200, okBody)
    await p
    expect(FakeXHR.last().timeout).toBe(uploadTimeoutMs(5 * 1024 * 1024, "photo"))
    expect(FakeXHR.last().timeout).toBeGreaterThan(20_000)
  })

  it("timeoutMs eksplisit menang atas rumus", async () => {
    const p = uploadFileWithProgress(
      {} as unknown as FormData,
      { fileBytes: 5 * 1024 * 1024, timeoutMs: 777 },
    )
    await waitForXhrCount(1)
    FakeXHR.last().respond(200, okBody)
    await p
    expect(FakeXHR.last().timeout).toBe(777)
  })
})

describe("uploadFileWithProgress — klasifikasi error per tipe", () => {
  it("413 → PAYLOAD_TOO_LARGE + backendCode (UI mengisi 'maks X MB')", async () => {
    const p = uploadFileWithProgress({} as unknown as FormData)
    await waitForXhrCount(1)
    FakeXHR.last().respond(413, JSON.stringify({ errors: { code: "FILE_TOO_LARGE" } }))
    const err: unknown = await p.catch((e) => e)
    expect(isApiError(err)).toBe(true)
    if (!isApiError(err)) return
    expect(err.code).toBe("PAYLOAD_TOO_LARGE")
    expect(err.status).toBe(413)
    expect(err.backendCode).toBe("FILE_TOO_LARGE")
    // 4xx TIDAK di-retry — satu attempt saja.
    expect(FakeXHR.instances).toHaveLength(1)
  })

  it("400 + MIME_TYPE_MISMATCH → copy klien spesifik, tanpa retry", async () => {
    const p = uploadFileWithProgress({} as unknown as FormData)
    await waitForXhrCount(1)
    FakeXHR.last().respond(400, JSON.stringify({ errors: { code: "MIME_TYPE_MISMATCH" } }))
    const err: unknown = await p.catch((e) => e)
    expect(isApiError(err)).toBe(true)
    if (!isApiError(err)) return
    expect(err.backendCode).toBe("MIME_TYPE_MISMATCH")
    expect(err.clientMessage).toBe(true)
    expect(FakeXHR.instances).toHaveLength(1)
  })

  it("500 → SERVER (retry transien: 3 percobaan total, lalu gagal)", async () => {
    const p = uploadFileWithProgress({} as unknown as FormData, { retryBaseMs: 1 })
    // Setiap kali XHR baru muncul, jawab 500 — sampai 3 attempt.
    let answered = 0
    while (answered < 3) {
      await waitForXhrCount(answered + 1)
      FakeXHR.instances[answered].respond(500, JSON.stringify({ message: "boom" }))
      answered += 1
    }
    const err: unknown = await p.catch((e) => e)
    expect(isApiError(err)).toBe(true)
    if (!isApiError(err)) return
    expect(err.code).toBe("SERVER")
    expect(FakeXHR.instances).toHaveLength(3) // 1 + 2 retry
  })

  it("ontimeout → TIMEOUT, attempt 2 sukses (retry transien + backoff)", async () => {
    const p = uploadFileWithProgress({} as unknown as FormData, { retryBaseMs: 1 })
    await waitForXhrCount(1)
    FakeXHR.last().fireTimeout()
    await waitForXhrCount(2)
    FakeXHR.last().respond(200, okBody)
    await expect(p).resolves.toMatchObject({ fileKey: "fk-1" })
    expect(FakeXHR.instances).toHaveLength(2)
  })

  it("TIMEOUT akhir membawa pesan upload-specific (bukan 'server terlalu lama')", async () => {
    const p = uploadFileWithProgress({} as unknown as FormData, { retryBaseMs: 1 })
    let fired = 0
    while (fired < 3) {
      await waitForXhrCount(fired + 1)
      FakeXHR.instances[fired].fireTimeout()
      fired += 1
    }
    const err: unknown = await p.catch((e) => e)
    expect(isApiError(err)).toBe(true)
    if (!isApiError(err)) return
    expect(err.code).toBe("TIMEOUT")
    expect(err.message).toBe(UPLOAD_TIMEOUT_COPY)
    expect(err.message).not.toContain("Server terlalu lama")
  })

  it("onerror (socket putus) → NETWORK 'terputus' — JANGAN 'tidak ada koneksi' tanpa verifikasi", async () => {
    const p = uploadFileWithProgress({} as unknown as FormData, { retryBaseMs: 1 })
    let fired = 0
    while (fired < 3) {
      await waitForXhrCount(fired + 1)
      FakeXHR.instances[fired].fireError()
      fired += 1
    }
    const err: unknown = await p.catch((e) => e)
    expect(isApiError(err)).toBe(true)
    if (!isApiError(err)) return
    expect(err.code).toBe("NETWORK")
    expect(err.backendCode).not.toBe("OFFLINE_VERIFIED")
    expect(err.message).toBe(UPLOAD_UNSTABLE_COPY)
    expect(err.message).not.toContain("Tidak ada koneksi internet")
  })

  it("401 → refresh sekali lalu kirim ulang dengan token baru", async () => {
    const p = uploadFileWithProgress({} as unknown as FormData)
    await waitForXhrCount(1)
    FakeXHR.last().respond(401, "{}")
    await waitForXhrCount(2)
    const second = FakeXHR.last()
    second.respond(200, okBody)
    await expect(p).resolves.toMatchObject({ fileKey: "fk-1" })
    expect(session.refreshCalls).toBe(1)
    expect(second.headers["Authorization"]).toBe("Bearer token-fresh")
  })

  it("401 dua kali (refresh gagal) → UNAUTHORIZED", async () => {
    session.setFresh(null)
    const p = uploadFileWithProgress({} as unknown as FormData)
    await waitForXhrCount(1)
    FakeXHR.last().respond(401, "{}")
    const err: unknown = await p.catch((e) => e)
    expect(isApiError(err)).toBe(true)
    if (!isApiError(err)) return
    expect(err.code).toBe("UNAUTHORIZED")
    expect(FakeXHR.instances).toHaveLength(1)
  })
})

describe("uploadFileWithProgress — cek NetInfo & batalkan (audit A3/D)", () => {
  it("perangkat offline → gagal CEPAT dengan OFFLINE_VERIFIED, XHR tidak pernah dibuat", async () => {
    connectivity.setOffline(true)
    const p = uploadFileWithProgress({} as unknown as FormData)
    const err: unknown = await p.catch((e) => e)
    expect(isApiError(err)).toBe(true)
    if (!isApiError(err)) return
    expect(err.backendCode).toBe("OFFLINE_VERIFIED")
    expect(err.message).toBe(UPLOAD_OFFLINE_COPY)
    expect(FakeXHR.instances).toHaveLength(0)
  })

  it("signal sudah aborted → ABORTED tanpa XHR", async () => {
    const controller = new AbortController()
    controller.abort()
    const p = uploadFileWithProgress({} as unknown as FormData, { signal: controller.signal })
    await expect(p).rejects.toMatchObject({ code: "ABORTED" })
    expect(FakeXHR.instances).toHaveLength(0)
  })

  it("abort di tengah transfer → ABORTED (batal per file)", async () => {
    const controller = new AbortController()
    const p = uploadFileWithProgress({} as unknown as FormData, { signal: controller.signal })
    await waitForXhrCount(1)
    const xhr = FakeXHR.last()
    // Transfer berjalan (belum onload) → user batalkan.
    controller.abort()
    await expect(p).rejects.toMatchObject({ code: "ABORTED" })
    expect(xhr.aborted).toBe(true)
  })

  it("device baru offline SEBELUM retry → berhenti OFFLINE_VERIFIED (jangan bakar retry)", async () => {
    const p = uploadFileWithProgress({} as unknown as FormData, { retryBaseMs: 1 })
    await waitForXhrCount(1)
    FakeXHR.last().fireError() // attempt 1 gagal transien
    connectivity.setOffline(true) // perangkat baru saja offline
    const err: unknown = await p.catch((e) => e)
    expect(isApiError(err)).toBe(true)
    if (!isApiError(err)) return
    expect(err.backendCode).toBe("OFFLINE_VERIFIED")
    expect(FakeXHR.instances).toHaveLength(1)
  })
})
