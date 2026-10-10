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
  chatDraftStorageKey,
  clearChatDraft,
  loadChatDraft,
  peekChatDraft,
  saveChatDraft,
  setChatDraftReply,
} from "@/lib/chat-drafts"
import {
  __resetChatLocalStorageCacheForTest,
  chatDraftKey,
  clearSession,
  getChatLocalScope,
  getRawItem,
  setRawItem,
} from "@/lib/secure-storage"

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
    expect(await getRawItem(await chatDraftStorageKey("room-a"))).toBeNull()
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
    expect(await getRawItem(await chatDraftStorageKey("room-a"))).toBe(
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
    expect(await getRawItem(await chatDraftStorageKey("room-a"))).toBeNull()
  })

  it("draft kosong menghapus entri storage yang menggantung", async () => {
    saveChatDraft("room-a", "ada isi")
    await flushPersist()
    saveChatDraft("room-a", "")
    await flushPersist()
    expect(await getRawItem(await chatDraftStorageKey("room-a"))).toBeNull()
  })

  it("chatDraftKey menormalisasi roomId liar & scope (audit Pesan #6)", () => {
    expect(chatDraftKey("room a/b?c", "s1")).toBe("kahade.chat.draft.s1.room-a-b-c")
    expect(chatDraftKey("", "s1")).toBe("kahade.chat.draft.s1.")
    expect(chatDraftKey("r", "a.b/c")).toBe("kahade.chat.draft.a-b-c.r")
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
    await setRawItem(await chatDraftStorageKey("room-a"), "draft versi lama")
    expect(await loadChatDraft("room-a")).toEqual({ text: "draft versi lama", replyToId: null })
  })

  it("P2-C2: loadChatDraft null bila tidak ada draft", async () => {
    expect(await loadChatDraft("room-kosong")).toBeNull()
  })
})

// ── Audit Pesan 2026-10-10 (#6): scope per akun + hapus saat logout ─────
describe("draft chat ber-scope sesi akun", () => {
  it("kunci persist memuat scope sesi, dan scope dibuat sekali per sesi", async () => {
    const scope = await getChatLocalScope()
    expect(scope.length).toBeGreaterThanOrEqual(8)
    expect(await chatDraftStorageKey("room-a")).toBe(`kahade.chat.draft.${scope}.room-a`)
    expect(await getChatLocalScope()).toBe(scope)
  })

  it("logout (clearSession) menghapus draft yang tersimpan DAN mengganti scope", async () => {
    saveChatDraft("room-a", "rahasia akun A")
    await flushPersist()
    const key = await chatDraftStorageKey("room-a")
    expect(await getRawItem(key)).not.toBeNull()
    const scopeA = await getChatLocalScope()

    await clearSession()
    // Simulasi akun B login di perangkat yang sama (memory modul dibersihkan).
    __resetChatDraftsForTest()

    expect(await getRawItem(key)).toBeNull()
    const scopeB = await getChatLocalScope()
    expect(scopeB).not.toBe(scopeA)
    expect(await loadChatDraft("room-a")).toBeNull()
  })

  it("scope lama tidak terbaca oleh sesi baru walau kuncinya masih ada (lapisan kedua)", async () => {
    // Kunci sesi lama yang (hipotetis) gagal terhapus — scope berbeda, jadi
    // tidak pernah dibaca.
    await setRawItem(chatDraftKey("room-a", "scope-lama"), JSON.stringify({ t: "bocor", r: null }))
    __resetChatLocalStorageCacheForTest()
    expect(await loadChatDraft("room-a")).toBeNull()
  })
})
