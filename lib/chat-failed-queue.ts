/**
 * Kahade — antrean pesan chat lokal per-room (B07 + antre kirim Fase 3).
 *
 * Menyimpan pesan yang perlu tindakan pengguna maupun pesan yang memang
 * menunggu koneksi. Isi chat hanya disimpan lewat SecureStore native; web
 * tetap memory-only. Penjadwal kirim otomatis berada di
 * `lib/chat-send-queue.ts`, terpisah dari antrean sosial.
 *
 * Batas: maksimal CHAT_FAILED_QUEUE_MAX pesan per room. Bila penuh, pesan
 * failed tertua boleh digantikan; pesan queued/sending tidak pernah dibuang
 * diam-diam.
 */
import {
  chatFailedKey,
  deleteRawItem,
  getChatLocalScope,
  getRawItem,
  registerChatLocalKey,
  setRawItem,
} from "@/lib/secure-storage"
import { getSessionRevision, subscribeSession } from "@/lib/api/session"
import { logWarn } from "@/lib/telemetry"

/**
 * Audit Pesan 2026-10-10 (#6): kunci persist ber-scope SESI AKUN dan
 * tercatat di indeks agar `clearSession()` menghapusnya saat logout —
 * pesan gagal (isi chat!) akun A tidak boleh dipulihkan di sesi akun B.
 */
export async function chatFailedStorageKey(roomId: string): Promise<string> {
  return chatFailedKey(roomId, await getChatLocalScope())
}

/** Maksimal pesan lokal yang dipertahankan per room. */
export const CHAT_FAILED_QUEUE_MAX = 20

export type ChatLocalSendStatus = "queued" | "sending" | "failed"

/** Payload minimal untuk memulihkan bubble lokal dan retry/kirim antrean. */
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
   * ShowcaseItem; `showcaseId` di dalamnya dipakai retry).
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
  /** Fase 3: dipakai ulang pada pengiriman antrean dan retry manual. */
  idempotencyKey?: string
  /** Fase 3: durasi voice note untuk rekonstruksi DTO saat kirim ulang. */
  durationSeconds?: number
  /** Status lokal; field absen pada data lama berarti `failed`. */
  sendStatus?: ChatLocalSendStatus
  /** Hanya ada pada pesan yang menunggu antrean otomatis. */
  queueEnqueuedAt?: number
}

const memory = new Map<string, FailedChatMessage[]>()
/** roomId yang sudah dimuat dari storage ke memory sesi ini. */
const hydrated = new Set<string>()
/** Serialisasi tulis per room agar update status tidak menimpa snapshot lama. */
const persistChains = new Map<string, Promise<void>>()
/** Hidrasi per room yang sedang berjalan — pemanggil bersamaan menunggu ini. */
const hydrating = new Map<string, Promise<FailedChatMessage[]>>()

/**
 * #6: memori proses juga dibersihkan saat sesi berganti (login/logout) —
 * pola yang sama dengan lib/chat-drafts. Tanpa ini akun B masih melihat
 * bubble "gagal terkirim" akun A sampai aplikasi di-restart.
 */
let failedQueueSessionRevision = getSessionRevision()
subscribeSession(() => {
  if (failedQueueSessionRevision === getSessionRevision()) return
  failedQueueSessionRevision = getSessionRevision()
  __resetChatFailedQueueForTest()
})

function persistRoom(roomId: string): Promise<void> {
  const previous = persistChains.get(roomId) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(async () => {
    const key = await chatFailedStorageKey(roomId)
    const list = memory.get(roomId) ?? []
    if (list.length === 0) {
      await deleteRawItem(key)
      return
    }
    // #6: catat di indeks DULU supaya logout selalu tahu kunci ini ada.
    await registerChatLocalKey(key)
    await setRawItem(key, JSON.stringify(list))
  })
  persistChains.set(roomId, next)
  void next.finally(() => {
    if (persistChains.get(roomId) === next) persistChains.delete(roomId)
  }).catch(() => undefined)
  return next
}

function reportPersistFailure(action: string, error: unknown): void {
  logWarn(`chat-failed-queue:${action}`, error)
}

function upsertMemory(roomId: string, message: FailedChatMessage): boolean {
  const list = memory.get(roomId) ?? []
  const idx = list.findIndex((m) => m.id === message.id)
  if (idx >= 0) {
    memory.set(roomId, list.map((m, i) => (i === idx ? message : m)))
    hydrated.add(roomId)
    return true
  }

  let next = [...list, message]
  if (next.length > CHAT_FAILED_QUEUE_MAX) {
    // Never evict a queued or in-flight send. Preserve the old behavior of
    // dropping the oldest failed record when that is the only safe choice.
    const evict = next.findIndex((m) => m.sendStatus !== "queued" && m.sendStatus !== "sending")
    if (evict < 0) return false
    next = next.filter((_, i) => i !== evict)
  }
  memory.set(roomId, next)
  hydrated.add(roomId)
  return true
}

function removeMemory(roomId: string, messageId: string): void {
  const list = memory.get(roomId) ?? []
  const next = list.filter((m) => m.id !== messageId)
  if (next.length !== list.length || !memory.has(roomId)) memory.set(roomId, next)
  hydrated.add(roomId)
}

/** Daftar pesan lokal room (salinan; jangan mutasi langsung). */
export function peekChatFailedMessages(roomId: string): FailedChatMessage[] {
  return [...(memory.get(roomId) ?? [])]
}

/**
 * Simpan/timpa satu pesan lokal secara sinkron di memory. Persist best-effort;
 * antrean kirim memakai varian async agar dapat mengetahui kegagalan storage.
 */
export function saveChatFailedMessage(roomId: string, message: FailedChatMessage): void {
  if (!roomId || !message?.id || !upsertMemory(roomId, message)) return
  void persistRoom(roomId).catch((error) => reportPersistFailure("persist", error))
}

/** Simpan pesan lokal dan tunggu penulisan storage; false berarti antrean penuh. */
export async function saveChatFailedMessageAsync(
  roomId: string,
  message: FailedChatMessage,
): Promise<boolean> {
  if (!roomId || !message?.id || !upsertMemory(roomId, message)) return false
  await persistRoom(roomId)
  return true
}

/** Hapus satu pesan lokal (retry sukses / hapus lokal oleh pengguna). */
export function removeChatFailedMessage(roomId: string, messageId: string): void {
  if (!roomId) return
  removeMemory(roomId, messageId)
  void persistRoom(roomId).catch((error) => reportPersistFailure("remove", error))
}

/** Hapus satu pesan dan tunggu storage ikut diperbarui. */
export async function removeChatFailedMessageAsync(roomId: string, messageId: string): Promise<void> {
  if (!roomId) return
  removeMemory(roomId, messageId)
  await persistRoom(roomId)
}

/** Hapus seluruh antrean gagal satu room. */
export function clearChatFailedMessages(roomId: string): void {
  if (!roomId) return
  memory.delete(roomId)
  hydrated.add(roomId)
  void persistRoom(roomId).catch((error) => reportPersistFailure("clear", error))
}

function normalizeStoredMessage(value: unknown): FailedChatMessage | null {
  if (!value || typeof value !== "object") return null
  const item = value as Partial<FailedChatMessage>
  if (typeof item.id !== "string" || typeof item.messageType !== "string") return null
  const sendStatus: ChatLocalSendStatus =
    item.sendStatus === "queued" || item.sendStatus === "sending" || item.sendStatus === "failed"
      ? item.sendStatus
      : "failed"
  return { ...item, sendStatus } as FailedChatMessage
}

/**
 * Muat antrean lokal room: memory dulu, lalu SecureStore bila belum
 * di-hydrate sesi ini. Dipanggil saat room dibuka dan oleh penjadwal kirim.
 */
export async function loadChatFailedMessages(roomId: string): Promise<FailedChatMessage[]> {
  if (!roomId) return []
  const cached = memory.get(roomId)
  if (cached !== undefined) return [...cached]
  // #6: pemanggil kedua yang datang SAAT hidrasi berjalan (mis. penjadwal
  // kirim memulihkan antrean sementara room dibuka) menunggu hasil yang sama,
  // bukan menerima [] — dulu jendela ini membuat pesan "sending" lolos dari
  // pemulihan dan tetap terlihat berputar selamanya.
  const inflight = hydrating.get(roomId)
  if (inflight) return inflight.then(() => [...(memory.get(roomId) ?? [])])
  if (hydrated.has(roomId)) return []
  hydrated.add(roomId)
  const task = (async (): Promise<FailedChatMessage[]> => {
    try {
      const stored = await getRawItem(await chatFailedStorageKey(roomId))
      const parsed: unknown = stored ? JSON.parse(stored) : []
      const list = Array.isArray(parsed)
        ? parsed
            .map(normalizeStoredMessage)
            .filter((item): item is FailedChatMessage => item !== null)
            .slice(-CHAT_FAILED_QUEUE_MAX)
        : []
      // Pesan yang disimpan SELAMA hidrasi (upsertMemory) tidak boleh tertimpa
      // snapshot storage yang lebih lama.
      const live = memory.get(roomId)
      const merged = live
        ? [...list.filter((m) => !live.some((l) => l.id === m.id)), ...live].slice(-CHAT_FAILED_QUEUE_MAX)
        : list
      memory.set(roomId, merged)
      return [...merged]
    } catch (error) {
      reportPersistFailure("restore", error)
      if (!memory.has(roomId)) memory.set(roomId, [])
      return [...(memory.get(roomId) ?? [])]
    }
  })()
  hydrating.set(roomId, task)
  void task.finally(() => {
    if (hydrating.get(roomId) === task) hydrating.delete(roomId)
  }).catch(() => undefined)
  return task
}

/** @internal — dipakai test untuk isolasi antar kasus. */
export function __resetChatFailedQueueForTest(): void {
  memory.clear()
  hydrated.clear()
  hydrating.clear()
  persistChains.clear()
}
