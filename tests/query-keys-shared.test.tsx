/**
 * C-02 (audit 2026-09-20): satu endpoint = satu kunci cache.
 *
 * Temuan C-02 adalah klaim komentar yang tidak benar: `GET /v1/wallet` dibaca
 * di bawah empat kunci berbeda dan `GET /v1/users/me` di bawah tujuh kunci,
 * sehingga "dedupe lintas layar" tidak pernah terjadi dan invalidasi cache
 * tidak bisa menjangkau semua salinan. Setelah kunci dipusatkan di
 * `lib/query-keys.ts` (+ opsi `select` untuk layar yang butuh bentuk lain),
 * dua layar yang memproyeksikan data berbeda harus tetap hanya menembak SATU
 * request. Test ini mengunci janji itu — kalau ada layar baru memakai kunci
 * ad-hoc lagi, di sinilah ia ketahuan.
 */
import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { invalidateQueryCache, useApiQuery } from "@/lib/use-api-query"
import { fetchViaQueryCache } from "@/lib/query-cache"
import { queryKeys } from "@/lib/query-keys"

type WalletResponse = { availableBalance: number; pendingBalance: number }

beforeEach(() => {
  invalidateQueryCache()
})

describe("C-02: kunci per endpoint", () => {
  it("kunci dompet & profil adalah satu string baku (bukan per layar)", () => {
    expect(queryKeys.wallet()).toBe(queryKeys.wallet())
    expect(queryKeys.me()).toBe(queryKeys.me())
    // Bentuknya stabil — kunci inilah yang dipakai invalidasi C-01.
    expect(queryKeys.wallet()).toBe("wallet")
    expect(queryKeys.me()).toBe("me")
  })

  it("dua layar dengan bentuk data berbeda berbagi SATU request lewat `select`", async () => {
    const fetcher = vi.fn(async (): Promise<WalletResponse> => ({
      availableBalance: 1_234,
      pendingBalance: 10,
    }))

    // Layar A butuh seluruh respons (mis. Beranda menampilkan saldo + pending).
    const full = renderHook(() => useApiQuery<WalletResponse>(queryKeys.wallet(), fetcher))
    await waitFor(() => expect(full.result.current.data).not.toBeNull())

    // Layar B hanya butuh saldo (mis. layar Penarikan) — bentuknya diproyeksikan
    // dari respons BAKU yang sudah ada di cache, tanpa request baru.
    const projected = renderHook(() =>
      useApiQuery<WalletResponse, { balance: number }>(queryKeys.wallet(), fetcher, true, {
        select: (raw) => ({ balance: raw.availableBalance }),
      }),
    )
    await waitFor(() => expect(projected.result.current.data).toEqual({ balance: 1_234 }))

    expect(fetcher).toHaveBeenCalledTimes(1)
    // Cache menyimpan bentuk BAKU — proyeksi tidak meracuni pembaca lain.
    expect(full.result.current.data).toEqual({ availableBalance: 1_234, pendingBalance: 10 })
  })

  it("kunci yang berbeda untuk endpoint yang sama memang menembak dua kali (biaya kunci ad-hoc)", async () => {
    const fetcher = vi.fn(async (): Promise<WalletResponse> => ({
      availableBalance: 1,
      pendingBalance: 2,
    }))

    const first = renderHook(() => useApiQuery("wallet-balance", fetcher))
    await waitFor(() => expect(first.result.current.data).not.toBeNull())
    const second = renderHook(() => useApiQuery("wallet-overview", fetcher))
    await waitFor(() => expect(second.result.current.data).not.toBeNull())

    // Ini yang DULU terjadi di produksi untuk satu endpoint. Test ini ada
    // sebagai pembanding: ia gagal kalau dedupe-nya justru rusak.
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it("pemanggil imperatif dan hook berbagi cache yang sama (satu request)", async () => {
    const fetcher = vi.fn(async (): Promise<WalletResponse> => ({
      availableBalance: 99,
      pendingBalance: 0,
    }))

    // Jalur imperatif dulu: header showcase memanggil getMe/getWallet di dalam
    // fungsi async — dulu selalu menembak, tidak pernah melihat cache.
    await fetchViaQueryCache(queryKeys.wallet(), fetcher)

    const hook = renderHook(() => useApiQuery<WalletResponse>(queryKeys.wallet(), fetcher))
    await waitFor(() => expect(hook.result.current.data).not.toBeNull())

    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it("invalidasi setelah mutasi uang membuat pembacaan berikutnya menembak ulang", async () => {
    const fetcher = vi.fn(async (): Promise<WalletResponse> => ({
      availableBalance: fetcher.mock.calls.length,
      pendingBalance: 0,
    }))

    const query = renderHook(() => useApiQuery<WalletResponse>(queryKeys.wallet(), fetcher))
    await waitFor(() => expect(query.result.current.data?.availableBalance).toBe(1))

    // C-01: `lib/api/client.ts` memanggil ini setelah mutasi dompet/order.
    invalidateQueryCache()

    const after = renderHook(() => useApiQuery<WalletResponse>(queryKeys.wallet(), fetcher))
    await waitFor(() => expect(after.result.current.data?.availableBalance).toBe(2))
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
