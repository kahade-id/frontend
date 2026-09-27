/**
 * GAP-B2 (G125): verifikasi envelope HMAC event realtime.
 *
 * - `hmacSha256Hex` diuji melawan `node:crypto` (vektor RFC 4231 +
 *   vektor acak) — implementasi murni-TS harus bit-identik.
 * - `verifyAndUnwrapEvent` diuji: envelope valid lolos & terkupas,
 *   signature salah ditolak, envelope basi ditolak, event tanpa
 *   signature ditolak saat kunci sesi ada (downgrade protection),
 *   dan diterima saat server tanpa HMAC (kompatibilitas).
 */
import { createHmac, randomBytes } from "node:crypto"
import { describe, expect, it } from "vitest"

import { hmacSha256Hex, verifyAndUnwrapEvent } from "@/lib/realtime/hmac"

describe("hmacSha256Hex — kompatibel node:crypto", () => {
  it("cocok untuk vektor RFC 4231 (kunci 20×0x0b, 'Hi There')", () => {
    const key = "\x0b".repeat(20)
    const expected = createHmac("sha256", key).update("Hi There").digest("hex")
    expect(hmacSha256Hex(key, "Hi There")).toBe(expected)
    expect(expected).toBe(
      "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7",
    )
  })

  it("cocok untuk 25 pasangan kunci/pesan acak", () => {
    for (let i = 0; i < 25; i++) {
      const key = randomBytes(16 + (i % 48)).toString("hex")
      const msg = randomBytes(64).toString("hex")
      expect(hmacSha256Hex(key, msg)).toBe(
        createHmac("sha256", key).update(msg).digest("hex"),
      )
    }
  })
})

/** Meniru `signWithKey` backend: _ts + JSON + _signature. */
function signLikeBackend(key: string, payload: Record<string, unknown>) {
  const withTs = { ...payload, _ts: Date.now() }
  const raw = JSON.stringify(withTs)
  return { ...withTs, _signature: createHmac("sha256", key).update(raw).digest("hex") }
}

describe("verifyAndUnwrapEvent", () => {
  const key = randomBytes(32).toString("hex")

  it("envelope valid → lolos dan terkupas dari _ts/_signature", () => {
    const env = signLikeBackend(key, { roomId: "r1", text: "halo" })
    const out = verifyAndUnwrapEvent(env, key)
    expect(out).toEqual({ roomId: "r1", text: "halo" })
  })

  it("signature salah → ditolak", () => {
    const env = signLikeBackend(key, { roomId: "r1" })
    env._signature = "0".repeat(64)
    expect(verifyAndUnwrapEvent(env, key)).toBeNull()
  })

  it("envelope basi (> 5 menit) → ditolak", () => {
    const withTs = { roomId: "r1", _ts: Date.now() - 10 * 60 * 1000 }
    const raw = JSON.stringify(withTs)
    const env = { ...withTs, _signature: createHmac("sha256", key).update(raw).digest("hex") }
    expect(verifyAndUnwrapEvent(env, key)).toBeNull()
  })

  it("payload bukan objek → ditolak", () => {
    expect(verifyAndUnwrapEvent("bukan-objek", key)).toBeNull()
    expect(verifyAndUnwrapEvent(null, key)).toBeNull()
  })

  it("event tanpa signature + kunci sesi ada → ditolak (anti-downgrade)", () => {
    expect(verifyAndUnwrapEvent({ roomId: "r1", _ts: Date.now() }, key)).toBeNull()
  })

  it("event tanpa signature + tanpa kunci → diterima (server HMAC nonaktif)", () => {
    expect(verifyAndUnwrapEvent({ roomId: "r1" }, null)).toEqual({ roomId: "r1" })
  })

  it("kunci belum tiba tapi event bertanda → diterima (race connect)", () => {
    const env = signLikeBackend(key, { roomId: "r1" })
    expect(verifyAndUnwrapEvent(env, null)).toEqual({ roomId: "r1" })
  })
})
