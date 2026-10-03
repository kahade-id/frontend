/**
 * Kahade — ekspor riwayat chat ke TXT (batch 43 FE-CHAT, 2026-09-28).
 *
 * GET /v1/chat/rooms/{id}/export?format=txt → simpan via `saveTextFile`
 * (web: unduh; native: share sheet). Batas backend 5000 pesan
 * (CHAT_EXPORT_TOO_LARGE bila lewat — diteruskan sebagai pesan error).
 */
import { exportChatRoom } from "@/lib/api/chat"
import { saveTextFile } from "@/lib/export-file"

export type ChatExportResult = {
  /** true bila file berhasil disimpan/dibagikan. */
  saved: boolean
  filename: string
}

/** Ekspor chat ruang ini ke file TXT lalu simpan/bagikan. Melempar bila gagal. */
export async function exportAndSaveChatRoom(roomId: string): Promise<ChatExportResult> {
  const { filename, content } = await exportChatRoom(roomId, "txt")
  // saveTextFile (bukan saveBlobFile): konstruktor Blob + round-trip
  // arrayBuffer() tidak konsisten di runtime RN — lihat export-file.ts.
  await saveTextFile(content, filename, "text/plain")
  return { saved: true, filename }
}
