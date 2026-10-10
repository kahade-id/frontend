/**
 * AP-02 (audit etalase 2026-10-10): satu baris `null`/non-objek di
 * users/orders/transactions dari GET /v1/search tidak boleh meruntuhkan
 * seluruh hasil (dulu TypeError → "Terjadi kesalahan. Coba lagi.").
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock("@/lib/api/client", () => ({ http: { get: mocks.get, delete: vi.fn() }, seg: (v: string) => encodeURIComponent(v) }))
vi.mock("@/lib/api/orders", () => ({ normalizeOrder: (o: Record<string, unknown>) => ({ ...o, normalized: true }) }))

import { deleteSearchHistoryItem, globalSearch } from "@/lib/api/search"

beforeEach(() => vi.clearAllMocks())

describe("globalSearch — baris rusak dilewati per baris", () => {
  it("null/non-objek di users, orders, transactions dibuang; baris sehat tetap ada", async () => {
    mocks.get.mockResolvedValue({
      results: {
        users: [null, { id: "u1", username: "a" }, 42],
        orders: [{ id: "o1" }, null],
        transactions: [undefined, { txId: "TX-1", referenceId: "R" }],
        helpCenter: [],
        showcase: [],
        totals: { users: 3, orders: 2, transactions: 2, showcase: 0, helpCenter: 0 },
      },
    })
    const out = await globalSearch({ q: "sepatu" })
    expect(out.users).toHaveLength(1)
    expect(out.users?.[0]).toMatchObject({ id: "u1" })
    expect(out.orders).toHaveLength(1)
    expect(out.orders?.[0]).toMatchObject({ id: "o1", normalized: true })
    expect(out.transactions).toHaveLength(1)
    expect(out.transactions?.[0]).toMatchObject({ id: "TX-1", referenceId: "R" })
    // Total tetap dari server (bukan hitungan baris lokal).
    expect(out.totals?.users).toBe(3)
  })
})

describe("deleteSearchHistoryItem — AP-06 segmen dot", () => {
  it("'..' / '.' / kosong ditolak di klien dengan pesan yang bisa ditindak (bukan DELETE /v1/search/)", async () => {
    await expect(deleteSearchHistoryItem("..")).rejects.toMatchObject({ code: "BAD_REQUEST" })
    await expect(deleteSearchHistoryItem(" . ")).rejects.toMatchObject({ code: "BAD_REQUEST" })
    await expect(deleteSearchHistoryItem("")).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })
})
