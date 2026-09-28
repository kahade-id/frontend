/**
 * Test Batch 139 A04 — helper focusFirstInvalid.
 */
import { describe, expect, it, vi } from "vitest"

import { focusFirstInvalid } from "@/lib/form-validation"

describe("focusFirstInvalid (A04)", () => {
  it("memfokuskan ref pertama yang terpasang", () => {
    const first = vi.fn()
    const second = vi.fn()
    focusFirstInvalid([
      { current: { focus: first } },
      { current: { focus: second } },
    ])
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()
  })

  it("melewati ref null dan berhenti di yang pertama valid", () => {
    const second = vi.fn()
    focusFirstInvalid([{ current: null }, { current: { focus: second } }])
    expect(second).toHaveBeenCalledTimes(1)
  })

  it("diam bila tidak ada ref yang bisa difokuskan", () => {
    expect(() => focusFirstInvalid([{ current: null }])).not.toThrow()
    expect(() => focusFirstInvalid([])).not.toThrow()
  })
})
