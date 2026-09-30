/**
 * NC-005 (audit performa): `usePolling` punya gerbang konektivitas.
 *
 * Saat offline terkonfirmasi, tick DILEWATI (jangan tembak jaringan) lalu
 * jadwalkan ulang — callback pemanggil tidak pernah melihat kegagalan, jadi
 * tidak ada Alert "Tidak ada koneksi" yang berkedip tiap tick. Saat
 * reconnect, polling menembak segera via `onReconnect`.
 *
 * Dijalankan dengan vitest.components.config.ts (jsdom + react-native-web +
 * stub @react-navigation/native — fokus dikendalikan via __setFocused).
 */
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { __setFocused } from "./stubs/react-navigation"

let mockedOffline = false
const reconnectListeners: Array<() => void> = []

vi.mock("@/lib/connectivity", () => ({
  isOfflineKnown: () => mockedOffline,
  onReconnect: (listener: () => void) => {
    reconnectListeners.push(listener)
    return () => {
      const index = reconnectListeners.indexOf(listener)
      if (index >= 0) reconnectListeners.splice(index, 1)
    }
  },
}))

import { usePolling } from "@/lib/use-polling"

beforeEach(() => {
  mockedOffline = false
  reconnectListeners.length = 0
  __setFocused(true)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("NC-005: usePolling gerbang konektivitas", () => {
  it("tick dilewati saat offline — callback tidak pernah dipanggil", async () => {
    mockedOffline = true
    const callback = vi.fn(async () => {})
    renderHook(() => usePolling(callback, 1_000))

    await vi.advanceTimersByTimeAsync(10_000)
    expect(callback).not.toHaveBeenCalled()
  })

  it("reconnect menembak segera (tidak menunggu sisa interval)", async () => {
    mockedOffline = true
    const callback = vi.fn(async () => {})
    renderHook(() => usePolling(callback, 30_000))

    await vi.advanceTimersByTimeAsync(10_000)
    expect(callback).not.toHaveBeenCalled()

    // Koneksi kembali: listener onReconnect dipicu.
    mockedOffline = false
    expect(reconnectListeners.length).toBeGreaterThan(0)
    await act(async () => {
      for (const listener of [...reconnectListeners]) listener()
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it("saat online perilaku tidak berubah — tick terus berjalan", async () => {
    const callback = vi.fn(async () => {})
    renderHook(() => usePolling(callback, 1_000))

    // Jitter ±15% per tick: pakai jendela longgar, bukan kelipatan interval.
    await vi.advanceTimersByTimeAsync(5_000)
    expect(callback.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})
