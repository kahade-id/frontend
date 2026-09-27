/**
 * Test draft chat per-room (lib/chat-drafts.ts).
 *
 * Menjamin: ketikan tersimpan sinkron di memory per roomId, persist ke
 * storage di-debounce, draft dimuat kembali saat room dibuka, dan draft
 * hilang saat pesan terkirim — tanpa bocor antar room.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  __resetChatDraftsForTest,
  CHAT_DRAFT_PERSIST_DEBOUNCE_MS,
  clearChatDraft,
  loadChatDraft,
  peekChatDraft,
  saveChatDraft,
} from "@/lib/chat-drafts"
import { chatDraftKey, getRawItem } from "@/lib/secure-storage"

beforeEach(() => {
  vi.useFakeTimers()
  __resetChatDraftsForTest()
})

afterEach(() => {
  vi.useRealTimers()
  __resetChatDraftsForTest()
})

describe("chat drafts per-room", () => {
  it("menyimpan draft sinkron di memory per roomId", () => {
    saveChatDraft("room-a", "halo")
    saveChatDraft("room-b", "tes")
    expect(peekChatDraft("room-a")).toBe("halo")
    expect(peekChatDraft("room-b")).toBe("tes")
    expect(peekChatDraft("room-c")).toBeUndefined()
  })

  it("persist di-debounce: belum menulis sebelum jeda", async () => {
    saveChatDraft("room-a", "halo")
    expect(await getRawItem(chatDraftKey("room-a"))).toBeNull()
    vi.advanceTimersByTime(CHAT_DRAFT_PERSIST_DEBOUNCE_MS)
    // flush promise setRawItem
    await vi.advanceTimersByTimeAsync(0)
    expect(await getRawItem(chatDraftKey("room-a"))).toBe("halo")
  })

  it("ketikan beruntun hanya persist sekali dengan nilai terakhir", async () => {
    saveChatDraft("room-a", "h")
    vi.advanceTimersByTime(100)
    saveChatDraft("room-a", "ha")
    vi.advanceTimersByTime(100)
    saveChatDraft("room-a", "halo")
    vi.advanceTimersByTime(CHAT_DRAFT_PERSIST_DEBOUNCE_MS)
    await vi.advanceTimersByTimeAsync(0)
    expect(await getRawItem(chatDraftKey("room-a"))).toBe("halo")
  })

  it("loadChatDraft membaca dari storage bila memory kosong (simulasi buka ulang)", async () => {
    saveChatDraft("room-a", "draft lama")
    vi.advanceTimersByTime(CHAT_DRAFT_PERSIST_DEBOUNCE_MS)
    await vi.advanceTimersByTimeAsync(0)
    // Simulasi buka ulang: kosongkan memory chat-drafts (storage SecureStore
    // tidak ikut di-reset — itu lapisan terpisah).
    __resetChatDraftsForTest()
    expect(await loadChatDraft("room-a")).toBe("draft lama")
    // Kedua kali: dari memory, tanpa hit storage lagi.
    expect(peekChatDraft("room-a")).toBe("draft lama")
  })

  it("clearChatDraft menghapus memory + storage (pesan terkirim)", async () => {
    saveChatDraft("room-a", "terkirim")
    vi.advanceTimersByTime(CHAT_DRAFT_PERSIST_DEBOUNCE_MS)
    await vi.advanceTimersByTimeAsync(0)
    clearChatDraft("room-a")
    await vi.advanceTimersByTimeAsync(0)
    expect(peekChatDraft("room-a")).toBeUndefined()
    expect(await getRawItem(chatDraftKey("room-a"))).toBeNull()
  })

  it("draft kosong menghapus entri storage yang menggantung", async () => {
    saveChatDraft("room-a", "ada isi")
    vi.advanceTimersByTime(CHAT_DRAFT_PERSIST_DEBOUNCE_MS)
    await vi.advanceTimersByTimeAsync(0)
    saveChatDraft("room-a", "")
    vi.advanceTimersByTime(CHAT_DRAFT_PERSIST_DEBOUNCE_MS)
    await vi.advanceTimersByTimeAsync(0)
    expect(await getRawItem(chatDraftKey("room-a"))).toBeNull()
  })

  it("chatDraftKey menormalisasi roomId liar", () => {
    expect(chatDraftKey("room a/b?c")).toBe("kahade.chat.draft.room-a-b-c")
    expect(chatDraftKey("")).toBe("kahade.chat.draft.")
  })
})
