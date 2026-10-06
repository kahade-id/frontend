import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const disk = vi.hoisted(() => new Map<string, { data: unknown; at: number }>())

vi.mock("@/lib/query-cache-persistence", () => ({
  persistQueryCacheEntry: vi.fn(async (key: string, data: unknown, at: number) => {
    disk.set(key, { data, at })
  }),
  readPersistedQueryCacheEntry: vi.fn(async (key: string) => disk.get(key) ?? null),
  invalidatePersistedQueryCache: vi.fn(async (match?: (key: string) => boolean) => {
    if (!match) disk.clear()
    else for (const key of disk.keys()) if (match(key)) disk.delete(key)
  }),
  flushPersistedQueryCache: vi.fn(async () => undefined),
}))

import { initConnectivity } from "@/lib/connectivity"
import { invalidateQueryCache, useApiQuery } from "@/lib/use-api-query"
import { __setNetInfoState } from "./stubs/netinfo"

beforeEach(async () => {
  disk.clear()
  __setNetInfoState({ type: "wifi", isConnected: true, isInternetReachable: true })
  initConnectivity()
  await Promise.resolve()
  invalidateQueryCache()
})

describe("useApiQuery cache persisten", () => {
  it("menampilkan cache disk saat offline tanpa request atau error", async () => {
    disk.set("hook:offline-disk", { data: { value: "tersimpan" }, at: Date.now() - 60_000 })
    __setNetInfoState({ type: "none", isConnected: false, isInternetReachable: false })
    const fetcher = vi.fn(async () => ({ value: "jaringan" }))

    const { result } = renderHook(() => useApiQuery("hook:offline-disk", fetcher))
    await waitFor(() => expect(result.current.data).toEqual({ value: "tersimpan" }))

    expect(result.current.offline).toBe(true)
    expect(result.current.offlineMiss).toBe(false)
    expect(result.current.error).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("merender disk hit lebih dulu lalu menyegarkan stale data tanpa skeleton", async () => {
    let finish!: (value: { value: string }) => void
    const pending = new Promise<{ value: string }>((resolve) => {
      finish = resolve
    })
    disk.set("hook:swr-disk", { data: { value: "cache lama" }, at: Date.now() - 60_000 })
    const fetcher = vi.fn(() => pending)
    const { result } = renderHook(() => useApiQuery("hook:swr-disk", fetcher))

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
    expect(result.current.data).toEqual({ value: "cache lama" })
    expect(result.current.loading).toBe(false)
    expect(result.current.refreshing).toBe(false)
    expect(result.current.error).toBeNull()

    await act(async () => finish({ value: "data baru" }))
    await waitFor(() => expect(result.current.data).toEqual({ value: "data baru" }))
  })
})
