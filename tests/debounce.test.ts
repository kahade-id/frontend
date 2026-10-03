/**
 * P2 (audit perf/UX 2026-10-03): primitif debounce trailing untuk penulisan
 * rute terakhir (SecureStore) — dipakai `saveLastNativeRouteDebounced`.
 *
 * Yang dikunci:
 *   - hanya nilai TERAKHIR dalam jendela yang ditulis, sekali;
 *   - `flush()` mengirim segera (app masuk background sebelum timer menyala);
 *   - `cancel()` membuang tanpa mengirim;
 *   - tidak ada timer menggantung setelah flush/cancel.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createTrailingDebounce } from "@/lib/debounce"

describe("createTrailingDebounce", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("menggabungkan panggilan beruntun menjadi satu penulisan nilai terakhir", () => {
    const writes: string[] = []
    const debounce = createTrailingDebounce<string>((v) => writes.push(v), 500)

    debounce.call("/showcase")
    debounce.call("/transactions")
    debounce.call("/chat")

    expect(writes).toEqual([])
    expect(debounce.pending).toBe(true)

    vi.advanceTimersByTime(499)
    expect(writes).toEqual([])

    vi.advanceTimersByTime(1)
    expect(writes).toEqual(["/chat"])
    expect(debounce.pending).toBe(false)
  })

  it("penulisan berikutnya menunggu jendela sendiri", () => {
    const writes: string[] = []
    const debounce = createTrailingDebounce<string>((v) => writes.push(v), 500)

    debounce.call("/a")
    vi.advanceTimersByTime(500)
    debounce.call("/b")
    vi.advanceTimersByTime(500)

    expect(writes).toEqual(["/a", "/b"])
  })

  it("flush mengirim segera dan membatalkan timer", () => {
    const writes: string[] = []
    const debounce = createTrailingDebounce<string>((v) => writes.push(v), 500)

    debounce.call("/notifications")
    debounce.flush()

    expect(writes).toEqual(["/notifications"])
    expect(debounce.pending).toBe(false)
    // Timer tidak boleh menyala lagi setelah flush.
    vi.advanceTimersByTime(1000)
    expect(writes).toEqual(["/notifications"])
  })

  it("flush tanpa panggilan tertunda tidak menulis apa pun", () => {
    const writes: string[] = []
    const debounce = createTrailingDebounce<string>((v) => writes.push(v), 500)
    debounce.flush()
    expect(writes).toEqual([])
  })

  it("cancel membuang nilai tertunda", () => {
    const writes: string[] = []
    const debounce = createTrailingDebounce<string>((v) => writes.push(v), 500)

    debounce.call("/rahasia")
    debounce.cancel()
    vi.advanceTimersByTime(1000)

    expect(writes).toEqual([])
    expect(debounce.pending).toBe(false)
  })
})
