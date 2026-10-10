/**
 * Test lib murni batch 139 area B (Chat & Notifikasi):
 * - lib/chat-attachment-limits.ts (B06)
 * - lib/chat-presence-label.ts (B11)
 * - lib/chat-unread-anchor.ts (B02)
 * - buildSearchSnippet di lib/chat-search.ts (B12)
 * - lib/chat-failed-queue.ts (B07)
 * - lib/chat-hidden-messages.ts (B08 hapus-untuk-saya)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  CHAT_ATTACHMENT_ALLOWED_MIME_TYPES,
  CHAT_ATTACHMENT_MAX_BYTES,
  chatAttachmentFormatsLabel,
  formatBytesId,
  validateChatAttachment,
} from "@/lib/chat-attachment-limits"
import {
  PRESENCE_LAST_SEEN_STALE_MS,
  PRESENCE_ONLINE_STALE_MS,
  presenceLabel,
} from "@/lib/chat-presence-label"
import { firstUnreadMessageId } from "@/lib/chat-unread-anchor"
import { buildSearchSnippet } from "@/lib/chat-search"
import {
  __resetChatFailedQueueForTest,
  chatFailedStorageKey,
  loadChatFailedMessages,
  peekChatFailedMessages,
  removeChatFailedMessage,
  saveChatFailedMessage,
  CHAT_FAILED_QUEUE_MAX,
} from "@/lib/chat-failed-queue"
import {
  __resetHiddenMessagesForTest,
  hideMessageLocally,
  loadHiddenMessageIds,
  peekHiddenMessageIds,
  unhideMessageLocally,
} from "@/lib/chat-hidden-messages"
import { chatHiddenKey, getRawItem } from "@/lib/secure-storage"

beforeEach(() => {
  __resetChatFailedQueueForTest()
  __resetHiddenMessagesForTest()
})

afterEach(() => {
  __resetChatFailedQueueForTest()
  __resetHiddenMessagesForTest()
})

describe("B06 — batas lampiran dari server", () => {
  it("batas ukuran 50 MB (bukan 10 MB seperti hardcode lama)", () => {
    expect(CHAT_ATTACHMENT_MAX_BYTES).toBe(50 * 1024 * 1024)
  })

  it("file tepat di batas lolos; 1 byte di atasnya ditolak", () => {
    expect(validateChatAttachment({ size: CHAT_ATTACHMENT_MAX_BYTES, mimeType: "image/jpeg" }).ok).toBe(true)
    const over = validateChatAttachment({ size: CHAT_ATTACHMENT_MAX_BYTES + 1, mimeType: "image/jpeg" })
    expect(over.ok).toBe(false)
    if (!over.ok) {
      expect(over.reason).toBe("too-large")
      expect(over.message).toContain("50 MB")
    }
  })

  it("file 20 MB (dulu ditolak klien) sekarang lolos — sesuai server", () => {
    expect(validateChatAttachment({ size: 20 * 1024 * 1024, mimeType: "video/mp4" }).ok).toBe(true)
  })

  it("size 0 (platform tidak melapor) dilewatkan — server tetap gate", () => {
    expect(validateChatAttachment({ size: 0, mimeType: "image/png" }).ok).toBe(true)
  })

  it("MIME di luar allowlist server ditolak dengan daftar format", () => {
    const res = validateChatAttachment({ size: 1000, mimeType: "image/svg+xml" })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.reason).toBe("unsupported-type")
      expect(res.message).toContain("JPG")
    }
  })

  it("semua MIME allowlist server diterima", () => {
    for (const mime of CHAT_ATTACHMENT_ALLOWED_MIME_TYPES) {
      expect(validateChatAttachment({ size: 1000, mimeType: mime }).ok).toBe(true)
    }
  })

  it("mime kosong dilewatkan (server validasi magic bytes)", () => {
    expect(validateChatAttachment({ size: 1000, mimeType: "" }).ok).toBe(true)
    expect(validateChatAttachment({ size: 1000 }).ok).toBe(true)
  })

  it("formatBytesId memformat batas dengan koma desimal Indonesia", () => {
    expect(formatBytesId(CHAT_ATTACHMENT_MAX_BYTES)).toBe("50 MB")
    expect(formatBytesId(1536 * 1024)).toBe("1,5 MB")
    expect(formatBytesId(512)).toBe("512 B")
  })

  it("label format menyebut jenis utama", () => {
    const label = chatAttachmentFormatsLabel()
    expect(label).toContain("JPG")
    expect(label).toContain("PDF")
    expect(label).toContain("MP4")
  })
})

describe("B11 — label kehadiran tidak menyesatkan", () => {
  const NOW = 1_700_000_000_000

  it("online + data segar → online", () => {
    expect(presenceLabel({ isOnline: true }, NOW - 10_000, NOW)).toEqual({ kind: "online" })
  })

  it("online + data basi (>60 dtk) → netral, bukan offline", () => {
    expect(presenceLabel({ isOnline: true }, NOW - PRESENCE_ONLINE_STALE_MS - 1, NOW)).toEqual({
      kind: "stale",
    })
  })

  it("terakhir dilihat segar → last-seen", () => {
    const at = new Date(NOW - 60_000).toISOString()
    expect(presenceLabel({ isOnline: false, lastSeenAt: at }, NOW - 5_000, NOW)).toEqual({
      kind: "last-seen",
      at,
    })
  })

  it("terakhir dilihat basi (>5 mnt) → netral", () => {
    const at = new Date(NOW - PRESENCE_LAST_SEEN_STALE_MS - 1).toISOString()
    expect(presenceLabel({ isOnline: false, lastSeenAt: at }, NOW - 5_000, NOW)).toEqual({
      kind: "stale",
    })
  })

  it("offline tanpa lastSeen → offline", () => {
    expect(presenceLabel({ isOnline: false }, NOW - 5_000, NOW)).toEqual({ kind: "offline" })
  })

  it("presence null / fetchedAt null → netral", () => {
    expect(presenceLabel(null, NOW, NOW)).toEqual({ kind: "stale" })
    expect(presenceLabel({ isOnline: true }, null, NOW)).toEqual({ kind: "stale" })
  })
})

describe("B02 — jangkar pesan pertama belum dibaca", () => {
  const msgs = (n: number, fromUserEvery = 0) =>
    Array.from({ length: n }, (_, i) => ({
      id: `m${i}`,
      fromUser: fromUserEvery > 0 && i % fromUserEvery === 0,
      messageType: "TEXT",
    }))

  it("unread 0 → null", () => {
    expect(firstUnreadMessageId(msgs(5), 0)).toBeNull()
  })

  it("unread 3 dari 10 → pesan masuk tertua di antara 3 terbaru", () => {
    // m0..m9 semua masuk; 3 terbaru = m7,m8,m9 → jangkar m7.
    expect(firstUnreadMessageId(msgs(10), 3)).toBe("m7")
  })

  it("pesan sendiri tidak mengonsumsi jatah unread", () => {
    // m8 milik sendiri; unread 2 → 2 pesan masuk terbaru = m9, m7 → jangkar m7.
    const list = msgs(10).map((m, i) => ({ ...m, fromUser: i === 8 }))
    expect(firstUnreadMessageId(list, 2)).toBe("m7")
  })

  it("pesan sistem dilewati", () => {
    const list = msgs(5).map((m, i) =>
      i === 3 ? { ...m, messageType: "SYSTEM" } : m,
    )
    // 2 pesan masuk terbaru = m4, m2 (m3 sistem dilewati) → jangkar m2.
    expect(firstUnreadMessageId(list, 2)).toBe("m2")
  })

  it("unread melebihi pesan masuk yang dimuat → pesan masuk tertua", () => {
    expect(firstUnreadMessageId(msgs(3), 99)).toBe("m0")
  })

  it("tidak ada pesan masuk → null", () => {
    const list = msgs(3).map((m) => ({ ...m, fromUser: true }))
    expect(firstUnreadMessageId(list, 2)).toBeNull()
  })
})

describe("B12 — cuplikan hasil pencarian", () => {
  it("mengambil konteks sebelum/sesudah keyword dengan highlight", () => {
    const text = "Halo, apakah barangnya masih tersedia? Saya mau beli dua."
    const spans = buildSearchSnippet(text, "tersedia")
    expect(spans.length).toBeGreaterThan(0)
    const hits = spans.filter((s) => s.hit)
    expect(hits).toHaveLength(1)
    expect(hits[0].text.toLowerCase()).toBe("tersedia")
    // Ada konteks sebelum keyword.
    const before = spans.slice(0, spans.indexOf(hits[0])).map((s) => s.text).join("")
    expect(before.length).toBeGreaterThan(0)
  })

  it("query tidak cocok → []", () => {
    expect(buildSearchSnippet("halo dunia", "xyz")).toEqual([])
    expect(buildSearchSnippet("halo", "")).toEqual([])
  })

  it("kemunculan jauh dipisah elipsis", () => {
    const pad = "x".repeat(100)
    const text = `apel ${pad} jeruk ${pad} apel`
    const spans = buildSearchSnippet(text, "apel", 5)
    const joined = spans.map((s) => s.text).join("")
    expect(joined).toContain("…")
    expect(spans.filter((s) => s.hit)).toHaveLength(2)
  })

  it("case-insensitive", () => {
    const spans = buildSearchSnippet("Kirim FOTO sekarang", "foto")
    expect(spans.some((s) => s.hit && s.text === "FOTO")).toBe(true)
  })
})

describe("B07 — antrean pesan gagal persisten", () => {
  const failed = (id: string) => ({
    id,
    text: `pesan ${id}`,
    messageType: "TEXT",
    fromUser: true,
    createdAt: new Date().toISOString(),
  })

  it("menyimpan & membaca per room tanpa bocor antar room", () => {
    saveChatFailedMessage("room-a", failed("t1"))
    saveChatFailedMessage("room-b", failed("t2"))
    expect(peekChatFailedMessages("room-a").map((m) => m.id)).toEqual(["t1"])
    expect(peekChatFailedMessages("room-b").map((m) => m.id)).toEqual(["t2"])
  })

  it("menyimpan ulang id yang sama menimpa, bukan duplikat", () => {
    saveChatFailedMessage("room-a", failed("t1"))
    saveChatFailedMessage("room-a", { ...failed("t1"), text: "revisi" })
    const list = peekChatFailedMessages("room-a")
    expect(list).toHaveLength(1)
    expect(list[0].text).toBe("revisi")
  })

  it("dibatasi maksimal per room — yang terlama dibuang", () => {
    for (let i = 0; i < CHAT_FAILED_QUEUE_MAX + 5; i++) {
      saveChatFailedMessage("room-a", failed(`t${i}`))
    }
    const list = peekChatFailedMessages("room-a")
    expect(list).toHaveLength(CHAT_FAILED_QUEUE_MAX)
    expect(list[0].id).toBe("t5")
  })

  it("remove menghapus satu entri (retry sukses / hapus lokal)", () => {
    saveChatFailedMessage("room-a", failed("t1"))
    saveChatFailedMessage("room-a", failed("t2"))
    removeChatFailedMessage("room-a", "t1")
    expect(peekChatFailedMessages("room-a").map((m) => m.id)).toEqual(["t2"])
  })

  it("persist ke storage & dimuat kembali (simulasi buka ulang room)", async () => {
    saveChatFailedMessage("room-a", failed("t1"))
    // flush promise setRawItem
    await vi.waitFor(async () => {
      expect(await getRawItem(await chatFailedStorageKey("room-a"))).not.toBeNull()
    })
    __resetChatFailedQueueForTest()
    const loaded = await loadChatFailedMessages("room-a")
    expect(loaded.map((m) => m.id)).toEqual(["t1"])
  })
})

describe("B08 — hapus untuk saya (sembunyi lokal)", () => {
  it("menyembunyikan & memuat kembali per room", async () => {
    hideMessageLocally("room-a", "m1")
    hideMessageLocally("room-a", "m2")
    expect(peekHiddenMessageIds("room-a")).toEqual(new Set(["m1", "m2"]))
    expect(peekHiddenMessageIds("room-b")).toEqual(new Set())

    await vi.waitFor(async () => {
      expect(await getRawItem(chatHiddenKey("room-a"))).not.toBeNull()
    })
    __resetHiddenMessagesForTest()
    expect(await loadHiddenMessageIds("room-a")).toEqual(new Set(["m1", "m2"]))
  })

  it("unhide membatalkan sembunyi", () => {
    hideMessageLocally("room-a", "m1")
    unhideMessageLocally("room-a", "m1")
    expect(peekHiddenMessageIds("room-a").size).toBe(0)
  })

  it("input kosong diabaikan", () => {
    hideMessageLocally("", "m1")
    hideMessageLocally("room-a", "")
    expect(peekHiddenMessageIds("room-a").size).toBe(0)
  })
})
