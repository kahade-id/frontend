/**
 * Utas balasan Tanya Jawab profil (lib/qa-thread.ts) — murni, tanpa RN.
 *
 * Mengunci:
 *   - susunan pohon dari daftar datar `parentId` (tanpa kehilangan komentar);
 *   - komentar yatim & siklus tidak hilang dan tidak membuat loop;
 *   - urutan "Teratas" (dukungan terbanyak, seri → terlama) vs "Terbaru";
 *   - indentasi dibatasi, collapse otomatis pada kedalaman ambang.
 */
import { describe, expect, it } from "vitest"

import type { QuestionComment } from "@/lib/api/users"
import {
  THREAD_COLLAPSE_DEPTH,
  THREAD_INDENT_MAX,
  buildCommentThread,
  countThread,
  indentLevel,
  startsCollapsed,
  type ThreadNode,
} from "@/lib/qa-thread"

const T0 = Date.parse("2026-10-01T10:00:00Z")
const at = (minutes: number) => new Date(T0 + minutes * 60_000).toISOString()

const c = (id: string, over: Partial<QuestionComment> = {}): QuestionComment => ({
  id,
  content: `isi ${id}`,
  createdAt: at(0),
  ...over,
})

function ids(nodes: ThreadNode[]): string[] {
  return nodes.map((n) => n.comment.id)
}

function flatten(nodes: ThreadNode[]): ThreadNode[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children)])
}

describe("buildCommentThread — susunan", () => {
  it("daftar tanpa parentId: semua jadi akar", () => {
    const tree = buildCommentThread([c("a"), c("b"), c("c")], "newest")
    expect(tree.length).toBe(3)
    expect(tree.every((n) => n.depth === 0 && n.children.length === 0)).toBe(true)
  })

  it("balasan ditempatkan di bawah induknya dengan depth dan descendantCount benar", () => {
    const items = [
      c("root"),
      c("r1", { parentId: "root", createdAt: at(1) }),
      c("r1a", { parentId: "r1", createdAt: at(2) }),
      c("r1b", { parentId: "r1", createdAt: at(3) }),
    ]
    const tree = buildCommentThread(items, "top")
    expect(ids(tree)).toEqual(["root"])
    const r1 = tree[0].children[0]
    expect(r1.comment.id).toBe("r1")
    expect(r1.depth).toBe(1)
    expect(r1.children.map((x) => x.depth)).toEqual([2, 2])
    expect(tree[0].descendantCount).toBe(3)
    expect(r1.descendantCount).toBe(2)
  })

  it("tanpa komentar yang hilang: total pohon = jumlah input", () => {
    const items = [
      c("a"),
      c("b", { parentId: "a" }),
      c("c", { parentId: "b" }),
      c("d", { parentId: "a" }),
      c("e", { parentId: "zz" }), // yatim
    ]
    expect(countThread(buildCommentThread(items, "top"))).toBe(items.length)
  })

  it("komentar yatim (induk tak ada di halaman) diangkat jadi akar, tidak hilang", () => {
    const tree = buildCommentThread([c("x", { parentId: "tidak-ada" })], "top")
    expect(ids(tree)).toEqual(["x"])
    expect(tree[0].depth).toBe(0)
  })

  it("parentId yang menunjuk diri sendiri dianggap akar", () => {
    const tree = buildCommentThread([c("self", { parentId: "self" })], "top")
    expect(ids(tree)).toEqual(["self"])
  })

  it("siklus A↔B tidak membuat loop dan tidak menghilangkan keduanya", () => {
    const items = [c("A", { parentId: "B" }), c("B", { parentId: "A" })]
    const tree = buildCommentThread(items, "top")
    expect(countThread(tree)).toBe(2)
    expect(new Set(flatten(tree).map((n) => n.comment.id))).toEqual(new Set(["A", "B"]))
  })

  it("tidak memutasi array input", () => {
    const items = [c("a"), c("b", { parentId: "a" })]
    const snapshot = JSON.stringify(items)
    buildCommentThread(items, "newest")
    expect(JSON.stringify(items)).toBe(snapshot)
  })

  it("rantai 60 level tetap utuh (kedalaman tanpa batas)", () => {
    const items: QuestionComment[] = []
    for (let i = 0; i < 60; i++) {
      items.push(c(`n${i}`, { parentId: i === 0 ? undefined : `n${i - 1}`, createdAt: at(i) }))
    }
    const tree = buildCommentThread(items, "newest")
    expect(countThread(tree)).toBe(60)
    const deepest = flatten(tree).reduce((m, n) => Math.max(m, n.depth), 0)
    expect(deepest).toBe(59)
  })
})

describe("buildCommentThread — urutan", () => {
  it("Teratas: dukungan terbanyak di atas, seri dipecah oleh yang paling lama", () => {
    const items = [
      c("lama-0", { createdAt: at(0), upvoteCount: 0 }),
      c("baru-5", { createdAt: at(50), upvoteCount: 5 }),
      c("lama-3", { createdAt: at(3), upvoteCount: 3 }),
      c("seri-tua", { createdAt: at(1), upvoteCount: 3 }),
    ]
    expect(ids(buildCommentThread(items, "top"))).toEqual(["baru-5", "seri-tua", "lama-3", "lama-0"])
  })

  it("Teratas tanpa upvoteCount (kontrak sekarang) jatuh ke urutan waktu terlama", () => {
    const items = [c("b", { createdAt: at(2) }), c("a", { createdAt: at(1) })]
    expect(ids(buildCommentThread(items, "top"))).toEqual(["a", "b"])
  })

  it("Terbaru: waktu terbaru di atas", () => {
    const items = [
      c("a", { createdAt: at(1), upvoteCount: 99 }),
      c("b", { createdAt: at(9), upvoteCount: 0 }),
    ]
    expect(ids(buildCommentThread(items, "newest"))).toEqual(["b", "a"])
  })

  it("urutan berlaku di setiap level, termasuk anak dari anak", () => {
    const items = [
      c("p"),
      c("p1", { parentId: "p", createdAt: at(1), upvoteCount: 1 }),
      c("p2", { parentId: "p", createdAt: at(2), upvoteCount: 4 }),
      c("p2x", { parentId: "p2", createdAt: at(3), upvoteCount: 0 }),
      c("p2y", { parentId: "p2", createdAt: at(4), upvoteCount: 2 }),
    ]
    const tree = buildCommentThread(items, "top")
    expect(ids(tree[0].children)).toEqual(["p2", "p1"])
    expect(ids(tree[0].children[0].children)).toEqual(["p2y", "p2x"])
  })

  it("nilai upvoteCount tak valid (negatif/NaN) diperlakukan 0", () => {
    const items = [
      c("neg", { createdAt: at(1), upvoteCount: -5 }),
      c("nan", { createdAt: at(2), upvoteCount: Number.NaN }),
      c("ok", { createdAt: at(3), upvoteCount: 1 }),
    ]
    expect(ids(buildCommentThread(items, "top"))[0]).toBe("ok")
  })
})

describe("indentasi & collapse", () => {
  it("indentLevel dibatasi THREAD_INDENT_MAX", () => {
    expect(indentLevel(0)).toBe(0)
    expect(indentLevel(1)).toBe(1)
    expect(indentLevel(THREAD_INDENT_MAX)).toBe(THREAD_INDENT_MAX)
    expect(indentLevel(THREAD_INDENT_MAX + 7)).toBe(THREAD_INDENT_MAX)
    expect(indentLevel(-1)).toBe(0)
  })

  it("startsCollapsed: hanya node dengan anak pada kedalaman >= ambang", () => {
    const items: QuestionComment[] = []
    for (let i = 0; i <= THREAD_COLLAPSE_DEPTH + 1; i++) {
      items.push(c(`n${i}`, { parentId: i === 0 ? undefined : `n${i - 1}`, createdAt: at(i) }))
    }
    const flat = flatten(buildCommentThread(items, "newest"))
    const byId = new Map(flat.map((n) => [n.comment.id, n]))
    expect(startsCollapsed(byId.get(`n${THREAD_COLLAPSE_DEPTH - 1}`)!)).toBe(false)
    expect(startsCollapsed(byId.get(`n${THREAD_COLLAPSE_DEPTH}`)!)).toBe(true)
    // Daun (tanpa anak) tidak pernah collapse.
    expect(startsCollapsed(byId.get(`n${THREAD_COLLAPSE_DEPTH + 1}`)!)).toBe(false)
  })
})
