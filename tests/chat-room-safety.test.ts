/**
 * Guard permintaan produk 2026-10-08 untuk ruang chat (bagian 3):
 *
 *   3a. TIDAK ada dobel-kirim — satu ketukan kirim = satu pesan. Dua lapis:
 *       (i) pagar sinkron di composer (muatan identik dalam jendela singkat),
 *       (ii) merge sadar-identitas untuk gema netral (diuji di
 *       tests/chat-dedupe.test.ts).
 *   3c. Notice "chat ini belum dilindungi…" TIDAK lagi tampil permanen di
 *       ruang; diganti popup yang tampil SEKALI per lawan bicara (penanda
 *       lokal lib/chat-dm-notice-seen.ts).
 *   3d. TIDAK ada garis pemisah di atas kolom ketik — slot footer <Screen>
 *       dirender tanpa border.
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  store: new Map<string, string>(),
}))

vi.mock("@/lib/secure-storage", () => ({
  getRawItem: async (key: string) => mocks.store.get(key) ?? null,
  setRawItem: async (key: string, value: string) => {
    mocks.store.set(key, value)
  },
  deleteRawItem: async (key: string) => {
    mocks.store.delete(key)
  },
}))

import {
  __resetDmNoticeSeenForTests,
  hasSeenDmNotice,
  hydrateDmNoticeSeen,
  markDmNoticeSeen,
} from "@/lib/chat-dm-notice-seen"

const ROOT = resolve(__dirname, "..")

function src(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8")
}

describe("penanda popup sekali-per-lawan-bicara", () => {
  it("belum pernah dilihat → false; setelah ditandai → true", () => {
    __resetDmNoticeSeenForTests()
    mocks.store.clear()
    expect(hasSeenDmNotice("user-a")).toBe(false)
    markDmNoticeSeen("user-a")
    expect(hasSeenDmNotice("user-a")).toBe(true)
    // Lawan bicara LAIN tetap dapat popup-nya sendiri.
    expect(hasSeenDmNotice("user-b")).toBe(false)
  })

  it("bertahan lintas sesi (dibaca dari penyimpanan)", async () => {
    __resetDmNoticeSeenForTests()
    mocks.store.clear()
    markDmNoticeSeen("user-a")
    // Simulasi restart: memori modul dibersihkan, storage tetap.
    __resetDmNoticeSeenForTests()
    expect(hasSeenDmNotice("user-a")).toBe(false)
    await hydrateDmNoticeSeen()
    expect(hasSeenDmNotice("user-a")).toBe(true)
  })

  it("id tanpa lawan bicara tidak pernah memicu popup", () => {
    __resetDmNoticeSeenForTests()
    mocks.store.clear()
    expect(hasSeenDmNotice("")).toBe(true)
    markDmNoticeSeen("")
    expect(mocks.store.size).toBe(0)
  })

  it("penyimpanan rusak tidak melempar & tidak mengunci popup", async () => {
    __resetDmNoticeSeenForTests()
    mocks.store.clear()
    mocks.store.set("kahade.chat.dmNoticeSeen", "{bukan json")
    await expect(hydrateDmNoticeSeen()).resolves.toBeUndefined()
    expect(hasSeenDmNotice("user-a")).toBe(false)
  })
})

describe("ruang chat tidak lagi memakai banner permanen", () => {
  const room = src("components/screens/chat-room-screen.tsx")

  it("banner/pemakaian <DmEscrowWarning> dihapus", () => {
    expect(room).not.toContain("DmEscrowWarning")
    expect(room).not.toContain("dm-escrow-warning")
    expect(room).toContain("DmSafetyDialog")
  })

  it("popup ditandai sudah dilihat SETELAH lawan bicara diketahui", () => {
    // Urutan: syarat tampil (DM 1:1, tanpa orderId, sealTier null) → id
    // lawan bicara ada → baru tandai. Menandai lebih dulu akan mematikan
    // popup untuk orang yang salah.
    //
    // Audit chat F14: keputusan diturunkan jadi SATU id primitif lewat
    // `dmSafetyCounterpartId` (lib/chat-room-effects, teruji — mengembalikan
    // null bila id lawan bicara kosong); efeknya hanya menandai bila id itu ada.
    const derive = room.indexOf("dmSafetyCounterpartId({")
    const source = room.indexOf("counterpartId: room?.counterpart?.id")
    const guard = room.indexOf("if (!dmSafetyId) return")
    const mark = room.indexOf("markDmNoticeSeen(dmSafetyId)")
    expect(derive).toBeGreaterThan(-1)
    expect(source).toBeGreaterThan(derive)
    expect(guard).toBeGreaterThan(source)
    expect(mark).toBeGreaterThan(guard)
    // Efek tidak lagi bergantung pada objek `room` utuh (menyala ulang tiap setRoom).
    expect(room).toContain("}, [dmSafetyId])")
  })

  it("menu ⋮ tidak lagi menerima slot peringatan escrow", () => {
    const menu = src("components/ui/chat-room-menu.tsx")
    expect(menu).not.toContain("escrowWarning")
  })
})

describe("kolom ketik tanpa garis pemisah", () => {
  it("<Screen> meneruskan `footerBorderless` ke <FooterBar>", () => {
    const screen = src("components/ui/screen.tsx")
    expect(screen).toContain("footerBorderless")
    expect(screen).toContain("<FooterBar borderless={footerBorderless}>")
  })

  it("ruang chat memakai footerBorderless", () => {
    expect(src("components/screens/chat-room-screen.tsx")).toContain("footerBorderless")
  })
})

describe("pagar dobel-kirim di composer", () => {
  const composer = src("components/ui/chat-composer.tsx")

  it("muatan identik diabaikan dalam jendela singkat", () => {
    expect(composer).toContain("SEND_DUPLICATE_WINDOW_MS")
    expect(composer).toContain("lastSendRef")
    expect(composer).toMatch(/last\.key === key && now - last\.at < SEND_DUPLICATE_WINDOW_MS/)
  })

  it("kiriman yang masih di perjalanan tidak boleh terkirim ulang", () => {
    expect(composer).toMatch(/last\.key === key && sending/)
  })

  it("pagar dilepas saat induk selesai mengirim", () => {
    expect(composer).toMatch(/if \(!sending\) lastSendRef\.current = null/)
  })
})
