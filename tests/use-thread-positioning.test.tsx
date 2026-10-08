/**
 * Audit chat I23 — penempatan posisi awal thread (lib/use-thread-positioning).
 *
 * Yang dikunci: shimmer penutup BENAR-BENAR dilepas (tidak mungkin menggantung),
 * gulir ke ujung diulang selama konten masih berubah ukuran, dan hanya muat awal
 * (begin) yang menutup list.
 */
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  POSITION_MAX_RESCROLLS,
  POSITION_QUIET_MS,
  POSITION_SAFETY_MS,
  POSITION_START_DELAY_MS,
  useThreadPositioning,
} from "@/lib/use-thread-positioning"

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms))

describe("useThreadPositioning", () => {
  it("diam sebelum begin(): tidak menutup list dan tidak menggulir", () => {
    const scroll = vi.fn()
    const { result } = renderHook(() => useThreadPositioning(scroll))
    expect(result.current.positioning).toBe(false)
    act(() => result.current.onContentSizeChange())
    advance(2000)
    expect(scroll).not.toHaveBeenCalled()
    expect(result.current.positioning).toBe(false)
  })

  it("begin(): menutup, menunggu satu frame layout, menggulir sekali, lalu melepas setelah hening", () => {
    const scroll = vi.fn()
    const { result } = renderHook(() => useThreadPositioning(scroll))
    act(() => result.current.begin())
    expect(result.current.positioning).toBe(true)

    advance(POSITION_START_DELAY_MS - 1)
    expect(scroll).not.toHaveBeenCalled()
    advance(1)
    expect(scroll).toHaveBeenCalledTimes(1)
    expect(result.current.positioning).toBe(true) // masih menunggu hening

    advance(POSITION_QUIET_MS - 1)
    expect(result.current.positioning).toBe(true)
    advance(1)
    expect(result.current.positioning).toBe(false)
  })

  it("perubahan ukuran konten SEBELUM gulir pertama diabaikan (frame layout belum selesai)", () => {
    const scroll = vi.fn()
    const { result } = renderHook(() => useThreadPositioning(scroll))
    act(() => result.current.begin())
    act(() => result.current.onContentSizeChange())
    expect(scroll).not.toHaveBeenCalled()
  })

  it("ukuran konten berubah SESUDAH gulir pertama → gulir ulang ke ujung dan hening diulang", () => {
    const scroll = vi.fn()
    const { result } = renderHook(() => useThreadPositioning(scroll))
    act(() => result.current.begin())
    advance(POSITION_START_DELAY_MS)
    expect(scroll).toHaveBeenCalledTimes(1)

    // Baris di ujung ter-mount & terukur → tinggi berubah → gulir ulang.
    advance(100)
    act(() => result.current.onContentSizeChange())
    expect(scroll).toHaveBeenCalledTimes(2)
    // Penghitung hening mulai dari awal lagi.
    advance(POSITION_QUIET_MS - 1)
    expect(result.current.positioning).toBe(true)
    advance(1)
    expect(result.current.positioning).toBe(false)
  })

  it("batas keras: konten yang terus berubah tidak menahan shimmer melewati POSITION_SAFETY_MS", () => {
    const scroll = vi.fn()
    const { result } = renderHook(() => useThreadPositioning(scroll))
    act(() => result.current.begin())
    advance(POSITION_START_DELAY_MS)
    // Event ukuran datang tiap 100 ms (lebih rapat dari hening 150 ms) tanpa henti.
    for (let t = POSITION_START_DELAY_MS; t < POSITION_SAFETY_MS - 100; t += 100) {
      advance(100)
      act(() => result.current.onContentSizeChange())
    }
    expect(result.current.positioning).toBe(true)
    advance(POSITION_SAFETY_MS)
    expect(result.current.positioning).toBe(false)
  })

  it("batas keras tanpa event layout sama sekali: dilepas oleh pengaman", () => {
    const scroll = vi.fn()
    const { result } = renderHook(() => useThreadPositioning(scroll))
    act(() => result.current.begin())
    // Tak ada onContentSizeChange; gulir pertama jalan, hening lepas dulu (≈250 ms).
    advance(POSITION_SAFETY_MS)
    expect(result.current.positioning).toBe(false)
  })

  it("gulir ulang dibatasi POSITION_MAX_RESCROLLS", () => {
    const scroll = vi.fn()
    const { result } = renderHook(() => useThreadPositioning(scroll))
    act(() => result.current.begin())
    advance(POSITION_START_DELAY_MS)
    for (let i = 0; i < POSITION_MAX_RESCROLLS + 5; i++) act(() => result.current.onContentSizeChange())
    // 1 gulir awal + paling banyak MAX gulir ulang.
    expect(scroll).toHaveBeenCalledTimes(1 + POSITION_MAX_RESCROLLS)
  })

  it("setelah dilepas: perubahan ukuran (pesan baru, gambar selesai dimuat) TIDAK menggulir paksa", () => {
    const scroll = vi.fn()
    const { result } = renderHook(() => useThreadPositioning(scroll))
    act(() => result.current.begin())
    advance(POSITION_SAFETY_MS)
    expect(result.current.positioning).toBe(false)
    scroll.mockClear()
    act(() => result.current.onContentSizeChange())
    advance(1000)
    expect(scroll).not.toHaveBeenCalled()
    expect(result.current.positioning).toBe(false)
  })

  it("begin() ulang (muat ulang setelah galat) memulai siklus bersih tanpa timer ganda", () => {
    const scroll = vi.fn()
    const { result } = renderHook(() => useThreadPositioning(scroll))
    act(() => result.current.begin())
    advance(50)
    act(() => result.current.begin())
    advance(POSITION_START_DELAY_MS)
    expect(scroll).toHaveBeenCalledTimes(1)
    advance(POSITION_SAFETY_MS)
    expect(result.current.positioning).toBe(false)
    expect(scroll).toHaveBeenCalledTimes(1)
  })

  it("selalu memakai fungsi gulir TERBARU (ref FlatList bisa berganti)", () => {
    const first = vi.fn()
    const second = vi.fn()
    const { result, rerender } = renderHook(({ fn }) => useThreadPositioning(fn), {
      initialProps: { fn: first },
    })
    act(() => result.current.begin())
    rerender({ fn: second })
    advance(POSITION_START_DELAY_MS)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it("keluar dari layar (unmount) melepas semua timer — tidak ada gulir/state setelahnya", () => {
    const scroll = vi.fn()
    const { result, unmount } = renderHook(() => useThreadPositioning(scroll))
    act(() => result.current.begin())
    unmount()
    advance(POSITION_SAFETY_MS * 2)
    expect(scroll).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
