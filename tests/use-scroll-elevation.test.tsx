/** Test useScrollElevation: efek elevasi header saat scroll. */
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { useScrollElevation } from "@/lib/use-scroll-elevation"

describe("useScrollElevation", () => {
  it("mulai tidak terangkat, terangkat setelah melewati ambang, rata lagi di atas", () => {
    const { result } = renderHook(() => useScrollElevation(8))
    expect(result.current.elevated).toBe(false)

    act(() => result.current.onScrollWorklet(0))
    expect(result.current.elevated).toBe(false)

    act(() => result.current.onScrollWorklet(8))
    expect(result.current.elevated).toBe(false)

    act(() => result.current.onScrollWorklet(9))
    expect(result.current.elevated).toBe(true)

    act(() => result.current.onScrollWorklet(500))
    expect(result.current.elevated).toBe(true)

    act(() => result.current.onScrollWorklet(2))
    expect(result.current.elevated).toBe(false)
  })

  it("menghormati threshold kustom", () => {
    const { result } = renderHook(() => useScrollElevation(100))
    act(() => result.current.onScrollWorklet(50))
    expect(result.current.elevated).toBe(false)
    act(() => result.current.onScrollWorklet(101))
    expect(result.current.elevated).toBe(true)
  })
})
