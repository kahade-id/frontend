/**
 * Kontrak DTO lokasi presisi untuk aksi sensitif (kontrak lintas tim 2026-09-27).
 *
 * Setiap aksi sensitif WAJIB mengirim `deviceLocation` di body request dengan
 * shape `LocationDto` yang valid — dan aksi tetap terkirim (tidak gagal)
 * ketika `getAuthLocation()` mengembalikan `null` (izin ditolak/gagal).
 *
 * `getAuthLocation` di-mock di level `@/lib/location`; `expo-location`
 * sendiri di-stub di vitest.config.ts agar graf impor termuat di Node.
 * Fetch di-stub global; respons hanya perlu 200 — yang diuji adalah body
 * request yang terkirim, bukan normalizer respons.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { clearSession, setAccessToken } from "@/lib/api/session"
import type { LocationDto } from "@/lib/api/types"
import * as accountDeletionApi from "@/lib/api/account-deletion"
import * as authApi from "@/lib/api/auth"
import * as ordersApi from "@/lib/api/orders"
import * as walletApi from "@/lib/api/wallet"

const { mockGetAuthLocation } = vi.hoisted(() => ({ mockGetAuthLocation: vi.fn() }))

vi.mock("@/lib/location", () => ({
  getAuthLocation: mockGetAuthLocation,
}))

// ------------------------------------------------------------------
// Util
// ------------------------------------------------------------------

type FetchCall = { url: string; init: RequestInit }

function installFetch() {
  const calls: FetchCall[] = []
  const impl = vi.fn(async (input: unknown, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} })
    return new Response(JSON.stringify({ success: true, data: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  })
  vi.stubGlobal("fetch", impl)
  return calls
}

const FIXTURE_LOCATION: LocationDto = {
  latitude: -6.2088,
  longitude: 106.8456,
  accuracy: 12.5,
  timestamp: "2026-09-27T07:05:00.000Z",
  source: "gps",
}

/** Validasi shape LocationDto sesuai tipe di `@/lib/api/types`. */
function expectValidLocationShape(value: unknown) {
  expect(value).toBeTypeOf("object")
  const loc = value as Record<string, unknown>
  expect(loc.latitude).toBeTypeOf("number")
  expect(Number.isFinite(loc.latitude)).toBe(true)
  expect(loc.longitude).toBeTypeOf("number")
  expect(Number.isFinite(loc.longitude)).toBe(true)
  if (loc.accuracy !== undefined) expect(loc.accuracy).toBeTypeOf("number")
  if (loc.timestamp !== undefined) expect(loc.timestamp).toBeTypeOf("string")
  if (loc.source !== undefined) expect(loc.source).toBeTypeOf("string")
}

type Action = { name: string; path: string; run: () => Promise<unknown> }

const ACTIONS: Action[] = [
  {
    name: "buat order (checkout)",
    path: "/v1/orders",
    run: () =>
      ordersApi.createOrder({
        role: "BUYER",
        counterpartUsername: "penjual123",
        title: "Kopi arabika 1kg",
        description: "Kopi arabika gayo sangrai medium, kemasan satu kilogram.",
        orderType: "PHYSICAL_GOODS",
        orderValue: 150000,
        deliveryDeadlineDays: 3,
        feeResponsibility: "BUYER",
      }),
  },
  {
    name: "bayar order (masuk escrow, PIN)",
    path: "/v1/orders/o1/pay",
    run: () => ordersApi.payOrder("o1", { pin: "123456" }),
  },
  {
    name: "bayar order (QRIS)",
    path: "/v1/orders/o1/pay-qris",
    run: () => ordersApi.payOrderQris("o1"),
  },
  {
    name: "konfirmasi terima barang (rilis escrow)",
    path: "/v1/orders/o1/complete",
    run: () => ordersApi.completeOrder("o1"),
  },
  {
    name: "batalkan order",
    path: "/v1/orders/o1/cancel",
    run: () => ordersApi.cancelOrder("o1", { reason: "CHANGED_MIND" }),
  },
  {
    name: "buka sengketa",
    path: "/v1/orders/o1/dispute",
    run: () =>
      ordersApi.submitDispute("o1", {
        category: "ITEM_NOT_RECEIVED",
        claim: "Barang tidak kunjung datang setelah dua minggu menunggu.",
      }),
  },
  {
    name: "wallet top-up",
    path: "/v1/wallet/topup",
    run: () => walletApi.createTopup({ amount: 100000, method: "QRIS" }),
  },
  {
    name: "withdraw",
    path: "/v1/wallet/withdraw",
    run: () => walletApi.createWithdraw({ amount: 100000, bankAccountId: "bank1", pin: "123456" }),
  },
  {
    name: "konfirmasi OTP withdraw",
    path: "/v1/wallet/withdraw/confirm-otp",
    run: () => walletApi.confirmWithdrawOtp({ txId: "tx1", otp: "123456" }),
  },
  {
    name: "transfer",
    path: "/v1/wallet/transfer",
    run: () => walletApi.transferFunds({ recipientId: "user2", amount: 50000, pin: "123456" }),
  },
  {
    name: "ganti PIN wallet",
    path: "/v1/wallet/set-pin",
    run: () => walletApi.setWalletPin({ pin: "654321", currentPin: "123456" }),
  },
  {
    name: "ubah nomor HP (minta OTP)",
    path: "/v1/auth/phone-change/request",
    run: () =>
      authApi.requestPhoneChange({ newPhoneNumber: "+6281234567890", currentPassword: "password1" }),
  },
  {
    name: "ubah nomor HP (konfirmasi)",
    path: "/v1/auth/phone-change/confirm",
    run: () => authApi.confirmPhoneChange({ newPhoneNumber: "+6281234567890", code: "123456" }),
  },
  {
    name: "ubah email",
    path: "/v1/auth/correct-email",
    run: () => authApi.correctEmail({ newEmail: "baru@example.com", password: "password1" }),
  },
  {
    name: "hapus akun",
    path: "/v1/users/me/delete-request",
    run: () => accountDeletionApi.requestAccountDeletion({ password: "password1" }),
  },
]

/** Jalankan aksi, abaikan error normalizer respons, kembalikan body request. */
async function captureRequestBody(action: Action) {
  const calls = installFetch()
  await action.run().catch(() => {})
  const call = calls.find((c) => c.url.includes(action.path))
  expect(call, `request ${action.name} (${action.path}) harus terkirim`).toBeDefined()
  return JSON.parse(String(call!.init.body)) as Record<string, unknown>
}

// ------------------------------------------------------------------
// Test
// ------------------------------------------------------------------

beforeEach(async () => {
  await clearSession()
  await setAccessToken("token-uji")
  mockGetAuthLocation.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("deviceLocation dikirim di body aksi sensitif", () => {
  it.each(ACTIONS.map((a) => [a.name, a] as const))(
    "%s: body memuat deviceLocation dengan shape LocationDto yang valid",
    async (_name, action) => {
      mockGetAuthLocation.mockResolvedValue(FIXTURE_LOCATION)
      const body = await captureRequestBody(action)
      expect(body).toHaveProperty("deviceLocation")
      expectValidLocationShape(body.deviceLocation)
      expect(body.deviceLocation).toEqual(FIXTURE_LOCATION)
    },
  )

  it.each(ACTIONS.map((a) => [a.name, a] as const))(
    "%s: aksi tetap terkirim bila lokasi null (izin ditolak)",
    async (_name, action) => {
      mockGetAuthLocation.mockResolvedValue(null)
      const body = await captureRequestBody(action)
      expect(body).toHaveProperty("deviceLocation")
      expect(body.deviceLocation).toBeNull()
    },
  )

  it("getAuthLocation dipanggil tepat sekali per aksi (tidak spam prompt)", async () => {
    mockGetAuthLocation.mockResolvedValue(FIXTURE_LOCATION)
    await captureRequestBody(ACTIONS[0])
    expect(mockGetAuthLocation).toHaveBeenCalledTimes(1)
  })

  it("getAuthLocation yang throw tetap tidak menggagalkan aksi", async () => {
    // Sabuk pengaman ganda: withDeviceLocation menangkap throw apa pun dari
    // pengambilan lokasi — request tetap terkirim dengan deviceLocation null.
    mockGetAuthLocation.mockRejectedValue(new Error("boom"))
    const calls = installFetch()
    await ACTIONS[3].run().catch(() => {})
    expect(calls.some((c) => c.url.includes(ACTIONS[3].path))).toBe(true)
  })
})
