/**
 * CR-04 (audit etalase 2026-10-10): membuang draf hanya membatalkan timer
 * autosave yang SUDAH berjalan — timer berikutnya hidup kembali (dulu flag
 * `draftSuppressed` tidak pernah direset → autosave mati untuk sisa sesi).
 */
import { describe, expect, it } from "vitest"

import { createDraftAutosaveGuard } from "@/lib/draft-autosave-guard"

describe("createDraftAutosaveGuard", () => {
  it("timer yang dijadwalkan sebelum invalidate() basi; yang dijadwalkan sesudahnya hidup", () => {
    const guard = createDraftAutosaveGuard()
    const before = guard.arm()
    expect(guard.isLive(before)).toBe(true)
    guard.invalidate()
    expect(guard.isLive(before)).toBe(false)
    const after = guard.arm()
    expect(guard.isLive(after)).toBe(true)
  })

  it("beberapa invalidate berturut-turut tidak mematikan timer baru", () => {
    const guard = createDraftAutosaveGuard()
    guard.invalidate()
    guard.invalidate()
    const token = guard.arm()
    expect(guard.isLive(token)).toBe(true)
  })
})
