/**
 * Audit Pesan 2026-10-10 (#9e/#10): bisukan & arsipkan dari menu ⋮ ruang
 * chat OPTIMISTIS dengan rollback, dan labelnya lewat i18n.
 *
 * Menu ini memegang mutasinya sendiri (lihat header komponen); logikanya
 * kecil dan terikat ke ActionSheet, jadi dijaga di tingkat sumber + tombstone
 * realtime (#9c) di layar.
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const menu = readFileSync(resolve(process.cwd(), "components/ui/chat-room-menu.tsx"), "utf8")
const room = readFileSync(resolve(process.cwd(), "components/screens/chat-room-screen.tsx"), "utf8")

describe("menu ⋮ ruang: bisukan/arsip optimistis", () => {
  it("state ruang ditambal SEBELUM request (di luar runBusy), lalu dikonfirmasi respons", () => {
    expect(menu).toMatch(
      /const wantMuted = room\.isMuted !== true\s*\n\s*const rollback = \{ isMuted: room\.isMuted, mutedUntil: room\.mutedUntil \}\s*\n\s*onRoomChange\(\{ isMuted: wantMuted/,
    )
    expect(menu).toMatch(
      /const wantArchived = !room\.isArchived\s*\n\s*const rollback = \{ isArchived: room\.isArchived \}\s*\n\s*onRoomChange\(\{ isArchived: wantArchived \}\)/,
    )
  })

  it("gagal → dikembalikan PERSIS ke nilai semula, galat tetap dilaporkan (throw ke runBusy)", () => {
    const rollbacks = menu.match(/\} catch \(err\) \{\s*\n\s*onRoomChange\(rollback\)\s*\n\s*throw err/g) ?? []
    expect(rollbacks.length).toBe(2)
  })

  it("tidak ada lagi pola lama: onRoomChange hanya setelah await", () => {
    expect(menu).not.toMatch(/const res = await setRoomMuted\(room\.id, room\.isMuted !== true\)/)
    expect(menu).not.toMatch(/const res = await setRoomArchived\(room\.id, !room\.isArchived\)/)
  })

  it("#10: label menu & toast lewat translate()", () => {
    for (const literal of [
      'label: "Lihat pesanan"',
      'label: "Cari semua pesan"',
      'label: "Ekspor chat (TXT)"',
      'label: "Pesan berbintang"',
      'label: "Buat transaksi"',
      'label: "Lihat profil"',
      'label: "Laporkan / Blokir"',
      'title: "Gagal memperbarui percakapan"',
      '"Percakapan dibisukan" : "Suara percakapan dikembalikan"',
    ]) {
      expect(menu).not.toContain(literal)
    }
    expect(menu).toContain('import { translate } from "@/lib/i18n"')
  })
})

describe("tombstone realtime (#9c) juga membersihkan pin & target balasan", () => {
  it("onMessageDeleted menyentuh setPinned dan setReplyTarget", () => {
    expect(room).toMatch(
      /onMessageDeleted: \(messageId\) => \{\s*\n\s*setMessages\(\(prev\) => applyDeletedTombstone\(prev, messageId\)\)[\s\S]{0,400}?setPinned\(\(prev\) =>[\s\S]{0,200}?setReplyTarget\(\(prev\) => \(prev\?\.id === messageId \? null : prev\)\)/,
    )
  })
})
