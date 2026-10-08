/**
 * Audit chat G17 — indikator mengetik:
 *   - PENGIRIM: sinyal sekali, denyut tiap 5 dtk selama masih mengetik, berhenti
 *     3 dtk setelah diam, dan SEGERA saat draft kosong / kirim / blur / latar;
 *   - PENERIMA: roster dengan expiry per pengguna + nama ("Budi sedang mengetik…").
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  TYPING_IDLE_MS,
  TYPING_KEEPALIVE_MS,
  createTypingSender,
  summarizeTypers,
} from "@/lib/chat-typing"
import {
  CHAT_SOCKET_EVENTS,
  TYPING_EXPIRY_MS,
  createTypingRoster,
  type TypingRosterEntry,
} from "@/lib/realtime/chat-events"
import { createChatRoomHandlers } from "@/lib/realtime/use-chat-room"

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe("createTypingSender", () => {
  function setup() {
    const sent: boolean[] = []
    const sender = createTypingSender((v) => sent.push(v), () => Date.now())
    return { sent, sender }
  }

  it("ketikan pertama mengirim 'mengetik'; ketikan berikutnya tidak membanjiri", () => {
    const { sent, sender } = setup()
    sender.keystroke(true)
    sender.keystroke(true)
    sender.keystroke(true)
    expect(sent).toEqual([true])
  })

  it("berhenti 3 detik setelah ketikan TERAKHIR (timer di-reset tiap ketikan)", () => {
    const { sent, sender } = setup()
    sender.keystroke(true)
    vi.advanceTimersByTime(TYPING_IDLE_MS - 500)
    sender.keystroke(true)
    vi.advanceTimersByTime(TYPING_IDLE_MS - 500)
    // 5,0 dtk sejak ketikan pertama tetapi baru 2,5 dtk sejak yang terakhir.
    expect(sent).toEqual([true])
    vi.advanceTimersByTime(600)
    expect(sent).toEqual([true, false])
    expect(sender.isActive()).toBe(false)
  })

  it("denyut tiap 5 dtk selama masih mengetik (indikator lawan tidak mati di tengah sesi)", () => {
    const { sent, sender } = setup()
    sender.keystroke(true)
    // Mengetik terus-menerus selama 12 dtk, satu ketikan tiap 1 dtk.
    for (let i = 0; i < 12; i++) {
      vi.advanceTimersByTime(1000)
      sender.keystroke(true)
    }
    const starts = sent.filter((v) => v).length
    // 1 sinyal awal + denyut di ±5 dtk dan ±10 dtk.
    expect(starts).toBe(3)
    expect(sent.includes(false)).toBe(false)
    // Denyut lebih rapat dari TTL server (8 dtk).
    expect(TYPING_KEEPALIVE_MS).toBeLessThan(8000)
  })

  it("draft dikosongkan → berhenti SEGERA (tanpa menunggu 3 dtk)", () => {
    const { sent, sender } = setup()
    sender.keystroke(true)
    sender.keystroke(false)
    expect(sent).toEqual([true, false])
    // Timer idle tidak mengirim stop kedua.
    vi.advanceTimersByTime(TYPING_IDLE_MS * 2)
    expect(sent).toEqual([true, false])
  })

  it("stop() idempoten (kirim/blur/latar memanggilnya berulang)", () => {
    const { sent, sender } = setup()
    sender.stop()
    expect(sent).toEqual([])
    sender.keystroke(true)
    sender.stop()
    sender.stop()
    expect(sent).toEqual([true, false])
  })

  it("setelah berhenti, ketikan baru memulai sinyal baru", () => {
    const { sent, sender } = setup()
    sender.keystroke(true)
    sender.stop()
    sender.keystroke(true)
    expect(sent).toEqual([true, false, true])
  })

  it("dispose: timer dibersihkan dan memberi tahu apakah sinyal masih aktif (pemanggil mengirim stop)", () => {
    const { sent, sender } = setup()
    sender.keystroke(true)
    expect(sender.dispose()).toBe(true)
    vi.advanceTimersByTime(TYPING_IDLE_MS * 2)
    // Tidak ada stop otomatis setelah dispose — layar yang mengirimnya (REST).
    expect(sent).toEqual([true])
    expect(sender.dispose()).toBe(false)
  })
})

describe("summarizeTypers", () => {
  const t = (name: string | null, id = name ?? "x"): TypingRosterEntry => ({ userId: id, name })

  it("tak seorang pun → none", () => {
    expect(summarizeTypers([], { isGroup: true })).toEqual({ kind: "none" })
  })

  it("DM 1:1 selalu generik (tanpa nama)", () => {
    expect(summarizeTypers([t("Budi")], { isGroup: false })).toEqual({ kind: "generic" })
  })

  it("grup: satu / dua / banyak pengetik", () => {
    expect(summarizeTypers([t("Budi")], { isGroup: true })).toEqual({ kind: "one", a: "Budi" })
    expect(summarizeTypers([t("Budi"), t("Ani")], { isGroup: true })).toEqual({
      kind: "two",
      a: "Budi",
      b: "Ani",
    })
    expect(summarizeTypers([t("Budi"), t("Ani"), t("Citra")], { isGroup: true })).toEqual({
      kind: "many",
      a: "Budi",
      others: 2,
    })
  })

  it("nama kosong tidak dikarang: tanpa nama sama sekali → generik", () => {
    expect(summarizeTypers([t(null)], { isGroup: true })).toEqual({ kind: "generic" })
    expect(summarizeTypers([t("  ")], { isGroup: true })).toEqual({ kind: "generic" })
  })

  it("dua pengetik tetapi satu tanpa nama → ringkasan 'banyak' yang jujur (jumlah benar)", () => {
    expect(summarizeTypers([t("Budi"), t(null, "u2")], { isGroup: true })).toEqual({
      kind: "many",
      a: "Budi",
      others: 1,
    })
  })
})

describe("createTypingRoster (penerima)", () => {
  function setup() {
    const emissions: TypingRosterEntry[][] = []
    const roster = createTypingRoster((typers) => emissions.push([...typers]))
    return { emissions, roster }
  }
  const last = (e: TypingRosterEntry[][]) => e[e.length - 1]

  it("pengetik masuk dengan namanya, keluar saat berhenti", () => {
    const { emissions, roster } = setup()
    roster.signal("u1", true, "Budi")
    expect(last(emissions)).toEqual([{ userId: "u1", name: "Budi" }])
    roster.signal("u1", false)
    expect(last(emissions)).toEqual([])
  })

  it("dua pengetik: yang satu berhenti, yang lain TETAP tampil (bug boolean tunggal)", () => {
    const { emissions, roster } = setup()
    roster.signal("u1", true, "Budi")
    roster.signal("u2", true, "Ani")
    expect(last(emissions)?.map((x) => x.name)).toEqual(["Budi", "Ani"])
    roster.signal("u1", false)
    expect(last(emissions)).toEqual([{ userId: "u2", name: "Ani" }])
  })

  it("expiry PER pengguna: paket 'stop' hilang tidak membuat indikator macet", () => {
    const { emissions, roster } = setup()
    roster.signal("u1", true, "Budi")
    vi.advanceTimersByTime(TYPING_EXPIRY_MS - 1000)
    roster.signal("u2", true, "Ani")
    vi.advanceTimersByTime(1500)
    // u1 kedaluwarsa; u2 masih ada.
    expect(last(emissions)).toEqual([{ userId: "u2", name: "Ani" }])
    vi.advanceTimersByTime(TYPING_EXPIRY_MS)
    expect(last(emissions)).toEqual([])
  })

  it("denyut (sinyal ulang) memperpanjang expiry tanpa emit ulang", () => {
    const { emissions, roster } = setup()
    roster.signal("u1", true, "Budi")
    const count = emissions.length
    vi.advanceTimersByTime(TYPING_EXPIRY_MS - 1000)
    roster.signal("u1", true, "Budi") // denyut
    expect(emissions.length).toBe(count)
    vi.advanceTimersByTime(TYPING_EXPIRY_MS - 1000)
    // Belum kedaluwarsa karena diperpanjang.
    expect(last(emissions)).toEqual([{ userId: "u1", name: "Budi" }])
  })

  it("nama yang tiba belakangan melengkapi nama kosong; nama lama dipertahankan bila sinyal tanpa nama", () => {
    const { emissions, roster } = setup()
    roster.signal("u1", true, null)
    roster.signal("u1", true, "Budi")
    expect(last(emissions)).toEqual([{ userId: "u1", name: "Budi" }])
    roster.signal("u1", true)
    expect(last(emissions)).toEqual([{ userId: "u1", name: "Budi" }])
  })

  it("stop untuk pengguna yang tak ada tidak emit; dispose membersihkan timer", () => {
    const { emissions, roster } = setup()
    roster.signal("ghost", false)
    expect(emissions).toEqual([])
    roster.signal("u1", true, "Budi")
    const count = emissions.length
    roster.dispose()
    vi.advanceTimersByTime(TYPING_EXPIRY_MS * 2)
    expect(emissions.length).toBe(count)
  })
})

describe("event chat.typing → callback", () => {
  const ROOM = "room-1"
  const ME = "user-me"

  it("meneruskan nama pengetik (username payload) dan menyaring gema sendiri", () => {
    const calls: Array<[boolean, unknown]> = []
    const handlers = createChatRoomHandlers(ROOM, ME, {
      onTyping: (isTyping, who) => calls.push([isTyping, who]),
    })
    const typing = handlers[CHAT_SOCKET_EVENTS.TYPING] as (p: unknown) => void
    typing({ roomId: ROOM, userId: ME, isTyping: true, username: "Saya" })
    expect(calls).toHaveLength(0)
    typing({ roomId: ROOM, userId: "u-budi", isTyping: true, username: " Budi " })
    typing({ roomId: ROOM, userId: "u-budi", isTyping: false })
    typing({ roomId: "ruang-lain", userId: "u-x", isTyping: true })
    expect(calls).toEqual([
      [true, { userId: "u-budi", name: "Budi" }],
      [false, { userId: "u-budi", name: null }],
    ])
  })
})
