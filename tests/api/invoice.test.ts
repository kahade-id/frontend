import { describe, expect, it, vi } from "vitest"

vi.mock("react-native", () => ({ Platform: { OS: "web" } }))
vi.mock("@/lib/api/config", () => ({
  API_BASE_URL: "https://api.kahade.id",
  API_TIMEOUT_MS: 1000,
  HEADER_DEVICE_ID: "X-Device-Id",
  HEADER_DEVICE_INFO: "X-Device-Info",
  HEADER_APP_VERSION: "X-App-Version",
  HEADER_PLATFORM: "X-Platform",
}))
vi.mock("@/lib/api/session", () => ({
  getAccessToken: async () => null,
  getRefreshToken: async () => null,
  getSessionRevision: () => 0,
  getDeviceId: async () => "test-device",
  getDeviceInfo: () => "test",
  getAppVersion: () => "1.0.0",
  setAccessToken: vi.fn(),
  setRefreshToken: vi.fn(),
  clearSession: vi.fn(),
  emitSessionExpired: vi.fn(),
}))

import { normalizeInvoice } from "@/lib/api/orders"

const ORDER = {
  id: "ord-1",
  title: "Jasa desain",
  description: "Logo",
  orderType: "SERVICE",
  status: "PAID",
  orderValue: 100000,
  feeResponsibility: "SPLIT",
  deliveryDeadlineDays: 3,
  createdAt: "2026-09-01T00:00:00.000Z",
  buyer: { id: "b", username: "budi" },
  seller: { id: "s", username: "sari" },
}

describe("normalizeInvoice", () => {
  it("menerima bentuk kanonik apa adanya", () => {
    const inv = normalizeInvoice(
      {
        invoiceNumber: "INV-1",
        order: ORDER,
        issuedAt: "2026-09-02T00:00:00.000Z",
        items: [{ label: "Jasa", amount: 100000 }],
        total: 100000,
      },
      "ord-1",
    )
    expect(inv.invoiceNumber).toBe("INV-1")
    expect(inv.total).toBe(100000)
    expect(inv.order.id).toBe("ord-1")
  })
  it("membuka bungkus { invoice } / { data } dan nama kunci alternatif", () => {
    const body = {
      invoice: {
        number: "INV-2",
        orderDetail: { orderId: "ord-9", username: "x" },
        created_at: "2026-09-02T00:00:00.000Z",
        lines: [{ title: "Jasa", price: "50000" }],
        totalAmount: "50000",
      },
    }
    const inv = normalizeInvoice(body, "ord-9")
    expect(inv.invoiceNumber).toBe("INV-2")
    expect(inv.total).toBe(50000)
    expect(inv.items).toEqual([{ label: "Jasa", amount: 50000 }])
    expect(inv.order.id).toBe("ord-9")
  })
  it("total jatuh ke jumlah item; order hilang menjadi placeholder", () => {
    const inv = normalizeInvoice(
      { invoiceNumber: "INV-3", items: [{ label: "A", amount: 3000 }] },
      "ord-3",
    )
    expect(inv.total).toBe(3000)
    expect(inv.order.id).toBe("ord-3")
  })
  it("melempar PARSE untuk body yang bukan invoice", () => {
    expect(() => normalizeInvoice({}, "ord-x")).toThrowError()
    expect(() => normalizeInvoice(null, "ord-x")).toThrowError()
    expect(() => normalizeInvoice({ foo: "bar" }, "ord-x")).toThrowError()
  })
})
