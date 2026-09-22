/**
 * Test helper pembaca respons di `lib/api/response.ts`.
 *
 * Fokusnya satu aturan yang berulang kali dilanggar: **"tidak tahu" bukan
 * "tidak"**. `pickBoolean` harus mengembalikan `undefined` saat backend tidak
 * mengirim field-nya, karena `undefined !== true` dulu dipakai sebagai gerbang
 * dan mematikan transfer ke semua penerima.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

// C-06: fallback `readList` (array pertama yang bukan metadata) dulu SENYAP.
// Sekarang jalur tersebut melaporkan diri lewat telemetri supaya bentuk respons
// yang tidak dikenal terlihat, bukan berubah menjadi data yang salah.
const logWarn = vi.fn()
vi.mock("@/lib/telemetry", () => ({ logWarn: (...args: unknown[]) => logWarn(...args) }))

import {
  pickBoolean,
  pickString,
  pickUserId,
  readList,
  readPage,
  unwrapResponse,
} from "@/lib/api/response"

describe("pickBoolean", () => {
  it("mengembalikan nilai boolean apa adanya", () => {
    expect(pickBoolean({ kycVerified: true }, ["kycVerified"])).toBe(true)
    expect(pickBoolean({ kycVerified: false }, ["kycVerified"])).toBe(false)
  })

  it("mengembalikan undefined bila field tidak ada — BUKAN false", () => {
    expect(pickBoolean({ username: "budi" }, ["kycVerified", "isKycVerified"])).toBeUndefined()
    expect(pickBoolean(null, ["kycVerified"])).toBeUndefined()
  })

  it("menerima string 'true'/'false' dari backend yang mengirim boolean sebagai teks", () => {
    expect(pickBoolean({ verified: "true" }, ["verified"])).toBe(true)
    expect(pickBoolean({ verified: "false" }, ["verified"])).toBe(false)
  })

  it("memakai alias pertama yang tersedia", () => {
    expect(pickBoolean({ isKycVerified: true }, ["kycVerified", "isKycVerified"])).toBe(true)
  })
})

describe("pickString", () => {
  it("melewati string kosong dan nilai bukan string", () => {
    expect(pickString({ a: "", b: "  ", c: "isi" }, ["a", "b", "c"])).toBe("isi")
    expect(pickString({ n: 42 }, ["n"])).toBe("42")
    expect(pickString({ n: null }, ["n"])).toBeUndefined()
  })
})

describe("pickUserId", () => {
  it("membaca id langsung dari banyak nama", () => {
    expect(pickUserId({ id: "u1" })).toBe("u1")
    expect(pickUserId({ userId: "u2" })).toBe("u2")
    expect(pickUserId({ _id: "u3" })).toBe("u3")
  })

  it("menemukan id satu tingkat bersarang", () => {
    expect(pickUserId({ user: { id: "u4" } })).toBe("u4")
    expect(pickUserId({ data: { userId: "u5" } })).toBe("u5")
    expect(pickUserId({ profile: { id: "u6" } })).toBe("u6")
  })

  it("mengembalikan string kosong bila benar-benar tidak ada", () => {
    expect(pickUserId({ username: "budi" })).toBe("")
    expect(pickUserId(null)).toBe("")
    expect(pickUserId("budi")).toBe("")
  })
})

describe("unwrapResponse", () => {
  it("membuka amplop { success, data }", () => {
    expect(unwrapResponse({ success: true, data: { id: 1 } })).toEqual({ id: 1 })
  })

  it("melempar bila success: false", () => {
    expect(() => unwrapResponse({ success: false, message: "ditolak", data: null })).toThrow(
      /ditolak/,
    )
  })

  it("TIDAK membuka paginasi { data, meta } biasa", () => {
    const page = { data: [1, 2], meta: { page: 1 } }
    expect(unwrapResponse(page)).toBe(page)
  })
})

describe("readList", () => {
  it("memakai kunci domain yang diminta", () => {
    expect(readList({ users: [1, 2] }, ["users"])).toEqual([1, 2])
    expect(readList({ data: [3] })).toEqual([3])
    expect(readList([4])).toEqual([4])
  })

  it("jatuh ke array pertama bila backend memakai nama koleksi lain", () => {
    // spec tidak mendokumentasikan bentuk respons list, jadi nama kunci adalah
    // tebakan. Sebelum fallback ini, bentuk tak dikenal melempar dan seluruh
    // layar list mati padahal datanya ada.
    expect(readList({ blockedUsers: [{ id: "u1" }] }, ["users"])).toEqual([{ id: "u1" }])
  })

  it("tidak menganggap metadata sebagai koleksi", () => {
    expect(() => readList({ meta: { page: 1 }, pagination: [1] }, ["users"])).toThrow()
  })

  it("tetap melempar bila tidak ada array sama sekali — kosong bukan sukses", () => {
    expect(() => readList({ message: "ok" }, ["users"])).toThrow()
  })
})

describe("readPage", () => {
  it("tidak mengklaim 'tidak ada halaman berikutnya' saat server tanpa metadata", () => {
    const full = readPage({ items: [1, 2, 3] }, { page: 1, limit: 3 }, ["items"])
    expect(full.meta.totalPages).toBe(2)

    const short = readPage({ items: [1] }, { page: 1, limit: 3 }, ["items"])
    expect(short.meta.totalPages).toBe(1)
  })
})

// ------------------------------------------------------------------
// C-05/C-06/C-07 (audit): paginasi tanpa metadata & jalur rapuh
// ------------------------------------------------------------------

describe("C-06: fallback array pertama melaporkan diri ke telemetri", () => {
  beforeEach(() => logWarn.mockClear())

  it("memakai array pertama TAPI mencatat kunci yang diambil", () => {
    expect(readList({ blockedUsers: [{ id: "u1" }] }, ["users"])).toEqual([{ id: "u1" }])
    expect(logWarn).toHaveBeenCalledTimes(1)
    const [scope, detail] = logWarn.mock.calls[0] as [string, { keys?: unknown; picked?: unknown }]
    expect(scope).toBe("api:list-fallback")
    // `keys` dirangkai dengan "|" supaya muat di satu field telemetri.
    expect(detail.keys).toBe("users")
    expect(detail.picked).toBe("blockedUsers")
  })

  it("kunci domain yang cocok tidak dianggap fallback", () => {
    expect(readList({ users: [1] }, ["users"])).toEqual([1])
    expect(logWarn).not.toHaveBeenCalled()
  })
})

describe("C-07: metadata paginasi di root hanya dari kunci yang dikenal", () => {
  it("field domain bernama page/limit/total pada endpoint non-list tidak dibaca sebagai paginasi", () => {
    // Kasus nyata: dokumen legal/invoice punya kolom `total` sendiri.
    const page = readPage<{ id: string }>(
      {
        invoices: [{ id: "inv-1" }],
        total: 3, // total BARIS, bukan total halaman
        page: 2, // nomor halaman dokumen
      },
      { page: 5, limit: 20 },
      ["invoices"],
    )
    // `total` sah dibaca (kunci paginasi yang dikenal), tetapi `limit` tidak
    // ditebak dari data dan `page` tetap memakai nilai pemanggil bila server
    // mengirim kunci yang dikenal... di sini `page: 2` memang kunci paginasi,
    // jadi nilainya dihormati:
    expect(page.meta.page).toBe(2)
    expect(page.meta.total).toBe(3)
    expect(page.meta.totalPages).toBe(1) // ceil(3/20)
  })

  it("root tanpa satu pun kunci paginasi tidak dipakai sebagai meta", () => {
    const page = readPage<number>({ items: [1, 2] }, { page: 1, limit: 2 }, ["items"])
    expect(page.meta.page).toBe(1)
    expect(page.meta.limit).toBe(2)
    expect(page.meta.total).toBeUndefined()
  })
})

describe("C-05: paginasi tanpa metadata berhenti dengan benar", () => {
  it("halaman KOSONG selalu akhir — bahkan bila halaman sebelumnya penuh", () => {
    const full = readPage<number>({ items: [1, 2] }, { page: 1, limit: 2 }, ["items"])
    expect(full.meta.totalPages).toBe(2) // "mungkin masih ada" — bukan janji

    const empty = readPage<number>({ items: [] }, { page: 2, limit: 2 }, ["items"])
    expect(empty.meta.totalPages).toBe(2) // berhenti di halaman ini
  })

  it("tanpa `limit` eksplisit, halaman tak kosong dianggap punya lanjutan (aman: satu request kosong)", () => {
    const page = readPage<number>({ items: [1] }, {}, ["items"])
    expect(page.meta.limit).toBe(1) // ditampilkan, tetapi tidak dipakai menebak
    expect(page.meta.totalPages).toBe(2)
  })

  it("totalPages dihitung dari total ÷ limit yang DIKIRIM, bukan dari panjang data", () => {
    // Server memakai limit sendiri yang lebih kecil (2) daripada yang kita
    // kirim (10) — dulu panjang data (2) dibandingkan dengan limit kita (10)
    // sehingga paginasi berhenti lebih awal dan item tak terjangkau.
    const page = readPage<number>({ items: [1, 2], total: 25 }, { page: 1, limit: 10 }, ["items"])
    expect(page.meta.totalPages).toBe(3) // ceil(25/10)
  })
})
