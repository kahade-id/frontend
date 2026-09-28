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

  it("dibersihkan saat login berhasil", () => {
    setLoginIdentifier("nama@email.com")
    clearLoginIdentifier()
    expect(getLoginIdentifier()).toBe("")
  })
})
