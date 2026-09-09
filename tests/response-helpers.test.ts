/**
 * Test helper pembaca respons di `lib/api/response.ts`.
 *
 * Fokusnya satu aturan yang berulang kali dilanggar: **"tidak tahu" bukan
 * "tidak"**. `pickBoolean` harus mengembalikan `undefined` saat backend tidak
 * mengirim field-nya, karena `undefined !== true` dulu dipakai sebagai gerbang
 * dan mematikan transfer ke semua penerima.
 */
import { describe, expect, it } from "vitest"

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
