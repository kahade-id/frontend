/**
 * B-02/B-03 (audit 2026-09-20): gerbang tamu web di lapisan DATA.
 *
 * Root layout memblokir TAMPILAN layar ber-auth dengan <GuestLoginPrompt>,
 * tetapi layar di baliknya tetap ter-mount — tanpa gerbang di hook data,
 * tamu web menembak endpoint `auth:"required"` tiap deep link/fokus tab
 * (401 → refresh → potensi `expireSession`). Test ini mengunci dua janji:
 *
 *   1. B-03 — di path ber-auth (`isProtectedPath`), `useApiQuery`/
 *      `usePaginatedQuery` tidak menembak request sama sekali; begitu tamu
 *      berpindah ke path publik, query dimuat (gerbang tidak lengket).
 *   2. B-02 — layar yang route-nya TERBUKA untuk tamu tetapi datanya wajib
 *      sesi (tab Dompet/Transaksi/Pengguna) memakai `enabled` eksplisit, dan
 *      saat tertutup hook melaporkan keadaan kosong tanpa error.
 *
 * Environment: vitest.components.config.ts — Platform.OS = "web"
 * (react-native-web) dan `usePathname` dikendalikan `__setPathname()`.
 */
import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Page } from "@/lib/api/response"
import { clearSession, setAccessToken } from "@/lib/api/session"
import { useGuestPathBlocked } from "@/lib/guest-gate"
import { invalidateQueryCache, useApiQuery } from "@/lib/use-api-query"
import { usePaginatedQuery } from "@/lib/use-paginated-query"
import { __setFocused } from "./stubs/react-navigation"
import { __setPathname } from "./stubs/expo-router"

type Row = { id: string }

const page = (rows: Row[]): Page<Row> => ({ data: rows, meta: { page: 1, limit: 20, totalPages: 1 } })

beforeEach(async () => {
  invalidateQueryCache()
  __setFocused(true)
  __setPathname("/")
  await clearSession()
})

describe("B-03: gerbang tamu hanya menutup path ber-auth", () => {
  it("true di layar ber-auth, false di path publik/tab tamu", () => {
    __setPathname("/settings")
    const { result, rerender } = renderHook(() => useGuestPathBlocked())
    expect(result.current).toBe(true)

    // Path yang diizinkan tamu: tab yang memang boleh ditelusuri.
    act(() => __setPathname("/wallet"))
    rerender()
    expect(result.current).toBe(false)

    act(() => __setPathname("/"))
    rerender()
    expect(result.current).toBe(false)
  })

  it("useApiQuery tidak menembak endpoint saat gerbang tertutup, lalu memuat setelah tamu keluar", async () => {
    __setPathname("/order/abc")
    const fetcher = vi.fn(async () => ({ v: 1 }))
    const { result } = renderHook(() =>
      useApiQuery("b03-blocked", fetcher, true, { useCache: false }),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetcher).not.toHaveBeenCalled()
    expect(result.current.error).toBeNull()

    act(() => __setPathname("/"))
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(result.current.data).toEqual({ v: 1 }))
  })

  it("tamu tidak diblokir setelah punya sesi (token dari store sesi)", async () => {
    __setPathname("/settings")
    await act(async () => {
      await setAccessToken("token-tamu")
    })
    const { result } = renderHook(() => useGuestPathBlocked())
    expect(result.current).toBe(false)
  })
})

describe("B-02: gate eksplisit untuk layar tamu ber-data wajib sesi", () => {
  it("usePaginatedQuery dengan enabled:false tidak menembak halaman pertama", async () => {
    const fetcher = vi.fn(async () => page([{ id: "a" }]))
    const { result } = renderHook(() =>
      usePaginatedQuery<Row>("b02-gate", fetcher, { enabled: false }),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetcher).not.toHaveBeenCalled()
    expect(result.current.data).toEqual([])
    expect(result.current.error).toBeNull()
    expect(result.current.hasMore).toBe(false)
  })

  it("query paginasi juga tertutup saat tamu berada di path ber-auth (B-03)", async () => {
    __setPathname("/disputes")
    const fetcher = vi.fn(async () => page([{ id: "a" }]))
    const { result } = renderHook(() =>
      usePaginatedQuery<Row>("b03-paginated", fetcher, { enabled: true }),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetcher).not.toHaveBeenCalled()

    // Tamu membuka tab publik → gerbang terbuka → halaman pertama dimuat.
    act(() => __setPathname("/transactions"))
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
    // Data baru muncul setelah promise halaman pertama selesai.
    await waitFor(() => expect(result.current.data).toHaveLength(1))
  })
})
