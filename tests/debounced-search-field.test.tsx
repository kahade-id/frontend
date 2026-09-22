/**
 * Kontrak <DebouncedSearchField> — kolom cari yang menyimpan teksnya sendiri.
 *
 * Dua hal dikunci di sini:
 *   1. Debounce: layar induk tidak direrender tiap ketukan huruf (alasan
 *      komponen ini ada; lihat tests/list-render.test.tsx untuk angka
 *      pengukurannya).
 *   2. Sinkronisasi `initialQuery` TANPA remount. Layar Pencarian menyodorkan
 *      teks dari luar (chip saran, chip riwayat, tombol atur ulang). Versi lama
 *      hanya menyamakan nilai yang sudah dikirim sehingga teks di layar tidak
 *      ikut berubah; pemanggil terpaksa me-remount lewat `key`, yang membuang
 *      fokus dan menutup keyboard tepat setelah pengguna memilih saran.
 *      Identitas elemen input dipakai sebagai bukti tidak terjadi remount.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { DebouncedSearchField } from "@/components/ui/debounced-search-field"

function renderInTheme(ui: ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>)
}

/** react-native-web merender TextInput sebagai <input> biasa. */
function type(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } })
}

// Vitest tidak menyalakan `globals`, jadi auto-cleanup RTL tidak aktif.
afterEach(cleanup)

const DEBOUNCE = 300

describe("<DebouncedSearchField>", () => {
  it("tidak memberi tahu induk pada tiap ketukan, hanya setelah debounce", async () => {
    vi.useFakeTimers()
    const onQueryChange = vi.fn()
    try {
      renderInTheme(
        <DebouncedSearchField
          initialQuery=""
          debounceMs={DEBOUNCE}
          onQueryChange={onQueryChange}
          placeholder="Cari"
        />,
      )
      const input = screen.getByPlaceholderText("Cari")
      for (const text of ["p", "pe", "pem", "pemb"]) type(input, text)
      expect(onQueryChange).not.toHaveBeenCalled()
      vi.advanceTimersByTime(DEBOUNCE)
      expect(onQueryChange).toHaveBeenCalledTimes(1)
      expect(onQueryChange).toHaveBeenCalledWith("pemb")
    } finally {
      vi.useRealTimers()
    }
  })

  it("teks kosong lewat tombol clear dikirim seketika (tanpa menunggu debounce)", async () => {
    vi.useFakeTimers()
    const onQueryChange = vi.fn()
    try {
      renderInTheme(
        <DebouncedSearchField initialQuery="bpjs" debounceMs={DEBOUNCE} onQueryChange={onQueryChange} />,
      )
      type(screen.getByDisplayValue("bpjs"), "")
      expect(onQueryChange).toHaveBeenCalledWith("")
    } finally {
      vi.useRealTimers()
    }
  })

  it("nilai yang secara efektif sama tidak dikirim dua kali", async () => {
    vi.useFakeTimers()
    const onQueryChange = vi.fn()
    try {
      renderInTheme(
        <DebouncedSearchField initialQuery="" debounceMs={DEBOUNCE} onQueryChange={onQueryChange} />,
      )
      const input = screen.getByPlaceholderText("Cari transaksi, pihak, atau ID")
      type(input, "bpjs")
      vi.advanceTimersByTime(DEBOUNCE)
      type(input, "bpjs   ")
      vi.advanceTimersByTime(DEBOUNCE)
      expect(onQueryChange).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it("perubahan initialQuery dari luar memperbarui teks yang terlihat TANPA remount", async () => {
    const onQueryChange = vi.fn()
    const { rerender } = renderInTheme(
      <DebouncedSearchField initialQuery="" debounceMs={DEBOUNCE} onQueryChange={onQueryChange} />,
    )
    const before = screen.getByPlaceholderText("Cari transaksi, pihak, atau ID")

    rerender(
      <ThemeProvider>
        <DebouncedSearchField
          initialQuery="token listrik"
          debounceMs={DEBOUNCE}
          onQueryChange={onQueryChange}
        />
      </ThemeProvider>,
    )

    // Teks ikut berubah — inilah yang tidak dilakukan versi lama.
    await waitFor(() => expect(screen.getByDisplayValue("token listrik")).toBeTruthy())
    // Elemen yang sama = tidak ada remount, jadi fokus tidak dibuang.
    expect(screen.getByDisplayValue("token listrik")).toBe(before)
  })

  it("mengosongkan initialQuery dari luar ikut mengosongkan kolom", async () => {
    const onQueryChange = vi.fn()
    const { rerender } = renderInTheme(
      <DebouncedSearchField initialQuery="bpjs" debounceMs={DEBOUNCE} onQueryChange={onQueryChange} />,
    )
    expect(screen.getByDisplayValue("bpjs")).toBeTruthy()

    rerender(
      <ThemeProvider>
        <DebouncedSearchField initialQuery="" debounceMs={DEBOUNCE} onQueryChange={onQueryChange} />
      </ThemeProvider>,
    )

    await waitFor(() => expect(screen.queryByDisplayValue("bpjs")).toBeNull())
  })
})
