/**
 * Audit chat I23 — tampilan thread saat belum ada baris: tiap keadaan punya
 * tampilan yang jelas dan aksi yang bekerja. Teks lewat i18n, tanpa istilah
 * internal yang dilarang produk.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { ChatThreadSkeleton } from "@/components/ui/chat-thread-skeleton"
import {
  ChatThreadStateView,
  type ChatThreadStateViewProps,
} from "@/components/ui/chat-thread-state-view"

afterEach(cleanup)

function inTheme(ui: ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>)
}

const props = (over: Partial<ChatThreadStateViewProps> = {}): ChatThreadStateViewProps => ({
  state: "loading",
  error: null,
  slow: false,
  counterpartName: "Budi",
  selfChat: false,
  onRetry: vi.fn(),
  onBackToList: vi.fn(),
  ...over,
})

describe("<ChatThreadSkeleton>", () => {
  it("merender gelembung bergantian kiri/kanan dalam SATU grup progres (satu 'Memuat' untuk pembaca layar)", () => {
    inTheme(<ChatThreadSkeleton />)
    expect(screen.getByTestId("chat-thread-skeleton")).toBeTruthy()
    expect(screen.getAllByRole("progressbar")).toHaveLength(1)
  })
})

describe("<ChatThreadStateView>", () => {
  it("loading: shimmer; belum 'lambat' → tanpa penjelasan", () => {
    inTheme(<ChatThreadStateView {...props()} />)
    expect(screen.getByTestId("chat-thread-skeleton")).toBeTruthy()
    expect(screen.queryByTestId("chat-thread-slow")).toBeNull()
  })

  it("loading lambat: penjelasan + Coba lagi yang memanggil onRetry", () => {
    const onRetry = vi.fn()
    inTheme(<ChatThreadStateView {...props({ slow: true, onRetry })} />)
    expect(screen.getByText("Masih memuat percakapan. Periksa koneksi internet Anda.")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("error: judul, pesan galat dari server, dan Coba lagi", () => {
    const onRetry = vi.fn()
    inTheme(<ChatThreadStateView {...props({ state: "error", error: "Koneksi terputus.", onRetry })} />)
    expect(screen.getByText("Gagal memuat")).toBeTruthy()
    expect(screen.getByText("Koneksi terputus.")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: /Coba lagi/ }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("error tanpa pesan: tetap ada penjelasan bawaan (bukan kosong)", () => {
    inTheme(<ChatThreadStateView {...props({ state: "error", error: null })} />)
    expect(screen.getByText("Kami tidak dapat memuat percakapan ini. Silakan coba lagi.")).toBeTruthy()
  })

  it("gone: ruang dihapus + kembali ke daftar", () => {
    const onBackToList = vi.fn()
    inTheme(<ChatThreadStateView {...props({ state: "gone", onBackToList })} />)
    expect(screen.getByText("Percakapan tidak tersedia")).toBeTruthy()
    expect(screen.getByText("Ruang chat ini telah dihapus atau dinonaktifkan.")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Kembali ke daftar chat" }))
    expect(onBackToList).toHaveBeenCalledTimes(1)
  })

  it("invalid: tautan tidak valid + kembali ke daftar", () => {
    const onBackToList = vi.fn()
    inTheme(<ChatThreadStateView {...props({ state: "invalid", onBackToList })} />)
    expect(screen.getByText("Tautan percakapan ini tidak valid.")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Kembali ke daftar chat" }))
    expect(onBackToList).toHaveBeenCalledTimes(1)
  })

  it("empty: ilustrasi + panduan menyebut nama lawan bicara", () => {
    inTheme(<ChatThreadStateView {...props({ state: "empty" })} />)
    expect(screen.getByTestId("chat-empty-thread")).toBeTruthy()
    expect(screen.getByText("Belum ada pesan")).toBeTruthy()
    expect(screen.getByText(/Sapa Budi/)).toBeTruthy()
  })

  it("tidak menyebut istilah internal yang dilarang produk di keadaan mana pun", () => {
    const states: ChatThreadStateViewProps["state"][] = ["loading", "error", "gone", "invalid", "empty"]
    for (const state of states) {
      const { container, unmount } = inTheme(
        <ChatThreadStateView {...props({ state, slow: true, error: "x" })} />,
      )
      expect(container.textContent ?? "").not.toMatch(/escrow|rekber|ditahan|penahanan/i)
      unmount()
    }
  })
})
