/**
 * Test pencarian keyword dalam room chat (lib/chat-search.ts).
 *
 * Logika murni: pencocokan case-insensitive di pesan yang sudah dimuat,
 * pemecah segmen highlight, dan label penghitung "3 dari 12".
 */
import { describe, expect, it } from "vitest"

import {
  findMessageMatches,
  matchCounterLabel,
  splitHighlightSpans,
  type SearchableMessage,
} from "@/lib/chat-search"

const MESSAGES: SearchableMessage[] = [
  { id: "m1", text: "Halo, barangnya ready?" },
  { id: "m2", text: "Ready kak, silakan checkout" },
  { id: "m3", text: "Oke saya transfer sekarang" },
  { id: "m4", text: "Pesan ini telah dihapus", isDeleted: true },
  { id: "m5", text: "" },
  { id: "m6" },
]

describe("findMessageMatches", () => {
  it("mencocokkan case-insensitive dalam urutan thread", () => {
    expect(findMessageMatches(MESSAGES, "ready")).toEqual(["m1", "m2"])
    expect(findMessageMatches(MESSAGES, "READY")).toEqual(["m1", "m2"])
  })

  it("melewati pesan terhapus, teks kosong, dan tanpa teks", () => {
    expect(findMessageMatches(MESSAGES, "dihapus")).toEqual([])
    expect(findMessageMatches(MESSAGES, "")).toEqual([])
  })

  it("query < 2 karakter diabaikan (terlalu berisik)", () => {
    expect(findMessageMatches(MESSAGES, "a")).toEqual([])
    expect(findMessageMatches(MESSAGES, " re ")).toEqual(["m1", "m2"])
  })

  it("trim spasi di query", () => {
    expect(findMessageMatches(MESSAGES, "  transfer  ")).toEqual(["m3"])
  })
})

describe("splitHighlightSpans", () => {
  it("memecah teks menjadi segmen biasa vs cocok", () => {
    expect(splitHighlightSpans("halo dunia halo", "halo")).toEqual([
      { text: "halo", hit: true },
      { text: " dunia ", hit: false },
      { text: "halo", hit: true },
    ])
  })

  it("case-insensitive tapi mempertahankan teks asli", () => {
    expect(splitHighlightSpans("Halo Dunia", "halo")).toEqual([
      { text: "Halo", hit: true },
      { text: " Dunia", hit: false },
    ])
  })

  it("karakter regex dari ketikan user di-escape", () => {
    expect(splitHighlightSpans("harga (100rb) fix", "(100rb)")).toEqual([
      { text: "harga ", hit: false },
      { text: "(100rb)", hit: true },
      { text: " fix", hit: false },
    ])
  })

  it("query kosong → satu segmen biasa", () => {
    expect(splitHighlightSpans("halo", "")).toEqual([{ text: "halo", hit: false }])
    expect(splitHighlightSpans("halo", "  ")).toEqual([{ text: "halo", hit: false }])
  })
})

describe("matchCounterLabel", () => {
  it('format "3 dari 12", 1-based', () => {
    expect(matchCounterLabel(2, 12)).toBe("3 dari 12")
    expect(matchCounterLabel(0, 1)).toBe("1 dari 1")
  })

  it("di luar jangkauan → string kosong", () => {
    expect(matchCounterLabel(-1, 5)).toBe("")
    expect(matchCounterLabel(5, 5)).toBe("")
    expect(matchCounterLabel(0, 0)).toBe("")
  })
})
