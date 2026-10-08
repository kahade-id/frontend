/**
 * Test batch 2 drawer + header (2026-09-28).
 *
 * Mengunci logika baru yang murni (bisa jalan di vitest node env):
 *  1. Label menu drawer Bahasa Indonesia (`lib/drawer-menu.ts`): "Lihat Profil",
 *     "Dompet Saya", "Kelola Etalase", "Laporan & Analitik".
 *     Poin 1 (2026-10-04): "Toko Saya" DIHAPUS sebagai konsep (tanpa seller
 *     flag) — tidak ada lagi item "shop" / SHOP_MENU_META.
 *     Poin 2 (2026-10-04): "Template Transaksi", "Tautan Pesanan",
 *     "Sengketa Saya" PINDAH ke tab Transaksi (baris "Kelola") — tidak lagi
 *     di drawer.
 *  2. `hasOpenSupportTicket` (`lib/api/support.ts`): dot tiket menyala bila
 *     ada tiket OPEN/IN_PROGRESS/WAITING_USER; padam bila kosong atau semua
 *     CLOSED/RESOLVED.
 *  3. Header tab Pesan berbahasa Indonesia + judul tab (h2) — dicek lewat
 *     sumber (preceden: `tests/api-contract-guards.test.ts` membaca
 *     `app/subscriptions.tsx` sebagai teks, karena modul komponen tidak
 *     bisa diimpor di vitest node env).
 */
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { hasOpenSupportTicket, type SupportTicket, type SupportTicketStatus } from "@/lib/api/support"
import { MAIN_MENU_META, SECONDARY_MENU_META } from "@/lib/drawer-menu"
import { defaultHeaderTitleVariant } from "@/lib/header-title"

const testsDir = dirname(fileURLToPath(import.meta.url))
const src = (p: string) => readFileSync(resolve(testsDir, "..", p), "utf8")

function ticket(status: SupportTicketStatus): SupportTicket {
  return {
    id: "tick_123",
    ticketNumber: "TK-ABC123",
    subject: "Kendala transaksi",
    status,
    updatedAt: "2026-09-28T00:00:00.000Z",
  }
}

describe("menu drawer — label Bahasa Indonesia", () => {
  it("menu utama memakai label baru sesuai urutan", () => {
    // Sidebar 2026-10-05: susunan & urutan PERSIS spesifikasi produk.
    expect(MAIN_MENU_META.map((m) => m.label)).toEqual([
      "Lihat Profil",
      "Kelola Etalase",
      "Kelola Transaksi",
      "Dompet Saya",
      "Buku Alamat",
      "Laporan & Analitik",
    ])
  })

  it("tidak ada label lama yang tersisa", () => {
    const labels = MAIN_MENU_META.map((m) => m.label)
    for (const lama of ["Profile", "Dompet", "Etalase", "Template", "Laporan", "Toko Saya"]) {
      expect(labels).not.toContain(lama)
    }
  })

  it("tidak ada item Toko Saya (Poin 1 — konsep toko dihapus)", () => {
    const ids = MAIN_MENU_META.map((m) => m.id)
    expect(ids).not.toContain("shop")
  })

  it("item pindahan Poin 2 tidak lagi di drawer (ada di baris Kelola tab Transaksi)", () => {
    const ids = MAIN_MENU_META.map((m) => m.id)
    for (const pindahan of ["templates", "order-links", "disputes"]) {
      expect(ids).not.toContain(pindahan)
    }
  })

  it("item Pesan tidak ada di drawer (UX-NAV-007 — badge unread di tab)", () => {
    const pesan = MAIN_MENU_META.find((m) => m.id === "messages")
    expect(pesan).toBeUndefined()
  })

  it("accessibilityLabel ikut diperbarui", () => {
    const byId = Object.fromEntries(
      MAIN_MENU_META.map((m) => [m.id, m.accessibilityLabel]),
    )
    expect(byId).toMatchObject({
      profile: "Lihat profil saya",
      etalase: "Kelola etalase saya",
      "trx-manage": "Kelola transaksi saya",
      wallet: "Buka dompet saya",
      addresses: "Buka buku alamat",
      reports: "Laporan & Analitik",
    })
    expect(byId).not.toHaveProperty("shop")
  })

  it("menu sekunder: Keamanan, Pusat Bantuan, Bisnis", () => {
    expect(SECONDARY_MENU_META.map((m) => m.label)).toEqual([
      "Keamanan",
      "Pusat Bantuan",
      "Bisnis",
    ])
  })
})

describe("hasOpenSupportTicket — dot tiket bantuan", () => {
  it("true bila ada tiket berstatus terbuka", () => {
    expect(hasOpenSupportTicket([ticket("OPEN")])).toBe(true)
    expect(hasOpenSupportTicket([ticket("IN_PROGRESS")])).toBe(true)
    // SYS-A-002: WAITING_USER bukan nilai backend — dihapus dari
    // OPEN_TICKET_STATUSES; bukan status "terbuka" yang valid.
    expect(
      hasOpenSupportTicket([
        ticket("CLOSED"),
        ticket("RESOLVED"),
        ticket("OPEN"),
      ]),
    ).toBe(true)
  })

  it("false bila kosong atau semua sudah selesai", () => {
    expect(hasOpenSupportTicket([])).toBe(false)
    expect(hasOpenSupportTicket([ticket("CLOSED")])).toBe(false)
    expect(
      hasOpenSupportTicket([ticket("RESOLVED"), ticket("CLOSED")]),
    ).toBe(false)
  })

  it("status tak dikenal tidak menyalakan dot", () => {
    // Robustness: nilai tak dikenal dari server tidak boleh menyalakan dot.
    expect(hasOpenSupportTicket([ticket("ARCHIVED" as SupportTicketStatus)])).toBe(false)
  })
})

describe("header tab — Indonesia + judul lebih besar", () => {
  it("header tab chat berjudul Pesan (bukan Chat)", () => {
    // PERF-FIX (2026-09-30): tab kini thin shell — implementasi di components/screens/.
    // 2026-10-08: judul tetap "Pesan" di semua keadaan — arsip dibedakan lewat
    // chip filter "Diarsipkan" (query ?archived=true), bukan judul ikut berubah.
    const chatSrc = src("components/screens/chat-tab-screen.tsx")
    expect(chatSrc).toContain('title="Pesan"')
    expect(chatSrc).not.toContain('title="Chat"')
  })

  it("tiga header tab memakai judul h2 yang lebih besar", () => {
    // 2026-10-08: varian judul tidak lagi di-override per layar — <Header>
    // memakai defaultHeaderTitleVariant(pathname): route daftar/tab = h2,
    // route detail item = h3. Ketiga tab berada di jalur daftar, jadi judulnya
    // otomatis h2; ruang chat (detail) turun ke h3 untuk hierarki.
    for (const path of ["/(tabs)/transactions", "/(tabs)/chat", "/(tabs)/notifications"]) {
      expect(defaultHeaderTitleVariant(path)).toBe("h2")
    }
    expect(defaultHeaderTitleVariant("/chat/room-1")).toBe("h3")
  })

  it("Header mendukung varian judul h2", () => {
    const headerSrc = src("components/ui/header.tsx")
    expect(headerSrc).toContain('titleVariant?: "h2" | "h3"')
  })

  it("shadow header di web tidak tertutup konten (stacking context web-only)", () => {
    const headerSrc = src("components/ui/header.tsx")
    // position:relative web-only mengaktifkan z-index (z-sticky) supaya
    // box-shadow tampil di atas konten — native tidak disentuh.
    expect(headerSrc).toContain('Platform.OS === "web"')
    expect(headerSrc).toContain('{ position: "relative" } as ViewStyle')
  })
})
