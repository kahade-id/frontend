/**
 * R1-002 (2026-09-29, audit render-perf): ui-prefs — emit hemat + selector
 * per-key + emitter terpisah.
 *
 * Yang diuji:
 * 1. `setUiPrefs` dengan patch no-op TIDAK membangunkan subscriber.
 * 2. `setUiPrefs` dengan perubahan membangunkan subscriber (tetap reaktif).
 * 3. Tulis key lain TIDAK me-render ulang subscriber `useUiPref` key berbeda.
 * 4. `recordRecentRecipient` TIDAK membangunkan subscriber prefs
 *    (emitter terpisah) — tapi membangunkan subscriber recents.
 * 5. `useDataSaver` per-key: tulis preferensi lain tidak me-render ulang.
 */
import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  recordRecentRecipient,
  resetUiPrefsForTest,
  setUiPrefs,
  useDataSaver,
  useRecentRecipients,
  useUiPref,
} from "@/lib/ui-prefs"

beforeEach(() => {
  resetUiPrefsForTest()
  vi.clearAllMocks()
})

describe("R1-002 setUiPrefs emit-on-change", () => {
  it("patch no-op tidak membangunkan subscriber", () => {
    let renders = 0
    const { result } = renderHook(() => {
      renders++
      return useUiPref("dataSaver")
    })
    expect(result.current).toBe(false)
    const before = renders
    // dataSaver sudah false → no-op, tidak boleh ada render ulang.
    act(() => setUiPrefs({ dataSaver: false }))
    act(() => setUiPrefs({}))
    expect(renders).toBe(before)
  })

  it("patch yang mengubah nilai tetap membangunkan subscriber", () => {
    let renders = 0
    const { result } = renderHook(() => {
      renders++
      return useUiPref("dataSaver")
    })
    const before = renders
    act(() => setUiPrefs({ dataSaver: true }))
    expect(result.current).toBe(true)
    expect(renders).toBeGreaterThan(before)
  })

  it("tulis key lain tidak me-render ulang subscriber key berbeda", () => {
    let renders = 0
    const { result } = renderHook(() => {
      renders++
      return useUiPref("dataSaver")
    })
    const before = renders
    act(() => setUiPrefs({ balanceHidden: true }))
    act(() => setUiPrefs({ showcaseFeedTab: "latest" }))
    expect(result.current).toBe(false)
    expect(renders).toBe(before)
  })
})

describe("R1-002 emitter recents terpisah dari prefs", () => {
  it("recordRecentRecipient tidak membangunkan subscriber prefs", () => {
    let renders = 0
    renderHook(() => {
      renders++
      return useUiPref("dataSaver")
    })
    const before = renders
    act(() =>
      recordRecentRecipient({ id: "u1", name: "A", username: "a" }),
    )
    expect(renders).toBe(before)
  })

  it("recordRecentRecipient membangunkan subscriber recents", () => {
    const { result } = renderHook(() => useRecentRecipients())
    expect(result.current).toHaveLength(0)
    act(() =>
      recordRecentRecipient({ id: "u1", name: "A", username: "a" }),
    )
    expect(result.current).toHaveLength(1)
    expect(result.current[0]?.id).toBe("u1")
  })

  it("setUiPrefs tidak membangunkan subscriber recents", () => {
    let renders = 0
    renderHook(() => {
      renders++
      return useRecentRecipients()
    })
    const before = renders
    act(() => setUiPrefs({ dataSaver: true }))
    expect(renders).toBe(before)
  })
})

describe("R1-002 useDataSaver selector per-key", () => {
  it("tulis preferensi lain tidak me-render ulang consumer dataSaver", () => {
    let renders = 0
    const { result } = renderHook(() => {
      renders++
      return useDataSaver()
    })
    const before = renders
    act(() => setUiPrefs({ balanceHidden: true }))
    act(() => setUiPrefs({ showcaseFeedTab: "popular" }))
    expect(result.current).toBe(false)
    expect(renders).toBe(before)
    act(() => setUiPrefs({ dataSaver: true }))
    expect(result.current).toBe(true)
    expect(renders).toBeGreaterThan(before)
  })
})
