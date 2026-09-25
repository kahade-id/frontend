/**
 * Regresi 2026-09-25 — "navbar etalase hilang" (laporan produk di web).
 *
 * Gejala: membuka halaman Etalase (/showcase) TIDAK menampilkan bottom navbar;
 * saat halaman di-refresh, bar muncul sekejap lalu lenyap. Penyebabnya:
 *   1. `PersistentShellBar` menyembunyikan bar saat `activeShellSlot(path,
 *      mode) === null`, dan peta halaman mode wallet tidak memuat /showcase —
 *      jadi preferensi `appMode` = "wallet" menghapus navbar dari halaman itu;
 *   2. render pertama (SSR/hydration & export statis) memakai preferensi
 *      default `commerce`, sehingga bar sempat ter-render lalu dilepas begitu
 *      `loadUiPrefs()` selesai membaca localStorage — itulah kedipannya.
 *
 * Kontrak yang dikunci test ini:
 *   1. /showcase SELALU punya bar dengan slot commerce (Etalase aktif) —
 *      termasuk saat mode tersimpan "wallet".
 *   2. Halaman mode wallet (/wallet) memakai slot wallet walau mode tersimpan
 *      "commerce", lengkap dengan aksi tengah halaman itu ("Bayar").
 *   3. `/more` dipakai kedua mode → tetap mengikuti mode tersimpan.
 *   4. Preferensi mode pengguna TIDAK ditulis ulang oleh halaman.
 *
 * Dijalankan dengan vitest.components.config.ts (jsdom + react-native-web +
 * stub expo-router: `__setPathname`).
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { PortalHost, PortalProvider } from "@/components/ui/portal"
import { ShellTabBar } from "@/components/ui/shell-tab-bar"
import { resetAppModeForTest } from "@/lib/app-mode"
import { getUiPrefsSnapshot, resetUiPrefsForTest, setUiPrefs } from "@/lib/ui-prefs"
import { __setPathname } from "./stubs/expo-router"

function renderBar() {
  return render(
    <ThemeProvider>
      <PortalProvider>
        <ShellTabBar />
        <PortalHost />
      </PortalProvider>
    </ThemeProvider>,
  )
}

/**
 * Simulasi "preferensi mode tersimpan di perangkat, lalu halaman di-refresh":
 * tulis ke localStorage (web), lalu reset memori store ke default — persis
 * keadaan modul saat bundle baru dievaluasi.
 */
function persistStoredMode(mode: "commerce" | "wallet") {
  setUiPrefs({ appMode: mode })
  resetUiPrefsForTest()
}

beforeEach(() => {
  resetAppModeForTest()
  resetUiPrefsForTest()
  window.localStorage.clear()
  __setPathname("/showcase")
})

afterEach(cleanup)

describe("<ShellTabBar> mengikuti halaman", () => {
  it("halaman etalase tetap punya bar walau mode tersimpan = wallet", async () => {
    persistStoredMode("wallet")
    renderBar()

    // Render pertama = preferensi default (pola SSR/export statis): bar commerce
    // sudah terlihat, jadi tidak ada kedipan "muncul lalu hilang".
    expect(screen.getByRole("tab", { name: "Tab Etalase" })).toBeTruthy()

    // Setelah preferensi tersimpan terbaca (mode = wallet)…
    await waitFor(() => expect(getUiPrefsSnapshot().appMode).toBe("wallet"))

    // …bar TETAP ada di halaman etalase, dengan slot commerce & Etalase aktif.
    expect(
      screen.getByRole("tab", { name: "Tab Etalase" }).getAttribute("aria-selected"),
    ).toBe("true")
    expect(screen.getByRole("tab", { name: "Tab Transaksi" })).toBeTruthy()
    expect(screen.getByRole("tab", { name: "Tab Pesan" })).toBeTruthy()
    expect(screen.queryByRole("tab", { name: "Tab Wallet" })).toBeNull()
    expect(screen.queryByRole("tab", { name: "Tab Promo" })).toBeNull()
    // Aksi tengah pun mengikuti halaman (commerce = buat transaksi).
    expect(screen.getByRole("button", { name: "Buat Transaksi" })).toBeTruthy()

    // Halaman tidak boleh mengubah pilihan mode pengguna.
    expect(window.localStorage.getItem("kahade.ui.prefs")).toContain("\"wallet\"")
  })

  it("halaman dompet memakai slot wallet walau mode tersimpan = commerce", () => {
    __setPathname("/wallet")
    renderBar()

    expect(
      screen.getByRole("tab", { name: "Tab Wallet" }).getAttribute("aria-selected"),
    ).toBe("true")
    expect(screen.getByRole("tab", { name: "Tab Promo" })).toBeTruthy()
    expect(screen.getByRole("tab", { name: "Tab History" })).toBeTruthy()
    expect(screen.queryByRole("tab", { name: "Tab Etalase" })).toBeNull()
    expect(screen.getByRole("button", { name: "Bayar" })).toBeTruthy()
  })

  it("/more dipakai kedua mode — mengikuti mode tersimpan", async () => {
    __setPathname("/more")
    persistStoredMode("wallet")
    renderBar()

    await waitFor(() => expect(screen.getByRole("tab", { name: "Tab Wallet" })).toBeTruthy())
    expect(
      screen.getByRole("tab", { name: "Tab Lainnya" }).getAttribute("aria-selected"),
    ).toBe("true")
    expect(screen.queryByRole("tab", { name: "Tab Etalase" })).toBeNull()
  })
})
