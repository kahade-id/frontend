/**
 * Kahade — pembangun body kirim pesan chat (audit chat B6, MURNI).
 *
 * SATU fungsi membangun `SendMessageDto` dari bubble optimistis, dipakai oleh
 * kiriman pertama DAN semua percobaan ulang. Itu syarat idempotensi:
 * `Idempotency-Key` yang SAMA dengan body yang BERBEDA adalah kontrak yang
 * tidak terdefinisi — server bisa menolak (422 key-reuse) atau, lebih buruk,
 * mengembalikan pesan pertama seolah retry sukses. Dengan builder tunggal,
 * "key sama ⇒ body sama" berlaku menurut konstruksi, bukan menurut disiplin.
 *
 * Bug yang ikut tertutup: retry manual dulu HANYA meneruskan
 * `ephemeralTtlSeconds`/`viewOnce` untuk lokasi & kartu produk; pesan TEKS/FOTO
 * sekali-lihat yang gagal lalu di-retry terkirim sebagai pesan biasa yang
 * permanen — bocor melewati niat pengirim.
 */
import { asProductCard, type ChatMessage } from "@/lib/api/chat"
import type { ChatAttachmentDto, SendMessageDto } from "@/lib/api/types"
import { createIdempotencyKey } from "@/lib/api/client"

const SENDABLE_TYPES = [
  "TEXT",
  "IMAGE",
  "FILE",
  "VIDEO",
  "VOICE",
  "LOCATION",
  "PRODUCT_CARD",
] as const

type SendableType = (typeof SENDABLE_TYPES)[number]

/**
 * `messageType` ChatMessage bisa string bebas; DTO hanya menerima union ini —
 * nilai tak dikenal jatuh ke TEXT (validasi defensif).
 */
function sendableType(messageType: string): SendableType {
  return (SENDABLE_TYPES as readonly string[]).includes(messageType)
    ? (messageType as SendableType)
    : "TEXT"
}

function toAttachmentDto(a: ChatAttachmentDto): ChatAttachmentDto {
  return {
    fileName: a.fileName,
    fileUrl: a.fileUrl,
    mimeType: a.mimeType,
    fileSize: a.fileSize,
    thumbnailUrl: a.thumbnailUrl,
  }
}

/**
 * Body kirim untuk bubble optimistis `message`. Murni & deterministik: dipanggil
 * dua kali untuk pesan yang sama menghasilkan body yang sama persis.
 */
export function buildSendDto(message: ChatMessage): SendMessageDto {
  const messageType = sendableType(message.messageType)
  const location = messageType === "LOCATION" ? message.location : null
  const card = messageType === "PRODUCT_CARD" ? asProductCard(message.card) : null
  return {
    messageType,
    content: message.text || undefined,
    attachments: message.attachments?.length
      ? message.attachments.map(toAttachmentDto)
      : undefined,
    // BFE-003: `durationSeconds` wajib untuk VOICE (server 400 tanpanya).
    durationSeconds: messageType === "VOICE" ? (message.durationSeconds ?? undefined) : undefined,
    // CHT-004: koordinat + label asli — bukan TEXT kosong.
    location: location
      ? { lat: location.lat, lng: location.lng, label: location.label ?? undefined }
      : undefined,
    // CHT-012: kartu produk dikirim via showcaseId; server membekukan snapshot.
    showcaseId: card?.showcaseId,
    replyToId: message.replyToId ?? undefined,
    // Berlaku untuk SEMUA tipe: retry harus mereproduksi kiriman asli.
    ephemeralTtlSeconds: message.ephemeralTtlSeconds ?? undefined,
    viewOnce: message.viewOnce || undefined,
  }
}

/**
 * Idempotency key untuk percobaan ulang: PAKAI YANG SAMA dengan kiriman
 * pertama. Bila bubble (data lama dari sebelum fitur key) tidak membawanya,
 * satu key baru dibuat dan `generated: true` — pemanggil WAJIB menyimpannya
 * pada bubble + antrean persisten sebelum mengirim, supaya percobaan
 * berikutnya memakai key itu, bukan key baru lagi.
 */
export function resolveRetryKey(
  message: Pick<ChatMessage, "sendIdempotencyKey">,
): { key: string; generated: boolean } {
  const existing = message.sendIdempotencyKey
  if (existing) return { key: existing, generated: false }
  return { key: createIdempotencyKey(), generated: true }
}
