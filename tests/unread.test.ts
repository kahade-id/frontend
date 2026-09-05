// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
const api = vi.hoisted(() => ({ get: vi.fn(), revision: 0, changed: () => {} }))
vi.mock("@/lib/use-polling", () => ({ usePolling: () => undefined }))
vi.mock("@/lib/api", () => ({
  api: { notifications: { getUnreadCount: api.get } },
  isApiError: () => false,
  readUnreadCount: (value: number) => value,
}))
vi.mock("@/lib/api/session", () => ({
  getSessionRevision: () => api.revision,
  subscribeSession: (listener: () => void) => {
    api.changed = listener
    return () => {}
  },
}))
import {
  refreshUnreadCount,
  resetUnreadCount,
  setUnreadCount,
  useUnreadCountState,
} from "@/lib/unread-count"
beforeEach(() => {
  resetUnreadCount()
  api.get.mockReset()
})
afterEach(cleanup)
it("deduplicates overlapping requests", async () => {
  const hook = renderHook(useUnreadCountState)
  api.get.mockResolvedValue(3)
  await act(async () => {
    const first = refreshUnreadCount()
    expect(refreshUnreadCount()).toBe(first)
    await first
  })
  expect(api.get).toHaveBeenCalledTimes(1)
  expect(hook.result.current.count).toBe(3)
})
it("cannot show a previous account's unread count after switching accounts", async () => {
  let finish!: (count: number) => void
  api.get.mockImplementationOnce(
    () =>
      new Promise<number>((resolve) => {
        finish = resolve
      }),
  )
  const hook = renderHook(useUnreadCountState)
  let pending!: Promise<void>
  act(() => {
    pending = refreshUnreadCount()
  })
  act(() => {
    api.revision += 1
    api.changed()
  })
  api.get.mockResolvedValueOnce(2)
  await act(async () => {
    await refreshUnreadCount()
    finish(99)
    await pending
  })
  expect(hook.result.current.count).toBe(2)
})
it("a stale poll cannot undo a confirmed mark-all-read action", async () => {
  let finish!: (count: number) => void
  api.get.mockImplementationOnce(
    () =>
      new Promise<number>((resolve) => {
        finish = resolve
      }),
  )
  const hook = renderHook(useUnreadCountState)
  let pending!: Promise<void>
  act(() => {
    pending = refreshUnreadCount()
  })
  act(() => setUnreadCount(0))
  await act(async () => {
    finish(50)
    await pending
  })
  expect(hook.result.current.count).toBe(0)
})
it("never renders non-finite counts", () => {
  const hook = renderHook(useUnreadCountState)
  act(() => setUnreadCount(Infinity))
  expect(hook.result.current.count).toBeNull()
})
