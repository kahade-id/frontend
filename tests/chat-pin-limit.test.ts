/**
 * Audit chat E12 — batas pin dijelaskan di UI, bukan gagal diam-diam.
 *
 * Kontrak backend tidak menyebut angka maupun kode galat batas pin, jadi
 * pengenalannya heuristik (kode/pesan/body) dan DIKUNCI di sini terhadap
 * bentuk galat yang masuk akal — termasuk yang BUKAN batas (jaringan, 404,
 * angka status yang kebetulan ada di pesan).
 */
import { describe, expect, it } from "vitest"

import {
  CHAT_PIN_LIMIT_FALLBACK,
  classifyPinFailure,
  parsePinLimitError,
  pinBlockedByKnownLimit,
} from "@/lib/chat-pin"

describe("parsePinLimitError", () => {
  it("pesan Inggris: 'Maximum 3 pinned messages per room' → batas 3", () => {
    expect(parsePinLimitError({ status: 400, code: "BAD_REQUEST", message: "Maximum 3 pinned messages per room" })).toEqual({ limit: 3 })
  })

  it("pesan Indonesia: 'Maksimal 3 pesan yang bisa disematkan' → batas 3", () => {
    expect(parsePinLimitError({ status: 400, message: "Maksimal 3 pesan yang bisa disematkan" })).toEqual({ limit: 3 })
  })

  it("kode backend tanpa angka: batas tercapai tapi angka tak diketahui", () => {
    expect(parsePinLimitError({ status: 409, code: "CONFLICT", backendCode: "CHAT_PIN_LIMIT_REACHED" })).toEqual({ limit: null })
  })

  it("angka dari body mentah (raw)", () => {
    expect(
      parsePinLimitError({ status: 422, raw: { message: ["pin limit is 5 per room"] } }),
    ).toEqual({ limit: 5 })
  })

  it("angka format '5 pin'", () => {
    expect(parsePinLimitError({ status: 400, message: "Room sudah punya 5 pin, tidak bisa lebih dari itu" })).toEqual({ limit: 5 })
  })

  it("kode status di pesan tidak dianggap batas", () => {
    expect(parsePinLimitError({ status: 409, message: "Request failed with status 409: pin limit reached" })).toEqual({ limit: null })
  })

  it("BUKAN batas: jaringan, timeout, 404, 500, galat tanpa kata pin/batas", () => {
    expect(parsePinLimitError({ code: "NETWORK", message: "pin limit" })).toBeNull()
    expect(parsePinLimitError({ code: "TIMEOUT" })).toBeNull()
    expect(parsePinLimitError({ status: 404, message: "pin not found" })).toBeNull()
    expect(parsePinLimitError({ status: 500, message: "max pin limit exceeded" })).toBeNull()
    expect(parsePinLimitError({ status: 400, message: "Pesan tidak ditemukan" })).toBeNull()
    expect(parsePinLimitError({ status: 400, message: "limit rate exceeded" })).toBeNull() // tanpa kata pin
    expect(parsePinLimitError(null)).toBeNull()
    expect(parsePinLimitError("pin limit")).toBeNull()
  })
})

describe("classifyPinFailure", () => {
  it("memakai angka dari galat bila ada", () => {
    expect(classifyPinFailure({ status: 400, message: "Maximum 3 pins" }, { pinnedCount: 2 })).toEqual({ kind: "limit", limit: 3 })
  })

  it("tanpa angka: batas = jumlah pin saat ditolak (penolakan karena sudah penuh)", () => {
    expect(
      classifyPinFailure({ status: 409, backendCode: "PIN_LIMIT_REACHED" }, { pinnedCount: 4 }),
    ).toEqual({ kind: "limit", limit: 4 })
  })

  it("tanpa angka dan daftar pin belum termuat: jatuh ke angka produk (3)", () => {
    expect(
      classifyPinFailure({ status: 409, backendCode: "PIN_LIMIT_REACHED" }, { pinnedCount: 0 }),
    ).toEqual({ kind: "limit", limit: CHAT_PIN_LIMIT_FALLBACK })
    expect(CHAT_PIN_LIMIT_FALLBACK).toBe(3)
  })

  it("selain batas → 'other' (toast generik tetap dipakai)", () => {
    expect(classifyPinFailure({ code: "NETWORK" }, { pinnedCount: 3 })).toEqual({ kind: "other" })
    expect(classifyPinFailure(new Error("boom"), { pinnedCount: 3 })).toEqual({ kind: "other" })
  })
})

describe("pinBlockedByKnownLimit", () => {
  it("tidak menebak di muka: tanpa batas yang dipelajari, tidak pernah memblokir", () => {
    expect(pinBlockedByKnownLimit(null, 99)).toBe(false)
  })

  it("setelah batas dipelajari, memblokir saat penuh dan membuka lagi setelah lepas pin", () => {
    expect(pinBlockedByKnownLimit(3, 3)).toBe(true)
    expect(pinBlockedByKnownLimit(3, 4)).toBe(true)
    expect(pinBlockedByKnownLimit(3, 2)).toBe(false)
  })
})

describe("alur penuh: pin ke-4 ditolak backend (integrasi applyPinChange + klasifikasi)", () => {
  // Backend rekaan: menolak pin bila sudah ada 3, dengan pesan yang tidak memuat angka sebagai kode.
  it("rollback optimistis → penjelasan 'maksimal 3' → pin berikutnya diblokir di muka → bisa lagi setelah lepas pin", async () => {
    const { applyPinChange } = await import("@/lib/chat-message-actions")
    type M = import("@/lib/api/chat").ChatMessage
    const mk = (id: string, minute: number): M => ({
      id,
      messageType: "TEXT",
      fromUser: true,
      text: id,
      createdAt: new Date(Date.UTC(2026, 9, 7, 8, minute)).toISOString(),
    })
    const msgs = [mk("a", 1), mk("b", 2), mk("c", 3), mk("d", 4)]
    let thread = msgs
    let pinned: M[] = []
    const serverPinned = new Set<string>()
    const patchMessage = (id: string, patch: (m: M) => M) => {
      thread = thread.map((m) => (m.id === id ? patch(m) : m))
    }
    const setPinned = (u: (prev: M[]) => M[]) => {
      pinned = u(pinned)
    }
    const api = {
      pin: async (_room: string, id: string) => {
        if (serverPinned.size >= 3) {
          throw Object.assign(new Error("Maximum 3 pinned messages per room"), {
            status: 400,
            code: "BAD_REQUEST",
          })
        }
        serverPinned.add(id)
      },
      unpin: async (_room: string, id: string) => {
        serverPinned.delete(id)
      },
    }
    const run = (m: M, wantPin: boolean) =>
      applyPinChange({ roomId: "r1", message: m, wantPin, ...api, patchMessage, setPinned })

    for (const m of msgs.slice(0, 3)) expect((await run(m, true)).ok).toBe(true)
    expect(pinned).toHaveLength(3)

    // Pin ke-4 ditolak: UI kembali persis, galat terklasifikasi sebagai batas 3.
    const fourth = thread.find((m) => m.id === "d") as M
    const result = await run(fourth, true)
    expect(result.ok).toBe(false)
    expect(pinned.map((p) => p.id)).toEqual(["a", "b", "c"])
    expect(thread.find((m) => m.id === "d")?.isPinned).toBe(false)
    const failure = classifyPinFailure(result.ok ? null : result.error, {
      pinnedCount: pinned.filter((p) => p.id !== "d").length,
    })
    expect(failure).toEqual({ kind: "limit", limit: 3 })

    // Batas dipelajari → percobaan berikutnya diblokir di muka (tanpa request).
    const learned = failure.kind === "limit" ? failure.limit : null
    expect(pinBlockedByKnownLimit(learned, pinned.length)).toBe(true)

    // Lepas satu pin → ruang kosong → pin ke-4 berhasil.
    await run(thread.find((m) => m.id === "a") as M, false)
    expect(pinBlockedByKnownLimit(learned, pinned.length)).toBe(false)
    expect((await run(fourth, true)).ok).toBe(true)
    expect(pinned.map((p) => p.id).sort()).toEqual(["b", "c", "d"])
  })
})
