/**
 * Test unit utilitas struk tiket (`lib/receipt.ts`):
 *   - `makeReceiptId`: format + keunikan.
 *   - `RECEIPT_STATUS_LABEL`: empat label status.
 *   - `fetchReceiptToken`: defensif — null bila endpoint belum ada / gagal /
 *     respons tak berbentuk / referenceId kosong (tiket render tanpa QR).
 *   - `receiptQrDataUrl`: data URL PNG bila encode OK, null bila gagal.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const httpMock = {
  get: vi.fn(),
  post: vi.fn(),
}

vi.mock("@/lib/api/client", () => ({ http: httpMock }))

const { fetchReceiptToken, makeReceiptId, receiptQrDataUrl, RECEIPT_STATUS_LABEL } =
  await import("@/lib/receipt")

beforeEach(() => {
  httpMock.get.mockReset()
  httpMock.post.mockReset()
})

describe("RECEIPT_STATUS_LABEL", () => {
  it("memetakan empat varian status ke label struk", () => {
    expect(RECEIPT_STATUS_LABEL).toEqual({
      SUCCESS: "BERHASIL",
      PENDING: "DIPROSES",
      FAILED: "GAGAL",
      REFUND: "REFUND",
    })
  })
})

describe("makeReceiptId", () => {
  it("berformat KHD-<base36 waktu>-<6 karakter acak>", () => {
    const id = makeReceiptId(1_700_000_000_000)
    expect(id).toMatch(/^KHD-[0-9A-Z]+-[0-9A-Z]{6}$/)
  })

  it("unik antar panggilan", () => {
    const ids = new Set(Array.from({ length: 50 }, () => makeReceiptId()))
    expect(ids.size).toBe(50)
  })
})

describe("fetchReceiptToken", () => {
  it("mengembalikan token + verifyUrl bila backend menjawab", async () => {
    httpMock.post.mockResolvedValue({
      token: "tok-123",
      verifyUrl: "https://api.kahade.id/v1/receipts/verify/tok-123",
    })
    const res = await fetchReceiptToken("TRANSFER", "tx-1")
    expect(res).toEqual({
      token: "tok-123",
      verifyUrl: "https://api.kahade.id/v1/receipts/verify/tok-123",
    })
    expect(httpMock.post).toHaveBeenCalledWith(
      "/v1/receipts/token",
      { kind: "TRANSFER", referenceId: "tx-1" },
      expect.objectContaining({ auth: "required" }),
    )
  })

  it("null bila endpoint belum ada (request melempar) — tiket tanpa QR", async () => {
    httpMock.post.mockRejectedValue(new Error("404"))
    await expect(fetchReceiptToken("TOPUP", "pay-1")).resolves.toBeNull()
  })

  it("null bila respons tidak memuat verifyUrl", async () => {
    httpMock.post.mockResolvedValue({ token: "tok-1" })
    await expect(fetchReceiptToken("WITHDRAWAL", "wd-1")).resolves.toBeNull()
    httpMock.post.mockResolvedValue(null)
    await expect(fetchReceiptToken("WITHDRAWAL", "wd-1")).resolves.toBeNull()
  })

  it("tidak memanggil API bila referenceId kosong", async () => {
    await expect(fetchReceiptToken("WALLET_TX", "")).resolves.toBeNull()
    expect(httpMock.post).not.toHaveBeenCalled()
  })
})

describe("receiptQrDataUrl", () => {
  it("menghasilkan data URL PNG dari verifyUrl", async () => {
    const url = await receiptQrDataUrl("https://api.kahade.id/v1/receipts/verify/tok-123")
    expect(url).toMatch(/^data:image\/png;base64,/)
  })

  it("null bila payload kosong", async () => {
    await expect(receiptQrDataUrl("")).resolves.toBeNull()
  })
})
