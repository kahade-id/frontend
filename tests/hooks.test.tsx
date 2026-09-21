/**
 * H-02 (audit 2026-09-20): hook data (`useApiQuery`, `usePaginatedQuery`)
 * adalah tempat bug F-01/F-02/F-03/F-09/F-11 dulu bersembunyi — kini dikunci
 * dengan test: abort saat unmount, retry transient tanpa kedip loading,
 * cache per-key + refresh menembus cache, pemulihan error saat fokus,
 * single-flight loadMore, dan paginasi yang tidak berhenti karena duplikat.
 *
 * Dijalankan dengan vitest.components.config.ts (jsdom + react-native-web +
 * stub @react-navigation/native — fokus dikendalikan via __setFocused).
 */
import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import { ApiError } from "@/lib/api/errors"
import type { Page } from "@/lib/api/response"
import { invalidateQueryCache, useApiQuery } from "@/lib/use-api-query"
import { mergeById, usePaginatedQuery } from "@/lib/use-paginated-query"
import { __setFocused } from "./stubs/react-navigation"

beforeEach(() => {
  invalidateQueryCache()
  __setFocused(true)
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

// ------------------------------------------------------------------
// useApiQuery
// ------------------------------------------------------------------

describe("useApiQuery", () => {
  it("memuat data lalu mematikan loading", async () => {
    const { result } = renderHook(() =>
      useApiQuery("h02-basic", async () => ({ v: 1 }), true, { useCache: false }),
    )
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.data).toEqual({ v: 1 }))
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it("membatalkan request saat unmount (tidak ada setState pasca-unmount)", async () => {
    const gate = deferred<{ v: number }>()
    let captured: AbortSignal | undefined
    const { result, unmount } = renderHook(() =>
      useApiQuery("h02-abort", (signal) => {
        captured = signal
        return gate.promise
      }, true, { useCache: false }),
    )
    await waitFor(() => expect(captured).toBeDefined())
    expect(captured?.aborted).toBe(false)
    unmount()
    expect(captured?.aborted).toBe(true)
    // Respons telat tidak boleh meledak: selesaikan saja promise-nya.
    gate.resolve({ v: 999 })
    expect(result.current.data).toBeNull()
  })

  it("F-11: error transient di-retry otomatis (default 1×) lalu pulih", async () => {
    let calls = 0
    const { result } = renderHook(() =>
      useApiQuery(
        "h02-retry",
        async () => {
          calls += 1
          if (calls === 1) throw new ApiError({ code: "SERVER", message: "gangguan" })
          return { v: calls }
        },
        true,
        { useCache: false },
      ),
    )
    // Backoff 800ms berjalan real-time; waitFor menoleransi.
    await waitFor(() => expect(result.current.data).toEqual({ v: 2 }), { timeout: 4000 })
    expect(calls).toBe(2)
    expect(result.current.error).toBeNull()
  })

  it("error permanen TIDAK di-retry dan pesannya siap tampil", async () => {
    let calls = 0
    const { result } = renderHook(() =>
      useApiQuery(
        "h02-permanent",
        async () => {
          calls += 1
          throw new ApiError({ code: "NOT_FOUND", message: "Data tidak ditemukan." })
        },
        true,
        { useCache: false },
      ),
    )
    await waitFor(() => expect(result.current.error).toBe("Data tidak ditemukan."))
    expect(calls).toBe(1)
    expect(result.current.loading).toBe(false)
  })

  it("F-03: key sama dalam TTL memakai cache; refresh() selalu menembus", async () => {
    let calls = 0
    const fetcher = async () => {
      calls += 1
      return { v: calls }
    }
    const first = renderHook(() => useApiQuery("h02-cache", fetcher))
    await waitFor(() => expect(first.result.current.data).toEqual({ v: 1 }))
    first.unmount()

    const second = renderHook(() => useApiQuery("h02-cache", fetcher))
    await waitFor(() => expect(second.result.current.data).toEqual({ v: 1 }))
    expect(calls).toBe(1) // tidak menembak jaringan lagi

    await act(async () => {
      await second.result.current.refresh()
    })
    expect(calls).toBe(2)
    expect(second.result.current.data).toEqual({ v: 2 })
    second.unmount()
  })

  it("F-02: layar yang GAGAL muat dipulihkan saat kembali fokus", async () => {
    let fail = true
    let calls = 0
    const { result, rerender } = renderHook(() =>
      useApiQuery(
        "h02-focus-error",
        async () => {
          calls += 1
          if (fail) throw new ApiError({ code: "SERVER", message: "gangguan" })
          return { v: calls }
        },
        true,
        { refreshOnFocus: true, useCache: false, retry: 0 },
      ),
    )
    await waitFor(() => expect(result.current.error).toBeTruthy())

    fail = false
    __setFocused(false)
    rerender()
    __setFocused(true)
    rerender()

    await waitFor(() => expect(result.current.data).not.toBeNull())
    expect(result.current.error).toBeNull()
  })

  it("F-01: fokus ulang dengan data → refresh SENYAP (data lama tetap tampil)", async () => {
    let calls = 0
    const { result, rerender } = renderHook(() =>
      useApiQuery(
        "h02-focus-refresh",
        async () => {
          calls += 1
          return { v: calls }
        },
        true,
        { refreshOnFocus: true, useCache: false },
      ),
    )
    await waitFor(() => expect(result.current.data).toEqual({ v: 1 }))

    __setFocused(false)
    rerender()
    __setFocused(true)
    rerender()

    await waitFor(() => expect(result.current.data).toEqual({ v: 2 }))
    expect(calls).toBe(2)
    expect(result.current.loading).toBe(false) // bukan skeleton penuh
  })
})

// ------------------------------------------------------------------
// mergeById + usePaginatedQuery
// ------------------------------------------------------------------

describe("mergeById", () => {
  it("memperbarui entri lama tanpa mengubah urutan, menambah yang baru", () => {
    const merged = mergeById(
      [
        { id: "a", v: 1 },
        { id: "b", v: 1 },
      ],
      [
        { id: "b", v: 2 },
        { id: "c", v: 1 },
      ],
    )
    expect(merged).toEqual([
      { id: "a", v: 1 },
      { id: "b", v: 2 },
      { id: "c", v: 1 },
    ])
  })
})

type Row = { id: string; v: number }
const page = (rows: Row[], totalPages: number, pageNum = 1): Page<Row> => ({
  data: rows,
  meta: { page: pageNum, limit: 2, totalPages },
})

describe("usePaginatedQuery", () => {
  it("loadMore mengakumulasi halaman dan hasMore mengikuti meta server", async () => {
    const { result } = renderHook(() =>
      usePaginatedQuery<Row>("h02-pages", async (p) => {
        if (p === 1) return page([{ id: "a", v: 1 }, { id: "b", v: 1 }], 3, 1)
        if (p === 2) return page([{ id: "c", v: 1 }], 3, 2)
        return page([{ id: "d", v: 1 }], 3, 3)
      }),
    )
    await waitFor(() => expect(result.current.data).toHaveLength(2))
    expect(result.current.hasMore).toBe(true)

    await act(async () => {
      result.current.loadMore()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.data).toHaveLength(3))

    await act(async () => {
      result.current.loadMore()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.data).toHaveLength(4))
    await waitFor(() => expect(result.current.hasMore).toBe(false))
  })

  it("loadMore single-flight: ketukan ganda tidak menembak halaman dua kali", async () => {
    const gate = deferred<Page<Row>>()
    let page2Calls = 0
    const { result } = renderHook(() =>
      usePaginatedQuery<Row>("h02-single-flight", async (p) => {
        if (p === 1) return page([{ id: "a", v: 1 }], 2, 1)
        page2Calls += 1
        return gate.promise
      }),
    )
    await waitFor(() => expect(result.current.data).toHaveLength(1))

    act(() => {
      result.current.loadMore()
      result.current.loadMore()
      result.current.loadMore()
    })
    gate.resolve(page([{ id: "b", v: 1 }], 2, 2))
    await waitFor(() => expect(result.current.data).toHaveLength(2))
    expect(page2Calls).toBe(1)
  })

  it("F-09: halaman penuh duplikat TIDAK menghentikan paginasi", async () => {
    const { result } = renderHook(() =>
      usePaginatedQuery<Row>("h02-dupes", async (p) => {
        if (p === 1) return page([{ id: "a", v: 1 }, { id: "b", v: 1 }], 3, 1)
        if (p === 2) return page([{ id: "a", v: 2 }, { id: "b", v: 2 }], 3, 2) // backend menggeser urutan
        return page([{ id: "c", v: 1 }], 3, 3)
      }),
    )
    await waitFor(() => expect(result.current.data).toHaveLength(2))

    await act(async () => {
      result.current.loadMore()
      await Promise.resolve()
    })
    // duplikat diperbarui in-place, jumlah tetap, paginasi jalan terus
    await waitFor(() => expect(result.current.data).toEqual([
      { id: "a", v: 2 },
      { id: "b", v: 2 },
    ]))
    expect(result.current.hasMore).toBe(true)

    await act(async () => {
      result.current.loadMore()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.data).toHaveLength(3))
  })

  it("loadMore gagal → baris lama TETAP tampil, error terpisah dari error layar", async () => {
    let failPage2 = false
    const { result } = renderHook(() =>
      usePaginatedQuery<Row>("h02-loadmore-error", async (p) => {
        if (p === 1) return page([{ id: "a", v: 1 }], 3, 1)
        if (failPage2) throw new ApiError({ code: "SERVER", message: "gangguan" })
        return page([{ id: "b", v: 1 }], 3, 2)
      }),
    )
    await waitFor(() => expect(result.current.data).toHaveLength(1))

    failPage2 = true
    await act(async () => {
      result.current.loadMore()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.loadMoreError).toBeTruthy())
    expect(result.current.error).toBeNull() // error layar tidak tersentuh
    expect(result.current.data).toHaveLength(1) // baris tidak hilang

    failPage2 = false
    await act(async () => {
      result.current.loadMore()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.data).toHaveLength(2))
    expect(result.current.loadMoreError).toBeNull()
  })

  it("refresh() reset ke halaman 1 tanpa mengosongkan layar (silent)", async () => {
    let version = 1
    const { result } = renderHook(() =>
      usePaginatedQuery<Row>("h02-refresh", async (p) =>
        p === 1
          ? page([{ id: "a", v: version }, { id: "b", v: version }], 2, 1)
          : page([{ id: "c", v: version }], 2, 2),
      ),
    )
    await waitFor(() => expect(result.current.data).toHaveLength(2))
    await act(async () => {
      result.current.loadMore()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.data).toHaveLength(3))

    version = 2
    await act(async () => {
      await result.current.refresh()
    })
    // kembali ke halaman 1 dengan nilai baru; refreshing (bukan loading penuh)
    await waitFor(() => expect(result.current.data).toEqual([
      { id: "a", v: 2 },
      { id: "b", v: 2 },
    ]))
    expect(result.current.refreshing).toBe(false)
    expect(result.current.loading).toBe(false)
  })
})
