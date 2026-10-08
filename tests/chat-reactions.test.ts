/**
 * Audit chat E13 — daftar "siapa memberi reaksi apa".
 *
 * Server tidak dijamin mengirim `reactions[].users`; daftar harus jujur:
 * nama bila ada, "Anda" untuk reaksi saya, nama lawan bicara di DM 1:1, dan
 * placeholder (jumlah benar, nama tidak dikarang) di ruang ramai.
 */
import { describe, expect, it } from "vitest"

import type { ChatReaction } from "@/lib/api/chat"
import { buildReactorRows, totalReactions } from "@/lib/chat-reactions"

const labels = { you: "Anda", someone: "Pengguna lain" }
const base = { selfIds: ["USR-ME", "internal-me"], isDirect: false, labels }

describe("buildReactorRows", () => {
  it("memakai nama dari users dan menandai reaksi saya", () => {
    const reactions: ChatReaction[] = [
      {
        emoji: "👍",
        count: 2,
        reactedByMe: true,
        users: [
          { userId: "USR-ME", fullName: "Saya Sendiri" },
          { userId: "USR-B", fullName: "Budi" },
        ],
      },
    ]
    const rows = buildReactorRows(reactions, base)
    expect(rows.map((r) => [r.name, r.mine, r.anonymous])).toEqual([
      ["Anda", true, false],
      ["Budi", false, false],
    ])
  })

  it("id internal saya juga dikenali (payload bisa memakai salah satunya)", () => {
    const rows = buildReactorRows(
      [{ emoji: "❤️", count: 1, reactedByMe: true, users: [{ userId: "internal-me", fullName: "X" }] }],
      base,
    )
    expect(rows[0]).toMatchObject({ name: "Anda", mine: true })
  })

  it("reactedByMe tapi users tidak memuat saya → baris 'Anda' tetap ada", () => {
    const rows = buildReactorRows(
      [{ emoji: "😂", count: 2, reactedByMe: true, users: [{ userId: "USR-B", fullName: "Budi" }] }],
      base,
    )
    expect(rows.map((r) => r.name)).toEqual(["Anda", "Budi"])
  })

  it("tanpa users di DM 1:1: sisa reaksi = lawan bicara (nama diketahui)", () => {
    const rows = buildReactorRows(
      [{ emoji: "🙏", count: 2, reactedByMe: true }],
      { ...base, isDirect: true, counterpartName: "Toko Maju" },
    )
    expect(rows.map((r) => [r.name, r.mine, r.anonymous])).toEqual([
      ["Anda", true, false],
      ["Toko Maju", false, false],
    ])
  })

  it("tanpa users di ruang ramai: jumlah jujur, nama TIDAK dikarang", () => {
    const rows = buildReactorRows([{ emoji: "👏", count: 3, reactedByMe: false }], base)
    expect(rows).toHaveLength(3)
    expect(rows.every((r) => r.name === "Pengguna lain" && r.anonymous)).toBe(true)
  })

  it("DM dengan lebih dari satu sisa tidak menunjuk lawan bicara (tak mungkin tahu siapa)", () => {
    const rows = buildReactorRows(
      [{ emoji: "👍", count: 2, reactedByMe: false }],
      { ...base, isDirect: true, counterpartName: "Toko Maju" },
    )
    expect(rows.every((r) => r.anonymous)).toBe(true)
  })

  it("reaksi dengan count 0 diabaikan; placeholder dibatasi", () => {
    expect(buildReactorRows([{ emoji: "👍", count: 0, reactedByMe: false }], base)).toEqual([])
    const many = buildReactorRows([{ emoji: "👍", count: 500, reactedByMe: false }], base)
    expect(many.length).toBe(20)
  })

  it("beberapa emoji: baris dikelompokkan per emoji sesuai urutan reaksi", () => {
    const rows = buildReactorRows(
      [
        { emoji: "👍", count: 1, reactedByMe: false, users: [{ userId: "a", fullName: "Ani" }] },
        { emoji: "❤️", count: 1, reactedByMe: false, users: [{ userId: "b", fullName: "Budi" }] },
      ],
      base,
    )
    expect(rows.map((r) => `${r.emoji}${r.name}`)).toEqual(["👍Ani", "❤️Budi"])
  })

  it("kunci baris unik (aman untuk daftar React)", () => {
    const rows = buildReactorRows(
      [
        { emoji: "👍", count: 3, reactedByMe: true },
        { emoji: "❤️", count: 2, reactedByMe: false },
      ],
      base,
    )
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length)
  })
})

describe("totalReactions", () => {
  it("menjumlah semua emoji", () => {
    expect(
      totalReactions([
        { emoji: "👍", count: 2, reactedByMe: false },
        { emoji: "❤️", count: 3, reactedByMe: true },
      ]),
    ).toBe(5)
    expect(totalReactions([])).toBe(0)
  })
})
