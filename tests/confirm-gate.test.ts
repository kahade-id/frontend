/**
 * Audit chat G20 — gerbang konfirmasi berkas besar (> 20 MB) + gerbang
 * Promise yang dipakai dialognya.
 */
import { describe, expect, it, vi } from "vitest"

import {
  CHAT_ATTACHMENT_MAX_BYTES,
  CHAT_LARGE_FILE_CONFIRM_BYTES,
  formatBytesId,
  needsLargeFileConfirm,
  validateChatAttachment,
} from "@/lib/chat-attachment-limits"
import { createConfirmGate } from "@/lib/confirm-gate"

const MB = 1024 * 1024

describe("needsLargeFileConfirm (G20)", () => {
  it("batas 20 MB: tepat 20 MB tidak, lebih dari itu ya", () => {
    expect(CHAT_LARGE_FILE_CONFIRM_BYTES).toBe(20 * MB)
    expect(needsLargeFileConfirm(20 * MB)).toBe(false)
    expect(needsLargeFileConfirm(20 * MB + 1)).toBe(true)
    expect(needsLargeFileConfirm(45 * MB)).toBe(true)
  })

  it("ukuran tak diketahui (0/absen/NaN) → tidak ada dasar bertanya", () => {
    expect(needsLargeFileConfirm(0)).toBe(false)
    expect(needsLargeFileConfirm(undefined)).toBe(false)
    expect(needsLargeFileConfirm(null)).toBe(false)
    expect(needsLargeFileConfirm(Number.NaN)).toBe(false)
  })

  it("konfirmasi berlaku di (20 MB, 50 MB]; di atas 50 MB ditolak lebih dulu oleh validasi server", () => {
    expect(CHAT_LARGE_FILE_CONFIRM_BYTES).toBeLessThan(CHAT_ATTACHMENT_MAX_BYTES)
    // "File 80 MB" TIDAK PERNAH sampai ke dialog: validasi menolaknya dulu.
    expect(validateChatAttachment({ size: 80 * MB, mimeType: "video/mp4" }).ok).toBe(false)
    expect(validateChatAttachment({ size: 40 * MB, mimeType: "video/mp4" }).ok).toBe(true)
    expect(needsLargeFileConfirm(40 * MB)).toBe(true)
  })

  it("teks dialog memakai format ukuran yang sama dengan pesan galat", () => {
    expect(formatBytesId(40 * MB)).toBe("40 MB")
    expect(formatBytesId(25.5 * MB)).toBe("25,5 MB")
  })
})

describe("createConfirmGate", () => {
  it("ask → settle(true) melanjutkan; settle(false) membatalkan; state dialog ikut", async () => {
    const states: Array<number | null> = []
    const gate = createConfirmGate<number>((s) => states.push(s))
    const yes = gate.ask(40)
    expect(states).toEqual([40])
    gate.settle(true)
    await expect(yes).resolves.toBe(true)
    expect(states).toEqual([40, null])

    const no = gate.ask(30)
    gate.settle(false)
    await expect(no).resolves.toBe(false)
  })

  it("pertanyaan baru membatalkan yang menggantung (tidak ada Promise yatim)", async () => {
    const gate = createConfirmGate<number>(() => undefined)
    const first = gate.ask(25)
    const second = gate.ask(35)
    await expect(first).resolves.toBe(false)
    gate.settle(true)
    await expect(second).resolves.toBe(true)
  })

  it("settle tanpa pertanyaan tidak berbuat apa-apa", () => {
    const onChange = vi.fn()
    const gate = createConfirmGate<number>(onChange)
    gate.settle(true)
    expect(onChange).not.toHaveBeenCalled()
  })

  it("dispose (layar ditutup) menjawab false supaya alur unggah berhenti", async () => {
    const gate = createConfirmGate<number>(() => undefined)
    const pending = gate.ask(40)
    gate.dispose()
    await expect(pending).resolves.toBe(false)
  })

  it("alur unggah: batal → tidak ada yang diunggah; lanjut → diunggah", async () => {
    const upload = vi.fn()
    const gate = createConfirmGate<number>(() => undefined)
    const attach = async (size: number) => {
      if (needsLargeFileConfirm(size) && !(await gate.ask(size))) return
      upload(size)
    }
    const small = attach(5 * MB)
    await small
    expect(upload).toHaveBeenCalledWith(5 * MB)

    const big = attach(40 * MB)
    gate.settle(false)
    await big
    expect(upload).toHaveBeenCalledTimes(1)

    const bigOk = attach(41 * MB)
    gate.settle(true)
    await bigOk
    expect(upload).toHaveBeenLastCalledWith(41 * MB)
  })
})
