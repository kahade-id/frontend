/**
 * Test murni — umpan balik artikel sekali per versi (F17).
 */
import { describe, expect, it } from "vitest"

import {
  contentVersionHash,
  feedbackKey,
  getHelpFeedback,
  saveHelpFeedback,
} from "@/lib/help-feedback"

const A1 = "artikel-1"
const CONTENT_V1 = "# Judul\n\nIsi versi satu."
const CONTENT_V2 = "# Judul\n\nIsi versi dua yang berbeda."

describe("contentVersionHash", () => {
  it("deterministik dan berbeda untuk konten berbeda", () => {
    expect(contentVersionHash(CONTENT_V1)).toBe(contentVersionHash(CONTENT_V1))
    expect(contentVersionHash(CONTENT_V1)).not.toBe(contentVersionHash(CONTENT_V2))
  })
})

describe("feedbackKey", () => {
  it("berbeda per versi konten", () => {
    expect(feedbackKey(A1, CONTENT_V1)).not.toBe(feedbackKey(A1, CONTENT_V2))
  })

  it("berbeda per artikel", () => {
    expect(feedbackKey(A1, CONTENT_V1)).not.toBe(feedbackKey("artikel-2", CONTENT_V1))
  })
})

describe("saveHelpFeedback / getHelpFeedback", () => {
  it("pilihan pertama tersimpan", async () => {
    expect(await getHelpFeedback(A1, CONTENT_V1)).toBeNull()
    const res = await saveHelpFeedback(A1, CONTENT_V1, "helpful")
    expect(res.status).toBe("saved")
    const stored = await getHelpFeedback(A1, CONTENT_V1)
    expect(stored?.choice).toBe("helpful")
    expect(stored?.corrected).toBe(false)
  })

  it("pilihan yang sama kedua kali terkunci", async () => {
    await saveHelpFeedback(A1, CONTENT_V1, "helpful")
    const res = await saveHelpFeedback(A1, CONTENT_V1, "helpful")
    expect(res.status).toBe("already_locked")
  })

  it("koreksi tunggal diizinkan tepat satu kali", async () => {
    await saveHelpFeedback("art-koreksi", CONTENT_V1, "helpful")
    const first = await saveHelpFeedback("art-koreksi", CONTENT_V1, "not_helpful")
    expect(first.status).toBe("corrected")
    const stored = await getHelpFeedback("art-koreksi", CONTENT_V1)
    expect(stored?.choice).toBe("not_helpful")
    expect(stored?.corrected).toBe(true)
    // Koreksi kedua ditolak.
    const second = await saveHelpFeedback("art-koreksi", CONTENT_V1, "helpful")
    expect(second.status).toBe("already_locked")
    expect((await getHelpFeedback("art-koreksi", CONTENT_V1))?.choice).toBe("not_helpful")
  })

  it("versi baru artikel boleh dipilih lagi", async () => {
    await saveHelpFeedback("art-versi", CONTENT_V1, "helpful")
    await saveHelpFeedback("art-versi", CONTENT_V1, "not_helpful") // pakai koreksi
    const res = await saveHelpFeedback("art-versi", CONTENT_V2, "helpful")
    expect(res.status).toBe("saved")
  })
})
