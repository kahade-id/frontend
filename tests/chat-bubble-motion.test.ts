/**
 * Motion gelembung chat (permintaan produk 2026-10-08, bagian 3b).
 *
 * Yang dikunci: HANYA pesan baru yang dianimasikan masuk, arah masuk
 * mengikuti sisi pesan (kiri = lawan bicara, kanan = saya), dan pop centang
 * hanya untuk KEMAJUAN status (sent → read), bukan kemunduran.
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

import {
  BUBBLE_ENTRANCE_FRESH_MS,
  bubbleEntranceVector,
  isFreshMessage,
  isStatusAdvance,
} from "@/lib/chat-bubble-motion"

const ROOT = resolve(__dirname, "..")
const NOW = new Date("2026-10-08T10:00:00.000Z").getTime()
const ago = (ms: number) => new Date(NOW - ms).toISOString()

describe("isFreshMessage", () => {
  it("pesan yang baru tiba dianggap baru", () => {
    expect(isFreshMessage(ago(0), NOW)).toBe(true)
    expect(isFreshMessage(ago(2_000), NOW)).toBe(true)
    expect(isFreshMessage(ago(BUBBLE_ENTRANCE_FRESH_MS), NOW)).toBe(true)
  })

  it("pesan lama TIDAK beranimasi (riwayat saat ruang dibuka)", () => {
    expect(isFreshMessage(ago(BUBBLE_ENTRANCE_FRESH_MS + 1), NOW)).toBe(false)
    expect(isFreshMessage(ago(60 * 60 * 1000), NOW)).toBe(false)
  })

  it("jam server yang sedikit di depan tidak mematikan animasi", () => {
    const future = new Date(NOW + 5_000).toISOString()
    expect(isFreshMessage(future, NOW)).toBe(true)
  })

  it("createdAt tidak valid / kosong → tidak beranimasi", () => {
    expect(isFreshMessage(undefined, NOW)).toBe(false)
    expect(isFreshMessage("", NOW)).toBe(false)
    expect(isFreshMessage("bukan-tanggal", NOW)).toBe(false)
  })
})

describe("bubbleEntranceVector", () => {
  it("pesan masuk dari kiri, pesan keluar dari kanan", () => {
    expect(bubbleEntranceVector("incoming").translateX).toBeLessThan(0)
    expect(bubbleEntranceVector("outgoing").translateX).toBeGreaterThan(0)
  })

  it("semua arah naik dari bawah dan mengembang < 1 → 1", () => {
    for (const direction of ["incoming", "outgoing", "system"] as const) {
      const v = bubbleEntranceVector(direction)
      expect(v.translateY).toBeGreaterThan(0)
      expect(v.scale).toBeGreaterThan(0.9)
      expect(v.scale).toBeLessThan(1)
      // Gerak kecil: gelembung muncul puluhan kali per menit — bukan atraksi.
      expect(Math.abs(v.translateX)).toBeLessThanOrEqual(16)
      expect(v.translateY).toBeLessThanOrEqual(12)
    }
  })

  it("kartu sistem tidak bergeser samping (bukan milik satu pihak)", () => {
    expect(bubbleEntranceVector("system").translateX).toBe(0)
  })
})

describe("isStatusAdvance", () => {
  it("sending → sent → read adalah kemajuan (layak pop)", () => {
    expect(isStatusAdvance("sending", "sent")).toBe(true)
    expect(isStatusAdvance("sent", "read")).toBe(true)
    expect(isStatusAdvance("sending", "read")).toBe(true)
  })

  it("status sama / mundur / gagal tidak memicu pop", () => {
    expect(isStatusAdvance("sent", "sent")).toBe(false)
    expect(isStatusAdvance("read", "sent")).toBe(false)
    expect(isStatusAdvance("read", "failed")).toBe(false)
    expect(isStatusAdvance(undefined, "sent")).toBe(false)
  })
})

describe("kontrak komponen (sumber)", () => {
  const bubble = readFileSync(resolve(ROOT, "components/ui/chat-message-bubble.tsx"), "utf8")

  it("animasi masuk memakai spring playful + reduced-motion gate", () => {
    expect(bubble).toContain("tokens.motion.springPlayful")
    expect(bubble).toContain("useReducedMotion()")
    expect(bubble).toMatch(/animateEntrance && !reducedMotion \? 0 : 1/)
  })

  it("animasi hanya berjalan sekali di mount (nilai awal dikunci)", () => {
    expect(bubble).toContain("useRef(animateEntrance && !reducedMotion ? 0 : 1).current")
  })

  it("pendengar status pop + denyut 'sending' terpasang", () => {
    expect(bubble).toContain("isStatusAdvance(prev, status)")
    expect(bubble).toContain("withRepeat(")
  })

  it("row meneruskan kesegaran pesan ke bubble (semua jenis bubble)", () => {
    const row = readFileSync(resolve(ROOT, "components/ui/chat-message-row.tsx"), "utf8")
    expect(row).toContain("animateEntrance={isFreshMessage(message.createdAt)}")
  })
})
