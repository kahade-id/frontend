/**
 * Guard permintaan produk 2026-10-08 untuk ruang chat (bagian 3), direvisi
 * audit Pesan 2026-10-10 (#8):
 *
 *   3a. TIDAK ada dobel-kirim — satu ketukan kirim = satu pesan. Dua lapis:
 *       (i) pagar sinkron di composer (muatan identik dalam jendela singkat),
 *       (ii) merge sadar-identitas untuk gema netral (diuji di
 *       tests/chat-dedupe.test.ts).
 *   3c. (REVISI #8, keputusan produk) banner anti-tipu TAMPIL SELALU di DM
 *       tanpa transaksi — popup sekali-per-lawan-bicara + penanda lokal
 *       lib/chat-dm-notice-seen.ts DIHAPUS.
 *   3d. TIDAK ada garis pemisah di atas kolom ketik — slot footer <Screen>
 *       dirender tanpa border.
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const ROOT = resolve(__dirname, "..")

function src(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8")
}

describe("banner anti-tipu permanen di DM tanpa transaksi (#8)", () => {
  const room = src("components/screens/chat-room-screen.tsx")

  it("penanda 'sudah dilihat' & popup sekali-tampil DIHAPUS", () => {
    expect(existsSync(resolve(ROOT, "lib/chat-dm-notice-seen.ts"))).toBe(false)
    expect(existsSync(resolve(ROOT, "components/ui/dm-safety-dialog.tsx"))).toBe(false)
    expect(room).not.toContain("chat-dm-notice-seen")
    expect(room).not.toContain("DmSafetyDialog")
    expect(room).not.toContain("DmEscrowWarning")
    expect(room).not.toContain("safetyNoticeOpen")
  })

  it("banner dirender selama syaratnya terpenuhi (dmSafetyId), tanpa state lokal", () => {
    // Syarat: DM 1:1, bukan self-chat, tanpa orderId, lawan bicara tanpa badge
    // — diturunkan oleh `dmSafetyCounterpartId` (lib/chat-room-effects, teruji).
    expect(room).toContain("dmSafetyCounterpartId({")
    expect(room).toContain("counterpartId: room?.counterpart?.id")
    expect(room).toMatch(/\{dmSafetyId \? <DmSafetyBanner onCreateOrder=\{handleSafetyCreateOrder\} \/> : null\}/)
    // Banner ditahan sampai room termuat agar tidak berkedip di shimmer awal.
    expect(room).toMatch(/const dmSafetyId = loading\s*\n\s*\? null/)
  })

  it("CTA banner membuka sheet transaksi yang sama dengan menu ⋮ (bukan jalur baru)", () => {
    expect(room).toMatch(
      /const handleSafetyCreateOrder = useCallback\(\(\) => \{\s*\n\s*setCreateOrderProduct\(null\)\s*\n\s*setCreateOrderSheetOpen\(true\)/,
    )
  })

  it("banner tanpa tombol tutup dan tanpa istilah internal", () => {
    const banner = src("components/ui/dm-safety-banner.tsx")
    expect(banner).not.toContain("onDismiss")
    for (const banned of ["escrow", "rekber", "ditahan", "penahanan"]) {
      // Hanya teks yang tampil (argumen translate) yang dijaga — komentar
      // boleh menyebut istilah itu untuk menjelaskan larangannya.
      const shown = banner.match(/translate\(\s*"([^"]+)"/g) ?? []
      for (const s of shown) expect(s.toLowerCase()).not.toContain(banned)
    }
  })

  it("menu ⋮ tidak menerima slot peringatan terpisah", () => {
    const menu = src("components/ui/chat-room-menu.tsx")
    expect(menu).not.toContain("escrowWarning")
  })
})

describe("kolom ketik tanpa garis pemisah", () => {
  it("<Screen> meneruskan `footerBorderless` & `footerDense` ke <FooterBar>", () => {
    const screen = src("components/ui/screen.tsx")
    // Regex (bukan string literal): JSX-nya terpotong beberapa baris, dan
    // baris baru itu tidak boleh membuat penjaga ini gagal.
    expect(screen).toMatch(/<FooterBar[^>]*borderless=\{footerBorderless\}/)
    // #9: footer padat (tanpa jarak atas ganda) untuk kolom ketik chat.
    expect(screen).toMatch(/<FooterBar[^>]*dense=\{footerDense\}/)
  })

  it("ruang chat memakai footerBorderless + footerDense", () => {
    const room = src("components/screens/chat-room-screen.tsx")
    expect(room).toContain("footerBorderless")
    expect(room).toContain("footerDense")
  })

  it("<FooterBar dense> memakai jarak atas yang lebih kecil", () => {
    const bar = src("components/ui/footer-bar.tsx")
    expect(bar).toContain('dense ? "gap-2 pt-1.5" : "gap-3 pt-4"')
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
