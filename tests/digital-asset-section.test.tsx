/**
 * Batch 43 (item 14) — auto-delivery produk digital.
 *
 * Mengunci kontrak render <DigitalAssetsBuyerSection> /
 * <DigitalAssetsSellerManager>:
 * - buyer: 403 (belum bayar) → kartu info "terbuka setelah pembayaran";
 *   daftar aset → LINK ada tombol Buka, LICENSE tampil termasking;
 *   daftar kosong → tidak render apa-apa.
 * - seller: daftar aset dimuat dan label tiap tipe tampil.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import type { ReactElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import {
  DigitalAssetsBuyerSection,
  DigitalAssetsSellerManager,
} from "@/components/showcase/digital-asset-section"
import type { DigitalAsset } from "@/lib/api/commerce"

const { mocks } = vi.hoisted(() => ({
  mocks: {
    listBuyerDigitalAssets: vi.fn(),
    listSellerDigitalAssets: vi.fn(),
    createDigitalAsset: vi.fn(),
    deleteDigitalAsset: vi.fn(),
  },
}))

vi.mock("@/lib/api", () => ({
  api: {
    commerce: {
      listBuyerDigitalAssets: mocks.listBuyerDigitalAssets,
      listSellerDigitalAssets: mocks.listSellerDigitalAssets,
      createDigitalAsset: mocks.createDigitalAsset,
      deleteDigitalAsset: mocks.deleteDigitalAsset,
    },
    upload: { downloadOwnFile: vi.fn() },
  },
  isApiError: (err: unknown) => err instanceof Error && (err as { status?: number }).status === 403,
  userMessage: () => "pesan",
}))

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ show: vi.fn() }),
}))

vi.mock("@/lib/export-file", () => ({
  saveBlobFile: vi.fn(),
}))

function forbidden(): Error {
  const err = new Error("forbidden") as Error & { status: number }
  err.status = 403
  return err
}

function wrap(ui: ReactElement) {
  return <ThemeProvider>{ui}</ThemeProvider>
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("<DigitalAssetsBuyerSection>", () => {
  it("403 (belum bayar) → kartu info terbuka setelah pembayaran", async () => {
    mocks.listBuyerDigitalAssets.mockRejectedValueOnce(forbidden())
    render(wrap(<DigitalAssetsBuyerSection showcaseId="s1" />))
    await waitFor(() => {
      expect(screen.getByText("Aset digital")).toBeTruthy()
    })
    expect(screen.getByText(/terbuka otomatis setelah pembayaran/i)).toBeTruthy()
  })

  it("daftar aset → LINK ada tombol Buka, LICENSE termasking", async () => {
    const assets: DigitalAsset[] = [
      { id: "a1", showcaseId: "s1", assetType: "LINK", payload: "https://contoh.id/ebook", label: "E-book", sortOrder: 0 },
      { id: "a2", showcaseId: "s1", assetType: "LICENSE", payload: "XXXX-ABCD-1234", label: "Lisensi", sortOrder: 1 },
    ]
    mocks.listBuyerDigitalAssets.mockResolvedValueOnce(assets)
    render(wrap(<DigitalAssetsBuyerSection showcaseId="s1" />))
    await waitFor(() => {
      expect(screen.getByText("Buka")).toBeTruthy()
    })
    // Kode lisensi dimasking — hanya 4 digit terakhir.
    expect(screen.getByText(/1234/)).toBeTruthy()
    expect(screen.queryByText(/XXXX-ABCD-1234/)).toBeNull()
  })

  it("daftar kosong → tidak render apa-apa", async () => {
    mocks.listBuyerDigitalAssets.mockResolvedValueOnce([])
    const { container } = render(wrap(<DigitalAssetsBuyerSection showcaseId="s1" />))
    await waitFor(() => {
      expect(mocks.listBuyerDigitalAssets).toHaveBeenCalledWith("s1", expect.anything())
    })
    expect(container.textContent).toBe("")
  })
})

describe("<DigitalAssetsSellerManager>", () => {
  it("memuat dan menampilkan daftar aset", async () => {
    const assets: DigitalAsset[] = [
      { id: "a1", showcaseId: "s1", assetType: "FILE", payload: "uploads/x/f.pdf", label: "E-book PDF", sortOrder: 0 },
    ]
    mocks.listSellerDigitalAssets.mockResolvedValueOnce(assets)
    render(wrap(<DigitalAssetsSellerManager showcaseId="s1" />))
    await waitFor(() => {
      expect(screen.getByText("E-book PDF")).toBeTruthy()
    })
    expect(screen.getByText(/otomatis diterima pembeli setelah bayar/i)).toBeTruthy()
  })
})
