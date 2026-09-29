// @vitest-environment jsdom
/**
 * DanaCheckoutSheet — sheet checkout DANA generik (Mode Tanpa Wallet
 * Internal, BI-safe).
 *
 * Mengunci kontrak sheet generik hasil ekstraksi OrderPaymentSheet:
 * daftar metode dirender DINAMIS dari backend (bukan hardcode), state
 * loading/error/kosong, slot (topExtra, methodAction, intentTopExtra),
 * dan cabang panel intent QRIS. Dipakai ulang untuk checkout order dan
 * langganan Kahade+ — regresi di sini berarti dua alur pecah sekaligus.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { PortalHost, PortalProvider } from "@/components/ui/portal"
import { Text } from "@/components/ui/text"
import { ToastProvider } from "@/components/ui/toast"
import {
  DanaCheckoutSheet,
  type DanaIntentBundle,
} from "@/components/dana-checkout-sheet"
import type { OrderPaymentMethod } from "@/lib/api/orders"

afterEach(cleanup)

function fakePayment(overrides: Record<string, unknown> = {}): DanaIntentBundle {
  return {
    intent: null,
    status: null,
    pollError: null,
    stopped: false,
    creating: false,
    syncing: false,
    syncStatus: async () => null,
    expireLocally: () => {},
    reset: () => {},
    createIntent: async () => false,
    ...overrides,
  } as unknown as DanaIntentBundle
}

function renderSheet(ui: ReactElement) {
  return render(
    <ThemeProvider>
      <PortalProvider>
        <ToastProvider>
          {ui}
          <PortalHost />
        </ToastProvider>
      </PortalProvider>
    </ThemeProvider>,
  )
}

const methods: OrderPaymentMethod[] = [
  { id: "m1", code: "QRIS", name: "QRIS", enabled: true, recommended: true },
  { id: "m2", code: "VA_BCA", name: "Virtual Account BCA", enabled: true },
]

function baseProps(extra: Record<string, unknown> = {}) {
  return {
    open: true,
    onClose: () => {},
    title: "Berlangganan Kahade+",
    methods,
    selectedMethod: null,
    onSelectMethod: () => {},
    methodsLoading: false,
    methodsError: null,
    onRetryMethods: () => {},
    payment: fakePayment(),
    onRequestRecreate: () => {},
    onUseOtherMethod: () => {},
    ...extra,
  }
}

describe("DanaCheckoutSheet", () => {
  it("state loading: memuat metode pembayaran", () => {
    renderSheet(<DanaCheckoutSheet {...baseProps({ methodsLoading: true })} />)
    expect(screen.getByText("Memuat metode pembayaran…")).toBeTruthy()
  })

  it("state error: judul + tombol Coba lagi memanggil onRetryMethods", () => {
    const onRetryMethods = vi.fn()
    renderSheet(
      <DanaCheckoutSheet {...baseProps({ methodsError: "jaringan putus", onRetryMethods })} />,
    )
    expect(screen.getByText("Gagal memuat metode pembayaran")).toBeTruthy()
    expect(screen.getByText("jaringan putus")).toBeTruthy()
    fireEvent.click(screen.getByText("Coba lagi"))
    expect(onRetryMethods).toHaveBeenCalledTimes(1)
  })

  it("state kosong: tidak ada metode → pesan tanpa copy wallet", () => {
    renderSheet(<DanaCheckoutSheet {...baseProps({ methods: [] })} />)
    expect(screen.getByText("Tidak ada metode pembayaran tersedia")).toBeTruthy()
    expect(screen.queryByText(/saldo|dompet|wallet/i)).toBeNull()
  })

  it("metode dirender DINAMIS dari backend — tanpa hardcode nama metode", () => {
    const onSelectMethod = vi.fn()
    renderSheet(<DanaCheckoutSheet {...baseProps({ onSelectMethod })} />)
    expect(screen.getByText("QRIS")).toBeTruthy()
    expect(screen.getByText("Virtual Account BCA")).toBeTruthy()
    expect(screen.getByText(/Disarankan/)).toBeTruthy()
    fireEvent.click(screen.getByText("QRIS"))
    expect(onSelectMethod).toHaveBeenCalledWith("QRIS")
    // Tidak ada opsi saldo/wallet di daftar generik.
    expect(screen.queryByText(/saldo wallet|dompet kahade/i)).toBeNull()
  })

  it("slot topExtra + methodAction dirender saat intent==null", () => {
    renderSheet(
      <DanaCheckoutSheet
        {...baseProps({
          selectedMethod: methods[0],
          topExtra: <Text testID="top-extra">catatan escrow</Text>,
          methodAction: <Text testID="method-action">aksi bayar</Text>,
        })}
      />,
    )
    expect(screen.getByTestId("top-extra")).toBeTruthy()
    expect(screen.getByTestId("method-action")).toBeTruthy()
  })

  it("intent QRIS → panel QRIS + intentTopExtra dirender", () => {
    const payment = fakePayment({
      intent: { method: "QRIS", qrString: "QR-TEST", amount: 99000 },
    })
    renderSheet(
      <DanaCheckoutSheet
        {...baseProps({
          payment,
          selectedMethod: methods[0],
          intentTopExtra: <Text testID="intent-top">catatan intent</Text>,
        })}
      />,
    )
    expect(screen.getByText("Pindai dengan aplikasi pembayaran")).toBeTruthy()
    expect(screen.getByTestId("intent-top")).toBeTruthy()
    // Daftar metode disembunyikan saat intent aktif.
    expect(screen.queryByText("Virtual Account BCA")).toBeNull()
  })

  it("intent VA → panel Virtual Account", () => {
    const payment = fakePayment({
      intent: { method: "VA_BCA", vaNumber: "8800123456", vaBankName: "BCA", amount: 99000 },
    })
    renderSheet(
      <DanaCheckoutSheet {...baseProps({ payment, selectedMethod: methods[1] })} />,
    )
    expect(screen.getByText("8800123456")).toBeTruthy()
  })
})
