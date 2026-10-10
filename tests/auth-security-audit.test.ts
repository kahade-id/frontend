/**
 * Audit Auth & Sesi 2026-10-10 — kontrak lapisan murni yang diperbaiki.
 */
import { describe, expect, it } from "vitest"

import { sanitizeNextPath, setPendingNext, takePendingNext } from "@/lib/login-redirect"

describe("sanitizeNextPath (#FE-N1 open redirect pasca-login)", () => {
  it("meloloskan path internal biasa, termasuk query", () => {
    expect(sanitizeNextPath("/order/abc")).toBe("/order/abc")
    expect(sanitizeNextPath("/chat/room-1?tab=media")).toBe("/chat/room-1?tab=media")
    expect(sanitizeNextPath("/")).toBe("/")
  })

  it("menolak URL eksternal dan protocol-relative", () => {
    expect(sanitizeNextPath("//evil.tld/phish")).toBeNull()
    expect(sanitizeNextPath("/\\evil.tld")).toBeNull()
    expect(sanitizeNextPath("https://evil.tld")).toBeNull()
    expect(sanitizeNextPath("javascript:alert(1)")).toBeNull()
    expect(sanitizeNextPath("/https://evil.tld")).toBeNull()
  })

  it("menolak nilai bukan string / kosong / karakter kontrol", () => {
    expect(sanitizeNextPath(undefined)).toBeNull()
    expect(sanitizeNextPath(null)).toBeNull()
    expect(sanitizeNextPath("")).toBeNull()
    expect(sanitizeNextPath("order/abc")).toBeNull()
    expect(sanitizeNextPath("/order\nabc")).toBeNull()
  })

  it("setPendingNext memakai sanitasi yang sama", () => {
    setPendingNext("//evil.tld")
    expect(takePendingNext()).toBeNull()
    setPendingNext("/wallet")
    expect(takePendingNext()).toBe("/wallet")
    expect(takePendingNext()).toBeNull()
  })
})
