/**
 * BUG #2 (2026-09-26): error PUT ke R2 sebelumnya dibuang dan diganti pesan
 * generik "Unggah berkas gagal" — penyebab asli tak terlacak. Test ini
 * memastikan detail error asli (HTTP status + kode XML R2) diteruskan ke
 * ApiError dan userMessage() menampilkan pesan informatif.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api/client", () => ({ http: {}, seg: (x: string) => x }))

import { uploadToPresignedUrl } from "@/lib/api/upload"
import { ApiError, userMessage } from "@/lib/api/errors"

const BLOB = new Blob(["photo"], { type: "image/jpeg" })
const UPLOAD = { url: "https://storage.example/signed", method: "PUT" as const }

function r2Error(status: number, code: string) {
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Error><Code>${code}</Code><Message>simulated</Message>` +
    `<Resource>uploads/showcase-images/key</Resource></Error>`
  return new Response(xml, { status, headers: { "Content-Type": "application/xml" } })
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe("uploadToPresignedUrl — BUG #2 error R2 tidak dibuang", () => {
  it("403 SignatureDoesNotMatch → FORBIDDEN + pesan informatif + backendCode R2", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(r2Error(403, "SignatureDoesNotMatch")))
    const err = await uploadToPresignedUrl(UPLOAD, BLOB, "foto.jpg").catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe("FORBIDDEN")
    expect(err.status).toBe(403)
    expect(err.backendCode).toBe("R2_SignatureDoesNotMatch")
    expect(err.message).toContain("Tanda tangan unggahan tidak cocok")
    // userMessage() harus menampilkan pesan informatif, bukan generik.
    expect(userMessage(err)).toContain("Tanda tangan unggahan tidak cocok")
  })

  it("400 EntityTooLarge → BAD_REQUEST + pesan batas ukuran", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(r2Error(400, "EntityTooLarge")))
    const err = await uploadToPresignedUrl(UPLOAD, BLOB, "foto.jpg").catch((e) => e)
    expect(err.code).toBe("BAD_REQUEST")
    expect(err.backendCode).toBe("R2_EntityTooLarge")
    expect(userMessage(err)).toContain("melebihi batas penyimpanan")
  })

  it("500 tanpa body → SERVER dengan status tercatat untuk diagnostik", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 500 })))
    const err = await uploadToPresignedUrl(UPLOAD, BLOB, "foto.jpg").catch((e) => e)
    expect(err.code).toBe("SERVER")
    expect(err.status).toBe(500)
    expect(err.backendCode).toBe("R2_HTTP_ERROR")
    expect(err.message).toContain("HTTP 500")
  })

  it("fetch gagal total (offline) → NETWORK, bukan TypeError mentah", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network request failed")))
    const err = await uploadToPresignedUrl(UPLOAD, BLOB, "foto.jpg").catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe("NETWORK")
  })

  it("PUT sukses → resolve tanpa error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 200 })))
    await expect(uploadToPresignedUrl(UPLOAD, BLOB, "foto.jpg")).resolves.toBeUndefined()
  })
})
