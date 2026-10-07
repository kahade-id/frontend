/**
 * Guard "Pesan baru" + daftar chat (permintaan produk 2026-10-08).
 *
 * Tiga keputusan produk yang dikunci di sini (semuanya pernah salah arah):
 *   1. Ikon (+) di header tab Pesan membuka HALAMAN "Pesan baru"
 *      (`ROUTES.chatNew`) — bukan lagi sheet "Buat baru" berisi karya/
 *      transaksi, yang akan mengagetkan pengguna di daftar percakapan.
 *   2. "Pesan untuk diri sendiri" TIDAK lagi menempel di puncak daftar chat;
 *      konsepnya pindah ke halaman "Pesan baru" sebagai baris pertama.
 *   3. Halaman itu memakai API yang SUDAH ada (cari username + simpan profil)
 *      dan membuka DM langsung lewat `getOrCreateDm` — tanpa endpoint baru.
 *
 * Plus satu regression test aset: baris daftar chat pernah memunculkan
 * "garis merah tipis" sekejap saat masuk/refresh karena lapisan aksi swipe
 * (fill `bg-danger` untuk Hapus) ter-mount di belakang setiap baris dan
 * terlihat satu frame sebelum baris melukis latarnya. Kontraknya sekarang:
 * lapisan itu baru dipasang SETELAH baris disentuh, dan opasitasnya mengikuti
 * translasi (0 saat baris diam) — dua pagar, bukan satu.
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

import { ROUTES } from "@/lib/routes"

const ROOT = resolve(__dirname, "..")

function src(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8")
}

describe("rute /chat/new", () => {
  it("ROUTES.chatNew menunjuk ke /chat/new", () => {
    expect(ROUTES.chatNew).toBe("/chat/new")
  })

  it("rute app/chat/new.tsx ada dan memuat layarnya secara lazy", () => {
    const route = src("app/chat/new.tsx")
    expect(route).toContain("@/components/screens/chat-new-message-screen")
    // Pola thin shell: modul layar tidak boleh dievaluasi saat boot.
    expect(route).toContain("lazy(")
  })
})

describe("tab Pesan", () => {
  const tab = src("components/screens/chat-tab-screen.tsx")

  it("ikon (+) membuka halaman Pesan baru, bukan sheet Buat baru", () => {
    expect(tab).toContain("ROUTES.chatNew")
    expect(tab).not.toContain("openCreateSheet")
    expect(tab).not.toContain("@/lib/create-sheet")
  })

  it("daftar chat tidak lagi memuat entri 'Pesan untuk diri sendiri'", () => {
    expect(tab).not.toContain("SelfChatEntry")
    expect(tab).not.toContain("getOrCreateSelfRoom")
    expect(tab).not.toContain("Pesan untuk diri sendiri")
  })
})

describe("layar Pesan baru", () => {
  const screen = src("components/screens/chat-new-message-screen.tsx")

  it("memakai API yang sudah ada, tanpa endpoint baru", () => {
    expect(screen).toContain("getOrCreateDm")
    expect(screen).toContain("getOrCreateSelfRoom")
    expect(screen).toContain("getSavedProfiles")
    expect(screen).toContain("searchUsers")
    // Q ≥ 2 huruf adalah batas backend — jangan turunkan tanpa mengubah API.
    expect(screen).toContain("SEARCH_MIN_CHARS = 2")
  })

  it("membuka DM langsung dan TIDAK menumpuk halaman di riwayat", () => {
    expect(screen).toContain("getOrCreateDm")
    // `replace` (bukan push): kembali dari ruang chat = daftar chat.
    expect(screen).toMatch(/router\.replace\(\s*ROUTES\.chatRoom/)
    expect(screen).not.toMatch(/router\.push\(\s*ROUTES\.chatRoom/)
  })

  it("semua teks tampil lewat translate()", () => {
    expect(screen).toContain('translate("Pesan baru")')
    expect(screen).toContain('translate("Kontak tersimpan")')
    expect(screen).toContain('translate("Pesan untuk diri sendiri")')
  })

  it("penolakan DM (CHAT_DM_NOT_ALLOWED) dijelaskan, bukan toast generik", () => {
    expect(screen).toContain("isDmNotAllowedError")
    expect(screen).toContain("Pengguna ini membatasi pesan dari orang yang belum ia kenal.")
  })
})

describe("baris swipe daftar chat — tidak ada kedip merah", () => {
  const row = src("components/ui/swipeable-list-item.tsx")

  it("lapisan aksi hanya dipasang setelah baris disentuh", () => {
    expect(row).toContain("actionsRevealed")
    expect(row).toContain("revealActions")
    // Fill merah (`bg-danger`) hidup di ActionButton — pastikan tidak ada
    // lapisan aksi yang dirender tanpa syarat.
    expect(row).toMatch(/\{actionsRevealed \? \(/)
  })

  it("opasitas lapisan aksi mengikuti translasi (0 saat baris diam)", () => {
    expect(row).toContain("actionsLayerStyle")
    expect(row).toContain("Math.abs(translateX.value) > 0.5 ? 1 : 0")
  })

  it("gesture tetap dikenali tanpa lapisan aksi (reveal di onBegin)", () => {
    const begin = row.indexOf(".onBegin(")
    expect(begin).toBeGreaterThan(-1)
    expect(row.slice(begin, begin + 400)).toContain("runOnJS(revealActions)()")
  })
})
