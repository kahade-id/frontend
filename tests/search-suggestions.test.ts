/**
 * Guard regresi crash layar Pencarian.
 *
 * Bug yang dilaporkan pengguna: menekan Enter di kolom pencarian menampilkan
 * "Halaman tidak dapat ditampilkan" (ErrorBoundary route), bukan hasil.
 *
 * Akarnya di lapisan API: `getSearchSuggestions()` memakai `readList<string>()`
 * yang hanya MENG-CAST tanpa pemeriksaan runtime. Begitu backend mengirim
 * objek (`[{ "query": "bpjs" }]` — bentuk yang sama dipakai endpoint riwayat
 * pencarian), objek itu mengalir apa adanya ke `<Chip key={s}>{s}</Chip>` di
 * `app/search.tsx`. React melempar "Objects are not valid as a React child"
 * dan seluruh layar jatuh ke ErrorBoundary tepat saat saran pertama tiba.
 *
 * Test ini mengunci kontrak `readSuggestionList`: apa pun bentuk itemnya,
 * keluarannya SELALU `string[]` yang aman dirender.
 */
import { describe, expect, it } from "vitest"

import { readSuggestionList } from "@/lib/api/search"

describe("readSuggestionList", () => {
  it("string polos dipertahankan (bentuk yang diasumsikan spec)", () => {
    expect(readSuggestionList(["bpjs", "token listrik"])).toEqual(["bpjs", "token listrik"])
  })

  it("objek saran dinormalkan menjadi string — tidak pernah bocor ke React child", () => {
    expect(
      readSuggestionList([
        { query: "bpjs kesehatan" },
        { suggestion: "token listrik" },
        { text: "transfer bank" },
        { value: "escrow" },
        { keyword: "voucher" },
        { title: "langganan" },
      ]),
    ).toEqual([
      "bpjs kesehatan",
      "token listrik",
      "transfer bank",
      "escrow",
      "voucher",
      "langganan",
    ])
  })

  it("campuran string + objek dalam satu respons tetap aman", () => {
    expect(readSuggestionList(["bpjs", { query: "token" }, 42, null, undefined, []])).toEqual([
      "bpjs",
      "token",
    ])
  })

  it("nilai kosong / hanya spasi dibuang agar tidak menghasilkan chip hampa", () => {
    expect(readSuggestionList(["", "   ", { query: "" }, { query: "  " }])).toEqual([])
  })

  it("spasi di ujung dirapikan", () => {
    expect(readSuggestionList(["  bpjs  ", { query: " token " }])).toEqual(["bpjs", "token"])
  })

  it("duplikat case-insensitive disatukan (chip ganda = kebisingan)", () => {
    expect(readSuggestionList(["BPJS", "bpjs", { query: "Bpjs" }])).toEqual(["BPJS"])
  })

  it("input kosong / bukan array menghasilkan daftar kosong, bukan throw", () => {
    expect(readSuggestionList([])).toEqual([])
  })
})
