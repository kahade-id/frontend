/**
 * Daftar chat — preview pesan terakhir (permintaan produk 2026-10-08).
 *
 * Kontrak yang dikunci:
 *  1. `chatRoomPreviewKind` — jenis lampiran untuk IKON preview
 *     (gambar / video / suara / berkas). Teks pengguna, tombstone, dan tipe
 *     khusus berlabel sendiri (lokasi, kartu, polling) TIDAK punya ikon.
 *  2. `chatRoomListPreview` tidak berubah (UI-C002 tetap): lampiran saja →
 *     "(lampiran)". Label JENISnya adalah urusan komponen, supaya kontrak
 *     lama tidak pecah.
 *  3. Baris daftar chat: TANPA prefix "Anda:" dan TANPA seal verifikasi yang
 *     menempel di foto profil.
 */
import { describe, expect, it } from "vitest"

import { chatRoomListPreview, chatRoomPreviewKind } from "@/lib/api/chat"
import type { ChatAttachmentDto } from "@/lib/api/types"
import type { ChatMessage } from "@/lib/api/chat"

function attachment(mimeType: string): ChatAttachmentDto {
  return { fileName: "a.bin", fileUrl: "https://x/a.bin", mimeType, fileSize: 1 }
}

function msg(partial: Partial<ChatMessage> & { id: string; roomId: string }): ChatMessage {
  return {
    messageType: "TEXT",
    fromUser: false,
    text: null,
    createdAt: "2026-10-08T10:00:00.000Z",
    ...partial,
  } as ChatMessage
}

describe("chatRoomPreviewKind (ikon jenis lampiran di preview)", () => {
  it("teks pengguna → tanpa ikon (preview adalah teksnya)", () => {
    expect(
      chatRoomPreviewKind(msg({ id: "m", roomId: "r", text: "Kirim", attachments: [attachment("image/jpeg")] })),
    ).toBeNull()
  })

  it("messageType IMAGE/VIDEO/VOICE/FILE → jenis yang sama", () => {
    const base = { id: "m", roomId: "r", text: "", attachments: [attachment("application/octet-stream")] }
    expect(chatRoomPreviewKind(msg({ ...base, messageType: "IMAGE" }))).toBe("image")
    expect(chatRoomPreviewKind(msg({ ...base, messageType: "VIDEO" }))).toBe("video")
    expect(chatRoomPreviewKind(msg({ ...base, messageType: "VOICE" }))).toBe("voice")
    expect(chatRoomPreviewKind(msg({ ...base, messageType: "FILE" }))).toBe("file")
  })

  it("fallback ke MIME lampiran bila messageType generik/TEXT", () => {
    const base = { id: "m", roomId: "r", text: "" }
    expect(chatRoomPreviewKind(msg({ ...base, attachments: [attachment("image/png")] }))).toBe("image")
    expect(chatRoomPreviewKind(msg({ ...base, attachments: [attachment("video/mp4")] }))).toBe("video")
    expect(chatRoomPreviewKind(msg({ ...base, attachments: [attachment("audio/m4a")] }))).toBe("voice")
    expect(chatRoomPreviewKind(msg({ ...base, attachments: [attachment("application/pdf")] }))).toBe("file")
  })

  it("tipe khusus berlabel sendiri (lokasi/kartu/polling) → tanpa ikon", () => {
    const base = { id: "m", roomId: "r", text: "" }
    expect(chatRoomPreviewKind(msg({ ...base, messageType: "LOCATION" }))).toBeNull()
    expect(chatRoomPreviewKind(msg({ ...base, messageType: "PRODUCT_CARD" }))).toBeNull()
    expect(chatRoomPreviewKind(msg({ ...base, messageType: "ORDER_CARD" }))).toBeNull()
    expect(chatRoomPreviewKind(msg({ ...base, messageType: "POLL" }))).toBeNull()
  })

  it("pesan terhapus & tanpa lampiran → tanpa ikon", () => {
    expect(chatRoomPreviewKind(msg({ id: "m", roomId: "r", text: "", isDeleted: true }))).toBeNull()
    expect(chatRoomPreviewKind(msg({ id: "m", roomId: "r", text: "" }))).toBeNull()
    expect(chatRoomPreviewKind(null)).toBeNull()
    expect(chatRoomPreviewKind(undefined)).toBeNull()
  })
})

describe("chatRoomListPreview (UI-C002 tidak berubah)", () => {
  const t = (s: string) => `EN:${s}`

  it("lampiran saja tetap '(lampiran)' — label JENIS milik komponen", () => {
    expect(
      chatRoomListPreview(
        msg({ id: "m", roomId: "r", text: "", messageType: "IMAGE", attachments: [attachment("image/jpeg")] }),
        t,
      ),
    ).toBe("EN:(lampiran)")
  })

  it("teks pengguna apa adanya", () => {
    expect(chatRoomListPreview(msg({ id: "m", roomId: "r", text: "Halo" }), t)).toBe("Halo")
  })
})
