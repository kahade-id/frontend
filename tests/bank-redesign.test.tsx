/**
 * Redesign layar Rekening Bank 2026-09-27 (TIM BANK).
 *
 * Mengunci kontrak tampilan hasil redesign premium (API tidak ditembak —
 * `lib/api` dan `useApiQuery` di-mock; yang diuji pohon render + kontrak
 * payload):
 *
 *  1. Daftar: tiap rekening tampil sebagai <BankAccountCard> premium —
 *     avatar bank (inisial dalam lingkaran berwarna bila tanpa logo),
 *     nomor termasker via `maskAccountNumber` (format yang sama seperti
 *     sebelum redesign), badge "Utama" hanya di rekening utama.
 *  2. Kontrak API TAK BERUBAH: form tambah memanggil
 *     `addBankAccount` dengan payload `{ bankCode, bankName, accountNumber,
 *     accountName }` yang persis sama seperti sebelum redesign; hapus →
 *     `deleteBankAccount(id)`; jadikan utama → `setPrimaryBankAccount(id)`;
 *     edit nama → `updateBankAccountName(id, name)`.
 *  3. Konfirmasi hapus: dialog "Hapus rekening?" menampilkan nomor TERMASKER
 *     (bukan penuh), tombol konfirmasi memanggil API hapus.
 *  4. Fail closed: error query → <ErrorState>, BUKAN daftar kosong palsu.
 *
 * Dijalankan dengan config komponen (repo convention):
 *   npx vitest run --config vitest.components.config.ts tests/bank-redesign.test.tsx
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { PortalHost, PortalProvider } from "@/components/ui/portal"
import BankAccountsScreen from "@/app/bank-accounts"
import { BankAccountCard } from "@/components/ui/bank-account-card"
import type { BankOption } from "@/components/ui/bank-select"
import type { BankAccount } from "@/lib/api/bank-accounts"
import { maskAccountNumber } from "@/lib/format"

// ------------------------------------------------------------------
// Mock lapisan data — API asli tidak pernah ditembak.
// ------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  accounts: [] as BankAccount[],
  banks: [] as BankOption[],
  loading: false,
  error: null as string | null,
  refresh: vi.fn(),
  reload: vi.fn(),
  addBankAccount: vi.fn(),
  deleteBankAccount: vi.fn(),
  setPrimaryBankAccount: vi.fn(),
  updateBankAccountName: vi.fn(),
  toastShow: vi.fn(),
}))

vi.mock("@/lib/use-api-query", () => ({
  useApiQuery: () => ({
    data: { accounts: mocks.accounts, banks: mocks.banks },
    loading: mocks.loading,
    refreshing: false,
    error: mocks.error,
    refresh: mocks.refresh,
    reload: mocks.reload,
  }),
}))

vi.mock("@/lib/api", () => ({
  api: {
    bankAccounts: {
      listBankAccounts: vi.fn(),
      addBankAccount: (...args: unknown[]) => mocks.addBankAccount(...args),
      deleteBankAccount: (...args: unknown[]) => mocks.deleteBankAccount(...args),
      setPrimaryBankAccount: (...args: unknown[]) => mocks.setPrimaryBankAccount(...args),
      updateBankAccountName: (...args: unknown[]) => mocks.updateBankAccountName(...args),
    },
    public: { getBanks: vi.fn() },
  },
  userMessage: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}))

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ show: mocks.toastShow, dismiss: vi.fn(), dismissAll: vi.fn() }),
}))

// ------------------------------------------------------------------
// Data uji — bentuk persis seperti yang dinormalisasi lib/api/bank-accounts
// (DRIFT-BA-01: list mengirim `maskedAccountNumber`, bukan nomor mentah).
// ------------------------------------------------------------------

const BANKS: BankOption[] = [
  { code: "BCA", name: "Bank Central Asia", kind: "bank" },
  { code: "BRI", name: "Bank Rakyat Indonesia", kind: "bank" },
]

const ACCOUNTS: BankAccount[] = [
  {
    id: "acc-1",
    bankCode: "BCA",
    bankName: "Bank Central Asia",
    accountNumber: "****1234",
    accountName: "Budi Santoso",
    isPrimary: true,
    isVerified: true,
  },
  {
    id: "acc-2",
    bankCode: "BRI",
    bankName: "Bank Rakyat Indonesia",
    accountNumber: "****5678",
    accountName: "Budi Santoso",
    isPrimary: false,
    isVerified: false,
  },
]

function renderThemed(ui: React.ReactElement) {
  // Dialog memakai portal → butuh PortalProvider + PortalHost (pola
  // tests/bottom-sheet-content.test.tsx).
  return render(
    <ThemeProvider>
      <PortalProvider>
        {ui}
        <PortalHost />
      </PortalProvider>
    </ThemeProvider>,
  )
}

function seedList() {
  mocks.accounts = ACCOUNTS.map((a) => ({ ...a }))
  mocks.banks = BANKS.map((b) => ({ ...b }))
}

beforeEach(() => {
  mocks.accounts = []
  mocks.banks = []
  mocks.loading = false
  mocks.error = null
  for (const fn of [
    mocks.refresh,
    mocks.reload,
    mocks.addBankAccount,
    mocks.deleteBankAccount,
    mocks.setPrimaryBankAccount,
    mocks.updateBankAccountName,
    mocks.toastShow,
  ]) fn.mockClear()
})

afterEach(() => {
  cleanup()
})

// ------------------------------------------------------------------
// 1. <BankAccountCard> — unit tampilan kartu premium.
// ------------------------------------------------------------------

describe("<BankAccountCard>", () => {
  it("menampilkan avatar inisial, nomor termasker, dan badge Utama", () => {
    renderThemed(
      <BankAccountCard
        bankName="Bank Central Asia"
        bankCode="BCA"
        accountNumber="1234567890"
        accountHolder="Budi Santoso"
        primary
      />,
    )
    // Inisial bank dalam lingkaran berwarna (tanpa logo).
    expect(screen.getByText("B")).toBeTruthy()
    // Nomor dimask dengan format yang sudah ada (bukan nomor penuh).
    expect(screen.getByText(maskAccountNumber("1234567890"))).toBeTruthy()
    expect(screen.queryByText("1234567890")).toBeNull()
    // Badge Utama hanya untuk rekening utama.
    expect(screen.getByText("Utama")).toBeTruthy()
    expect(screen.getByText("Budi Santoso")).toBeTruthy()
  })

  it("tidak menampilkan badge Utama untuk rekening non-utama + status belum diverifikasi", () => {
    renderThemed(
      <BankAccountCard
        bankName="Bank Rakyat Indonesia"
        bankCode="BRI"
        accountNumber="****5678"
        accountHolder="Budi Santoso"
        verified={false}
      />,
    )
    expect(screen.queryByText("Utama")).toBeNull()
    expect(screen.getByText("Belum diverifikasi")).toBeTruthy()
  })

  it("callback aksi dipanggil dari baris aksi kartu", () => {
    const onSetPrimary = vi.fn()
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    renderThemed(
      <BankAccountCard
        bankName="Bank Rakyat Indonesia"
        bankCode="BRI"
        accountNumber="****5678"
        accountHolder="Budi Santoso"
        onSetPrimary={onSetPrimary}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Jadikan utama" }))
    expect(onSetPrimary).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole("button", { name: "Edit nama" }))
    expect(onEdit).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole("button", { name: "Hapus" }))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})

// ------------------------------------------------------------------
// 2. Layar — daftar premium, badge, mask.
// ------------------------------------------------------------------

describe("layar Rekening Bank — daftar", () => {
  it("dua rekening tampil sebagai kartu dengan nomor termasker & satu badge Utama", () => {
    seedList()
    renderThemed(<BankAccountsScreen />)
    expect(screen.getByText("Bank Central Asia · BCA")).toBeTruthy()
    expect(screen.getByText("Bank Rakyat Indonesia · BRI")).toBeTruthy()
    // Format mask yang sama seperti sebelum redesign.
    expect(screen.getByText(maskAccountNumber("****1234"))).toBeTruthy()
    expect(screen.getByText(maskAccountNumber("****5678"))).toBeTruthy()
    // Badge Utama persis satu (rekening utama saja).
    expect(screen.getAllByText("Utama")).toHaveLength(1)
    // Tombol "Jadikan utama" hanya ada di kartu non-utama.
    expect(screen.getAllByRole("button", { name: "Jadikan utama" })).toHaveLength(1)
  })

  it("empty state 'Belum ada rekening' dengan aksi buka form", () => {
    renderThemed(<BankAccountsScreen />)
    expect(screen.getByText("Belum ada rekening")).toBeTruthy()
    fireEvent.click(screen.getAllByRole("button", { name: "Tambah rekening" })[0])
    // Form tambah terbuka: pemilih bank + field nomor + nama pemilik.
    expect(screen.getByRole("button", { name: "Bank" })).toBeTruthy()
    expect(screen.getByPlaceholderText("1234567890")).toBeTruthy()
    expect(screen.getByPlaceholderText("Sesuai rekening")).toBeTruthy()
  })

  it("fail closed: error query → ErrorState, bukan daftar kosong palsu", () => {
    mocks.error = "Koneksi gagal"
    renderThemed(<BankAccountsScreen />)
    expect(screen.getByText("Gagal memuat")).toBeTruthy()
    expect(screen.getByText("Koneksi gagal")).toBeTruthy()
    expect(screen.queryByText("Belum ada rekening")).toBeNull()
  })

  it("Jadikan utama memanggil setPrimaryBankAccount(id)", async () => {
    seedList()
    renderThemed(<BankAccountsScreen />)
    fireEvent.click(screen.getByRole("button", { name: "Jadikan utama" }))
    await waitFor(() => expect(mocks.setPrimaryBankAccount).toHaveBeenCalledWith("acc-2"))
    expect(mocks.toastShow).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Rekening utama diperbarui" }),
    )
  })
})

// ------------------------------------------------------------------
// 3. Form tambah — kontrak payload tak berubah.
// ------------------------------------------------------------------

describe("form tambah rekening", () => {
  function openForm() {
    seedList()
    renderThemed(<BankAccountsScreen />)
    // Tombol section "Tambah rekening" (di bawah daftar; daftar tidak kosong
    // sehingga ini satu-satunya tombol "Tambah rekening" yang tampil).
    fireEvent.click(screen.getByRole("button", { name: "Tambah rekening" }))
  }

  it("memanggil addBankAccount dengan payload yang sama seperti sebelum redesign", async () => {
    openForm()

    // Pilih bank lewat BankSelect (bottom sheet).
    fireEvent.click(screen.getByRole("button", { name: "Bank" }))
    fireEvent.click(screen.getByRole("button", { name: "Bank Central Asia" }))

    // Isi nomor & nama pemilik.
    fireEvent.change(screen.getByPlaceholderText("1234567890"), { target: { value: "1234567890" } })
    fireEvent.change(screen.getByPlaceholderText("Sesuai rekening"), { target: { value: "Budi Santoso" } })

    fireEvent.click(screen.getByRole("button", { name: "Simpan rekening" }))

    await waitFor(() =>
      expect(mocks.addBankAccount).toHaveBeenCalledWith({
        bankCode: "BCA",
        bankName: "Bank Central Asia",
        accountNumber: "1234567890",
        accountName: "Budi Santoso",
      }),
    )
    // Payload persis 4 kunci — tidak ada field baru yang bocor ke API.
    const dto = mocks.addBankAccount.mock.calls[0][0]
    expect(Object.keys(dto).sort()).toEqual(["accountName", "accountNumber", "bankCode", "bankName"])
  })

  it("tombol simpan terkunci sampai semua field terisi (F-06)", () => {
    openForm()
    const save = screen.getByRole("button", { name: "Simpan rekening" })
    expect(save.getAttribute("disabled")).not.toBeNull()
  })
})

// ------------------------------------------------------------------
// 4. Konfirmasi hapus — nomor termasker, API dipanggil dengan id.
// ------------------------------------------------------------------

describe("konfirmasi hapus rekening", () => {
  it("dialog menampilkan nomor termasker; konfirmasi memanggil deleteBankAccount(id)", async () => {
    seedList()
    renderThemed(<BankAccountsScreen />)

    // Tombol Hapus di kartu pertama.
    const hapusButtons = screen.getAllByRole("button", { name: "Hapus" })
    expect(hapusButtons).toHaveLength(2)
    fireEvent.click(hapusButtons[0])

    // Dialog konfirmasi: judul + deskripsi berisi nomor TERMASKER (format
    // yang sama dengan daftar — nomor tidak pernah ditulis penuh).
    expect(screen.getByText("Hapus rekening?")).toBeTruthy()
    const masked = maskAccountNumber("****1234")
    expect(
      screen.getByText(
        (content) => content.includes("Bank Central Asia") && content.includes(masked),
      ),
    ).toBeTruthy()

    // Konfirmasi = tombol Hapus terakhir (di dalam dialog).
    const all = screen.getAllByRole("button", { name: "Hapus" })
    fireEvent.click(all[all.length - 1])

    await waitFor(() => expect(mocks.deleteBankAccount).toHaveBeenCalledWith("acc-1"))
    expect(mocks.toastShow).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Rekening dihapus" }),
    )
  })
})

// ------------------------------------------------------------------
// 5. Edit nama — backend hanya menerima {accountName}.
// ------------------------------------------------------------------

describe("edit nama pemilik", () => {
  it("memanggil updateBankAccountName(id, namaBaru)", async () => {
    seedList()
    renderThemed(<BankAccountsScreen />)

    fireEvent.click(screen.getAllByRole("button", { name: "Edit nama" })[0])
    expect(screen.getByText("Edit nama pemilik")).toBeTruthy()

    const input = screen.getByPlaceholderText("Nama pemilik rekening")
    fireEvent.change(input, { target: { value: "Budi Baru" } })
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }))

    await waitFor(() => expect(mocks.updateBankAccountName).toHaveBeenCalledWith("acc-1", "Budi Baru"))
    expect(mocks.toastShow).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Rekening diperbarui" }),
    )
  })
})
