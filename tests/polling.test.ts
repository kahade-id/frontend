// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
const navigation = vi.hoisted(() => ({ focused: true }))
const app = vi.hoisted(() => ({
  currentState: "active",
  addEventListener: vi.fn(() => ({ remove: vi.fn() })),
}))
vi.mock("react-native", () => ({ AppState: app, Platform: { OS: "ios" } }))
vi.mock("@react-navigation/native", () => ({ useIsFocused: () => navigation.focused }))
import { usePolling } from "@/lib/use-polling"
beforeEach(() => {
  vi.useFakeTimers()
  navigation.focused = true
  app.currentState = "active"
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})
it("schedules after a request settles, never overlapping slow responses", async () => {
  let finish!: () => void
  const callback = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  renderHook(() => usePolling(callback, 1000))
  await act(async () => {
    vi.advanceTimersByTime(5000)
  })
  expect(callback).toHaveBeenCalledTimes(1)
  await act(async () => {
    finish()
  })
  await act(async () => {
    vi.advanceTimersByTime(1000)
  })
  expect(callback).toHaveBeenCalledTimes(2)
})
it("does not poll a hidden or unfocused screen", async () => {
  navigation.focused = false
  const callback = vi.fn(async () => {})
  const hook = renderHook(() => usePolling(callback, 1000))
  await act(async () => {
    vi.advanceTimersByTime(5000)
  })
  expect(callback).not.toHaveBeenCalled()
  navigation.focused = true
  app.currentState = "background"
  hook.rerender()
  await act(async () => {
    vi.advanceTimersByTime(5000)
  })
  expect(callback).not.toHaveBeenCalled()
})
it("cannot overlap a still-running request after navigation away and back", async () => {
  let finish!: () => void
  const callback = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  const hook = renderHook(() => usePolling(callback, 1000))
  await act(async () => {
    vi.advanceTimersByTime(1000)
  })
  navigation.focused = false
  hook.rerender()
  navigation.focused = true
  hook.rerender()
  await act(async () => {
    vi.advanceTimersByTime(4000)
  })
  expect(callback).toHaveBeenCalledTimes(1)
  await act(async () => {
    finish()
  })
  await act(async () => {
    vi.advanceTimersByTime(1000)
  })
  expect(callback).toHaveBeenCalledTimes(2)
})
it("clears timers and platform subscriptions on unmount", async () => {
  const callback = vi.fn(async () => {})
  const hook = renderHook(() => usePolling(callback, 1000))
  hook.unmount()
  expect(vi.getTimerCount()).toBe(0)
  expect(app.addEventListener.mock.results.at(-1)?.value.remove).toHaveBeenCalled()
})
