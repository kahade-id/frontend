/**
 * Redesign halaman Dompet 2026-09-27 (TIM WALLET PAGE).
 *
 * Mengunci kontrak tampilan hasil redesign (API tidak ditembak — `lib/api`,
 * `useApiQuery`, `usePaginatedQuery`, dan `useHasSession` di-mock; yang diuji
 * pohon render + peta route):
 *
 *  1. Toggle mata menyembunyikan saldo lewat `prefs.balanceHidden` dari
 *     useUiPrefs — preferensi yang SAMA dengan Beranda, bukan state lokal.
 *  2. Halaman Dompet TIDAK punya tombol kembali (destinasi top-level via
 *     mode switcher di drawer).
 *  3. Aksi primer (Isi Saldo/Tarik Dana/Transfer) ada dengan route yang
 *     benar + menu cepat tanpa tombol mati — di level komponen & peta route.
 *  4. Fail closed: error saldo → ErrorState + retry, bukan Rp 0 palsu.
 *  5. Dana tertahan memakai `holdBalance ?? escrowBalance`.
 *
 * Dijalankan dengan config komponen (repo convention):
 *   npx vitest run --config vitest.components.config.ts tests/wallet-redesign.test.tsx
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { router } from "expo-router"

import { ThemeProvider } from "@/components/theme-provider"
import {
  WalletHeroCard,
  type WalletHeroCardProps,
} from "@/components/wallet/wallet-hero-card"
import {
  WALLET_PRIMARY_ACTIONS,
  WALLET_QUICK_MENU,
  WalletPrimaryActions,
  WalletQuickMenu,
} from "@/components/wallet/wallet-menu"
import { getUiPrefsSnapshot, resetUiPrefsForTest, useUiPrefs } from "@/lib/ui-prefs"
import { formatRupiah } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import type { WalletTransaction } from "@/lib/api/wallet"
import { deleteSecureItem, SecureKeys } from "@/lib/secure-storage"
import WalletScreen from "@/app/wallet"

// ------------------------------------------------------------------
// Mock lapisan data — API asli tidak pernah ditembak.
// ------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  hasSession: true,
  balanceData: null as Record<string, unknown> | null,
  balanceLoading: false,
  balanceError: null as string | null,
  balanceReload: vi.fn(),
  historyData: [] as WalletTransaction[],
  historyLoading: false,
  historyError: null as string | null,
  historyReload: vi.fn(),
}))

vi.mock("@/lib/guest-gate", () => ({
  useHasSession: () => mocks.hasSession,
}))
vi.mock("@/lib/use-api-query", () => ({
  useApiQuery: () => ({
    data: mocks.balanceData,
    loading: mocks.balanceLoading,
    refreshing: false,
    error: mocks.balanceError,
    refresh: vi.fn(),
    reload: mocks.balanceReload,
  }),
}))
vi.mock("@/lib/use-paginated-query", () => ({
  byTimestampDesc: (get: (tx: WalletTransaction) => string) => get,
  usePaginatedQuery: () => ({
    data: mocks.historyData,
    loading: mocks.historyLoading,
    refreshing: false,
    loadingMore: false,
    error: mocks.historyError,
    loadMoreError: null,
    hasMore: false,
    refresh: vi.fn(),
    reload: mocks.historyReload,
    loadMore: vi.fn(),
  }),
}))
// lib/api menarik graf native dalam — layar hanya butuh tipenya; query-nya
// sendiri sudah di-mock di atas.
vi.mock("@/lib/api", () => ({ api: {} }))

const MASKED = `Rp${"\u2022".repeat(8)}`

/** Hero ter-wire ke useUiPrefs persis seperti app/wallet.tsx. */
function HeroWithPrefs(props: Omit<WalletHeroCardProps, "hidden" | "onToggleHidden">) {
  const { prefs, setPrefs } = useUiPrefs()
  return (
    <WalletHeroCard
      {...props}
      hidden={prefs.balanceHidden}
      onToggleHidden={() => setPrefs({ balanceHidden: !prefs.balanceHidden })}
    />
  )
}

function renderThemed(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>)
}

let pushSpy: ReturnType<typeof vi.spyOn>

beforeEach(async () => {
  resetUiPrefsForTest()
  // lib/secure-storage memakai cache memori + localStorage di web (di luar
  // stub expo-secure-store): tanpa ini, `balanceHidden: true` yang disimpan
  // test toggle dimuat ulang oleh `loadUiPrefs` pada test berikutnya
  // (lintas-test pollution).
  await deleteSecureItem(SecureKeys.uiPrefs)
  mocks.hasSession = true
  mocks.balanceData = null
  mocks.balanceLoading = false
  mocks.balanceError = null
  mocks.historyData = []
  mocks.historyLoading = false
  mocks.historyError = null
  mocks.balanceReload.mockClear()
  mocks.historyReload.mockClear()
  pushSpy = vi.spyOn(router, "push").mockImplementation(() => undefined)
})

afterEach(() => {
  cleanup()
  pushSpy.mockRestore()
})

// ------------------------------------------------------------------
// 1. Peta route — tidak ada tombol mati.
// ------------------------------------------------------------------

describe("peta route aksi dompet", () => {
  it("tiga aksi primer memetakan ke route yang benar", () => {
    expect(WALLET_PRIMARY_ACTIONS.map((a) => [a.label, a.route])).toEqual([
      ["Isi Saldo", ROUTES.topup],
      ["Transfer", ROUTES.transfer],
      ["Tarik Dana", ROUTES.withdraw],
    ])
  })

  it("lima menu cepat memetakan ke route yang benar", () => {
    expect(WALLET_QUICK_MENU.map((a) => [a.label, a.route])).toEqual([
      ["Terima", ROUTES.receive],
      ["Riwayat", ROUTES.walletHistory],
      ["Voucher", ROUTES.vouchers],
      ["Bank", ROUTES.bankAccounts],
      ["Bantuan", ROUTES.liveSupport],
    ])
  })

  it("setiap entri punya route terdefinisi yang terdaftar di ROUTES", () => {
    const known = new Set(Object.values(ROUTES))
    for (const item of [...WALLET_PRIMARY_ACTIONS, ...WALLET_QUICK_MENU]) {
      expect(item.route, item.label).toBeTruthy()
      expect(known.has(item.route), `${item.label} → ${String(item.route)}`).toBe(true)
    }
  })
})

// ------------------------------------------------------------------
// 2. Aksi primer & menu cepat menavigasi ke route yang benar.
// ------------------------------------------------------------------

describe("<WalletPrimaryActions> / <WalletQuickMenu>", () => {
  it("Isi Saldo → /topup, Transfer → /transfer, Tarik Dana → /withdraw", () => {
    renderThemed(<WalletPrimaryActions />)
    fireEvent.click(screen.getByRole("button", { name: "Isi Saldo" }))
    expect(pushSpy).toHaveBeenCalledWith(ROUTES.topup)
    fireEvent.click(screen.getByRole("button", { name: "Transfer" }))
    expect(pushSpy).toHaveBeenCalledWith(ROUTES.transfer)
    fireEvent.click(screen.getByRole("button", { name: "Tarik Dana" }))
    expect(pushSpy).toHaveBeenCalledWith(ROUTES.withdraw)
    expect(pushSpy).toHaveBeenCalledTimes(3)
  })

  it("menu cepat menavigasi: Terima, Riwayat, Voucher, Bank, Bantuan", () => {
    renderThemed(<WalletQuickMenu />)
    const cases = [
      ["Terima", ROUTES.receive],
      ["Riwayat", ROUTES.walletHistory],
      ["Voucher", ROUTES.vouchers],
      ["Bank", ROUTES.bankAccounts],
      ["Bantuan", ROUTES.liveSupport],
    ] as const
    for (const [label, route] of cases) {
      fireEvent.click(screen.getByRole("button", { name: label }))
      expect(pushSpy).toHaveBeenCalledWith(route)
    }
    expect(pushSpy).toHaveBeenCalledTimes(cases.length)
  })
})

// ------------------------------------------------------------------
// 3. Toggle sembunyi saldo via useUiPrefs (preferensi dibagi Beranda).
// ------------------------------------------------------------------

describe("<WalletHeroCard> + useUiPrefs", () => {
  const BALANCE = 1_250_000
  const HELD = 350_000

  async function renderHeroSettled() {
    renderThemed(<HeroWithPrefs available={BALANCE} held={HELD} />)
    // Tunggu loadUiPrefs (async, baca secure-store stub) selesai supaya tidak
    // menimpa preferensi yang diubah test setelahnya.
    await waitFor(() => expect(screen.getByText(formatRupiah(BALANCE))).toBeTruthy())
  }

  it("menampilkan saldo exact dari API + dana tertahan escrow", async () => {
    await renderHeroSettled()
    expect(screen.getByText("Saldo Dompet")).toBeTruthy()
    expect(screen.getByText(formatRupiah(BALANCE))).toBeTruthy()
    expect(screen.getByText(formatRupiah(HELD))).toBeTruthy()
    expect(screen.getByText("ditahan di escrow")).toBeTruthy()
  })

  it("mata menyembunyikan saldo dan menulis prefs.balanceHidden", async () => {
    await renderHeroSettled()
    expect(getUiPrefsSnapshot().balanceHidden).toBe(false)

    fireEvent.click(screen.getByRole("button", { name: "Sembunyikan saldo" }))

    expect(getUiPrefsSnapshot().balanceHidden).toBe(true)
    // Saldo DAN dana tertahan tersamar (bullet), bukan Rp 0.
    expect(screen.getAllByText(MASKED)).toHaveLength(2)
    expect(screen.queryByText(formatRupiah(BALANCE))).toBeNull()
    expect(screen.queryByText(formatRupiah(HELD))).toBeNull()
    // Label tombol ikut berganti.
    expect(screen.getByRole("button", { name: "Tampilkan saldo" })).toBeTruthy()
  })

  it("mata kedua menampilkan saldo lagi dan mengembalikan preferensi", async () => {
    await renderHeroSettled()
    fireEvent.click(screen.getByRole("button", { name: "Sembunyikan saldo" }))
    fireEvent.click(screen.getByRole("button", { name: "Tampilkan saldo" }))

    expect(getUiPrefsSnapshot().balanceHidden).toBe(false)
    expect(screen.getByText(formatRupiah(BALANCE))).toBeTruthy()
    expect(screen.getByRole("button", { name: "Sembunyikan saldo" })).toBeTruthy()
  })

  it("sub-baris escrow disembunyikan bila tidak ada dana tertahan", async () => {
    renderThemed(<HeroWithPrefs available={BALANCE} />)
    await waitFor(() => expect(screen.getByText(formatRupiah(BALANCE))).toBeTruthy())
    expect(screen.queryByText("ditahan di escrow")).toBeNull()
  })

  it("loading menampilkan skeleton, bukan angka", () => {
    renderThemed(<HeroWithPrefs available={BALANCE} held={HELD} loading />)
    expect(screen.queryByText(formatRupiah(BALANCE))).toBeNull()
    // Kontrol mata tetap ada — layout stabil saat refetch.
    expect(screen.getByRole("button", { name: "Sembunyikan saldo" })).toBeTruthy()
  })

  it("error menampilkan ErrorState + retry (fail closed, tanpa Rp 0 palsu)", () => {
    const onRetry = vi.fn()
    renderThemed(<HeroWithPrefs available={BALANCE} error="Jaringan bermasalah" onRetry={onRetry} />)
    expect(screen.getByText("Gagal memuat saldo")).toBeTruthy()
    expect(screen.queryByText("Saldo Dompet")).toBeNull()
    expect(screen.queryByText(formatRupiah(BALANCE))).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})

// ------------------------------------------------------------------
// 4. Layar penuh: tanpa tombol back, data flow utuh.
// ------------------------------------------------------------------

const TX_TOPUP: WalletTransaction = {
  id: "tx-1",
  type: "TOP_UP",
  amount: 500_000,
  direction: "CREDIT",
  status: "COMPLETED",
  createdAt: "2026-09-27T10:00:00+07:00",
}
const TX_WITHDRAW: WalletTransaction = {
  id: "tx-2",
  type: "WITHDRAW",
  amount: 200_000,
  direction: "DEBIT",
  status: "COMPLETED",
  createdAt: "2026-09-26T10:00:00+07:00",
}

describe("<WalletScreen>", () => {
  beforeEach(() => {
    mocks.balanceData = {
      id: "w-1",
      balance: 2_650_000,
      availableBalance: 2_500_000,
      escrowBalance: 150_000,
      updatedAt: "2026-09-27T10:00:00+07:00",
    }
    mocks.historyData = [TX_TOPUP, TX_WITHDRAW]
  })

  function renderScreen() {
    const { container } = renderThemed(<WalletScreen />)
    return container
  }

  it("TIDAK ada tombol kembali — Dompet destinasi top-level", async () => {
    renderScreen()
    await waitFor(() => expect(screen.getByText("Dompet")).toBeTruthy())
    expect(screen.queryByRole("button", { name: "Kembali" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Tutup" })).toBeNull()
  })

  it("menampilkan saldo exact + escrow via escrowBalance (fallback backend)", async () => {
    renderScreen()
    await waitFor(() => expect(screen.getByText(formatRupiah(2_500_000))).toBeTruthy())
    expect(screen.getByText(formatRupiah(150_000))).toBeTruthy()
    expect(screen.getByText("ditahan di escrow")).toBeTruthy()
  })

  it("holdBalance diprioritaskan di atas escrowBalance", async () => {
    mocks.balanceData = {
      id: "w-1",
      balance: 2_600_000,
      availableBalance: 2_500_000,
      holdBalance: 100_000,
      escrowBalance: 150_000,
    }
    renderScreen()
    await waitFor(() => expect(screen.getByText(formatRupiah(100_000))).toBeTruthy())
    expect(screen.queryByText(formatRupiah(150_000))).toBeNull()
  })

  it("error saldo → ErrorState + retry memanggil reload (tanpa Rp 0 palsu)", async () => {
    mocks.balanceError = "Jaringan bermasalah"
    renderScreen()
    await waitFor(() => expect(screen.getByText("Gagal memuat saldo")).toBeTruthy())
    expect(screen.queryByText("Saldo Dompet")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }))
    expect(mocks.balanceReload).toHaveBeenCalled()
  })

  it("pratinjau transaksi terakhir + tautan Lihat semua ke /wallet-history", async () => {
    const container = renderScreen()
    await waitFor(() => expect(screen.getByText("Transaksi terakhir")).toBeTruthy())
    // Baris vivid: nominal bertanda arah (+ masuk / − keluar).
    expect(screen.getByText(formatRupiah(500_000, { sign: "always" }))).toBeTruthy()
    expect(screen.getByText(formatRupiah(-200_000))).toBeTruthy()
    const link = container.querySelector('a[href="/wallet-history"]')
    expect(link).toBeTruthy()
    expect(link?.textContent).toContain("Lihat semua")
  })

  it("riwayat kosong → empty state yang ramah", async () => {
    mocks.historyData = []
    renderScreen()
    await waitFor(() => expect(screen.getByText("Belum ada riwayat")).toBeTruthy())
  })

  it("CTA primer di layar menavigasi ke route yang benar", async () => {
    renderScreen()
    await waitFor(() => expect(screen.getByText("Transaksi terakhir")).toBeTruthy())
    fireEvent.click(screen.getByRole("button", { name: "Tarik Dana" }))
    expect(pushSpy).toHaveBeenCalledWith(ROUTES.withdraw)
  })
})
