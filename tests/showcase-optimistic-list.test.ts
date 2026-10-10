/**
 * UX-11 (audit etalase 2026-10-10): transisi daftar optimistis + rollback.
 */
import { describe, expect, it } from "vitest"

import { withActive, withItemAt, withoutItem } from "@/lib/showcase-optimistic-list"

const list = [
  { id: "a", isActive: true },
  { id: "b", isActive: true },
  { id: "c", isActive: false },
]

describe("withoutItem / withItemAt (hapus optimistis + rollback)", () => {
  it("mengeluarkan item dan menyimpan posisinya; rollback mengembalikan ke posisi semula", () => {
    const removed = withoutItem(list, "b")
    expect(removed.next.map((it) => it.id)).toEqual(["a", "c"])
    expect(removed.index).toBe(1)
    expect(removed.removed?.id).toBe("b")
    const back = withItemAt(removed.next, removed.removed!, removed.index)
    expect(back.map((it) => it.id)).toEqual(["a", "b", "c"])
  })

  it("id yang tidak ada → daftar salinan utuh, removed null", () => {
    const out = withoutItem(list, "zzz")
    expect(out.removed).toBeNull()
    expect(out.next).toEqual(list)
    expect(out.next).not.toBe(list)
  })

  it("rollback tidak menggandakan bila server sudah mengembalikan item (refresh mendahului)", () => {
    const back = withItemAt(list, { id: "b", isActive: true }, 1)
    expect(back.map((it) => it.id)).toEqual(["a", "b", "c"])
  })

  it("indeks di luar rentang dijepit", () => {
    expect(withItemAt([{ id: "a" }], { id: "z" }, 99).map((it) => it.id)).toEqual(["a", "z"])
    expect(withItemAt([{ id: "a" }], { id: "z" }, -1).map((it) => it.id)).toEqual(["a", "z"])
  })
})

describe("withActive (nonaktifkan/aktifkan optimistis)", () => {
  it("hanya item target yang berubah; baris lain referensinya tetap", () => {
    const next = withActive(list, "a", false)
    expect(next[0]).toEqual({ id: "a", isActive: false })
    expect(next[1]).toBe(list[1])
    expect(next[2]).toBe(list[2])
  })
})
