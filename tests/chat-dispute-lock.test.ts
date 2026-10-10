/**
 * Audit Pesan 2026-10-10 (#9d): selama order DISPUTED server menolak edit &
 * hapus-untuk-semua pesan (kode CHAT_MESSAGE_LOCKED_DISPUTE — isi chat =
 * bukti sengketa). Frontend tidak menawarkan aksi itu, dan bila status
 * berubah di tengah jalan galatnya dijelaskan, bukan generik.
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

import { ApiError, userMessage } from "@/lib/api/errors"
import { CHAT_MESSAGE_LOCKED_DISPUTE } from "@/lib/api/error-codes"
import { isChatMessageLockedByDispute } from "@/lib/chat-dispute-lock"

describe("isChatMessageLockedByDispute", () => {
  it("hanya DISPUTED yang mengunci", () => {
    expect(isChatMessageLockedByDispute("DISPUTED")).toBe(true)
    for (const s of ["PAID", "SHIPPED", "COMPLETED", "CANCELLED", "REFUNDED", "EXPIRED", "", null, undefined]) {
      expect(isChatMessageLockedByDispute(s)).toBe(false)
    }
  })
})

describe("userMessage: CHAT_MESSAGE_LOCKED_DISPUTE", () => {
  it("pesan backend (Inggris) tidak diteruskan — copy Indonesia yang menjelaskan sebabnya", () => {
    const err = new ApiError({
      code: "BAD_REQUEST",
      status: 409,
      message: "Message is locked while the order is disputed",
      backendCode: CHAT_MESSAGE_LOCKED_DISPUTE,
      clientMessage: false,
    })
    const copy = userMessage(err)
    expect(copy).toContain("sengketa")
    expect(copy).not.toMatch(/locked|disputed/i)
    expect(copy).not.toContain("Terjadi kesalahan")
  })
})

describe("penyambungan ke layar ruang chat (guard sumber)", () => {
  const room = readFileSync(
    resolve(process.cwd(), "components/screens/chat-room-screen.tsx"),
    "utf8",
  )

  it("kunci diturunkan dari status order ruang", () => {
    expect(room).toContain("const messagesLockedByDispute = isChatMessageLockedByDispute(order?.status)")
  })

  it("aksi Ubah tidak ditawarkan saat terkunci", () => {
    expect(room).toMatch(/!!singleSelected\.text &&\s*\n(\s*\/\/[^\n]*\n)*\s*!messagesLockedByDispute/)
  })

  it("opsi 'Hapus untuk semua orang' disembunyikan saat terkunci; hapus lokal tetap ada", () => {
    expect(room).toContain("...(allSelectedMine && !messagesLockedByDispute")
    expect(room).toContain('label: translate("Hapus untuk saya")')
  })

  it("percakapan TIDAK ditutup oleh sengketa (sengketa butuh komunikasi)", () => {
    expect(room).toMatch(/\["COMPLETED", "CANCELLED", "REFUNDED", "EXPIRED"\]\.includes\(order\.status\)/)
    expect(room).not.toMatch(/\[[^\]]*"DISPUTED"[^\]]*\]\.includes\(order\.status\)/)
  })
})
