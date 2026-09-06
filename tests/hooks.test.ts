// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
// useApiQuery memakai useIsFocused (@react-navigation/native) untuk opsi
// refreshOnFocus. Mock konsisten dengan tests/polling.test.ts: tanpa ini,
// impor asli menarik react-native-safe-area-context → berkas Flow
// `react-native/Libraries/...` yang tidak bisa di-parse Node. `focused`
// dikontrol test untuk mensimulasikan pindah tab.
const navigation = vi.hoisted(() => ({ focused: true }))
vi.mock("@react-navigation/native", () => ({ useIsFocused: () => navigation.focused }))
import { useApiQuery } from "@/lib/use-api-query"
import { usePaginatedQuery } from "@/lib/use-paginated-query"
import { useDebouncedValue } from "@/lib/use-debounced-value"
const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
const page = (ids: string[], totalPages = 3) => ({
  data: ids.map((id) => ({ id })),
  meta: { page: 1, limit: 2, total: 6, totalPages },
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe("latest-query wins", () => {
  it("aborts stale input and ignores responses from fetchers that ignore AbortSignal", async () => {
    const older = deferred<string>()
    const newer = deferred<string>()
    const signals: AbortSignal[] = []
    const hook = renderHook(
      ({ key }) =>
        useApiQuery(key, (signal) => {
          signals.push(signal)
          return key === "a" ? older.promise : newer.promise
        }),
      { initialProps: { key: "a" } },
    )
    hook.rerender({ key: "b" })
    expect(signals[0].aborted).toBe(true)
    await act(async () => newer.resolve("new"))
    await act(async () => older.resolve("stale"))
    expect(hook.result.current.data).toBe("new")
    expect(hook.result.current.loading).toBe(false)
  })
  it("shows an initial failure without needing a previous successful result", async () => {
    const hook = renderHook(() =>
      useApiQuery("error", async () => {
        throw new Error("network")
      }),
    )
    await act(async () => {})
    expect(hook.result.current.error).toBeTruthy()
    expect(hook.result.current.loading).toBe(false)
  })
  it("retains previous data on a failed pull-to-refresh", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce("known")
      .mockRejectedValueOnce(new Error("offline"))
    const hook = renderHook(() => useApiQuery("refresh", fetcher))
    await act(async () => {})
    await act(async () => {
      await hook.result.current.refresh()
    })
    expect(hook.result.current.data).toBe("known")
    expect(hook.result.current.error).toBeTruthy()
  })
  it("does not request disabled input and aborts on unmount", async () => {
    const fetcher = vi.fn(() => Promise.resolve(1))
    const hook = renderHook(() => useApiQuery("disabled", fetcher, false))
    expect(fetcher).not.toHaveBeenCalled()
    expect(hook.result.current.loading).toBe(false)
    hook.unmount()
    let signal!: AbortSignal
    const pending = renderHook(() =>
      useApiQuery("pending", (value) => {
        signal = value
        return new Promise(() => {})
      }),
    )
    pending.unmount()
    expect(signal.aborted).toBe(true)
  })
})

describe("refreshOnFocus", () => {
  afterEach(() => {
    cleanup()
    navigation.focused = true
  })

  const refocus = async (hook: { rerender: () => void }) => {
    navigation.focused = false
    await act(async () => {
      hook.rerender()
    })
    navigation.focused = true
    await act(async () => {
      hook.rerender()
    })
    await act(async () => {})
  }

  it("silently refetches when the screen regains focus after the first mount", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce("stale")
      .mockResolvedValueOnce("fresh")
    const hook = renderHook(() =>
      useApiQuery("wallet-balance", fetcher, true, { refreshOnFocus: true }),
    )
    await act(async () => {})
    expect(hook.result.current.data).toBe("stale")
    await refocus(hook)
    // Muat ulang fokus tidak menampilkan skeleton ulang — data berganti diam.
    expect(hook.result.current.loading).toBe(false)
    expect(hook.result.current.data).toBe("fresh")
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it("does not refetch on focus unless the option is set", async () => {
    const fetcher = vi.fn().mockResolvedValue("same")
    const hook = renderHook(() => useApiQuery("static", fetcher))
    await act(async () => {})
    await refocus(hook)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(hook.result.current.data).toBe("same")
  })

  it("does not refetch before any data exists (initial load owns the request)", async () => {
    const fetcher = vi.fn(() => new Promise(() => {}))
    const hook = renderHook(() => useApiQuery("slow", fetcher, true, { refreshOnFocus: true }))
    await act(async () => {})
    await refocus(hook)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
describe("pagination", () => {
  it("serializes load-more and deduplicates rows", async () => {
    const next = deferred<ReturnType<typeof page>>()
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(page(["a", "b"]))
      .mockImplementationOnce(() => next.promise)
    const hook = renderHook(() => usePaginatedQuery("rows", fetcher))
    await act(async () => {})
    act(() => {
      void hook.result.current.loadMore()
      void hook.result.current.loadMore()
    })
    expect(fetcher).toHaveBeenCalledTimes(2)
    await act(async () => next.resolve(page(["b", "c"])))
    expect(hook.result.current.data.map((x) => x.id)).toEqual(["a", "b", "c"])
  })
  it("stops if the server ignores page and returns only known IDs", async () => {
    const hook = renderHook(() => usePaginatedQuery("repeated", async () => page(["a", "b"], 100)))
    await act(async () => {})
    await act(async () => {
      await hook.result.current.loadMore()
    })
    expect(hook.result.current.hasMore).toBe(false)
  })
  it("makes failed load-more retryable without losing rows or skipping a page", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(page(["a", "b"]))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(page(["c"]))
    const hook = renderHook(() => usePaginatedQuery("retry", fetcher))
    await act(async () => {})
    await act(async () => {
      await hook.result.current.loadMore()
    })
    expect(hook.result.current.data).toHaveLength(2)
    expect(hook.result.current.loadMoreError).toBeTruthy()
    await act(async () => {
      await hook.result.current.loadMore()
    })
    expect(fetcher.mock.calls[1][0]).toBe(2)
    expect(fetcher.mock.calls[2][0]).toBe(2)
    expect(hook.result.current.data).toHaveLength(3)
  })
  it("does not merge a late page from the previous filter", async () => {
    const old = deferred<ReturnType<typeof page>>()
    const hook = renderHook(
      ({ filter }) =>
        usePaginatedQuery(filter, () =>
          filter === "old" ? old.promise : Promise.resolve(page(["new"])),
        ),
      { initialProps: { filter: "old" } },
    )
    hook.rerender({ filter: "new" })
    await act(async () => {})
    await act(async () => old.resolve(page(["old"])))
    expect(hook.result.current.data).toEqual([{ id: "new" }])
  })
})
it("coalesces rapid typing and clears its timer on unmount", async () => {
  vi.useFakeTimers()
  const hook = renderHook(({ text }) => useDebouncedValue(text, 300), {
    initialProps: { text: "" },
  })
  hook.rerender({ text: "a" })
  hook.rerender({ text: "abc" })
  expect(hook.result.current).toBe("")
  await act(async () => {
    vi.advanceTimersByTime(300)
  })
  expect(hook.result.current).toBe("abc")
  hook.rerender({ text: "abcd" })
  hook.unmount()
  expect(vi.getTimerCount()).toBe(0)
})
