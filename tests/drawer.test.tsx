/**
 * Test drawer/sidebar navigasi (redesign navigasi mobile 2026-09-27).
 *
 * Kontrak yang dikunci:
 *  1. Store: openDrawer/closeDrawer/toggleDrawer + useDrawerOpen konsisten.
 *  2. <AppDrawer> tidak merender apa pun saat tertutup; saat dibuka
 *     menampilkan menu mengikuti mode aktif (commerce → menu etalase,
 *     wallet → menu dompet) + ModeSwitcher + Pengaturan di bawah.
 *  3. Ketuk backdrop ("Tutup menu") menutup drawer (store).
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
import { resetAppModeForTest, setAppMode } from "@/lib/app-mode"
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
// lib/api menarik graf native dalam (expo-image-picker, dsb.) — drawer hanya
// butuh tipenya; query-nya sendiri sudah di-mock di atas.
vi.mock("@/lib/api", () => ({
  api: { users: { getMeCached: () => Promise.resolve(null) } },
}))

function renderDrawer() {
  return render(
    <ThemeProvider>
      <AppDrawer />
    </ThemeProvider>,
  )
}

beforeEach(() => {
  resetAppModeForTest()
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

describe("<AppDrawer>", () => {
  it("tidak merender menu saat tertutup", () => {
    renderDrawer()
    expect(screen.queryByRole("menu", { name: "Menu navigasi" })).toBeNull()
  })

  it("menampilkan menu commerce + ModeSwitcher + Pengaturan saat dibuka", () => {
    setAppMode("commerce")
    renderDrawer()
    act(() => openDrawer())

    expect(screen.getByRole("menu", { name: "Menu navigasi" })).toBeTruthy()
    expect(screen.getByRole("menuitem", { name: "Buka profil saya" })).toBeTruthy()
    expect(screen.getByRole("menuitem", { name: "Buka daftar tersimpan" })).toBeTruthy()
    expect(screen.getByRole("menuitem", { name: "Kelola etalase" })).toBeTruthy()
    expect(screen.getByRole("menuitem", { name: "Buka order link" })).toBeTruthy()
    expect(screen.getByRole("menuitem", { name: "Buka template transaksi" })).toBeTruthy()
    expect(screen.getByRole("menuitem", { name: "Buka sengketa" })).toBeTruthy()
    // Switcher mode ada di dalam drawer.
    expect(screen.getByRole("radiogroup", { name: "Mode aplikasi" })).toBeTruthy()
    // Pengaturan di bawah.
    expect(screen.getByRole("menuitem", { name: "Buka pengaturan" })).toBeTruthy()
    // Kahade Plus: item menu tersendiri di sidebar (bukan di halaman Pengaturan).
    expect(screen.getByRole("menuitem", { name: "Menu langganan Kahade Plus" })).toBeTruthy()
    // Menu wallet TIDAK tampil di mode commerce.
    expect(screen.queryByRole("menuitem", { name: "Buka dompet" })).toBeNull()
  })

  it("menampilkan menu wallet saat mode = wallet", () => {
    setAppMode("wallet")
    renderDrawer()
    act(() => openDrawer())

    expect(screen.getByRole("menuitem", { name: "Buka dompet" })).toBeTruthy()
    expect(screen.getByRole("menuitem", { name: "Buka riwayat dompet" })).toBeTruthy()
    expect(screen.getByRole("menuitem", { name: "Buka voucher" })).toBeTruthy()
    expect(screen.getByRole("menuitem", { name: "Buka rekening bank" })).toBeTruthy()
    expect(screen.getByRole("menuitem", { name: "Isi saldo" })).toBeTruthy()
    expect(screen.getByRole("menuitem", { name: "Tarik dana" })).toBeTruthy()
    // Menu commerce TIDAK tampil di mode wallet.
    expect(screen.queryByRole("menuitem", { name: "Kelola etalase" })).toBeNull()
  })

  it("ketuk backdrop menutup drawer", () => {
    renderDrawer()
    act(() => openDrawer())
    expect(isDrawerOpen()).toBe(true)

    // Dua tombol "Tutup menu": backdrop (pertama di DOM) + tombol X panel.
    const closers = screen.getAllByRole("button", { name: "Tutup menu" })
    expect(closers.length).toBe(2)
    fireEvent.click(closers[0]!)
    expect(isDrawerOpen()).toBe(false)
  })
})
