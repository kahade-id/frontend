/**
 * Kahade — gerbang "boleh kirim" composer chat (logika murni).
 *
 * Dipisah dari `components/ui/chat-composer.tsx` supaya bisa diuji di vitest
 * (konfigurasi test repo hanya mencakup lapisan murni — modul komponen tidak
 * boleh diimpor). Komponen me-re-export fungsi ini agar API publiknya tetap.
 *
 * Aturan: kirim aktif bila ada teks ATAU minimal satu lampiran, DAN semua
 * lampiran sudah siap — tidak ada yang masih "uploading" (fileUrl belum ada;
 * mengirimnya membuat pesan ditolak server) atau "error".
 */
import type { ChatAttachmentStatus } from "@/components/ui/chat-attachment-item"

export type SendableAttachment = {
  status?: ChatAttachmentStatus
}

export function canSendMessage(
  text: string,
  attachments: readonly SendableAttachment[] = [],
): boolean {
  const hasText = text.trim().length > 0
  // Audit Pesan 2026-10-10 (realtime #31): chip "Dibatalkan" dibiarkan ada
  // untuk "Coba lagi", tetapi TIDAK boleh mengunci tombol kirim — ia tidak
  // ikut dikirim (layar menyaringnya), jadi bukan lampiran yang "belum siap".
  const sendable = attachments.filter((a) => (a.status ?? "idle") !== "cancelled")
  const hasFiles = sendable.length > 0
  const allReady = sendable.every((a) => (a.status ?? "idle") === "idle")
  return (hasText || hasFiles) && allReady
}
