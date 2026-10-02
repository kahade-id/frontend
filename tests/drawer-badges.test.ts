/**
 * Test batch 2 drawer + header (2026-09-28).
 *
 * Mengunci logika baru yang murni (bisa jalan di vitest node env):
 *  1. Label menu drawer Bahasa Indonesia (`lib/drawer-menu.ts`): "Lihat Profil",
 *     "Dompet Saya", "Kelola Etalase", "Template Transaksi", "Order Link",
 *     "Laporan & Analitik" + item "Pesan" (/chat) untuk badge unread.
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
import { BOTTOM_MENU_META, MAIN_MENU_META } from "@/lib/drawer-menu"

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
    expect(MAIN_MENU_META.map((m) => m.label)).toEqual([
      "Lihat Profil",
      "Dompet Saya",
      "Kelola Etalase",
      "Toko Saya",
      "Template Transaksi",
      "Tautan Pesanan",
      "Laporan & Analitik",
      "Pesan",
    ])
  })

  it("tidak ada label lama yang tersisa", () => {
    const labels = MAIN_MENU_META.map((m) => m.label)
    for (const lama of ["Profile", "Dompet", "Etalase", "Template", "Laporan"]) {
      expect(labels).not.toContain(lama)
    }
  })

  it("item Pesan menaut ke /chat (untuk badge unread)", () => {
    const pesan = MAIN_MENU_META.find((m) => m.id === "messages")
    expect(pesan?.label).toBe("Pesan")
    expect(String(pesan?.href)).toBe("/chat")
    expect(pesan?.accessibilityLabel).toBe("Buka pesan")
  })

  it("accessibilityLabel ikut diperbarui", () => {
    const byId = Object.fromEntries(
      MAIN_MENU_META.map((m) => [m.id, m.accessibilityLabel]),
    )
    expect(byId).toMatchObject({
      profile: "Lihat profil saya",
      wallet: "Buka dompet saya",
      etalase: "Kelola etalase saya",
      shop: "Buka menu toko saya",
      reports: "Buka laporan dan analitik",
    })
  })

  it("menu bawah: Umpan Balik, Bantuan Langsung, Tiket Bantuan", () => {
    expect(BOTTOM_MENU_META.map((m) => m.label)).toEqual([
      "Umpan Balik",
      "Bantuan Langsung",
      "Tiket Bantuan",
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
    const chatSrc = src("components/screens/chat-tab-screen.tsx")
    expect(chatSrc).toContain('title={archiveOpen ? "Diarsipkan" : "Pesan"}')
    expect(chatSrc).not.toContain('"Chat"}')
  })

  it("tiga header tab memakai judul h2 yang lebih besar", () => {
    for (const p of [
      "components/screens/transactions-tab-screen.tsx",
      "components/screens/chat-tab-screen.tsx",
      "components/screens/notifications-tab-screen.tsx",
    ]) {
      expect(src(p)).toContain('titleVariant="h2"')
    }
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
