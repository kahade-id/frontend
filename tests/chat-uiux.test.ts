/**
 * TIM CHAT — audit UI/UX 2026-09-27.
 *
 * Mengunci kontrak:
 *  - `formatChatListTime` (UI-C002/UI-C003/UI-C006): cap waktu ringkas pola
 *    WhatsApp untuk daftar chat, status "terakhir dilihat", dan hasil
 *    pencarian — bukan `formatDateTime` penuh yang memadati baris.
 *  - `canSendMessage` (<ChatComposer>): tombol kirim hanya aktif bila ada isi
 *    dan semua lampiran siap (tidak ada yang masih uploading/error).
 */
import { describe, expect, it } from "vitest"

import { formatChatListTime } from "@/lib/format"
import { canSendMessage, type SendableAttachment } from "@/lib/chat-send-ready"
import { chatRoomPreview, nonTextMessageLabel } from "@/lib/api/chat"

/** Komponen tanggal lokal (zona perangkat) — hasil tak bergantung TZ mesin CI. */
function localIso(year: number, month: number, day: number, h = 12, min = 0): string {
  return new Date(year, month - 1, day, h, min).toISOString()
}

function startOfToday(): Date {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate())
}

describe("formatChatListTime", () => {
  it("hari ini → jam saja (HH:MM)", () => {
    const t = startOfToday()
    const iso = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 9, 41).toISOString()
    expect(formatChatListTime(iso)).toBe("09:41")
  })

  it("kemarin → 'Kemarin' (bukan tanggal penuh)", () => {
    const t = startOfToday()
    const y = new Date(t.getTime() - 86_400_000)
    const iso = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 20, 15).toISOString()
    expect(formatChatListTime(iso)).toBe("Kemarin")
  })

  it("tahun berjalan (> kemarin) → '12 Sep' tanpa tahun", () => {
    const t = startOfToday()
    // 10 hari lalu; bila jatuh ke tahun lalu, lewati (diuji di kasus tahun lalu).
    const d = new Date(t.getTime() - 10 * 86_400_000)
    if (d.getFullYear() === t.getFullYear()) {
      const out = formatChatListTime(d.toISOString())
      expect(out).not.toContain(String(t.getFullYear()))
      expect(out).toMatch(/^\d{1,2} \w+$/)
    }
  })

  it("tahun lalu → memakai tahun ('12 Sep 2025')", () => {
    const t = startOfToday()
    const iso = localIso(t.getFullYear() - 1, 3, 12, 10, 30)
    const out = formatChatListTime(iso)
    expect(out).toContain(String(t.getFullYear() - 1))
    expect(out).toMatch(/^\d{1,2} \w+ \d{4}$/)
  })

  it("batas tengah malam: 00:05 hari ini tetap jam, bukan 'Kemarin'", () => {
    const t = startOfToday()
    const iso = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 0, 5).toISOString()
    expect(formatChatListTime(iso)).toMatch(/^\d{2}:\d{2}$/)
  })

  it("23:55 kemarin tetap 'Kemarin' (batas hari lokal, bukan UTC)", () => {
    const t = startOfToday()
    const y = new Date(t.getTime() - 86_400_000)
    const iso = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 55).toISOString()
    expect(formatChatListTime(iso)).toBe("Kemarin")
  })

  it("invalid → '—'", () => {
    expect(formatChatListTime("bukan-tanggal")).toBe("—")
    expect(formatChatListTime("")).toBe("—")
  })

  it("tidak pernah memakai formatDateTime penuh ('3 Sep 2026, 14:30')", () => {
    const t = startOfToday()
    const iso = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 14, 30).toISOString()
    expect(formatChatListTime(iso)).not.toContain(",")
  })
})

const idleAttachment: SendableAttachment & { localId: string } = {
  localId: "a1",
  status: "idle",
}

describe("canSendMessage", () => {
  it("teks saja → bisa", () => {
    expect(canSendMessage("halo", [])).toBe(true)
  })

  it("kosong tanpa lampiran → tidak bisa", () => {
    expect(canSendMessage("", [])).toBe(false)
    expect(canSendMessage("   ", [])).toBe(false)
  })

  it("lampiran siap tanpa teks → bisa", () => {
    expect(canSendMessage("", [idleAttachment])).toBe(true)
  })

  it("lampiran masih uploading → tidak bisa (fileUrl belum ada)", () => {
    expect(canSendMessage("halo", [{ ...idleAttachment, status: "uploading" }])).toBe(false)
    expect(canSendMessage("", [{ ...idleAttachment, status: "uploading" }])).toBe(false)
  })

  it("lampiran error → tidak bisa", () => {
    expect(canSendMessage("halo", [{ ...idleAttachment, status: "error" }])).toBe(false)
  })

  it("campuran: satu uploading membatalkan semuanya", () => {
    expect(
      canSendMessage("", [idleAttachment, { ...idleAttachment, localId: "a2", status: "uploading" }]),
    ).toBe(false)
  })
})

describe("chatRoomPreview (UI-C002)", () => {
  const attachment = {
    fileName: "foto.jpg",
    fileUrl: "https://x/foto.jpg",
    mimeType: "image/jpeg",
    fileSize: 123,
  }

  it("teks biasa → teks apa adanya", () => {
    expect(chatRoomPreview({ text: "Halo, kak" })).toBe("Halo, kak")
  })

  it("teks hanya spasi + tanpa lampiran → string kosong", () => {
    expect(chatRoomPreview({ text: "   " })).toBe("")
  })

  it("lampiran saja tanpa teks → label lampiran", () => {
    expect(chatRoomPreview({ text: "", attachments: [attachment] }, "(lampiran)")).toBe(
      "(lampiran)",
    )
  })

  it("label lampiran bisa diterjemahkan pemanggil", () => {
    expect(chatRoomPreview({ attachments: [attachment] }, "(attachment)")).toBe("(attachment)")
  })

  it("teks menang atas lampiran", () => {
    expect(
      chatRoomPreview({ text: "Lihat ini", attachments: [attachment] }, "(lampiran)"),
    ).toBe("Lihat ini")
  })

  it("null/undefined → string kosong", () => {
    expect(chatRoomPreview(null)).toBe("")
    expect(chatRoomPreview(undefined)).toBe("")
  })
})

describe("nonTextMessageLabel (CHT-011)", () => {
  it("tipe lampiran → '(lampiran)' (konsisten UI-C002)", () => {
    for (const t of ["IMAGE", "VIDEO", "VOICE", "FILE", "image"]) {
      expect(nonTextMessageLabel(t)).toBe("(lampiran)")
    }
  })

  it("tipe khusus batch 43 → label spesifik (bukan '(lampiran)')", () => {
    expect(nonTextMessageLabel("LOCATION")).toBe("Lokasi")
    expect(nonTextMessageLabel("PRODUCT_CARD")).toBe("Kartu produk")
    expect(nonTextMessageLabel("ORDER_CARD")).toBe("Kartu pesanan")
  })

  it("tipe tak dikenal/kosong → '(lampiran)'", () => {
    expect(nonTextMessageLabel("STICKER")).toBe("(lampiran)")
    expect(nonTextMessageLabel(undefined)).toBe("(lampiran)")
    expect(nonTextMessageLabel(null)).toBe("(lampiran)")
  })
})
