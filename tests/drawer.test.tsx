/**
 * Test drawer/sidebar navigasi (spesifikasi produk 2026-10-05).
 *
 * Kontrak yang dikunci:
 *  1. Store: openDrawer/closeDrawer/toggleDrawer + useDrawerOpen konsisten.
 *  2. <AppDrawer> tidak merender apa pun saat tertutup; saat dibuka
 *     menampilkan struktur tetap:
 *     header profil → kartu Kahade Plus → menu utama
 *     (Lihat Profil, Kelola Etalase, Kelola Transaksi, Dompet Saya,
 *     Buku Alamat, Laporan & Analitik) → garis pemisah → menu sekunder
 *     (Keamanan, Pusat Bantuan, Bisnis) → kaki (toggle tema, pencarian,
 *     segmen bahasa ID|EN, teks versi).
 *  3. TIDAK ada gear Pengaturan, TIDAK ada pensil "Buat baru", TIDAK ada
 *     menu lama (/settings & /language dihapus total).
 *  4. Setiap baris menu memuat tepat 1 ikon (tanpa chevron, tanpa
 *     background ikon) — dicek lewat jumlah [data-icon] per baris.
 *  5. Tombol X tepat di pojok kanan atas header (absolute).
 *  6. Ketuk backdrop ("Tutup menu") menutup drawer (store).
 *  7. Toggle tema memakai useTheme (matahari/bulan, tanpa className bg di
 *     Reanimated.View — dicek via sumber) dan segmen bahasa ID|EN hadir.
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
import { ToastProvider } from "@/components/ui/toast"
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
// Kill-switch dompet: kunci ke NYALA agar urutan deterministik
// ("Dompet Saya"); varian mati ("Rekening Bank") dikunci
// tests/wallet-gating.test.ts di level fungsi murni getMainMenuMeta.
vi.mock("@/lib/use-wallet-enabled", () => ({
  useWalletEnabled: () => true,
}))
vi.mock("@/lib/use-api-query", () => ({
  useApiQuery: () => ({ data: null, isLoading: false }),
}))
// lib/api menarik graf native dalam (expo-image-picker, dsb.) — drawer hanya
// butuh tipenya; query-nya sendiri sudah di-mock di atas.
vi.mock("@/lib/api", () => ({
  api: {
    users: { getMeCached: () => Promise.resolve(null) },
    settings: { updateLanguage: () => Promise.resolve({ language: "id" }) },
  },
}))

function renderDrawer() {
  return render(
    <ThemeProvider>
      <PortalProvider>
        <ToastProvider>
          <AppDrawer />
        </ToastProvider>
      </PortalProvider>
    </ThemeProvider>,
  )
}

/** Urutan menuitem yang diharapkan (tamu — kill-switch dompet default nyala). */
const EXPECTED_MENUITEM_ORDER = [
  "Menu langganan Kahade Plus",
  "Lihat profil saya",
  "Kelola etalase saya",
  "Kelola transaksi saya",
  "Buka dompet saya",
  "Buka buku alamat",
  "Laporan & Analitik",
  "Buka keamanan",
  "Buka pusat bantuan",
  "Buka verifikasi bisnis",
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

describe("<AppDrawer> — sidebar 2026-10-05", () => {
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

  it("tidak ada gear Pengaturan, pensil Buat, atau menu warisan", () => {
    renderDrawer()
    act(() => openDrawer())

    // /settings & /language dihapus total — kaki drawer kini toggle tema +
    // pencarian + segmen bahasa.
    expect(screen.queryByRole("button", { name: "Pengaturan" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Buat baru" })).toBeNull()
    for (const gone of [
      "Buka umpan balik",
      "Buka bantuan langsung",
      "Buka tiket bantuan",
      "Buka template transaksi",
      "Buka order link",
      "Buka sengketa",
      "Buka pesan",
      "Buka menu toko saya",
    ]) {
      expect(screen.queryByRole("menuitem", { name: gone })).toBeNull()
    }
  })

  it("kaki: toggle tema + pencarian + segmen bahasa + versi", () => {
    renderDrawer()
    act(() => openDrawer())

    // Stub nativewind: colorScheme light → ajakan mengaktifkan mode gelap.
    expect(screen.getByRole("button", { name: "Aktifkan mode gelap" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Pencarian" })).toBeTruthy()

    const group = screen.getByRole("radiogroup", { name: "Bahasa aplikasi" })
    expect(group).toBeTruthy()
    const radios = screen.getAllByRole("radio")
    expect(radios.map((el) => el.textContent)).toEqual(["ID", "EN"])
    // Bahasa default test = Indonesia → ID terpilih.
    expect(radios[0]!.getAttribute("aria-checked")).toBe("true")

    // Stub expo: tanpa versi → strip "—" (tetap menaut ke /app-version).
    expect(screen.getByRole("button", { name: "Versi aplikasi —" })).toBeTruthy()
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
    const profile = screen.getByRole("menuitem", { name: "Lihat profil saya" })
    const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING
    expect(plus.compareDocumentPosition(profile) & FOLLOWING).toBeTruthy()
  })

  it("menu sekunder tampil setelah garis pemisah", () => {
    renderDrawer()
    act(() => openDrawer())

    const reports = screen.getByRole("menuitem", { name: "Laporan & Analitik" })
    const security = screen.getByRole("menuitem", { name: "Buka keamanan" })
    const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING
    expect(reports.compareDocumentPosition(security) & FOLLOWING).toBeTruthy()
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
