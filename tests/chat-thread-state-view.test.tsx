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
import { Skeleton } from "@/components/ui/skeleton"
import {
  ChatThreadStateView,
  type ChatThreadStateViewProps,
} from "@/components/ui/chat-thread-state-view"

afterEach(cleanup)

function inTheme(ui: ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>)
}

/** Kumpulkan `tone` setiap <Skeleton> di pohon elemen (tanpa merender DOM). */
function collectSkeletonTones(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const child of node) collectSkeletonTones(child, out)
    return out
  }
  if (typeof node === "object" && node !== null && "props" in node) {
    const el = node as { type?: unknown; props: { children?: unknown; tone?: string } }
    if (el.type === Skeleton) out.push(el.props.tone ?? "subtle")
    collectSkeletonTones(el.props.children, out)
  }
  return out
}

const props = (over: Partial<ChatThreadStateViewProps> = {}): ChatThreadStateViewProps => ({
  state: "loading",
  error: null,
  timedOut: false,
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

  it("setiap blok shimmer memakai tone kontras (bg-border), bukan surface yang nyaris putih di light mode", () => {
    // react-native-web tidak menaruh className ke DOM di test ini, jadi yang
    // diperiksa adalah pohon elemen: tiap <Skeleton> harus tone="contrast".
    const tones = collectSkeletonTones(ChatThreadSkeleton())
    expect(tones.length).toBeGreaterThan(0)
    expect(tones.every((tone) => tone === "contrast")).toBe(true)
  })
})

describe("<ChatThreadStateView>", () => {
  it("loading: shimmer saja — belum timeout, tanpa galat", () => {
    inTheme(<ChatThreadStateView {...props()} />)
    expect(screen.getByTestId("chat-thread-skeleton")).toBeTruthy()
    expect(screen.queryByTestId("chat-thread-timeout")).toBeNull()
    expect(screen.queryByRole("button", { name: "Coba lagi" })).toBeNull()
  })

  it("muat awal melewati batas waktu → galat jelas + Coba lagi yang memanggil onRetry", () => {
    const onRetry = vi.fn()
    inTheme(<ChatThreadStateView {...props({ state: "error", timedOut: true, onRetry })} />)
    expect(screen.getByTestId("chat-thread-timeout")).toBeTruthy()
    expect(screen.getByText("Percakapan belum termuat. Periksa koneksi internet Anda, lalu coba lagi.")).toBeTruthy()
    expect(screen.queryByTestId("chat-thread-skeleton")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: /Coba lagi/ }))
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
        <ChatThreadStateView {...props({ state, timedOut: true, error: "x" })} />,
      )
      expect(container.textContent ?? "").not.toMatch(/escrow|rekber|ditahan|penahanan/i)
      unmount()
    }
  })
})
