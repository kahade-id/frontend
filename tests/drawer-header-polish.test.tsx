/**
 * UI polish 2026-09-27 — header profil drawer (tumpukan vertikal).
 *
 * Mengunci kontrak presentasi baru (hanya tampilan, tanpa logika):
 *  1. Foto profil di ATAS, nama + username di BAWAH foto — dicek lewat urutan
 *     DOM (atas → bawah), bukan snapshot rapuh.
 *  2. Tombol tutup (X) tetap di kanan atas (bersama backdrop: 2x "Tutup menu").
 *  3. Menu di bawah header tidak rusak (menu mode commerce tetap tampil).
 *
 * Dijalankan dengan config komponen (repo convention):
 *   npx vitest run --config vitest.components.config.ts tests/drawer-header-polish.test.tsx
 */
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { AppDrawer } from "@/components/ui/app-drawer"
import { resetAppModeForTest, setAppMode } from "@/lib/app-mode"
import { openDrawer, resetDrawerForTest } from "@/lib/drawer"

const profile = {
  fullName: "Budi Santoso",
  username: "budi123",
  avatarUrl: null,
  isKycVerified: false,
}

vi.mock("@/lib/use-auth-session", () => ({
  useAuthSession: () => ({
    token: "test-token",
    restoring: false,
    error: null,
    retry: () => undefined,
  }),
}))
vi.mock("@/lib/use-api-query", () => ({
  useApiQuery: () => ({ data: profile, isLoading: false }),
}))
// lib/api menarik graf native dalam (expo-image-picker, dsb.) — drawer hanya
// butuh tipenya; query-nya sendiri sudah di-mock di atas.
vi.mock("@/lib/api", () => ({
  api: { users: { getMeCached: () => Promise.resolve(profile) } },
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

describe("header profil drawer — tumpukan vertikal", () => {
  it("foto di atas, nama lalu username di bawahnya (urutan DOM)", () => {
    renderDrawer()
    act(() => openDrawer())

    const avatar = screen.getByRole("img", { name: "Foto profil Budi Santoso" })
    const name = screen.getByText("Budi Santoso")
    const username = screen.getByText("@budi123")

    // Tumpukan vertikal = urutan DOM atas → bawah: foto, nama, username.
    const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING
    expect(avatar.compareDocumentPosition(name) & FOLLOWING).toBeTruthy()
    expect(name.compareDocumentPosition(username) & FOLLOWING).toBeTruthy()
  })

  it("header memakai kolom (bukan baris horizontal foto-teks)", () => {
    renderDrawer()
    act(() => openDrawer())

    const headerButton = screen.getByRole("button", { name: "Buka profil saya" })
    // Kolom visual dirender di View dalam PressableScale (prop className).
    const column = headerButton.querySelector(":scope > div > div")
    expect(column).toBeTruthy()
    expect(column!.className).not.toMatch(/(^|\s)flex-row(\s|$)/)
  })

  it("tombol tutup (X) tetap ada di kanan atas", () => {
    renderDrawer()
    act(() => openDrawer())

    // Backdrop + tombol X di panel — keduanya berlabel "Tutup menu".
    expect(screen.getAllByRole("button", { name: "Tutup menu" })).toHaveLength(2)
  })

  it("menu di bawah header tidak rusak", () => {
    setAppMode("commerce")
    renderDrawer()
    act(() => openDrawer())

    expect(screen.getByRole("menuitem", { name: "Buka profil saya" })).toBeTruthy()
    expect(screen.getByRole("menuitem", { name: "Buka daftar tersimpan" })).toBeTruthy()
    expect(screen.getByRole("menuitem", { name: "Kelola etalase" })).toBeTruthy()
  })
})
