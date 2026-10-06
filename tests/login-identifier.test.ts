/**
 * Test Batch 139 A01 — penyimpanan identifier login selama sesi formulir.
 *
 * - Identifier non-rahasia bertahan di memori modul selama sesi formulir.
 * - Dibersihkan setelah login berhasil (sesi formulir selesai).
 */
import { describe, expect, it } from "vitest"

import {
  clearLoginIdentifier,
  getLoginIdentifier,
  setLoginIdentifier,
} from "@/lib/login-identifier"

describe("login-identifier (A01)", () => {
  it("mulai kosong", () => {
    clearLoginIdentifier()
    expect(getLoginIdentifier()).toBe("")
  })

  it("menyimpan identifier non-rahasia selama sesi formulir", () => {
    clearLoginIdentifier()
    setLoginIdentifier("johndoe")
    expect(getLoginIdentifier()).toBe("johndoe")
  })

  it("identifier email dan username disimpan terpisah saat berpindah tab", () => {
    clearLoginIdentifier()
    setLoginIdentifier("buyer@example.com", "email")
    setLoginIdentifier("johndoe", "username")
    expect(getLoginIdentifier("email")).toBe("buyer@example.com")
    expect(getLoginIdentifier("username")).toBe("johndoe")
    expect(getLoginIdentifier()).toBe("johndoe")
  })

  it("dibersihkan saat login berhasil", () => {
    setLoginIdentifier("nama@email.com", "email")
    clearLoginIdentifier()
    expect(getLoginIdentifier()).toBe("")
    expect(getLoginIdentifier("email")).toBe("")
    expect(getLoginIdentifier("username")).toBe("")
  })
})
