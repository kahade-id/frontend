/**
 * Sisa tes lib/app-mode.ts.
 *
 * REVISI 2026-09-28 (NAV-011): mesin mode-switcher mati total dan dihapus —
 * `setAppMode`, `planModeChange`, `planSlotPress`, `applyModeNavigation`,
 * parkir tab, dan tabel slot shell tidak ada lagi. Yang diuji di sini
 * hanyalah yang masih hidup: helper path murni + protokol event "mode
 * shift" yang dipakai <ModeShiftFade>.
 */
import { beforeEach, describe, expect, it } from "vitest"

import {
  getModeShift,
  markModeShift,
  modeShiftIsFresh,
  pathMatchesBase,
  resetAppModeForTest,
} from "@/lib/app-mode"

beforeEach(() => {
  resetAppModeForTest()
})

describe("pathMatchesBase", () => {
  it("tidak menyamakan prefix yang hanya kebetulan mirip", () => {
    expect(pathMatchesBase("/wallet-history", "/wallet")).toBe(false)
    expect(pathMatchesBase("/showcase-management", "/showcase")).toBe(false)
    expect(pathMatchesBase("/chat/room-1", "/chat")).toBe(true)
    expect(pathMatchesBase("/wallet/", "/wallet")).toBe(true)
  })
})

describe("shift", () => {
  it("menandai arah dan menganggap shift basi setelah jendela", () => {
    markModeShift("commerce", "wallet", "/wallet", 1_000)
    expect(getModeShift()).toMatchObject({ dir: 1, href: "/wallet" })
    expect(modeShiftIsFresh(1_000 + 699)).toBe(true)
    expect(modeShiftIsFresh(1_000 + 700)).toBe(false)

    markModeShift("wallet", "commerce", null, 2_000)
    expect(getModeShift()).toMatchObject({ dir: -1, href: null })
  })
})
