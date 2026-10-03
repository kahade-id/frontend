/**
 * Test draft chat per-room (lib/chat-drafts.ts).
 *
 * Menjamin: ketikan tersimpan sinkron di memory per roomId, persist ke
 * storage di-debounce, draft dimuat kembali saat room dibuka, dan draft
 * hilang saat pesan terkirim — tanpa bocor antar room.
 *
 * P2-C2: draft juga menyimpan replyToId; mengetik tidak menghapus konteks
 * reply; nilai persist lama (string mentah) tetap terbaca sebagai teks.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  __resetChatDraftsForTest,
  CHAT_DRAFT_PERSIST_DEBOUNCE_MS,
  clearChatDraft,
  loadChatDraft,
  peekChatDraft,
  saveChatDraft,
  setChatDraftReply,
} from "@/lib/chat-drafts"
import { chatDraftKey, getRawItem, setRawItem } from "@/lib/secure-storage"

beforeEach(() => {
  vi.useFakeTimers()
  __resetChatDraftsForTest()
})

afterEach(() => {
  vi.useRealTimers()
  __resetChatDraftsForTest()
})

async function flushPersist() {
  vi.advanceTimersByTime(CHAT_DRAFT_PERSIST_DEBOUNCE_MS)
  // flush promise setRawItem
  await vi.advanceTimersByTimeAsync(0)
}

describe("chat drafts per-room", () => {
  it("menyimpan draft sinkron di memory per roomId", () => {
    saveChatDraft("room-a", "halo")
    saveChatDraft("room-b", "tes")
    expect(peekChatDraft("room-a")).toEqual({ text: "halo", replyToId: null })
    expect(peekChatDraft("room-b")).toEqual({ text: "tes", replyToId: null })
    expect(peekChatDraft("room-c")).toBeUndefined()
  })

  it("persist di-debounce: belum menulis sebelum jeda", async () => {
    saveChatDraft("room-a", "halo")
    expect(await getRawItem(chatDraftKey("room-a"))).toBeNull()
    await flushPersist()
    expect(await loadChatDraft("room-a")).toEqual({ text: "halo", replyToId: null })
  })

  it("ketikan beruntun hanya persist sekali dengan nilai terakhir", async () => {
    saveChatDraft("room-a", "h")
    vi.advanceTimersByTime(100)
    saveChatDraft("room-a", "ha")
    vi.advanceTimersByTime(100)
    saveChatDraft("room-a", "halo")
    await flushPersist()
    expect(await getRawItem(chatDraftKey("room-a"))).toBe(
      JSON.stringify({ t: "halo", r: null }),
    )
  })

  it("loadChatDraft membaca dari storage bila memory kosong (simulasi buka ulang)", async () => {
    saveChatDraft("room-a", "draft lama")
    await flushPersist()
    // Simulasi buka ulang: kosongkan memory chat-drafts (storage SecureStore
    // tidak ikut di-reset — itu lapisan terpisah).
    __resetChatDraftsForTest()
    expect(await loadChatDraft("room-a")).toEqual({ text: "draft lama", replyToId: null })
    // Kedua kali: dari memory, tanpa hit storage lagi.
    expect(peekChatDraft("room-a")).toEqual({ text: "draft lama", replyToId: null })
  })

  it("clearChatDraft menghapus memory + storage (pesan terkirim)", async () => {
    saveChatDraft("room-a", "terkirim")
    await flushPersist()
    clearChatDraft("room-a")
    await vi.advanceTimersByTimeAsync(0)
    expect(peekChatDraft("room-a")).toBeUndefined()
    expect(await getRawItem(chatDraftKey("room-a"))).toBeNull()
  })

  it("draft kosong menghapus entri storage yang menggantung", async () => {
    saveChatDraft("room-a", "ada isi")
    await flushPersist()
    saveChatDraft("room-a", "")
    await flushPersist()
    expect(await getRawItem(chatDraftKey("room-a"))).toBeNull()
  })

  it("chatDraftKey menormalisasi roomId liar", () => {
    expect(chatDraftKey("room a/b?c")).toBe("kahade.chat.draft.room-a-b-c")
    expect(chatDraftKey("")).toBe("kahade.chat.draft.")
  })

  it("P2-C2: replyToId tersimpan dan pulih bersama teks", async () => {
    saveChatDraft("room-a", "balas ini", "msg-123")
    expect(peekChatDraft("room-a")).toEqual({ text: "balas ini", replyToId: "msg-123" })
    await flushPersist()
    __resetChatDraftsForTest()
    expect(await loadChatDraft("room-a")).toEqual({ text: "balas ini", replyToId: "msg-123" })
  })

  it("P2-C2: mengetik tidak menghapus konteks reply yang sudah ada", () => {
    saveChatDraft("room-a", "awal", "msg-123")
    saveChatDraft("room-a", "awal + lanjutan")
    expect(peekChatDraft("room-a")).toEqual({ text: "awal + lanjutan", replyToId: "msg-123" })
  })

  it("P2-C2: setChatDraftReply memperbarui reply tanpa menyentuh teks", async () => {
    saveChatDraft("room-a", "ketikan")
    setChatDraftReply("room-a", "msg-456")
    expect(peekChatDraft("room-a")).toEqual({ text: "ketikan", replyToId: "msg-456" })
    setChatDraftReply("room-a", null)
    expect(peekChatDraft("room-a")).toEqual({ text: "ketikan", replyToId: null })
    await flushPersist()
    __resetChatDraftsForTest()
    expect(await loadChatDraft("room-a")).toEqual({ text: "ketikan", replyToId: null })
  })

  it("P2-C2: nilai persist lama (string mentah) terbaca sebagai teks tanpa reply", async () => {
    await setRawItem(chatDraftKey("room-a"), "draft versi lama")
    expect(await loadChatDraft("room-a")).toEqual({ text: "draft versi lama", replyToId: null })
  })

  it("P2-C2: loadChatDraft null bila tidak ada draft", async () => {
    expect(await loadChatDraft("room-kosong")).toBeNull()
  })
})
