/**
 * Test checkout DANA — Mode Tanpa Wallet Internal (BI-safe).
 *
 * Mengunci kontrak:
 * - `normalizeOrderPaymentMethods`: toleran bentuk respons; entri tanpa
 *   code/name dibuang (fail-closed); `enabled` default true.
 * - `normalizeOrderPaymentIntent`: membaca qrString / vaNumber /
 *   redirectUrl dari berbagai alias; tanpa payload yang bisa ditindaklanjuti
 *   → undefined (bukan panel kosong).
 * - `checkoutMethodKind`: category-aware — kode bank asing + category "va"
 *   tetap me-render panel VA; kode/kategori asing → "bank".
 * - `selectDefaultCheckoutMethod`: recommended → pertama yang aktif;
 *   tidak pernah memilih yang disabled; kosong → null.
 * - `resolveCheckoutPaymentMethods`: saldo Kahade hanya disisipkan bila
 *   wallet nyala; backend gagal → fallback DANA statis (ditandai).
 * - `isWalletCheckoutMethod`: hanya "KAHADE_WALLET".
 */
import { describe, expect, it, vi, beforeEach } from "vitest"

import {
  getOrderPaymentMethods,
  normalizeOrderPaymentIntent,
  normalizeOrderPaymentMethods,
  type OrderPaymentMethod,
} from "@/lib/api/orders-endpoints"
import {
  checkoutMethodKind,
  DANA_PAYMENT_METHODS_FALLBACK,
  isWalletCheckoutMethod,
  resolveCheckoutPaymentMethods,
  selectDefaultCheckoutMethod,
  toCheckoutMethodItems,
} from "@/lib/dana-payment"

vi.mock("@/lib/api/orders-endpoints", async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>
  return { ...mod, getOrderPaymentMethods: vi.fn() }
})

const mockGetMethods = vi.mocked(getOrderPaymentMethods)

const method = (overrides: Partial<OrderPaymentMethod> = {}): OrderPaymentMethod => ({
  id: "QRIS",
  code: "QRIS",
  name: "QRIS",
  category: "qris",
  enabled: true,
  ...overrides,
})

describe("normalizeOrderPaymentMethods", () => {
  it("menerima array polos", () => {
    const out = normalizeOrderPaymentMethods([method()])
    expect(out).toHaveLength(1)
    expect(out?.[0].code).toBe("QRIS")
  })

  it("menerima {methods} dan {data:{methods}}", () => {
    expect(normalizeOrderPaymentMethods({ methods: [method()] })?.[0].code).toBe("QRIS")
    expect(normalizeOrderPaymentMethods({ data: { methods: [method()] } })?.[0].code).toBe("QRIS")
  })

  it("membuang entri tanpa code/name (fail-closed)", () => {
    const out = normalizeOrderPaymentMethods([{ code: "X" }, { name: "Y" }, null, method()])
    expect(out).toHaveLength(1)
  })

  it("enabled default true bila absen; membaca alias", () => {
    const out = normalizeOrderPaymentMethods([
      { code: "A", name: "A" },
      { methodCode: "B", label: "B", is_enabled: false },
    ])
    expect(out?.[0].enabled).toBe(true)
    expect(out?.[1]).toMatchObject({ code: "B", name: "B", enabled: false })
  })

  it("bukan array → undefined", () => {
    expect(normalizeOrderPaymentMethods({})).toBeUndefined()
    expect(normalizeOrderPaymentMethods(null)).toBeUndefined()
  })
})

describe("normalizeOrderPaymentIntent", () => {
  it("membaca QR dari alias", () => {
    const out = normalizeOrderPaymentIntent({ data: { qr_string: "QR123", amount: 50000 } })
    expect(out).toMatchObject({ qrString: "QR123", amount: 50000 })
  })

  it("membaca VA dari alias + nama bank", () => {
    const out = normalizeOrderPaymentIntent({
      payment: { virtual_account: "988123", bank_name: "BCA" },
    })
    expect(out).toMatchObject({ vaNumber: "988123", vaBankName: "BCA" })
  })

  it("membaca redirect URL dari alias", () => {
    const out = normalizeOrderPaymentIntent({ result: { payment_url: "https://pay/x" } })
    expect(out).toMatchObject({ redirectUrl: "https://pay/x" })
  })

  it("tanpa payload yang bisa ditindaklanjuti → undefined", () => {
    expect(normalizeOrderPaymentIntent({ data: { amount: 100 } })).toBeUndefined()
    expect(normalizeOrderPaymentIntent({})).toBeUndefined()
    expect(normalizeOrderPaymentIntent(null)).toBeUndefined()
  })

  it("instructions non-string dibuang", () => {
    const out = normalizeOrderPaymentIntent({
      qrString: "QR",
      instructions: ["Buka m-banking", 42, null],
    })
    expect(out?.instructions).toEqual(["Buka m-banking"])
  })
})

describe("checkoutMethodKind", () => {
  it("category-aware: kode asing + category va → bank", () => {
    expect(checkoutMethodKind(method({ code: "BCA_VA", category: "va" }))).toBe("bank")
  })

  it("QRIS → qris; DANA → ewallet; KAHADE_WALLET → balance", () => {
    expect(checkoutMethodKind(method({ code: "QRIS", category: "qris" }))).toBe("qris")
    expect(checkoutMethodKind(method({ code: "DANA", category: "ewallet" }))).toBe("ewallet")
    expect(checkoutMethodKind(method({ code: "KAHADE_WALLET", category: "wallet" }))).toBe("balance")
  })

  it("kode & kategori asing → bank (fail-closed ke pola VA generik)", () => {
    expect(checkoutMethodKind(method({ code: "SOME_NEW_RAIL", category: "mystery" }))).toBe("bank")
  })
})

describe("selectDefaultCheckoutMethod", () => {
  const a = method({ code: "VA_BCA", id: "VA_BCA", name: "VA BCA", category: "va" })
  const b = method({ code: "QRIS", id: "QRIS", recommended: true })
  const c = method({ code: "DANA", id: "DANA", enabled: false, recommended: true })

  it("recommended yang aktif menang", () => {
    expect(selectDefaultCheckoutMethod([a, b])?.code).toBe("QRIS")
  })

  it("tanpa recommended → yang aktif pertama", () => {
    expect(selectDefaultCheckoutMethod([a, { ...b, recommended: false }])?.code).toBe("VA_BCA")
  })

  it("tidak pernah memilih yang disabled", () => {
    expect(selectDefaultCheckoutMethod([c])?.code).toBeUndefined()
    expect(selectDefaultCheckoutMethod([c, a])?.code).toBe("VA_BCA")
  })

  it("kosong → null", () => {
    expect(selectDefaultCheckoutMethod([])).toBeNull()
  })
})

describe("toCheckoutMethodItems", () => {
  it("id = code; kind category-aware; tanpa ikon (diisi lapisan UI)", () => {
    const out = toCheckoutMethodItems([
      method({ code: "QRIS", name: "QRIS", category: "qris" }),
      method({ code: "VA_X", id: "VA_X", name: "VA X", category: "va" }),
    ])
    expect(out[0]).toMatchObject({ id: "QRIS", kind: "qris", name: "QRIS" })
    expect(out[1]).toMatchObject({ id: "VA_X", kind: "bank" })
    expect("icon" in out[0]).toBe(false)
  })
})

describe("resolveCheckoutPaymentMethods", () => {
  beforeEach(() => {
    mockGetMethods.mockReset()
  })

  it("wallet nyala: Saldo Kahade disisipkan di depan", async () => {
    mockGetMethods.mockResolvedValue([method()])
    const { methods, fromFallback } = await resolveCheckoutPaymentMethods("o1", {
      walletEnabled: true,
    })
    expect(fromFallback).toBe(false)
    expect(methods[0].code).toBe("KAHADE_WALLET")
    expect(methods).toHaveLength(2)
  })

  it("wallet mati (BI-safe): tidak ada Saldo Kahade", async () => {
    mockGetMethods.mockResolvedValue([method(), { ...method(), code: "KAHADE_WALLET", id: "KAHADE_WALLET" }])
    const { methods } = await resolveCheckoutPaymentMethods("o1", { walletEnabled: false })
    expect(methods.some((m) => isWalletCheckoutMethod(m.code))).toBe(false)
  })

  it("backend gagal → fallback DANA statis yang ditandai", async () => {
    mockGetMethods.mockRejectedValue(new Error("404"))
    const { methods, fromFallback } = await resolveCheckoutPaymentMethods("o1", {
      walletEnabled: false,
    })
    expect(fromFallback).toBe(true)
    expect(methods.map((m) => m.code)).toEqual(DANA_PAYMENT_METHODS_FALLBACK.map((m) => m.code))
  })

  it("metode disabled dari backend disaring", async () => {
    mockGetMethods.mockResolvedValue([
      method(),
      { ...method(), code: "OFF", id: "OFF", enabled: false },
    ])
    const { methods } = await resolveCheckoutPaymentMethods("o1", { walletEnabled: false })
    expect(methods.some((m) => m.code === "OFF")).toBe(false)
  })
})

describe("isWalletCheckoutMethod", () => {
  it("hanya KAHADE_WALLET", () => {
    expect(isWalletCheckoutMethod("KAHADE_WALLET")).toBe(true)
    expect(isWalletCheckoutMethod("QRIS")).toBe(false)
    expect(isWalletCheckoutMethod("DANA")).toBe(false)
  })
})

describe("kontrak kanonis backend DANA (2026-09-30)", () => {
  it("normalizeOrderPaymentMethods: membaca {kind,label,requiresBankCode,banks}", () => {
    const raw = {
      walletEnabled: false,
      methods: [
        { kind: "QRIS", label: "QRIS", requiresBankCode: false },
        {
          kind: "VA",
          label: "Virtual Account",
          requiresBankCode: true,
          banks: ["BCA", "BNI", "BRI", "MANDIRI", "CIMB", "PERMATA"],
        },
        { kind: "BALANCE", label: "Saldo DANA", requiresBankCode: false },
      ],
    }
    const out = normalizeOrderPaymentMethods(raw)
    expect(out).toHaveLength(3)
    expect(out?.[0]).toMatchObject({ code: "QRIS", name: "QRIS", category: "qris" })
    expect(out?.[1]).toMatchObject({
      code: "VA",
      name: "Virtual Account",
      category: "va",
      requiresBankCode: true,
      banks: ["BCA", "BNI", "BRI", "MANDIRI", "CIMB", "PERMATA"],
    })
    expect(out?.[2]).toMatchObject({ code: "BALANCE", name: "Saldo DANA", category: "ewallet" })
  })

  it("toDanaPayKind: QRIS / VA_BCA / DANA → {payKind,bankCode}", async () => {
    const { toDanaPayKind } = await import("@/lib/api/orders-endpoints")
    expect(toDanaPayKind("QRIS")).toEqual({ payKind: "QRIS" })
    expect(toDanaPayKind("VA_BCA")).toEqual({ payKind: "VA", bankCode: "BCA" })
    expect(toDanaPayKind("VA_MANDIRI")).toEqual({ payKind: "VA", bankCode: "MANDIRI" })
    expect(toDanaPayKind("DANA")).toEqual({ payKind: "BALANCE" })
    expect(toDanaPayKind("VA")).toEqual({ payKind: "VA" })
    expect(() => toDanaPayKind("GOPAY")).toThrow()
  })

  it("normalizePaymentStatus: SUCCESS backend → PAID (memicu onPaid)", async () => {
    const { normalizePaymentStatus } = await import("@/lib/api/orders-endpoints")
    const out = normalizePaymentStatus({ payment: { status: "SUCCESS" } })
    expect(out.status).toBe("PAID")
    expect(out.isPaid).toBe(true)
  })

  it("normalizeOrderPaymentIntent: membaca expiryTime + grossAmount/escrowAmount", () => {
    const out = normalizeOrderPaymentIntent({
      paymentTxId: "tx1",
      status: "PENDING",
      payKind: "QRIS",
      escrowAmount: 100000,
      providerFee: 2500,
      grossAmount: 102500,
      qrString: "QR123",
      expiryTime: "2026-10-01T00:00:00Z",
    })
    expect(out).toMatchObject({
      qrString: "QR123",
      amount: 102500,
      expiresAt: "2026-10-01T00:00:00Z",
      paymentTxId: "tx1",
    })
  })

  it("checkoutMethodKind: BALANCE → ewallet (panel redirect DANA)", () => {
    expect(checkoutMethodKind(method({ code: "BALANCE", category: "ewallet" }))).toBe("ewallet")
  })
})

describe("resolveCheckoutPaymentMethods — ekspansi VA ber-bank", () => {
  beforeEach(() => {
    mockGetMethods.mockReset()
  })

  it("satu metode VA + banks → satu entri per bank", async () => {
    mockGetMethods.mockResolvedValue([
      { id: "QRIS", code: "QRIS", name: "QRIS", category: "qris", enabled: true },
      {
        id: "VA",
        code: "VA",
        name: "Virtual Account",
        category: "va",
        enabled: true,
        requiresBankCode: true,
        banks: ["BCA", "BNI"],
      },
    ])
    const { methods } = await resolveCheckoutPaymentMethods("o1", { walletEnabled: false })
    const codes = methods.map((m) => m.code)
    expect(codes).toEqual(["QRIS", "VA_BCA", "VA_BNI"])
    expect(methods[1]).toMatchObject({ name: "Virtual Account BCA", category: "va" })
  })

  it("entri VA yang sudah per-bank tidak di-expand ganda", async () => {
    mockGetMethods.mockResolvedValue([
      { id: "VA_BCA", code: "VA_BCA", name: "Virtual Account BCA", category: "va", enabled: true },
    ])
    const { methods } = await resolveCheckoutPaymentMethods("o1", { walletEnabled: false })
    expect(methods.map((m) => m.code)).toEqual(["VA_BCA"])
  })
})
