/**
 * Kahade — antrean kirim chat terpisah dari `lib/offline-queue.ts`.
 *
 * Hanya payload pesan chat yang dibentuk UI yang bisa melewati modul ini;
 * antrean sosial tetap khusus like/follow dan tidak menerima route chat.
 * Payload pesan berada di SecureStore per-room (web: memory-only), sedangkan
 * indeks kecil hanya berisi roomId agar antrean bisa dipulihkan saat app buka.
 */
import type { ChatMessage } from "@/lib/api/chat"
import type { SendMessageDto } from "@/lib/api/types"
import { isApiError, isOfflineError } from "@/lib/api/errors"
import { isOfflineKnown, onReconnect } from "@/lib/connectivity"
import { onSessionCleared } from "@/lib/api/session"
import {
  clearChatFailedMessages,
  loadChatFailedMessages,
  removeChatFailedMessageAsync,
  saveChatFailedMessageAsync,
  type FailedChatMessage,
} from "@/lib/chat-failed-queue"
import {
  deleteSecureItem,
  getSecureItem,
  isSecureKeyPersisted,
  SecureKeys,
  setSecureItem,
} from "@/lib/secure-storage"
import { logWarn } from "@/lib/telemetry"

export const CHAT_SEND_QUEUE_MAX = 100
// Even fourteen maximum-length room IDs stay below SecureStore's 2 KB limit.
export const CHAT_SEND_QUEUE_MAX_ROOMS = 14
export const CHAT_SEND_QUEUE_TTL_MS = 7 * 24 * 60 * 60 * 1000

const QUEUEABLE_CHAT_TYPES = new Set([
  "TEXT",
  "IMAGE",
  "FILE",
  "VIDEO",
  "VOICE",
  "LOCATION",
  "PRODUCT_CARD",
])

export type ChatSendQueueEnqueueResult =
  | { queued: true; persisted: boolean }
  | { queued: false; reason: "full" | "unsupported" }

export type ChatSendQueueEvent =
  | { type: "queued"; roomId: string; messageId: string }
  | { type: "sending"; roomId: string; messageId: string }
  | { type: "failed"; roomId: string; messageId: string }
  | { type: "sent"; roomId: string; messageId: string; message: ChatMessage }

export type ChatSendQueueDrainResult = {
  sent: number
  failed: number
  waiting: number
}

type ChatSendQueueExecutor = (
  roomId: string,
  dto: SendMessageDto,
  idempotencyKey: string,
) => Promise<ChatMessage>

let roomIds: string[] | null = null
let restoringIndex: Promise<string[]> | null = null
let indexPersistChain: Promise<boolean> = Promise.resolve(true)
let queueRestored = false
let restoringQueue: Promise<void> | null = null
let draining = false
let initialized = false
let executor: ChatSendQueueExecutor = async (roomId, dto, idempotencyKey) => {
  const chatApi = await import("@/lib/api/chat")
  return chatApi.sendChatMessage(roomId, dto, { idempotencyKey })
}
const listeners = new Set<(event: ChatSendQueueEvent) => void>()
const drainedListeners = new Set<(result: ChatSendQueueDrainResult) => void>()
let stopReconnect: (() => void) | null = null
let stopSessionCleared: (() => void) | null = null

function randomIdempotencyKey(): string {
  const cryptoApi = globalThis.crypto
  if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID()
  const bytes = new Uint8Array(16)
  if (typeof cryptoApi?.getRandomValues === "function") cryptoApi.getRandomValues(bytes)
  else for (let index = 0; index < bytes.length; index++) bytes[index] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function emit(event: ChatSendQueueEvent): void {
  for (const listener of listeners) {
    try {
      listener(event)
    } catch (error) {
      logWarn("chat-send-queue:listener", error)
    }
  }
}

function emitDrained(result: ChatSendQueueDrainResult): void {
  if (result.sent === 0 && result.failed === 0) return
  for (const listener of drainedListeners) {
    try {
      listener(result)
    } catch (error) {
      logWarn("chat-send-queue:drained-listener", error)
    }
  }
}

export function onChatSendQueueEvent(listener: (event: ChatSendQueueEvent) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function onChatSendQueueDrained(
  listener: (result: ChatSendQueueDrainResult) => void,
): () => void {
  drainedListeners.add(listener)
  return () => drainedListeners.delete(listener)
}

/** Test seam; production defaults to the typed chat endpoint. */
export function setChatSendQueueExecutor(fn: ChatSendQueueExecutor): void {
  executor = fn
}

function normalizeRoomIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const normalized = value.filter(
    (roomId): roomId is string =>
      typeof roomId === "string" && roomId.length > 0 && roomId.length <= 128,
  )
  return [...new Set(normalized)].slice(-CHAT_SEND_QUEUE_MAX_ROOMS)
}

async function loadRoomIds(): Promise<string[]> {
  if (roomIds) return roomIds
  if (restoringIndex) return restoringIndex
  restoringIndex = (async () => {
    try {
      const raw = await getSecureItem(SecureKeys.chatSendQueueRooms)
      if (!raw) {
        roomIds = []
        return roomIds
      }
      roomIds = normalizeRoomIds(JSON.parse(raw))
      return roomIds
    } catch (error) {
      logWarn("chat-send-queue:index-restore", error)
      roomIds = []
      return roomIds
    } finally {
      restoringIndex = null
    }
  })()
  return restoringIndex
}

function persistRoomIds(): Promise<boolean> {
  const previous = indexPersistChain
  const next = previous.catch(() => false).then(async () => {
    // Read latest memory at execution time so concurrent enqueues cannot
    // overwrite a newer index with an older snapshot.
    const ids = [...(roomIds ?? [])]
    try {
      if (ids.length === 0) await deleteSecureItem(SecureKeys.chatSendQueueRooms)
      else await setSecureItem(SecureKeys.chatSendQueueRooms, JSON.stringify(ids))
      return true
    } catch (error) {
      logWarn("chat-send-queue:index-persist", error)
      return false
    }
  })
  indexPersistChain = next
  return next
}

function hasPendingSend(messages: FailedChatMessage[]): boolean {
  return messages.some((message) => message.sendStatus === "queued" || message.sendStatus === "sending")
}

async function syncRoomIndex(roomId: string): Promise<void> {
  const ids = await loadRoomIds()
  const messages = await loadChatFailedMessages(roomId)
  const pending = hasPendingSend(messages)
  const wasIndexed = ids.includes(roomId)
  if (pending && !wasIndexed && ids.length < CHAT_SEND_QUEUE_MAX_ROOMS) {
    roomIds = [...ids, roomId]
    await persistRoomIds()
    return
  }
  if (!pending && wasIndexed) {
    roomIds = ids.filter((candidate) => candidate !== roomId)
    await persistRoomIds()
  }
}

function normalizeAttachments(message: FailedChatMessage): ChatMessage["attachments"] {
  if (!Array.isArray(message.attachments)) return undefined
  const attachments = message.attachments.filter(
    (item) =>
      item &&
      typeof item.fileName === "string" &&
      typeof item.fileUrl === "string" &&
      typeof item.mimeType === "string" &&
      Number.isFinite(item.fileSize),
  )
  return attachments.length > 0 ? attachments : undefined
}

/** Strict allowlist for payloads; never accepts financial/order operations. */
export function toChatSendDto(message: FailedChatMessage): SendMessageDto | null {
  if (!QUEUEABLE_CHAT_TYPES.has(message.messageType)) return null
  const messageType = message.messageType as NonNullable<SendMessageDto["messageType"]>
  const attachments = normalizeAttachments(message)
  const dto: SendMessageDto = {
    messageType,
    content: message.text || undefined,
    attachments,
    replyToId: message.replyToId || undefined,
    ephemeralTtlSeconds: message.ephemeralTtlSeconds,
    viewOnce: message.viewOnce || undefined,
  }

  if (messageType === "VOICE") {
    if (!Number.isFinite(message.durationSeconds) || (message.durationSeconds ?? 0) <= 0) return null
    dto.durationSeconds = message.durationSeconds
  }
  if (messageType === "LOCATION") {
    const location = message.location
    if (
      !location ||
      !Number.isFinite(location.lat) ||
      !Number.isFinite(location.lng) ||
      location.lat < -90 ||
      location.lat > 90 ||
      location.lng < -180 ||
      location.lng > 180
    )
      return null
    dto.location = {
      lat: location.lat,
      lng: location.lng,
      label: location.label ?? undefined,
    }
  }
  if (messageType === "PRODUCT_CARD") {
    const showcaseId = message.card?.showcaseId
    if (typeof showcaseId !== "string" || !showcaseId) return null
    dto.showcaseId = showcaseId
  }
  if (messageType === "TEXT" && !dto.content && !attachments?.length) return null
  if (["IMAGE", "FILE", "VIDEO", "VOICE"].includes(messageType) && !attachments?.length) return null
  return dto
}

async function saveLocalMessage(
  roomId: string,
  message: FailedChatMessage,
): Promise<{ accepted: boolean; persisted: boolean }> {
  try {
    return { accepted: await saveChatFailedMessageAsync(roomId, message), persisted: true }
  } catch (error) {
    // SecureStore can reject oversized entries. The in-memory record is still
    // available for this process, so auto-send remains possible until restart.
    logWarn("chat-send-queue:message-persist", error)
    return { accepted: true, persisted: false }
  }
}

async function restoreQueueState(): Promise<void> {
  if (queueRestored) return
  if (restoringQueue) return restoringQueue
  restoringQueue = (async () => {
    const ids = await loadRoomIds()
    const now = Date.now()
    for (const roomId of ids) {
      const messages = await loadChatFailedMessages(roomId)
      let changed = false
      for (const message of messages) {
        if (message.sendStatus === "sending") {
          // A process stopped while an HTTP send was in flight. Do not replay
          // an uncertain request automatically; leave a visible manual retry.
          await saveLocalMessage(roomId, { ...message, sendStatus: "failed" })
          changed = true
        } else if (
          message.sendStatus === "queued" &&
          message.queueEnqueuedAt != null &&
          now - message.queueEnqueuedAt >= CHAT_SEND_QUEUE_TTL_MS
        ) {
          await saveLocalMessage(roomId, { ...message, sendStatus: "failed" })
          changed = true
        }
      }
      if (changed) await syncRoomIndex(roomId)
    }
    queueRestored = true
  })().finally(() => {
    restoringQueue = null
  })
  return restoringQueue
}

async function countPendingMessages(ids: string[]): Promise<number> {
  let count = 0
  for (const roomId of ids) {
    const messages = await loadChatFailedMessages(roomId)
    count += messages.filter((message) => message.sendStatus === "queued" || message.sendStatus === "sending").length
  }
  return count
}

/** Enqueue only a user-authored chat message; it is never passed to social queue. */
export async function enqueueChatMessage(
  roomId: string,
  message: FailedChatMessage,
): Promise<ChatSendQueueEnqueueResult> {
  if (!roomId || !toChatSendDto(message)) return { queued: false, reason: "unsupported" }
  await restoreQueueState()
  const ids = await loadRoomIds()
  const existing = await loadChatFailedMessages(roomId)
  const current = existing.find((candidate) => candidate.id === message.id)
  const alreadyPending = current?.sendStatus === "queued" || current?.sendStatus === "sending"
  const pendingCount = await countPendingMessages(ids)
  if ((!alreadyPending && pendingCount >= CHAT_SEND_QUEUE_MAX) || (!ids.includes(roomId) && ids.length >= CHAT_SEND_QUEUE_MAX_ROOMS)) {
    return { queued: false, reason: "full" }
  }

  const queued: FailedChatMessage = {
    ...message,
    sendStatus: "queued",
    queueEnqueuedAt: Date.now(),
    idempotencyKey: message.idempotencyKey || randomIdempotencyKey(),
  }
  const saved = await saveLocalMessage(roomId, queued)
  if (!saved.accepted) return { queued: false, reason: "full" }

  if (!ids.includes(roomId)) roomIds = [...ids, roomId]
  const indexPersisted = await persistRoomIds()
  // The SecureStore write may fail (for example, its per-value size limit).
  // Keep the in-memory queue active and tell the caller persistence is limited.
  emit({ type: "queued", roomId, messageId: message.id })
  return {
    queued: true,
    persisted:
      isSecureKeyPersisted(SecureKeys.chatSendQueueRooms) && saved.persisted && indexPersisted,
  }
}

function isConnectionFailure(error: unknown): boolean {
  return isOfflineError(error) || (isApiError(error) && (error.code === "NETWORK" || error.code === "TIMEOUT"))
}

const EMPTY_RESULT: ChatSendQueueDrainResult = { sent: 0, failed: 0, waiting: 0 }

/** Drain queued chat messages in FIFO order on reconnect and app startup. */
export async function drainChatSendQueue(): Promise<ChatSendQueueDrainResult> {
  if (draining) return EMPTY_RESULT
  await restoreQueueState()
  if (isOfflineKnown()) {
    const ids = await loadRoomIds()
    return { sent: 0, failed: 0, waiting: await countPendingMessages(ids) }
  }

  draining = true
  const result: ChatSendQueueDrainResult = { sent: 0, failed: 0, waiting: 0 }
  try {
    const ids = [...(await loadRoomIds())]
    let stopAll = false
    for (const roomId of ids) {
      const messages = await loadChatFailedMessages(roomId)
      let stopRoom = false
      for (const queued of messages) {
        if (queued.sendStatus !== "queued") continue
        if (isOfflineKnown()) {
          result.waiting += 1
          stopAll = true
          break
        }
        if (
          queued.queueEnqueuedAt != null &&
          Date.now() - queued.queueEnqueuedAt >= CHAT_SEND_QUEUE_TTL_MS
        ) {
          await saveLocalMessage(roomId, { ...queued, sendStatus: "failed" })
          emit({ type: "failed", roomId, messageId: queued.id })
          result.failed += 1
          stopRoom = true
          break
        }

        const dto = toChatSendDto(queued)
        if (!dto) {
          await saveLocalMessage(roomId, { ...queued, sendStatus: "failed" })
          emit({ type: "failed", roomId, messageId: queued.id })
          result.failed += 1
          stopRoom = true
          break
        }

        const idempotencyKey = queued.idempotencyKey || randomIdempotencyKey()
        await saveLocalMessage(roomId, {
          ...queued,
          idempotencyKey,
          sendStatus: "sending",
        })
        emit({ type: "sending", roomId, messageId: queued.id })
        try {
          const sent = await executor(roomId, dto, idempotencyKey)
          await removeChatFailedMessageAsync(roomId, queued.id).catch((error) =>
            logWarn("chat-send-queue:remove-sent", error),
          )
          emit({ type: "sent", roomId, messageId: queued.id, message: sent })
          result.sent += 1
        } catch (error) {
          if (isConnectionFailure(error)) {
            await saveLocalMessage(roomId, {
              ...queued,
              idempotencyKey,
              sendStatus: "queued",
            })
            emit({ type: "queued", roomId, messageId: queued.id })
            result.waiting += 1
            stopAll = true
            break
          }
          await saveLocalMessage(roomId, {
            ...queued,
            idempotencyKey,
            sendStatus: "failed",
          })
          emit({ type: "failed", roomId, messageId: queued.id })
          result.failed += 1
          stopRoom = true
          break
        }
      }
      await syncRoomIndex(roomId)
      if (stopAll) break
      // A failed first send blocks later messages in this room to preserve FIFO;
      // other rooms can still make progress.
      if (stopRoom) continue
    }
  } catch (error) {
    logWarn("chat-send-queue:drain", error)
  } finally {
    draining = false
    const ids = await loadRoomIds()
    result.waiting = Math.max(result.waiting, await countPendingMessages(ids).catch(() => 0))
    emitDrained(result)
  }
  return result
}

/** Remove session-owned queued content on logout/session replacement. */
export async function clearChatSendQueue(): Promise<void> {
  const ids = await loadRoomIds()
  for (const roomId of ids) {
    const messages = await loadChatFailedMessages(roomId)
    if (messages.length > 0) {
      // Indexed rooms belong to this send queue; remove these local chat
      // records as well so another account cannot inherit pending text.
      clearChatFailedMessages(roomId)
    }
  }
  roomIds = []
  await persistRoomIds()
  queueRestored = true
}

/** Initialize once from the app root; also drains retained work at boot. */
export function initChatSendQueue(): void {
  if (initialized) return
  initialized = true
  stopReconnect = onReconnect(() => {
    void drainChatSendQueue()
  })
  stopSessionCleared = onSessionCleared(() => {
    void clearChatSendQueue()
  })
  void restoreQueueState().then(() => drainChatSendQueue())
}

/** @internal — reset singleton state in isolated unit tests. */
export function __resetChatSendQueueForTest(): void {
  stopReconnect?.()
  stopSessionCleared?.()
  stopReconnect = null
  stopSessionCleared = null
  roomIds = null
  restoringIndex = null
  indexPersistChain = Promise.resolve(true)
  queueRestored = false
  restoringQueue = null
  draining = false
  initialized = false
  executor = async (roomId, dto, idempotencyKey) => {
    const chatApi = await import("@/lib/api/chat")
    return chatApi.sendChatMessage(roomId, dto, { idempotencyKey })
  }
  listeners.clear()
  drainedListeners.clear()
}
