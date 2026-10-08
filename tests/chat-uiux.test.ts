/**
 * TIM CHAT — audit UI/UX 2026-09-27.
 *
 * Mengunci kontrak:
 *  - `formatChatListTime` (UI-C002/UI-C003/UI-C006): cap waktu ringkas pola
 *    WhatsApp untuk daftar chat, status "terakhir dilihat", dan hasil
 *    pencarian — bukan `formatDateTime` penuh yang memadati baris.
 *  - `canSendMessage` (<ChatComposer>): tombol kirim hanya aktif bila ada isi
 *    dan semua lampiran siap (tidak ada yang masih uploading/error).
 *  - Daftar chat LIVE (2026-10-08): `applyIncomingMessageToRooms` menerapkan
 *    `chat.new_message` ke daftar room tanpa refetch; `chatRoomLastMessageStatus`
 *    = centang status pesan terakhir milik saya (pola WhatsApp/Telegram).
 */
import { describe, expect, it } from "vitest"

import { formatChatListTime } from "@/lib/format"
import { canSendMessage, type SendableAttachment } from "@/lib/chat-send-ready"
import {
  applyIncomingMessageToRooms,
  chatRoomLastMessageStatus,
  chatRoomPreview,
  nonTextMessageLabel,
  type ChatMessage,
  type ChatRoom,
} from "@/lib/api/chat"

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

function msg(partial: Partial<ChatMessage> & { id: string; roomId: string }): ChatMessage {
  return {
    messageType: "TEXT",
    fromUser: false,
    text: `teks ${partial.id}`,
    createdAt: "2026-10-08T10:00:00.000Z",
    ...partial,
  }
}

function room(id: string, lastMessage: ChatMessage | null, unreadCount = 0): ChatRoom {
  return { id, lastMessage, unreadCount, updatedAt: lastMessage?.createdAt ?? "2026-10-01T00:00:00.000Z" }
}

describe("chatRoomLastMessageStatus (centang di daftar chat)", () => {
  it("pesan lawan bicara / tidak ada pesan → tanpa centang", () => {
    expect(chatRoomLastMessageStatus(null, "me")).toBeUndefined()
    expect(chatRoomLastMessageStatus(msg({ id: "m", roomId: "r" }), "me")).toBeUndefined()
  })

  it("pesan saya di server tanpa readAt → 'sent'; masih optimistis → tanpa centang", () => {
    expect(chatRoomLastMessageStatus(msg({ id: "m", roomId: "r", fromUser: true }), "me")).toBe("sent")
    expect(
      chatRoomLastMessageStatus(msg({ id: "m", roomId: "r", fromUser: true, sendStatus: "sending" }), "me"),
    ).toBeUndefined()
  })

  it("readAt ISO atau peta berisi pembaca lain → 'read'; peta hanya berisi saya → 'sent'", () => {
    const base = { id: "m", roomId: "r", fromUser: true }
    expect(chatRoomLastMessageStatus(msg({ ...base, readAt: "2026-10-08T10:01:00.000Z" }), "me")).toBe("read")
    expect(chatRoomLastMessageStatus(msg({ ...base, readAt: { other: "2026-10-08T10:01:00.000Z" } }), "me")).toBe(
      "read",
    )
    expect(chatRoomLastMessageStatus(msg({ ...base, readAt: { me: "2026-10-08T10:01:00.000Z" } }), "me")).toBe(
      "sent",
    )
  })

  it("broadcast netral (fromUser false) dikenali milik saya lewat senderId", () => {
    expect(chatRoomLastMessageStatus(msg({ id: "m", roomId: "r", senderId: "me" }), "me")).toBe("sent")
  })
})

describe("applyIncomingMessageToRooms (daftar chat live)", () => {
  const older = msg({ id: "a1", roomId: "A", createdAt: "2026-10-08T09:00:00.000Z" })
  const rooms: ChatRoom[] = [
    room("B", msg({ id: "b1", roomId: "B", createdAt: "2026-10-08T09:30:00.000Z" })),
    room("A", older, 2),
  ]

  it("pesan lawan bicara: preview + waktu diganti, unread +1, ruang naik ke atas", () => {
    const incoming = msg({ id: "a2", roomId: "A", createdAt: "2026-10-08T10:00:00.000Z" })
    const next = applyIncomingMessageToRooms(rooms, incoming, { viewerId: "me" })
    expect(next).not.toBeNull()
    expect(next!.map((r) => r.id)).toEqual(["A", "B"])
    expect(next![0].lastMessage?.id).toBe("a2")
    expect(next![0].unreadCount).toBe(3)
    expect(next![0].updatedAt).toBe(incoming.createdAt)
    // Ruang lain tidak disentuh (identitas objek sama → memo baris bail-out).
    expect(next![1]).toBe(rooms[0])
  })

  it("pesan saya sendiri: unread TIDAK naik, fromUser dipaksa true", () => {
    const mine = msg({ id: "a3", roomId: "A", senderId: "me", createdAt: "2026-10-08T10:00:00.000Z" })
    const next = applyIncomingMessageToRooms(rooms, mine, { viewerId: "me" })!
    expect(next[0].unreadCount).toBe(2)
    expect(next[0].lastMessage?.fromUser).toBe(true)
  })

  it("pesan yang sama tiba dua kali (netral + per-viewer) hanya dihitung sekali", () => {
    const incoming = msg({ id: "a2", roomId: "A", createdAt: "2026-10-08T10:00:00.000Z" })
    const once = applyIncomingMessageToRooms(rooms, incoming, { viewerId: "me" })!
    const twice = applyIncomingMessageToRooms(once, { ...incoming, fromUser: true }, { viewerId: "me" })!
    expect(twice[0].unreadCount).toBe(3)
    expect(twice[0].lastMessage?.fromUser).toBe(true)
  })

  it("gema yang lebih lama dari preview saat ini diabaikan", () => {
    const stale = msg({ id: "a0", roomId: "A", createdAt: "2026-10-08T08:00:00.000Z" })
    const next = applyIncomingMessageToRooms(rooms, stale, { viewerId: "me" })!
    expect(next.map((r) => r.id)).toEqual(["B", "A"])
    expect(next[1].lastMessage?.id).toBe("a1")
    expect(next[1].unreadCount).toBe(2)
  })

  it("ruang tidak ada di daftar / payload tanpa roomId → null (pemanggil refetch)", () => {
    expect(applyIncomingMessageToRooms(rooms, msg({ id: "z1", roomId: "Z" }))).toBeNull()
    expect(applyIncomingMessageToRooms(rooms, { ...msg({ id: "z1", roomId: "Z" }), roomId: undefined })).toBeNull()
  })
})
