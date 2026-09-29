/**
 * Test drawer/sidebar navigasi (redesign drawer 2026-09-27).
 *
 * Kontrak yang dikunci:
 *  1. Store: openDrawer/closeDrawer/toggleDrawer + useDrawerOpen konsisten.
 *  2. <AppDrawer> tidak merender apa pun saat tertutup; saat dibuka
 *     menampilkan struktur tetap (tanpa mode aplikasi):
 *     header profil → kartu Kahade Plus → menu utama
 *     (Lihat Profil, Dompet Saya, Kelola Etalase, Toko Saya [FE-098],
 *     Template Transaksi, Order Link, Laporan & Analitik, Pesan —
 *     revisi label 2026-09-28) →
 *     menu bawah (Umpan Balik, Bantuan Langsung, Tiket Bantuan).
 *  3. TIDAK ada ModeSwitcher ("Mode aplikasi") dan TIDAK ada menu lama
 *     berbasis mode (tersimpan, sengketa, isi saldo, dsb.).
 *  4. Setiap baris menu memuat tepat 1 ikon (tanpa chevron, tanpa
 *     background ikon) — dicek lewat jumlah <svg> per baris.
 *  5. Tombol X tepat di pojok kanan atas header (absolute).
 *  6. Ketuk backdrop ("Tutup menu") menutup drawer (store).
 *
 * Catatan stub: `withSpring` di stub reanimated langsung snap ke target
 * TANPA menjalankan callback selesai — jadi di test, drawer yang ditutup
 * tetap ter-mount (panel tergeser keluar layar). Test menutup memakai
 * status store (`isDrawerOpen`), bukan unmount DOM.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { AppDrawer } from "@/components/ui/app-drawer"
import { PortalProvider } from "@/components/ui/portal"
import {
  closeDrawer,
  isDrawerOpen,
  openDrawer,
  resetDrawerForTest,
  toggleDrawer,
} from "@/lib/drawer"

vi.mock("@/lib/use-auth-session", () => ({
  useAuthSession: () => ({ token: null, restoring: false, error: null, retry: () => undefined }),
}))
vi.mock("@/lib/use-api-query", () => ({
  useApiQuery: () => ({ data: null, isLoading: false }),
}))
// Badge unread memakai store global chat (side-effect ringan di modul).
vi.mock("@/lib/chat-unread-count", () => ({
  useChatUnreadCountState: () => ({ status: "idle", count: null }),
  refreshChatUnreadCount: () => Promise.resolve(),
}))
// lib/api menarik graf native dalam (expo-image-picker, dsb.) — drawer hanya
// butuh tipenya; query-nya sendiri sudah di-mock di atas.
vi.mock("@/lib/api", () => ({
  api: { users: { getMeCached: () => Promise.resolve(null) } },
}))

function renderDrawer() {
  return render(
    <ThemeProvider>
      <PortalProvider>
        <AppDrawer />
      </PortalProvider>
    </ThemeProvider>,
  )
}

/** Urutan menuitem yang diharapkan (tamu — tanpa badge unread). */
const EXPECTED_MENUITEM_ORDER = [
  "Menu langganan Kahade Plus",
  "Lihat profil saya",
  "Buka dompet saya",
  "Kelola etalase saya",
  "Buka menu toko saya",
  "Buka template transaksi",
  "Buka order link",
  "Buka laporan dan analitik",
  "Buka pesan",
  "Buka umpan balik",
  "Buka bantuan langsung",
  "Buka tiket bantuan",
]

beforeEach(() => {
  resetDrawerForTest()
})

afterEach(() => {
  cleanup()
  resetDrawerForTest()
})

describe("store drawer", () => {
  it("open/close/toggle konsisten", () => {
    expect(isDrawerOpen()).toBe(false)
    openDrawer()
    expect(isDrawerOpen()).toBe(true)
    openDrawer() // idempoten
    expect(isDrawerOpen()).toBe(true)
    closeDrawer()
    expect(isDrawerOpen()).toBe(false)
    toggleDrawer()
    expect(isDrawerOpen()).toBe(true)
    toggleDrawer()
    expect(isDrawerOpen()).toBe(false)
  })
})

describe("<AppDrawer> — struktur baru", () => {
  it("tidak merender menu saat tertutup", () => {
    renderDrawer()
    expect(screen.queryByRole("menu", { name: "Menu navigasi" })).toBeNull()
  })

  it("menampilkan item dalam urutan yang diminta saat dibuka", () => {
    renderDrawer()
    act(() => openDrawer())

    expect(screen.getByRole("menu", { name: "Menu navigasi" })).toBeTruthy()
    const items = screen.getAllByRole("menuitem")
    const labels = items.map((el) => el.getAttribute("aria-label"))
    expect(labels).toEqual(EXPECTED_MENUITEM_ORDER)
  })

  it("tidak ada ModeSwitcher dan tidak ada menu lama berbasis mode", () => {
    renderDrawer()
    act(() => openDrawer())

    expect(screen.queryByRole("radiogroup", { name: "Mode aplikasi" })).toBeNull()
    expect(screen.queryByText(/mode aplikasi/i)).toBeNull()
    // Menu lama yang sudah dihapus:
    for (const gone of [
      "Buka daftar tersimpan",
      "Kelola etalase",
      "Buka sengketa",
      "Buka dompet saya",
      "Buka riwayat dompet",
      "Buka voucher",
      "Buka rekening bank",
      "Isi saldo",
      "Tarik dana",
      "Buat karya baru",
    ]) {
      expect(screen.queryByRole("menuitem", { name: gone })).toBeNull()
    }
  })

  it("setiap baris menu memuat tepat satu ikon bold (tanpa chevron)", () => {
    renderDrawer()
    act(() => openDrawer())

    // Di env test, <Icon> merender <span data-icon data-weight> (bukan <svg>).
    for (const item of screen.getAllByRole("menuitem")) {
      const icons = (item as HTMLElement).querySelectorAll("[data-icon]")
      expect(icons.length).toBe(1)
      expect(icons[0]!.getAttribute("data-weight")).toBe("bold")
    }
  })

  it("tombol X absolute di pojok kanan atas header", () => {
    renderDrawer()
    act(() => openDrawer())

    // Dua tombol "Tutup menu": backdrop (pertama di DOM) + tombol X panel.
    const closers = screen.getAllByRole("button", { name: "Tutup menu" })
    expect(closers.length).toBe(2)
    // X dibungkus View ber-style inline position:absolute (bukan className,
    // karena className di-compile menjadi atomic di env test/web).
    let node = (closers[1] as HTMLElement).parentElement
    let positioned: HTMLElement | null = null
    while (node) {
      if (node.style?.position === "absolute") {
        positioned = node
        break
      }
      node = node.parentElement
    }
    expect(positioned).not.toBeNull()
    expect(positioned!.style.right).not.toBe("")
    expect(positioned!.style.top).not.toBe("")
  })

  it("kartu Kahade Plus tampil menonjol sebelum menu utama", () => {
    renderDrawer()
    act(() => openDrawer())

    const plus = screen.getByRole("menuitem", { name: "Menu langganan Kahade Plus" })
    expect(plus.textContent).toMatch(/Kahade Plus/)
    const profile = screen.getByRole("menuitem", { name: "Buka profil saya" })
    const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING
    expect(plus.compareDocumentPosition(profile) & FOLLOWING).toBeTruthy()
  })

  it("ketuk backdrop menutup drawer", () => {
    renderDrawer()
    act(() => openDrawer())
    expect(isDrawerOpen()).toBe(true)

    const closers = screen.getAllByRole("button", { name: "Tutup menu" })
    fireEvent.click(closers[0]!)
    expect(isDrawerOpen()).toBe(false)
  })
})
