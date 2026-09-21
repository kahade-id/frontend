/**
 * Guard regresi bug profil publik (D.2): list Tanya Jawab dirender KOSONG
 * padahal user punya data. Akarnya — `readQuestionList`/`readQuestionComments`
 * hanya mengenali bentuk `QuestionItem[]` dan `{data, meta}`; bentuk lain yang
 * sah dari backend (`{questions}`, `{items}`, envelope bersarang
 * `{data:{questions, meta}}`) diam-diam jatuh ke `[]` sehingga EmptyState
 * merendang di atas data yang sebenarnya ada. Test ini mengunci semua bentuk
 * respons yang diterima parser.
 */
import { describe, expect, it } from "vitest"

import {
  readQuestionComments,
  readQuestionList,
  type QuestionComment,
  type QuestionItem,
} from "@/lib/api/users"

const q = (id: string): QuestionItem => ({
  id,
  question: `Pertanyaan ${id}`,
  createdAt: "2026-09-01T00:00:00Z",
})

const c = (id: string): QuestionComment => ({
  id,
  content: `Komentar ${id}`,
  createdAt: "2026-09-02T00:00:00Z",
})

describe("readQuestionList", () => {
  it("mengembalikan kosong untuk body null/undefined", () => {
    expect(readQuestionList(null).items).toEqual([])
    expect(readQuestionList(undefined).items).toEqual([])
  })

  it("array polos", () => {
    expect(readQuestionList([q("1"), q("2")]).items).toHaveLength(2)
  })

  it("bentuk {data, meta} (spesifikasi utama)", () => {
    const out = readQuestionList({
      data: [q("1")],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    })
    expect(out.items.map((x) => x.id)).toEqual(["1"])
    expect(out.totalPages).toBe(1)
  })

  it("bentuk {questions, meta}", () => {
    const out = readQuestionList({ questions: [q("1"), q("2")] } as never)
    expect(out.items).toHaveLength(2)
  })

  it("bentuk {items} — kasus kosong-padahal-ada-data", () => {
    const out = readQuestionList({ items: [q("1"), q("2"), q("3")] } as never)
    expect(out.items).toHaveLength(3)
  })

  it("envelope bersarang {data:{questions, meta}}", () => {
    const out = readQuestionList({
      data: { questions: [q("1")], meta: { totalPages: 4 } },
    } as never)
    expect(out.items.map((x) => x.id)).toEqual(["1"])
    expect(out.totalPages).toBe(4)
  })

  it("envelope bersarang {data:{items}} dengan meta snake_case", () => {
    const out = readQuestionList({
      data: { items: [q("1")], meta: { total_pages: 2 } },
    } as never)
    expect(out.items).toHaveLength(1)
    expect(out.totalPages).toBe(2)
  })
})

describe("readQuestionComments", () => {
  it("array polos dan {data, meta}", () => {
    expect(readQuestionComments([c("1")]).items).toHaveLength(1)
    const out = readQuestionComments({
      data: [c("1")],
      meta: { page: 1, limit: 20, total: 1, totalPages: 3 },
    })
    expect(out.items).toHaveLength(1)
    expect(out.totalPages).toBe(3)
  })

  it("bentuk {comments} dan {items}", () => {
    expect(readQuestionComments({ comments: [c("1")] } as never).items).toHaveLength(1)
    expect(readQuestionComments({ items: [c("1"), c("2")] } as never).items).toHaveLength(2)
  })

  it("envelope bersarang {data:{comments, meta}}", () => {
    const out = readQuestionComments({
      data: { comments: [c("1")], meta: { totalPages: 5 } },
    } as never)
    expect(out.items.map((x) => x.id)).toEqual(["1"])
    expect(out.totalPages).toBe(5)
  })
})
