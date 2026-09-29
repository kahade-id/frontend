/**
 * Kontrak redesign halaman Riwayat Dompet (app/wallet-history.tsx,
 * lib/wallet-history-grouping.ts, components/ui/wallet-history-filter-sheet.tsx).
 *
 * Yang dikunci:
 *  1. Pengelompokan tanggal WIB (murni): "Hari ini"/"Kemarin"/tanggal panjang,
 *     batas WIB vs UTC, item tanpa tanggal valid, net harian tahan amount negatif.
 *  2. Filter client-side (murni): arah Masuk/Keluar, status, pencarian atas
 *     label jenis / referenceId / string nominal.
 *  3. Funnel: sheet filter membuka (judul + 4 seksi), menutup via X,
 *     "Terapkan" mengirim draf, "Atur ulang" mengembalikan default.
 *  4. Rentang tanggal: preset 90 hari mengirim query from/to yang benar
 *     ke `api.wallet.getWalletTransactions` (mock lib/api, render layar asli).
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import type { ReactElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { PortalHost, PortalProvider } from "@/components/ui/portal"
import { WalletHistoryFilterSheet } from "@/components/ui/wallet-history-filter-sheet"
import {
  DEFAULT_HISTORY_FILTERS,
  filterWalletTransactions,
  groupByDay,
} from "@/lib/wallet-history-grouping"
import type { WalletTransaction } from "@/lib/api/wallet"

const mocks = vi.hoisted(() => ({
  getWalletTransactions: vi.fn(
    async (
      _query: { page: number; limit: number; type?: string; from?: string; to?: string },
      _signal?: AbortSignal,
    ) => ({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    }),
  ),
}))

// lib/api menarik graf native dalam — layar hanya butuh getWalletTransactions;
// useWalletExport butuh ToastProvider — di-stub karena bukan objek test ini.
vi.mock("@/lib/api", () => ({
  api: { wallet: { getWalletTransactions: mocks.getWalletTransactions } },
}))
vi.mock("@/lib/use-wallet-export", () => ({
  useWalletExport: () => ({ exporting: null, exportWallet: () => Promise.resolve() }),
}))

// Impor layar SETELAH mock di atas (hoisted oleh vitest, tapi urutan eksplisit
// menjaga keterbacaan).
import WalletHistoryScreen from "@/app/wallet-history"

afterEach(() => {
  cleanup()
  mocks.getWalletTransactions.mockClear()
})

function tx(overrides: Partial<WalletTransaction> & Pick<WalletTransaction, "id">): WalletTransaction {
  return {
    type: "TOP_UP",
    amount: 100000,
    status: "COMPLETED",
    createdAt: "2026-09-27T05:00:00Z",
    ...overrides,
  }
}

function renderScreen() {
  // Root app asli membungkus layar dengan PortalProvider — BottomSheet
  // (filter sheet, visible=false) membutuhkannya bahkan saat tertutup.
  return render(
    <ThemeProvider>
      <PortalProvider>
        <WalletHistoryScreen />
        <PortalHost />
      </PortalProvider>
    </ThemeProvider>,
  )
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

// ------------------------------------------------------------------
// 1. Pengelompokan tanggal WIB (murni)
// ------------------------------------------------------------------

describe("groupByDay (tanggal WIB)", () => {
  it("melabeli Hari ini / Kemarin / tanggal panjang", () => {
    vi.useFakeTimers()
    try {
      // 27 Sep 2026 10:00 WIB.
      vi.setSystemTime(new Date("2026-09-27T10:00:00+07:00"))
      const groups = groupByDay([
        tx({ id: "a", createdAt: "2026-09-27T05:00:00Z" }), // 12:00 WIB 27 Sep
        tx({ id: "b", createdAt: "2026-09-26T10:00:00Z" }), // 17:00 WIB 26 Sep
        tx({ id: "c", createdAt: "2026-09-20T10:00:00Z" }), // 17:00 WIB 20 Sep
      ])
      expect(groups).toHaveLength(3)
      expect(groups[0].label).toBe("Hari ini")
      expect(groups[0].sub).toBeTruthy()
      expect(groups[0].txns.map((t) => t.id)).toEqual(["a"])
      expect(groups[1].label).toBe("Kemarin")
      expect(groups[1].sub).toBeTruthy()
      expect(groups[2].label).toContain("2026")
      expect(groups[2].label).not.toBe("Hari ini")
      expect(groups[2].label).not.toBe("Kemarin")
      expect(groups[2].sub).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it("batas WIB: 23:59 WIB masuk Kemarin, 00:00 WIB masuk Hari ini (bukan UTC)", () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date("2026-09-27T10:00:00+07:00"))
      const groups = groupByDay([
        tx({ id: "late", createdAt: "2026-09-26T16:59:59Z" }), // 23:59:59 WIB 26 Sep
        tx({ id: "early", createdAt: "2026-09-26T17:00:00Z" }), // 00:00:00 WIB 27 Sep
      ])
      // Dalam UTC keduanya 26 Sep — WIB memisahnya ke dua hari berbeda.
      const late = groups.find((g) => g.txns.some((t) => t.id === "late"))
      const early = groups.find((g) => g.txns.some((t) => t.id === "early"))
      expect(late?.label).toBe("Kemarin")
      expect(early?.label).toBe("Hari ini")
      expect(late?.id).not.toBe(early?.id)
    } finally {
      vi.useRealTimers()
    }
  })

  it("createdAt tidak valid → grup 'Tanggal tidak tersedia'", () => {
    const groups = groupByDay([tx({ id: "x", createdAt: "bukan-tanggal" })])
    expect(groups).toHaveLength(1)
    expect(groups[0].id).toBe("day:invalid")
    expect(groups[0].label).toBe("Tanggal tidak tersedia")
    expect(groups[0].txns).toHaveLength(1)
  })

  it("net harian memakai Math.abs — tahan terhadap amount negatif", () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date("2026-09-27T10:00:00+07:00"))
      const groups = groupByDay([
        tx({ id: "a", createdAt: "2026-09-27T05:00:00Z", type: "TOP_UP", amount: 100000 }),
        tx({ id: "b", createdAt: "2026-09-27T06:00:00Z", type: "TOP_UP", amount: -50000 }),
        tx({ id: "c", createdAt: "2026-09-27T07:00:00Z", type: "WITHDRAW", amount: 20000 }),
      ])
      expect(groups).toHaveLength(1)
      expect(groups[0].in).toBe(150000)
      expect(groups[0].out).toBe(20000)
    } finally {
      vi.useRealTimers()
    }
  })
})

// ------------------------------------------------------------------
// 2. Filter client-side (murni)
// ------------------------------------------------------------------

describe("filterWalletTransactions (client-side)", () => {
  const items = [
    tx({
      id: "1",
      type: "TOP_UP",
      amount: 50000,
      direction: "CREDIT",
      status: "COMPLETED",
      referenceId: "TOP-12345",
    }),
    tx({
      id: "2",
      type: "WITHDRAW",
      amount: 100000,
      direction: "DEBIT",
      status: "PENDING",
      referenceId: "WD-999",
    }),
    tx({
      id: "3",
      type: "TRANSFER_SENT",
      amount: 25000,
      status: "FAILED",
      referenceId: null,
    }),
  ]
  const base = { direction: "ALL" as const, status: "ALL" as const, query: "" }

  it("arah Masuk hanya menampilkan kredit", () => {
    const out = filterWalletTransactions(items, { ...base, direction: "CREDIT" })
    expect(out.map((t) => t.id)).toEqual(["1"])
  })

  it("arah Keluar menampilkan debit termasuk fallback tipe (TRANSFER_SENT)", () => {
    const out = filterWalletTransactions(items, { ...base, direction: "DEBIT" })
    expect(out.map((t) => t.id).sort()).toEqual(["2", "3"])
  })

  it("status: Menunggu / Gagal / Berhasil", () => {
    expect(
      filterWalletTransactions(items, { ...base, status: "PENDING" }).map((t) => t.id),
    ).toEqual(["2"])
    expect(
      filterWalletTransactions(items, { ...base, status: "FAILED" }).map((t) => t.id),
    ).toEqual(["3"])
    expect(
      filterWalletTransactions(items, { ...base, status: "SUCCESS" }).map((t) => t.id),
    ).toEqual(["1"])
  })

  it("pencarian cocok dengan label jenis (case-insensitive)", () => {
    // WALLET_TXN_LABELS: TOP_UP → "Isi Saldo" (T3-008) — pencarian user
    // memakai label baru, case-insensitive.
    const out = filterWalletTransactions(items, { ...base, query: "ISI SALDO" })
    expect(out.map((t) => t.id)).toEqual(["1"])
    const out2 = filterWalletTransactions(items, { ...base, query: "  PENARIKAN " })
    expect(out2.map((t) => t.id)).toEqual(["2"])
  })

  it("pencarian cocok dengan referenceId", () => {
    const out = filterWalletTransactions(items, { ...base, query: "wd-999" })
    expect(out.map((t) => t.id)).toEqual(["2"])
  })

  it("pencarian cocok dengan string nominal", () => {
    const out = filterWalletTransactions(items, { ...base, query: "25000" })
    expect(out.map((t) => t.id)).toEqual(["3"])
  })

  it("pencarian kosong/blank = semua item", () => {
    expect(filterWalletTransactions(items, { ...base, query: "" })).toHaveLength(3)
    expect(filterWalletTransactions(items, { ...base, query: "   " })).toHaveLength(3)
  })

  it("kombinasi arah + pencarian menyempit dengan benar", () => {
    const out = filterWalletTransactions(items, {
      direction: "DEBIT",
      status: "ALL",
      query: "transfer",
    })
    expect(out.map((t) => t.id)).toEqual(["3"])
  })
})

// ------------------------------------------------------------------
// 3. Funnel: sheet filter membuka & menutup
// ------------------------------------------------------------------

describe("<WalletHistoryFilterSheet>", () => {
  it("membuka: menampilkan judul dan empat seksi filter", () => {
    renderSheet(
      <WalletHistoryFilterSheet
        visible
        initial={DEFAULT_HISTORY_FILTERS}
        onApply={() => undefined}
        onRequestClose={() => undefined}
      />,
    )
    expect(screen.getByText("Filter riwayat")).toBeTruthy()
    expect(screen.getByText("Arah dana")).toBeTruthy()
    expect(screen.getByText("Jenis transaksi")).toBeTruthy()
    expect(screen.getByText("Rentang tanggal")).toBeTruthy()
    expect(screen.getByText("Status")).toBeTruthy()
    // Chip jenis dibangun dari enum API persis — bukan alias lama.
    expect(screen.getByText("Isi Saldo")).toBeTruthy()
    expect(screen.getByText("Semua jenis")).toBeTruthy()
  })

  it("tidak merender apa pun saat tertutup", () => {
    renderSheet(
      <WalletHistoryFilterSheet
        visible={false}
        initial={DEFAULT_HISTORY_FILTERS}
        onApply={() => undefined}
        onRequestClose={() => undefined}
      />,
    )
    expect(screen.queryByText("Filter riwayat")).toBeNull()
  })

  it("tombol X memanggil onRequestClose", () => {
    const onRequestClose = vi.fn()
    renderSheet(
      <WalletHistoryFilterSheet
        visible
        initial={DEFAULT_HISTORY_FILTERS}
        onApply={() => undefined}
        onRequestClose={onRequestClose}
      />,
    )
    // "Tutup" juga dipakai backdrop — scope ke kartu sheet (root ber-label judul).
    const sheetRoot = screen.getByLabelText("Filter riwayat")
    fireEvent.click(within(sheetRoot).getByLabelText("Tutup"))
    expect(onRequestClose).toHaveBeenCalledTimes(1)
  })

  it("Terapkan mengirim draf yang dipilih (arah + status)", () => {
    const onApply = vi.fn()
    const onRequestClose = vi.fn()
    renderSheet(
      <WalletHistoryFilterSheet
        visible
        initial={DEFAULT_HISTORY_FILTERS}
        onApply={onApply}
        onRequestClose={onRequestClose}
      />,
    )
    fireEvent.click(screen.getByText("Dana masuk"))
    fireEvent.click(screen.getByText("Menunggu"))
    fireEvent.click(screen.getByText("Terapkan"))
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onApply).toHaveBeenCalledWith({
      ...DEFAULT_HISTORY_FILTERS,
      direction: "CREDIT",
      status: "PENDING",
    })
    expect(onRequestClose).toHaveBeenCalledTimes(1)
  })

  it("Atur ulang mengembalikan draf ke default sebelum diterapkan", () => {
    const onApply = vi.fn()
    renderSheet(
      <WalletHistoryFilterSheet
        visible
        initial={{ ...DEFAULT_HISTORY_FILTERS, direction: "DEBIT", rangeDays: 7 }}
        onApply={onApply}
        onRequestClose={() => undefined}
      />,
    )
    fireEvent.click(screen.getByText("Atur ulang"))
    fireEvent.click(screen.getByText("Terapkan"))
    expect(onApply).toHaveBeenCalledWith(DEFAULT_HISTORY_FILTERS)
  })
})

// ------------------------------------------------------------------
// 4. Rentang tanggal → query from/to (mock lib/api, layar asli)
// ------------------------------------------------------------------

describe("app/wallet-history — query server", () => {
  it("preset default 90 hari: type tidak dikirim, from ≈ 90 hari lalu (+margin 1 jam), to ≈ sekarang", async () => {
    const before = Date.now()
    renderScreen()
    await waitFor(() => expect(mocks.getWalletTransactions).toHaveBeenCalled())

    const arg = mocks.getWalletTransactions.mock.calls[0][0]
    expect(arg.page).toBe(1)
    expect(arg.limit).toBe(20)
    // "Semua jenis" TIDAK mengirim query `type` — adapter membuang "ALL".
    // Layar tetap meneruskan "ALL" dan adapter yang menghapusnya.
    expect(arg.type).toBe("ALL")
    expect(arg.to).toBeDefined()
    expect(arg.from).toBeDefined()
    const toMs = new Date(arg.to as string).getTime()
    expect(toMs).toBeGreaterThanOrEqual(before - 1000)
    expect(toMs).toBeLessThanOrEqual(Date.now() + 1000)
    const fromMs = new Date(arg.from as string).getTime()
    const expectedFrom = toMs - 90 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000
    expect(Math.abs(fromMs - expectedFrom)).toBeLessThan(2000)
  })

  it("header menampilkan ikon filter funnel + tombol unduh CSV/PDF", async () => {
    renderScreen()
    await waitFor(() => expect(mocks.getWalletTransactions).toHaveBeenCalled())
    expect(screen.getByLabelText("Buka filter riwayat")).toBeTruthy()
    expect(screen.getByLabelText("Unduh riwayat dompet CSV")).toBeTruthy()
    expect(screen.getByLabelText("Unduh riwayat dompet untuk dicetak")).toBeTruthy()
    // Kolom pencarian client-side ada di header daftar.
    expect(screen.getByLabelText("Cari mutasi dompet")).toBeTruthy()
  })
})
