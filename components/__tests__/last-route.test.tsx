import { describe, expect, it, vi } from "vitest"

import {
  isLastRouteRestoreSuppressed,
  safeNativeRoutePath,
  subscribeLastRouteRestore,
  suppressLastRouteRestore,
} from "@/lib/last-route"

describe("native last-route restoration", () => {
  it("stores only a normalized pathname and strips every query parameter", () => {
    expect(safeNativeRoutePath("/(tabs)/chat/room-123?message=private&token=secret#reply")).toBe(
      "/chat/room-123",
    )
    expect(safeNativeRoutePath("/(tabs)/showcase?category=design")).toBe("/showcase")
  })

  it("does not restore transient auth or recipient-resolution routes", () => {
    expect(safeNativeRoutePath("/verify-otp?phoneNumber=secret")).toBeNull()
    expect(safeNativeRoutePath("/prepare-navigation?kind=dm&id=alice")).toBeNull()
    expect(safeNativeRoutePath("/login-required?next=/chat/private-room")).toBeNull()
    expect(safeNativeRoutePath("/payment/finish?orderId=private-order")).toBeNull()
  })

  it("lets a cold-start push suppress the stored route", () => {
    expect(isLastRouteRestoreSuppressed()).toBe(false)
    const listener = vi.fn()
    const unsubscribe = subscribeLastRouteRestore(listener)
    suppressLastRouteRestore()
    expect(isLastRouteRestoreSuppressed()).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })
})
