import type { ReactElement } from "react"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  params: {} as Record<string, string | string[]>,
  orderStatus: vi.fn(),
  subscriptionStatus: vi.fn(),
  replace: vi.fn(),
  poll: undefined as undefined | (() => Promise<void>),
  pollingEnabled: false,
}))

vi.mock("expo-router", async (importOriginal) => ({
  ...await importOriginal<Record<string, unknown>>(),
  useLocalSearchParams: () => ({ ...state.params }), // Expo returns a fresh object each render.
  router: { replace: state.replace },
}))
vi.mock("@/lib/api", () => ({ api: { orders: { getPaymentStatus: state.orderStatus } } }))
vi.mock("@/lib/api/subscription-payments", () => ({ getSubscriptionPaymentStatus: state.subscriptionStatus }))
vi.mock("@/lib/use-polling", () => ({
  usePolling: (poll: () => Promise<void>, _interval: number, enabled: boolean) => {
    state.poll = poll
    state.pollingEnabled = enabled
  },
}))

import { ThemeProvider } from "@/components/theme-provider"
import PaymentFinishScreen from "@/app/payment/finish"

const themed = (ui: ReactElement) => <ThemeProvider>{ui}</ThemeProvider>

beforeEach(() => {
  vi.clearAllMocks()
  state.params = {}
  state.poll = undefined
  state.pollingEnabled = false
  state.orderStatus.mockResolvedValue({ status: "UNKNOWN", isPaid: false })
  state.subscriptionStatus.mockResolvedValue({ status: "UNKNOWN", isPaid: false })
})
afterEach(cleanup)

describe("A1 — PaymentFinishScreen", () => {
  it.each([{}, { status: "success" }, { status: "pending" }, { status: "failed" }, { status: "malformed" }])(
    "missing payment ID never claims a payment status: %j", async (params) => {
      state.params = params as Record<string, string | string[]>
      render(themed(<PaymentFinishScreen />))
      expect(await screen.findByText("Status pembayaran belum diketahui")).toBeTruthy()
      expect(state.orderStatus).not.toHaveBeenCalled()
      expect(state.subscriptionStatus).not.toHaveBeenCalled()
      expect(screen.queryByText("Pembayaran berhasil")).toBeNull()
      expect(screen.queryByText("Pembayaran gagal")).toBeNull()
      expect(screen.queryByText("Menunggu konfirmasi")).toBeNull()
      expect(state.pollingEnabled).toBe(false)
      fireEvent.click(screen.getByRole("button", { name: "Cek status di Transaksi" }))
      expect(state.replace).toHaveBeenCalledWith("/transactions")
    },
  )

  it("does not show pending or success while the API verification is unresolved", async () => {
    state.params = { orderId: "ord-1", status: "pending" }
    let resolve!: (value: { status: string }) => void
    state.orderStatus.mockReturnValue(new Promise((done) => { resolve = done }))
    render(themed(<PaymentFinishScreen />))
    expect(screen.getByText("Memverifikasi pembayaran…")).toBeTruthy()
    expect(screen.queryByText("Menunggu konfirmasi")).toBeNull()
    expect(screen.queryByText("Pembayaran berhasil")).toBeNull()
    await act(async () => resolve({ status: "PAID" }))
    expect(await screen.findByText("Pembayaran berhasil")).toBeTruthy()
  })

  it.each([
    ["PENDING", "Menunggu konfirmasi", true],
    ["PAID", "Pembayaran berhasil", false],
    ["FAILED", "Pembayaran gagal", false],
    ["UNKNOWN", "Status pembayaran belum diketahui", false],
    ["REFUNDED", "Status pembayaran belum diketahui", false],
  ])("uses only verified order status %s", async (status, label, polling) => {
    state.params = { orderId: "ord-1", status: "success" }
    state.orderStatus.mockResolvedValue({ status })
    const { rerender } = render(themed(<PaymentFinishScreen />))
    expect(await screen.findByText(label as string)).toBeTruthy()
    expect(state.pollingEnabled).toBe(polling)
    rerender(themed(<PaymentFinishScreen />))
    await act(async () => {})
    expect(state.orderStatus).toHaveBeenCalledTimes(1)
    expect(state.orderStatus).toHaveBeenCalledWith("ord-1")
  })

  it("an API failure keeps status unknown and manual recheck actually calls the API", async () => {
    state.params = { orderId: "ord-1", status: "success" }
    state.orderStatus.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ status: "PAID" })
    render(themed(<PaymentFinishScreen />))
    expect(await screen.findByText("Status pembayaran belum diketahui")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Coba bayar lagi" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Cek status pembayaran" }))
    expect(await screen.findByText("Pembayaran berhasil")).toBeTruthy()
    expect(state.orderStatus).toHaveBeenCalledTimes(2)
  })

  it("an unknown subscription response is never labeled failed", async () => {
    state.params = { subscriptionId: "sub-1", status: "failed" }
    render(themed(<PaymentFinishScreen />))
    expect(await screen.findByText("Status pembayaran belum diketahui")).toBeTruthy()
    expect(state.subscriptionStatus).toHaveBeenCalledWith("sub-1")
    expect(screen.queryByRole("button", { name: "Coba bayar lagi" })).toBeNull()
  })

  it("verified ACTIVE subscription is the only successful subscription status", async () => {
    state.params = { subscriptionId: "sub-1" }
    state.subscriptionStatus.mockResolvedValue({ status: "ACTIVE", isPaid: true })
    render(themed(<PaymentFinishScreen />))
    expect(await screen.findByText("Pembayaran berhasil")).toBeTruthy()
  })

  it("a stale response cannot overwrite a different payment target", async () => {
    let resolveOld!: (value: { status: string }) => void
    state.params = { orderId: "old" }
    state.orderStatus.mockReturnValueOnce(new Promise((done) => { resolveOld = done })).mockResolvedValueOnce({ status: "FAILED" })
    const { rerender } = render(themed(<PaymentFinishScreen />))
    state.params = { orderId: "new" }
    rerender(themed(<PaymentFinishScreen />))
    expect(await screen.findByText("Pembayaran gagal")).toBeTruthy()
    await act(async () => resolveOld({ status: "PAID" }))
    expect(screen.queryByText("Pembayaran berhasil")).toBeNull()
    expect(screen.getByText("Pembayaran gagal")).toBeTruthy()
  })

  it("pending polls stop once the backend confirms payment", async () => {
    state.params = { orderId: "ord-1" }
    state.orderStatus.mockResolvedValueOnce({ status: "PENDING" }).mockResolvedValueOnce({ status: "PAID" })
    render(themed(<PaymentFinishScreen />))
    await screen.findByText("Menunggu konfirmasi")
    expect(state.pollingEnabled).toBe(true)
    await act(async () => { await state.poll?.() })
    await waitFor(() => expect(state.pollingEnabled).toBe(false))
    expect(screen.getByText("Pembayaran berhasil")).toBeTruthy()
  })
})
