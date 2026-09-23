import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { useShowcaseOperation } from "@/lib/use-showcase-operation"
import { clearSession, startSession } from "@/lib/api/session"

beforeEach(async () => { await clearSession() })

describe("Etalase mutation lifecycle E21/E23/E29/E31", () => {
  it("locks synchronously before React has rendered the busy flag", () => {
    const { result } = renderHook(() => useShowcaseOperation("a"))
    const first = result.current.begin()!
    expect(first.valid()).toBe(true)
    expect(result.current.begin()).toBeNull()
    first.finish()
    expect(result.current.begin()).not.toBeNull()
  })
  it("invalidates an old response when the sheet switches items", () => {
    const { result, rerender } = renderHook(({ id }) => useShowcaseOperation(id), { initialProps: { id: "a" } })
    const first = result.current.begin()!
    rerender({ id: "b" })
    expect(first.valid()).toBe(false)
    const second = result.current.begin()!
    first.finish()
    expect(second.valid()).toBe(true)
    expect(result.current.begin()).toBeNull()
  })
  it("closing and reopening the SAME item rejects the old response", () => {
    const { result, rerender } = renderHook(({ id }: { id: string | undefined }) => useShowcaseOperation(id), { initialProps: { id: "a" as string | undefined } })
    const first = result.current.begin()!
    rerender({ id: undefined })
    expect(result.current.begin()).toBeNull()
    rerender({ id: "a" })
    expect(first.valid()).toBe(false)
    expect(result.current.begin()?.valid()).toBe(true)
  })
  it("unmount invalidates a pending operation", () => {
    const { result, unmount } = renderHook(() => useShowcaseOperation("a"))
    const task = result.current.begin()!
    unmount()
    expect(task.valid()).toBe(false)
  })
  it("logout invalidates old operations even if the item has not changed", async () => {
    await startSession({ accessToken: "a" })
    const { result } = renderHook(() => useShowcaseOperation("item"))
    const task = result.current.begin()!
    await act(async () => { await clearSession() })
    expect(task.valid()).toBe(false)
    expect(result.current.begin()?.valid()).toBe(true)
  })
})
