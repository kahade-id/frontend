/** FD-09 (audit etalase 2026-10-10): ember menit untuk cap waktu relatif. */
import { describe, expect, it } from "vitest"

import { minuteBucket } from "@/lib/minute-bucket"

describe("minuteBucket", () => {
  it("berubah tepat saat menit berganti, stabil di dalam satu menit", () => {
    // Basis sejajar menit — supaya +59_999 tidak melewati batas menit.
    const base = 28_333_333 * 60_000
    expect(minuteBucket(base)).toBe(minuteBucket(base + 59_999))
    expect(minuteBucket(base + 60_000)).toBe(minuteBucket(base) + 1)
  })
})
