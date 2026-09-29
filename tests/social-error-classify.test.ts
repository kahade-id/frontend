/**
 * UI-UX T4-011: klasifikasi error login sosial — batal → diam, network →
 * pesan koneksi, lainnya → pesan generik (jangan tuduh koneksi, jangan
 * tampilkan pesan mentah SDK yang bisa berbahasa Inggris).
 */
import { describe, expect, it } from "vitest"

import { classifySocialError, SocialCancelledError } from "@/lib/social-oauth"

describe("classifySocialError", () => {
  it("pembatalan user → cancelled", () => {
    expect(classifySocialError(new SocialCancelledError())).toBe("cancelled")
  })

  it("ApiError NETWORK/TIMEOUT → network", () => {
    expect(classifySocialError({ code: "NETWORK" })).toBe("network")
    expect(classifySocialError({ code: "TIMEOUT" })).toBe("network")
  })

  it("error fetch polos 'Network request failed' → network", () => {
    expect(classifySocialError(new Error("Network request failed"))).toBe("network")
    expect(classifySocialError(new Error("timeout of 10000ms exceeded"))).toBe("network")
  })

  it("error server/umum → other (fail-closed, bukan network)", () => {
    expect(classifySocialError({ code: "SERVER" })).toBe("other")
    expect(classifySocialError(new Error("Google auth gagal (locked_out). Coba lagi."))).toBe("other")
    expect(classifySocialError(new Error("The user canceled the sign in flow"))).toBe("other")
    expect(classifySocialError(undefined)).toBe("other")
  })
})
