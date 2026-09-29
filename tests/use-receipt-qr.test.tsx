/**
 * D1-007 (perf 2026-09-29): QR struk lazy + cache sesi.
 * - `enabled: false` -> TIDAK ada POST token / encode QR.
 * - Mount kedua dengan (kind, referenceId) sama -> TIDAK ada fetch ulang.
 * - Kegagalan TIDAK di-cache -> retry boleh fetch lagi.
 * - referenceId null -> tidak fetch.
 */
import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const fetchReceiptToken = vi.fn()
const receiptQrDataUrl = vi.fn()

vi.mock("@/lib/receipt", () => ({ fetchReceiptToken, receiptQrDataUrl }))

const { useReceiptQrState } = await import("@/components/receipt/use-receipt-qr")

beforeEach(() => {
  fetchReceiptToken.mockReset()
  receiptQrDataUrl.mockReset()
  fetchReceiptToken.mockResolvedValue({ token: "tok", verifyUrl: "https://x/verify" })
  receiptQrDataUrl.mockResolvedValue("data:image/png;base64,AAA")
})

describe("useReceiptQrState (D1-007)", () => {
  it("tidak fetch bila enabled=false (struk belum dibuka)", () => {
    const { result } = renderHook(() =>
      useReceiptQrState("ORDER_PAYMENT", "order-lazy-1", { enabled: false }),
    )
    expect(result.current.dataUrl).toBeNull()
    expect(result.current.failed).toBe(false)
    expect(fetchReceiptToken).not.toHaveBeenCalled()
    expect(receiptQrDataUrl).not.toHaveBeenCalled()
  })

  it("fetch sekali lalu dataUrl terisi (enabled default true)", async () => {
    const { result } = renderHook(() => useReceiptQrState("TOPUP", "topup-ok-1"))
    await waitFor(() => expect(result.current.dataUrl).toBe("data:image/png;base64,AAA"))
    expect(fetchReceiptToken).toHaveBeenCalledTimes(1)
    expect(fetchReceiptToken).toHaveBeenCalledWith("TOPUP", "topup-ok-1")
    expect(receiptQrDataUrl).toHaveBeenCalledTimes(1)
  })

  it("mount kedua (kind, referenceId) sama tidak fetch ulang (cache sesi)", async () => {
    const first = renderHook(() => useReceiptQrState("TRANSFER", "tx-cache-1"))
    await waitFor(() => expect(first.result.current.dataUrl).not.toBeNull())
    const callsAfterFirst = fetchReceiptToken.mock.calls.length
    const second = renderHook(() => useReceiptQrState("TRANSFER", "tx-cache-1"))
    await waitFor(() => expect(second.result.current.dataUrl).not.toBeNull())
    expect(fetchReceiptToken.mock.calls.length).toBe(callsAfterFirst)
    expect(receiptQrDataUrl.mock.calls.length).toBe(callsAfterFirst)
    first.unmount()
    second.unmount()
  })

  it("kegagalan tidak di-cache: retry boleh fetch lagi", async () => {
    fetchReceiptToken.mockResolvedValueOnce(null)
    const { result } = renderHook(() => useReceiptQrState("WITHDRAWAL", "wd-fail-1"))
    await waitFor(() => expect(result.current.failed).toBe(true))
    expect(result.current.dataUrl).toBeNull()
    const calls = fetchReceiptToken.mock.calls.length
    act(() => {
      result.current.retry()
    })
    await waitFor(() => expect(fetchReceiptToken.mock.calls.length).toBe(calls + 1))
    await waitFor(() => expect(result.current.dataUrl).toBe("data:image/png;base64,AAA"))
    expect(result.current.failed).toBe(false)
  })

  it("referenceId null tidak fetch", () => {
    renderHook(() => useReceiptQrState("WALLET_TX", null))
    expect(fetchReceiptToken).not.toHaveBeenCalled()
    expect(receiptQrDataUrl).not.toHaveBeenCalled()
  })

  it("mount pertama unmount saat in-flight: mount kedua tetap dapat hasil", async () => {
    let resolveToken: ((v: { token: string; verifyUrl: string }) => void) | null = null
    fetchReceiptToken.mockImplementationOnce(
      () => new Promise((res) => { resolveToken = res }),
    )
    receiptQrDataUrl.mockResolvedValueOnce("data:image/png;base64,SHARED")

    const first = renderHook(() => useReceiptQrState("ORDER_PAYMENT", "shared-inflight-1"))
    const second = renderHook(() => useReceiptQrState("ORDER_PAYMENT", "shared-inflight-1"))
    // Dua mount bersamaan = SATU request (janji in-flight dipakai bersama).
    expect(fetchReceiptToken).toHaveBeenCalledTimes(1)

    // Mount pertama unmount saat request masih terbang — tidak boleh
    // membatalkan fetch bersama.
    first.unmount()
    await act(async () => {
      resolveToken!({ token: "tok", verifyUrl: "https://x/verify" })
    })
    await waitFor(() => expect(second.result.current.dataUrl).toBe("data:image/png;base64,SHARED"))
    second.unmount()
  })
})
