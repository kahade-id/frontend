/**
 * Kahade — antrean pesan chat yang GAGAL terkirim, persisten per room (B07).
 *
 * Masalah: pesan optimistis dengan `sendStatus: "failed"` hanya hidup di
 * state layar — `fetchMessages` me-replace seluruh thread, jadi status gagal
 * hilang begitu pengguna refresh / menutup room. Pengguna tidak pernah tahu
 * pesannya tidak sampai.
 *
 * Modul ini menyimpan pesan gagal:
 *   1. Memory Map per roomId (sinkron, sumber kebenaran utama).
 *   2. Persist ke SecureStore per kunci `chatFailedKey(roomId)` — selamat
 *      dari refresh state & restart app. Isi chat bersifat sensitif → TIDAK
 *      boleh ke localStorage/AsyncStorage polos (pola sama dengan draft).
 *
 * Batasan yang disengaja:
 *   - Maksimal CHAT_FAILED_QUEUE_MAX pesan per room (yang terlama dibuang).
 *   - Entri dihapus saat: retry BERHASIL (`removeChatFailedMessage`),
 *     pengguna memilih "Hapus" lokal, atau pesan terkirim.
 *   - Draft tidak memakai ini: draft = belum dikirim; ini = sudah dicoba
 *     dan gagal.
 */
import {
  chatFailedKey,
  deleteRawItem,
  getRawItem,
  setRawItem,
} from "@/lib/secure-storage"

/** Maksimal pesan gagal yang dipertahankan per room. */
export const CHAT_FAILED_QUEUE_MAX = 20

/** Payload minimal untuk me-render ulang bubble gagal + retry. */
export type FailedChatMessage = {
  id: string
  text?: string
  messageType: string
  fromUser: boolean
  attachments?: Array<{
    fileName: string
    fileUrl: string
    mimeType: string
    fileSize: number
    thumbnailUrl?: string
  }>
  /**
   * CHT-004: payload pesan LOCATION ({ lat, lng, label }) — tanpanya retry
   * pesan lokasi mengirim TEXT kosong dan data lokasi hilang permanen
   * setelah restart (antrean persisten tidak menyimpannya).
   */
  location?: { lat: number; lng: number; label?: string | null } | null
  /**
   * CHT-012: snapshot kartu pesan PRODUCT_CARD (dibangun optimistis dari
   * ShowcaseItem; `showcaseId` di dalamnya dipakai retry) — tanpanya kartu
   * produk yang gagal tidak bisa dikirim ulang setelah restart.
   */
  card?: Record<string, unknown> | null
  replyToId?: string | null
  replyTo?: {
    id: string
    content?: string | null
    messageType?: string
    isDeleted?: boolean
    senderName?: string | null
  } | null
  createdAt: string
  ephemeralTtlSeconds?: number
  viewOnce?: boolean
}

const memory = new Map<string, FailedChatMessage[]>()
/** roomId yang sudah dimuat dari storage ke memory sesi ini. */
const hydrated = new Set<string>()

function persist(roomId: string): void {
  const key = chatFailedKey(roomId)
  const list = memory.get(roomId) ?? []
  if (list.length === 0) {
    void deleteRawItem(key).catch(() => {
      // Best-effort.
    })
    return
  }
  void setRawItem(key, JSON.stringify(list)).catch(() => {
    // Gagal persist bukan fatal — memory tetap sumber kebenaran sesi ini.
  })
}

/** Daftar pesan gagal room (salinan; jangan mutasi langsung). */
export function peekChatFailedMessages(roomId: string): FailedChatMessage[] {
  return [...(memory.get(roomId) ?? [])]
}

/** Simpan/timpa satu pesan gagal (berdasar id). */
export function saveChatFailedMessage(roomId: string, message: FailedChatMessage): void {
  if (!roomId || !message?.id) return
  const list = memory.get(roomId) ?? []
  const idx = list.findIndex((m) => m.id === message.id)
  const next =
    idx >= 0
      ? list.map((m, i) => (i === idx ? message : m))
      : [...list, message].slice(-CHAT_FAILED_QUEUE_MAX)
  memory.set(roomId, next)
  hydrated.add(roomId)
  persist(roomId)
}

/** Hapus satu pesan gagal (retry sukses / hapus lokal oleh pengguna). */
export function removeChatFailedMessage(roomId: string, messageId: string): void {
  if (!roomId) return
  const list = memory.get(roomId) ?? []
  const next = list.filter((m) => m.id !== messageId)
  if (next.length === list.length && memory.has(roomId)) return
  memory.set(roomId, next)
  hydrated.add(roomId)
  persist(roomId)
}

/** Hapus seluruh antrean gagal satu room. */
export function clearChatFailedMessages(roomId: string): void {
  if (!roomId) return
  memory.delete(roomId)
  hydrated.add(roomId)
  void deleteRawItem(chatFailedKey(roomId)).catch(() => {
    // Best-effort.
  })
}

/**
 * Muat antrean gagal room: memory dulu, lalu SecureStore bila belum
 * di-hydrate sesi ini. Dipanggil sekali saat room dibuka, hasilnya
 * di-merge ke thread (pesan gagal tidak ada di server).
 */
export async function loadChatFailedMessages(roomId: string): Promise<FailedChatMessage[]> {
  if (!roomId) return []
  const cached = memory.get(roomId)
  if (cached !== undefined) return [...cached]
  if (hydrated.has(roomId)) return []
  hydrated.add(roomId)
  try {
    const stored = await getRawItem(chatFailedKey(roomId))
    if (!stored) {
      memory.set(roomId, [])
      return []
    }
    const parsed = JSON.parse(stored) as FailedChatMessage[]
    const list = Array.isArray(parsed)
      ? parsed.filter((m) => m && typeof m.id === "string").slice(-CHAT_FAILED_QUEUE_MAX)
      : []
    memory.set(roomId, list)
    return [...list]
  } catch {
    memory.set(roomId, [])
    return []
  }
}

/** @internal — dipakai test untuk isolasi antar kasus. */
export function __resetChatFailedQueueForTest(): void {
  memory.clear()
  hydrated.clear()
}
