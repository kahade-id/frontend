/**
 * Redesign tab Transaksi 2026-09-27 (presentasi saja — logika/filter/API identik).
 *
 * Mengunci kontrak tampilan hasil redesign (API tidak ditembak — `lib/api`,
 * `lib/guest-gate`, dan `lib/ui-prefs` di-mock; yang diuji pohon render):
 *
 *  1. <OrderCard>: nominal berwarna mengikuti arah dana (penjual = dana masuk
 *     success + chip ArrowDownLeft; pembeli = dana keluar primary + chip
 *     ArrowUpRight; tanpa peran = tanpa chip, primary), badge status tetap
 *     memakai label ORDER_STATUS_LABELS, nama lawan transaksi tampil, nilai
 *     nominal EXACT dari prop (tanpa tanda +/- tambahan).
 *  2. Layar: segmen peran "Pembeli"/"Penjual" berikon tampil; chip status
 *     ("Semua status", "Aktif", + enum) tampil; daftar dikelompokkan per hari
 *     WIB ("Hari ini"/"Kemarin"); empty state saat daftar kosong; pemanggilan
 *     awal `listOrders` memakai role=BUYER tanpa param status.
 *
 * Dijalankan dengan config komponen (repo convention):
 *   npx vitest run --config vitest.components.config.ts tests/transactions-redesign.test.tsx
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { OrderCard, orderDirectionConfig } from "@/components/ui/order-card"
import type { Order } from "@/lib/api/orders"

// ------------------------------------------------------------------
// Mock lapisan data — API asli tidak pernah ditembak.
// ------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  listOrders: vi.fn(
    async (
      _query: { page: number; limit: number; role?: string; status?: string },
      _signal?: AbortSignal,
    ) => ({
      data: [] as Order[],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    }),
  ),
  setPrefs: vi.fn(),
  roleTab: "buyer" as "buyer" | "seller",
}))

vi.mock("@/lib/api", () => ({
  api: { orders: { listOrders: mocks.listOrders } },
}))

vi.mock("@/lib/guest-gate", () => ({
  useHasSession: () => true,
  useGuestPathBlocked: () => false,
}))

vi.mock("@/lib/ui-prefs", () => ({
  useUiPrefs: () => ({ prefs: { transactionsTab: mocks.roleTab }, setPrefs: mocks.setPrefs }),
}))

// Impor layar SETELAH mock di atas.
import TransactionsScreen from "@/app/(tabs)/transactions"

afterEach(() => {
  cleanup()
  mocks.listOrders.mockClear()
  mocks.setPrefs.mockClear()
  mocks.roleTab = "buyer"
})

// ------------------------------------------------------------------
// Data uji — bentuk Order sesuai lib/api/orders-shared.ts.
// ------------------------------------------------------------------

/** Tengah hari WIB yang deterministik: 12:00 WIB hari ini & kemarin. */
function wibNoon(offsetDays: number): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date())
  const value = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? NaN)
  return new Date(
    Date.UTC(value("year"), value("month") - 1, value("day") + offsetDays, 5, 0, 0),
  ).toISOString()
}

function order(overrides: Partial<Order> & Pick<Order, "id">): Order {
  return {
    title: "Kopi Robusta 1kg",
    description: "",
    orderType: "PRODUCT",
    status: "WAITING_PAYMENT",
    orderValue: 1500000,
    feeResponsibility: "BUYER",
    deliveryDeadlineDays: 3,
    myRole: "BUYER",
    buyer: { id: "u-buyer", username: "pembeli_1", fullName: "Budi Pembeli" },
    seller: { id: "u-seller", username: "penjual_1", fullName: "Sari Penjual" },
    createdAt: wibNoon(0),
    ...overrides,
  } as Order
}

function renderCard(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>)
}

function renderScreen() {
  return render(
    <ThemeProvider>
      <TransactionsScreen />
    </ThemeProvider>,
  )
}

// ------------------------------------------------------------------
// 1. <OrderCard> — arah dana, badge, lawan transaksi, nominal exact.
// ------------------------------------------------------------------

describe("<OrderCard> arah dana & hierarki", () => {
  const base = {
    orderId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    title: "Kopi Robusta 1kg",
    amount: 1500000,
    status: "WAITING_PAYMENT",
    timestamp: "27 Sep 2026, 12:00 WIB",
  }

  it("penjual: chip ArrowDownLeft tampil + nominal exact tanpa tanda tambahan", () => {
    renderCard(
      <OrderCard
        {...base}
        role="seller"
        counterpart={{ name: "Budi Pembeli" }}
      />,
    )
    const chip = screen.getByTestId("order-direction-chip")
    expect(chip.querySelector('[data-icon="ArrowDownLeft"]')).toBeTruthy()
    expect(screen.getByTestId("order-card-amount").textContent).toBe("Rp1.500.000")
  })

  it("pembeli: chip ArrowUpRight tampil + nominal exact tanpa tanda tambahan", () => {
    renderCard(
      <OrderCard
        {...base}
        role="buyer"
        counterpart={{ name: "Sari Penjual" }}
      />,
    )
    const chip = screen.getByTestId("order-direction-chip")
    expect(chip.querySelector('[data-icon="ArrowUpRight"]')).toBeTruthy()
    // Nilai tetap exact — tanpa tanda minus/plus tambahan.
    expect(screen.getByTestId("order-card-amount").textContent).toBe("Rp1.500.000")
  })

  it("tanpa peran: tanpa chip arah (perilaku lama, tidak menebak arah)", () => {
    renderCard(<OrderCard {...base} counterpart={{ name: "Sari Penjual" }} />)
    expect(screen.queryByTestId("order-direction-chip")).toBeNull()
    expect(screen.getByTestId("order-card-amount").textContent).toBe("Rp1.500.000")
  })

  it("badge status memakai label ORDER_STATUS_LABELS + nama lawan tampil", () => {
    renderCard(
      <OrderCard
        {...base}
        status="DISPUTED"
        role="buyer"
        counterpart={{ name: "Sari Penjual" }}
      />,
    )
    expect(screen.getByText("Sengketa")).toBeTruthy()
    expect(screen.getByText("Sari Penjual")).toBeTruthy()
    // Label peran ditulis dari sudut pandang pengguna: pembeli melihat "Penjual".
    expect(screen.getByText("Penjual ·")).toBeTruthy()
  })

  it("strip tenggat tampil untuk status aktif + ikon jam", () => {
    renderCard(
      <OrderCard
        {...base}
        role="buyer"
        counterpart={{ name: "Sari Penjual" }}
        deadlineAt={Date.now() + 3_600_000}
      />,
    )
    expect(screen.getByText("Batas waktu")).toBeTruthy()
    expect(document.querySelector('[data-icon="Clock"]')).toBeTruthy()
  })

  it("strip tenggat TIDAK tampil untuk status final", () => {
    renderCard(
      <OrderCard
        {...base}
        status="COMPLETED"
        role="buyer"
        counterpart={{ name: "Sari Penjual" }}
        deadlineAt={Date.now() + 3_600_000}
      />,
    )
    expect(screen.queryByText("Batas waktu")).toBeNull()
    expect(screen.getByText("Selesai")).toBeTruthy()
  })
})

describe("orderDirectionConfig (murni — warna masuk/keluar)", () => {
  it("seller = dana masuk: amountTone success, chip success-soft", () => {
    const config = orderDirectionConfig("seller")
    expect(config?.amountTone).toBe("success")
    expect(config?.chipClass).toBe("bg-success-soft")
    expect(config?.iconTone).toBe("success")
    expect(config?.a11y).toBe("Dana masuk")
  })

  it("buyer = dana keluar: amountTone primary (bukan danger), chip primary solid", () => {
    const config = orderDirectionConfig("buyer")
    expect(config?.amountTone).toBe("primary")
    expect(config?.amountTone).not.toBe("danger")
    expect(config?.chipClass).toBe("bg-primary")
    expect(config?.iconTone).toBe("inverse")
    expect(config?.a11y).toBe("Dana keluar")
  })

  it("tanpa peran → null (tanpa chip, tidak menebak arah)", () => {
    expect(orderDirectionConfig(undefined)).toBeNull()
  })
})

// ------------------------------------------------------------------
// 2. Layar Transaksi — tab, filter, pengelompokan, empty state.
// ------------------------------------------------------------------

describe("layar Transaksi (redesign)", () => {
  it("segmen peran berikon + chip status tampil", async () => {
    renderScreen()
    await waitFor(() => expect(mocks.listOrders).toHaveBeenCalled())
    // Segmen peran — Pembeli dulu (mayoritas pengguna escrow).
    expect(screen.getByText("Pembeli")).toBeTruthy()
    expect(screen.getByText("Penjual")).toBeTruthy()
    expect(document.querySelector('[data-icon="ShoppingBag"]')).toBeTruthy()
    expect(document.querySelector('[data-icon="Storefront"]')).toBeTruthy()
    // Blok filter status.
    expect(screen.getByText("Filter status")).toBeTruthy()
    expect(document.querySelector('[data-icon="FunnelSimple"]')).toBeTruthy()
    expect(screen.getByText("Semua status")).toBeTruthy()
    expect(screen.getByText("Aktif")).toBeTruthy()
  })

  it("pemanggilan awal: role=BUYER, tanpa param status", async () => {
    renderScreen()
    await waitFor(() => expect(mocks.listOrders).toHaveBeenCalled())
    const query = mocks.listOrders.mock.calls[0][0] as {
      role?: string
      status?: string
    }
    expect(query.role).toBe("BUYER")
    expect(query.status).toBeUndefined()
  })

  it("daftar dikelompokkan per hari WIB dengan jumlah per kelompok", async () => {
    mocks.listOrders.mockResolvedValueOnce({
      data: [
        order({ id: "o-today", title: "Order hari ini", createdAt: wibNoon(0) }),
        order({ id: "o-yesterday", title: "Order kemarin", createdAt: wibNoon(-1) }),
      ],
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
    })
    renderScreen()
    await waitFor(() => expect(screen.getByText("Order hari ini")).toBeTruthy())
    expect(screen.getByText("Hari ini")).toBeTruthy()
    expect(screen.getByText("Kemarin")).toBeTruthy()
    expect(screen.getByText("Order kemarin")).toBeTruthy()
    // Tiap kelompok menampilkan jumlahnya ("1 transaksi").
    expect(screen.getAllByText("1 transaksi")).toHaveLength(2)
    // Kartu memakai testID order-card.
    expect(screen.getAllByTestId("order-card")).toHaveLength(2)
  })

  it("mengganti segmen peran memanggil setPrefs (refetch via query key)", async () => {
    renderScreen()
    await waitFor(() => expect(mocks.listOrders).toHaveBeenCalled())
    fireEvent.click(screen.getByRole("radio", { name: "Penjual" }))
    expect(mocks.setPrefs).toHaveBeenCalledWith({ transactionsTab: "seller" })
  })

  it("empty state saat belum ada transaksi (peran pembeli)", async () => {
    renderScreen()
    await waitFor(() => expect(mocks.listOrders).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText("Belum ada transaksi")).toBeTruthy())
    expect(
      screen.getByText("Transaksi Anda sebagai pembeli akan muncul di sini."),
    ).toBeTruthy()
  })

  it("empty state saat filter aktif menawarkan hapus filter", async () => {
    renderScreen()
    await waitFor(() => expect(mocks.listOrders).toHaveBeenCalled())
    fireEvent.click(screen.getByRole("button", { name: "Aktif" }))
    await waitFor(() => expect(screen.getByText("Tidak ada hasil")).toBeTruthy())
    expect(
      screen.getByText("Tidak ada transaksi yang cocok dengan saringan ini."),
    ).toBeTruthy()
    expect(screen.getByText("Hapus filter")).toBeTruthy()
  })
})
