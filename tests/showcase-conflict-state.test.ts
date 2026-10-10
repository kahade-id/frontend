/**
 * RK-01 (audit etalase 2026-10-10): state server dari 409 suka/simpan.
 */
import { describe, expect, it } from "vitest"

import { ApiError } from "@/lib/api/errors"
import { likeStateFromConflict, saveStateFromConflict } from "@/lib/showcase-conflict-state"

const conflict = (data?: Record<string, unknown>) =>
  new ApiError({ code: "CONFLICT", status: 409, message: "conflict", backendCode: "SHOWCASE_ALREADY_LIKED", data })

describe("likeStateFromConflict", () => {
  it("{liked, likeCount} valid → state final server", () => {
    expect(likeStateFromConflict(conflict({ liked: true, likeCount: 7 }))).toEqual({ isLiked: true, likeCount: 7 })
    expect(likeStateFromConflict(conflict({ liked: false, likeCount: 0 }))).toEqual({ isLiked: false, likeCount: 0 })
  })

  it("data tidak lengkap / bukan ApiError → null (pemanggil memakai jalur lama)", () => {
    expect(likeStateFromConflict(conflict())).toBeNull()
    expect(likeStateFromConflict(conflict({ liked: true }))).toBeNull()
    expect(likeStateFromConflict(conflict({ liked: "ya", likeCount: 1 }))).toBeNull()
    expect(likeStateFromConflict(conflict({ liked: true, likeCount: Number.NaN }))).toBeNull()
    expect(likeStateFromConflict(new Error("x"))).toBeNull()
  })

  it("hitungan negatif/pecahan dinormalkan", () => {
    expect(likeStateFromConflict(conflict({ liked: true, likeCount: -3 }))).toEqual({ isLiked: true, likeCount: 0 })
    expect(likeStateFromConflict(conflict({ liked: true, likeCount: 2.9 }))).toEqual({ isLiked: true, likeCount: 2 })
  })
})

describe("saveStateFromConflict", () => {
  it("{saved, saveCount} valid → state final server", () => {
    expect(saveStateFromConflict(conflict({ saved: true, saveCount: 4 }))).toEqual({ saved: true, saveCount: 4 })
  })
  it("tanpa saveCount → null", () => {
    expect(saveStateFromConflict(conflict({ saved: true }))).toBeNull()
  })
})
