/**
 * Fase 3: antre chat tersendiri, pemulihan saat reconnect, dan fail-closed.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const connectivity = vi.hoisted(() => {
  let offline = false
  const reconnectListeners = new Set<() => void>()
  return {
    isOfflineKnown: () => offline,
    onReconnect: (listener: () => void) => {
      reconnectListeners.add(listener)
      return () => reconnectListeners.delete(listener)
    },
    setOffline(next: boolean) {
      const was = offline
      offline = next
      if (was && !next) for (const listener of reconnectListeners) listener()
    },
    reset() {
      offline = false
      reconnectListeners.clear()
    },
  }
})

vi.mock("@/lib/connectivity", () => ({
  isOfflineKnown: connectivity.isOfflineKnown,
  onReconnect: connectivity.onReconnect,
}))
vi.mock("@/lib/api/session", () => ({
  onSessionCleared: () => () => undefined,
  // Audit Pesan #6: chat-failed-queue kini membersihkan memori saat sesi berganti.
  getSessionRevision: () => 1,
  subscribeSession: () => () => undefined,
}))

import { ApiError } from "@/lib/api/errors"
import {
  __resetChatFailedQueueForTest,
  loadChatFailedMessages,
  peekChatFailedMessages,
  saveChatFailedMessageAsync,
} from "@/lib/chat-failed-queue"
import {
  __resetChatSendQueueForTest,
  CHAT_SEND_QUEUE_MAX,
  drainChatSendQueue,
  enqueueChatMessage,
  initChatSendQueue,
  onChatSendQueueEvent,
  setChatSendQueueExecutor,
  toChatSendDto,
} from "@/lib/chat-send-queue"
import { SecureKeys, getSecureItem } from "@/lib/secure-storage"
import { __store } from "@/tests/stubs/expo"
import type { ChatMessage } from "@/lib/api/chat"
import type { FailedChatMessage } from "@/lib/chat-failed-queue"

const baseMessage = (extra: Partial<FailedChatMessage> = {}): FailedChatMessage => ({
  id: "temp-1",
  text: "Halo, nanti saya kirim detailnya.",
  messageType: "TEXT",
  fromUser: true,
  createdAt: new Date().toISOString(),
  idempotencyKey: "11111111-1111-4111-8111-111111111111",
  sendStatus: "failed",
  ...extra,
})

beforeEach(() => {
  __resetChatSendQueueForTest()
  __resetChatFailedQueueForTest()
  __store.reset()
  connectivity.reset()
  setChatSendQueueExecutor(async (_roomId, _dto, _idempotencyKey) => ({
    id: "server-1",
    text: "Halo, nanti saya kirim detailnya.",
    messageType: "TEXT",
    fromUser: true,
    createdAt: new Date().toISOString(),
  }))
})

describe("antrean kirim chat Fase 3", () => {
  it("menyimpan status yang terlihat lalu mengirim FIFO saat koneksi pulih", async () => {
    connectivity.setOffline(true)
    initChatSendQueue()
    const executor = vi.fn(async (_roomId: string, _dto: unknown, _key: string): Promise<ChatMessage> => ({
      id: "server-1",
      text: "Halo, nanti saya kirim detailnya.",
      messageType: "TEXT",
      fromUser: true,
      createdAt: new Date().toISOString(),
    }))
    setChatSendQueueExecutor(executor as never)
    const events: string[] = []
    const unsubscribe = onChatSendQueueEvent((event) => events.push(event.type))

    const queued = await enqueueChatMessage("room-a", baseMessage())
    // Node test runtime maps SecureStore to the web memory-only policy.
    expect(queued).toEqual({ queued: true, persisted: false })
    expect(peekChatFailedMessages("room-a")[0].sendStatus).toBe("queued")
    expect(executor).not.toHaveBeenCalled()
    expect(await getSecureItem(SecureKeys.chatSendQueueRooms)).toBe('["room-a"]')

    connectivity.setOffline(false)
    await vi.waitFor(async () => {
      expect(events).toContain("sent")
      expect(await getSecureItem(SecureKeys.chatSendQueueRooms)).toBeNull()
    })
    expect(executor).toHaveBeenCalledWith(
      "room-a",
      expect.objectContaining({ messageType: "TEXT", content: "Halo, nanti saya kirim detailnya." }),
      "11111111-1111-4111-8111-111111111111",
    )
    expect(events).toEqual(["queued", "sending", "sent"])
    expect(peekChatFailedMessages("room-a")).toEqual([])
    expect(await getSecureItem(SecureKeys.chatSendQueueRooms)).toBeNull()
    unsubscribe()
  })

  it("memulihkan antrean dari SecureStore dan memulai drain ketika app dibuka online", async () => {
    connectivity.setOffline(true)
    await enqueueChatMessage("room-a", baseMessage())
    __resetChatFailedQueueForTest()
    __resetChatSendQueueForTest()
    connectivity.reset()

    const executor = vi.fn(async (): Promise<ChatMessage> => ({
      id: "server-restored",
      messageType: "TEXT",
      fromUser: true,
      createdAt: new Date().toISOString(),
    }))
    setChatSendQueueExecutor(executor as never)
    initChatSendQueue()
    await vi.waitFor(() => expect(executor).toHaveBeenCalledTimes(1))
    await vi.waitFor(async () => expect(await getSecureItem(SecureKeys.chatSendQueueRooms)).toBeNull())
  })

  it("mengubah kiriman yang sedang in-flight saat app ditutup menjadi retry manual", async () => {
    connectivity.setOffline(true)
    await enqueueChatMessage("room-a", baseMessage())
    const record = peekChatFailedMessages("room-a")[0]
    await saveChatFailedMessageAsync("room-a", { ...record, sendStatus: "sending" })
    __resetChatFailedQueueForTest()
    __resetChatSendQueueForTest()
    connectivity.reset()

    const executor = vi.fn()
    setChatSendQueueExecutor(executor as never)
    initChatSendQueue()
    await vi.waitFor(async () => {
      expect((await loadChatFailedMessages("room-a"))[0]?.sendStatus).toBe("failed")
    })
    expect(executor).not.toHaveBeenCalled()
  })

  it("gangguan koneksi saat drain tetap queued, bukan dipindah ke antrean sosial", async () => {
    connectivity.setOffline(true)
    await enqueueChatMessage("room-a", baseMessage())
    connectivity.setOffline(false)
    setChatSendQueueExecutor(async () => {
      throw new ApiError({ code: "NETWORK", message: "Tidak ada koneksi internet." })
    })

    const result = await drainChatSendQueue()
    expect(result.waiting).toBe(1)
    expect(result.failed).toBe(0)
    expect(peekChatFailedMessages("room-a")[0].sendStatus).toBe("queued")
  })

  it("jawaban non-koneksi mengubah status menjadi retry manual dan menghentikan drain room", async () => {
    connectivity.setOffline(true)
    await enqueueChatMessage("room-a", baseMessage())
    connectivity.setOffline(false)
    const executor = vi.fn(async () => {
      throw new ApiError({ code: "FORBIDDEN", message: "Tidak diizinkan." })
    })
    setChatSendQueueExecutor(executor as never)

    const result = await drainChatSendQueue()
    expect(result.failed).toBe(1)
    expect(peekChatFailedMessages("room-a")[0].sendStatus).toBe("failed")
    expect(await getSecureItem(SecureKeys.chatSendQueueRooms)).toBeNull()
    await drainChatSendQueue()
    expect(executor).toHaveBeenCalledTimes(1)
  })

  it("fail-closed untuk tipe yang bukan kiriman chat biasa dan payload tidak valid", () => {
    expect(toChatSendDto(baseMessage({ messageType: "ORDER_CARD" }))).toBeNull()
    expect(toChatSendDto(baseMessage({ messageType: "SYSTEM" }))).toBeNull()
    expect(toChatSendDto(baseMessage({ messageType: "VOICE" }))).toBeNull()
    expect(
      toChatSendDto(
        baseMessage({ messageType: "LOCATION", location: { lat: 120, lng: 10 } }),
      ),
    ).toBeNull()
    expect(
      toChatSendDto(baseMessage({ messageType: "PRODUCT_CARD", card: { title: "Tanpa ID" } })),
    ).toBeNull()
    expect(CHAT_SEND_QUEUE_MAX).toBe(100)
  })

  it("mendukung payload khusus yang sah: lokasi, kartu produk, voice note", () => {
    expect(
      toChatSendDto(baseMessage({ messageType: "LOCATION", location: { lat: -7.98, lng: 112.63 } })),
    ).toMatchObject({ messageType: "LOCATION", location: { lat: -7.98, lng: 112.63 } })
    expect(
      toChatSendDto(baseMessage({ messageType: "PRODUCT_CARD", card: { showcaseId: "show-1" } })),
    ).toMatchObject({ messageType: "PRODUCT_CARD", showcaseId: "show-1" })
    expect(
      toChatSendDto(baseMessage({ messageType: "VOICE", durationSeconds: 12, attachments: [{
        fileName: "voice.m4a",
        fileUrl: "https://cdn.example/voice.m4a",
        mimeType: "audio/mp4",
        fileSize: 8000,
      }] })),
    ).toMatchObject({ messageType: "VOICE", durationSeconds: 12 })
  })

  it("mempertahankan payload bila status queued dipulihkan dari storage", async () => {
    connectivity.setOffline(true)
    await enqueueChatMessage("room-a", baseMessage())
    __resetChatFailedQueueForTest()
    const restored = await loadChatFailedMessages("room-a")
    expect(restored).toHaveLength(1)
    expect(restored[0]).toMatchObject({
      id: "temp-1",
      text: "Halo, nanti saya kirim detailnya.",
      sendStatus: "queued",
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
    })
  })
})
