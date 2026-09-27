/**
 * Kahade — ekspor riwayat chat ke TXT (batch 43 FE-CHAT, 2026-09-28).
 *
 * GET /v1/chat/rooms/{id}/export?format=txt → simpan via `saveBlobFile`
 * (web: unduh; native: share sheet). Batas backend 5000 pesan
 * (CHAT_EXPORT_TOO_LARGE bila lewat — diteruskan sebagai pesan error).
 */
import { exportChatRoom } from "@/lib/api/chat"
import { saveBlobFile } from "@/lib/export-file"

export type ChatExportResult = {
  /** true bila file berhasil disimpan/dibagikan. */
  saved: boolean
  filename: string
}

/** Ekspor chat ruang ini ke file TXT lalu simpan/bagikan. Melempar bila gagal. */
export async function exportAndSaveChatRoom(roomId: string): Promise<ChatExportResult> {
  const { filename, content } = await exportChatRoom(roomId, "txt")
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
  await saveBlobFile(blob, filename, "text/plain;charset=utf-8")
  return { saved: true, filename }
}
