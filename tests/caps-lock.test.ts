/**
 * Test Batch 139 A02 — deteksi Caps Lock (web).
 *
 * Pembaca event murni: tidak pernah menyentuh isi field, hanya boolean
 * getModifierState("CapsLock").
 */
import { describe, expect, it } from "vitest"

import { isCapsLockOnEvent } from "@/lib/caps-lock"

describe("isCapsLockOnEvent (A02)", () => {
  it("true bila getModifierState('CapsLock') true", () => {
    expect(isCapsLockOnEvent({ getModifierState: (k) => k === "CapsLock" })).toBe(true)
  })

  it("false bila CapsLock tidak aktif", () => {
    expect(isCapsLockOnEvent({ getModifierState: () => false })).toBe(false)
  })

  it("false bila event tidak punya getModifierState", () => {
    expect(isCapsLockOnEvent({} as never)).toBe(false)
    expect(isCapsLockOnEvent(null)).toBe(false)
    expect(isCapsLockOnEvent(undefined)).toBe(false)
  })

  it("false bila getModifierState melempar", () => {
    expect(
      isCapsLockOnEvent({
        getModifierState: () => {
          throw new Error("boom")
        },
      }),
    ).toBe(false)
  })
})
