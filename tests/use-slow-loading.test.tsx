/** Audit chat I23 — penanda "memuat terlalu lama" (lib/use-slow-loading). */
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useSlowLoading } from "@/lib/use-slow-loading"

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe("useSlowLoading", () => {
  it("tidak aktif → tidak pernah lambat", () => {
    const { result } = renderHook(() => useSlowLoading(false, 1000))
    act(() => void vi.advanceTimersByTime(5000))
    expect(result.current).toBe(false)
  })

  it("aktif → baru 'lambat' SETELAH delay", () => {
    const { result } = renderHook(() => useSlowLoading(true, 1000))
    act(() => void vi.advanceTimersByTime(999))
    expect(result.current).toBe(false)
    act(() => void vi.advanceTimersByTime(1))
    expect(result.current).toBe(true)
  })

  it("selesai memuat sebelum delay → timer dibatalkan, tidak pernah lambat", () => {
    const { result, rerender } = renderHook(({ active }) => useSlowLoading(active, 1000), {
      initialProps: { active: true },
    })
    act(() => void vi.advanceTimersByTime(500))
    rerender({ active: false })
    act(() => void vi.advanceTimersByTime(5000))
    expect(result.current).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it("selesai memuat sesudah lambat → padam; memuat lagi menghitung dari awal", () => {
    const { result, rerender } = renderHook(({ active }) => useSlowLoading(active, 1000), {
      initialProps: { active: true },
    })
    act(() => void vi.advanceTimersByTime(1500))
    expect(result.current).toBe(true)
    rerender({ active: false })
    expect(result.current).toBe(false)
    rerender({ active: true })
    act(() => void vi.advanceTimersByTime(900))
    expect(result.current).toBe(false)
    act(() => void vi.advanceTimersByTime(100))
    expect(result.current).toBe(true)
  })

  it("ganti token (Coba lagi) mengulang penghitungan: penanda lama tidak ikut terbawa", () => {
    const { result, rerender } = renderHook(
      ({ active, token }) => useSlowLoading(active, 1000, token),
      { initialProps: { active: true, token: 1 } },
    )
    act(() => void vi.advanceTimersByTime(1500))
    expect(result.current).toBe(true)
    // Percobaan baru: shimmer lagi sejak detik ini, bukan galat sisa.
    rerender({ active: true, token: 2 })
    expect(result.current).toBe(false)
    act(() => void vi.advanceTimersByTime(999))
    expect(result.current).toBe(false)
    act(() => void vi.advanceTimersByTime(1))
    expect(result.current).toBe(true)
  })
})
