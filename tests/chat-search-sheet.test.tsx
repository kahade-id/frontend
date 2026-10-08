/**
 * Audit chat D9 — ikon cari di header membuka sheet: ketik → daftar hasil →
 * ketuk = lompat. Sheet memuat hasil BERTAHAP (kursor server) dan menebalkan
 * kata kunci dengan konteks sekitarnya.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ search: vi.fn() }))

vi.mock("@/lib/api/chat", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/chat")>("@/lib/api/chat")
  return { ...actual, searchRoomMessages: mocks.search }
})

import { ThemeProvider } from "@/components/theme-provider"
import { ChatSearchSheet } from "@/components/ui/chat-search-sheet"
import { PortalHost, PortalProvider } from "@/components/ui/portal"
import type { ChatMessage } from "@/lib/api/chat"

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})
beforeEach(() => {
  mocks.search.mockReset()
})

function msg(id: string, text: string, fromUser = false): ChatMessage {
  return { id, text, messageType: "TEXT", fromUser, createdAt: "2026-10-07T08:00:00.000Z" }
}

function renderSheet(ui: ReactElement) {
  return render(
    <ThemeProvider>
      <PortalProvider>
        {ui}
        <PortalHost />
      </PortalProvider>
    </ThemeProvider>,
  )
}

async function typeQuery(value: string) {
  const input = screen.getByLabelText("Kata kunci pencarian pesan")
  fireEvent.change(input, { target: { value } })
  // Debounce 400 ms (timer asli; test menunggu hasil lewat waitFor).
}

describe("<ChatSearchSheet>", () => {
  it("ketik → hasil tampil dengan kata kunci ditebalkan; ketuk memanggil onJump(id)", async () => {
    mocks.search.mockResolvedValue({
      items: [msg("m1", "Barang sudah saya kirim kemarin sore lewat JNE", true)],
      nextCursor: null,
    })
    const onJump = vi.fn()
    renderSheet(<ChatSearchSheet open roomId="r1" onClose={() => undefined} onJump={onJump} />)
    await act(async () => {
      await typeQuery("kirim")
    })
    const row = await screen.findByLabelText(/Lompat ke pesan: Barang sudah saya kirim/, undefined, {
      timeout: 2000,
    })
    expect(mocks.search).toHaveBeenCalledWith("r1", "kirim", { limit: 20 }, expect.anything())
    // Kata kunci dipisah jadi segmen sendiri (ditebalkan), dengan konteks di kiri-kanannya.
    const segments = Array.from(row.querySelectorAll("span")).map((el) => el.textContent)
    expect(segments).toContain("kirim")
    expect(segments.some((t) => t?.startsWith("Barang sudah saya"))).toBe(true)
    expect(segments.some((t) => t?.includes("kemarin sore"))).toBe(true)
    fireEvent.click(row)
    expect(onJump).toHaveBeenCalledWith("m1")
  })

  it("hasil >20: 'Muat lebih banyak hasil' menambahkan halaman berikutnya tanpa duplikat", async () => {
    mocks.search
      .mockResolvedValueOnce({ items: [msg("m1", "halo satu"), msg("m2", "halo dua")], nextCursor: "c2" })
      .mockResolvedValueOnce({ items: [msg("m2", "halo dua"), msg("m3", "halo tiga")], nextCursor: null })
    renderSheet(<ChatSearchSheet open roomId="r1" onClose={() => undefined} onJump={() => undefined} />)
    await act(async () => {
      await typeQuery("halo")
    })
    await screen.findByLabelText(/Lompat ke pesan: halo satu/, undefined, { timeout: 2000 })
    fireEvent.click(screen.getByText("Muat lebih banyak hasil"))
    await screen.findByLabelText(/Lompat ke pesan: halo tiga/, undefined, { timeout: 2000 })
    // Halaman kedua memakai kursor server dan m2 tidak digandakan.
    expect(mocks.search).toHaveBeenLastCalledWith(
      "r1",
      "halo",
      { limit: 20, cursor: "c2" },
      expect.anything(),
    )
    expect(screen.getAllByLabelText(/Lompat ke pesan: halo dua/)).toHaveLength(1)
    // Tidak ada lagi → tombol hilang.
    await waitFor(() => expect(screen.queryByText("Muat lebih banyak hasil")).toBeNull())
  })

  it("tanpa hasil: pesan penjelas, bukan daftar kosong", async () => {
    mocks.search.mockResolvedValue({ items: [], nextCursor: null })
    renderSheet(<ChatSearchSheet open roomId="r1" onClose={() => undefined} onJump={() => undefined} />)
    await act(async () => {
      await typeQuery("zzz")
    })
    await screen.findByText("Tidak ada pesan yang cocok dengan kata kunci itu.", undefined, {
      timeout: 2000,
    })
  })
})
