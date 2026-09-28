/**
 * Test Batch 139 E01/E14 — normalisasi username + sanitizer preferensi.
 */
import { describe, expect, it } from "vitest"

import { normalizeUsername } from "@/lib/username"
import { sanitizePrefs } from "@/lib/ui-prefs"

describe("normalizeUsername (E01 — bentuk final yang dikirim ke server)", () => {
  it("lowercase + buang spasi & karakter asing, maks 20", () => {
    expect(normalizeUsername("Budi Santoso!")).toBe("budisantoso")
  })
  it("mempertahankan . _ dan angka", () => {
    expect(normalizeUsername("budi.santoso_99")).toBe("budi.santoso_99")
  })
  it("memotong ke 20 karakter", () => {
    expect(normalizeUsername("a".repeat(30))).toBe("a".repeat(20))
  })
  it("string kosong tetap kosong", () => {
    expect(normalizeUsername("")).toBe("")
  })
})

describe("sanitizePrefs (E14 — scanFeedback default & sanitasi)", () => {
  it("default ON bila belum pernah disimpan", () => {
    expect(sanitizePrefs({}).scanFeedback).toBe(true)
  })
  it("false yang tersimpan dihormati", () => {
    expect(sanitizePrefs({ scanFeedback: false }).scanFeedback).toBe(false)
  })
  it("nilai rusak (non-boolean) jatuh ke ON", () => {
    expect(sanitizePrefs({ scanFeedback: "ya" }).scanFeedback).toBe(true)
    expect(sanitizePrefs({ scanFeedback: 0 }).scanFeedback).toBe(true)
  })
  it("input bukan objek → default", () => {
    expect(sanitizePrefs(null).scanFeedback).toBe(true)
    expect(sanitizePrefs("x").scanFeedback).toBe(true)
  })
})
