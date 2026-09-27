/**
 * TIM PROFILE — audit UI/UX 2026-09-27.
 *
 * Mengunci helper murni kepemilikan Q&A + handle profil:
 *  - UI-P008: `isOwnQuestion`/`isOwnQuestionComment` (lib/api/users.ts) HARUS
 *    memakai `askerId`/`authorId` sebagai sumber utama — backend tidak selalu
 *    mengirim `asker.id`, dan versi lama yang hanya memakai `q.asker?.id`
 *    membuat tombol Hapus milik sendiri tidak pernah muncul (regresi PRF-001).
 *  - UI-P014: `atHandle` (lib/profile-uiux.ts) tidak boleh menghasilkan
 *    "@undefined".
 */
import { describe, expect, it } from "vitest"

import {
  isOwnQuestion,
  isOwnQuestionComment,
  type QuestionComment,
  type QuestionItem,
} from "@/lib/api/users"
import { atHandle } from "@/lib/profile-uiux"

const ME = "cuid-internal-123"

const q = (overrides: Partial<QuestionItem> = {}): QuestionItem => ({
  id: "q1",
  question: "Pertanyaan",
  createdAt: "2026-09-01T00:00:00Z",
  ...overrides,
})

const c = (overrides: Partial<QuestionComment> = {}): QuestionComment => ({
  id: "c1",
  content: "Komentar",
  createdAt: "2026-09-02T00:00:00Z",
  ...overrides,
})

describe("isOwnQuestion", () => {
  it("true bila askerId sama dengan meId (jalur utama backend)", () => {
    expect(isOwnQuestion(q({ askerId: ME }), ME)).toBe(true)
  })

  it("true bila asker.id sama (fallback defensif)", () => {
    expect(isOwnQuestion(q({ asker: { id: ME } as never }), ME)).toBe(true)
  })

  it("false bila keduanya tidak cocok — tombol Hapus tidak bocor ke milik orang", () => {
    expect(isOwnQuestion(q({ askerId: "other", asker: { id: "other" } as never }), ME)).toBe(false)
  })

  it("false bila backend tidak mengirim info kepemilikan apa pun", () => {
    expect(isOwnQuestion(q({ askerId: undefined, asker: undefined }), ME)).toBe(false)
    expect(isOwnQuestion(q(), ME)).toBe(false)
  })

  it("false bila meId belum dimuat — jangan tampilkan Hapus spekulatif", () => {
    expect(isOwnQuestion(q({ askerId: ME }), null)).toBe(false)
    expect(isOwnQuestion(q({ askerId: ME }), undefined)).toBe(false)
    expect(isOwnQuestion(q({ askerId: ME }), "")).toBe(false)
  })

  it("false untuk pertanyaan null", () => {
    expect(isOwnQuestion(null, ME)).toBe(false)
    expect(isOwnQuestion(undefined, ME)).toBe(false)
  })
})

describe("isOwnQuestionComment", () => {
  it("true bila authorId sama dengan meId", () => {
    expect(isOwnQuestionComment(c({ authorId: ME }), ME)).toBe(true)
  })

  it("false bila authorId beda atau kosong", () => {
    expect(isOwnQuestionComment(c({ authorId: "other" }), ME)).toBe(false)
    expect(isOwnQuestionComment(c({}), ME)).toBe(false)
  })

  it("false bila meId/komentar belum ada", () => {
    expect(isOwnQuestionComment(c({ authorId: ME }), null)).toBe(false)
    expect(isOwnQuestionComment(null, ME)).toBe(false)
  })
})

describe("atHandle", () => {
  it("mengembalikan @username untuk nilai normal", () => {
    expect(atHandle("budi")).toBe("@budi")
  })

  it("tidak pernah menghasilkan '@undefined' / '@null'", () => {
    expect(atHandle(undefined)).toBe("")
    expect(atHandle(null)).toBe("")
    expect(atHandle("")).toBe("")
    expect(atHandle("   ")).toBe("")
    expect(atHandle(undefined)).not.toContain("undefined")
  })

  it("memangkas spasi di sekitar username", () => {
    expect(atHandle("  budi  ")).toBe("@budi")
  })
})
