import { afterEach, describe, expect, it } from "vitest"

import {
  isShellTabPath,
  popPreviousShellTab,
  rememberShellTabVisit,
  resetShellTabHistory,
} from "@/lib/shell-tabs"

afterEach(resetShellTabHistory)

describe("native shell-tab back history", () => {
  it("keeps the bottom bar visible for grouped tab routes, not detail routes", () => {
    expect(isShellTabPath("/(tabs)/showcase")).toBe(true)
    expect(isShellTabPath("/showcase/item-123")).toBe(false)
  })

  it("pops tabs in visit order, then leaves the platform free to exit", () => {
    rememberShellTabVisit("/(tabs)/showcase")
    rememberShellTabVisit("/(tabs)/transactions")
    rememberShellTabVisit("/(tabs)/chat")

    expect(popPreviousShellTab("/chat")?.key).toBe("transactions")
    // A route effect after navigation must not add a duplicate visit.
    rememberShellTabVisit("/(tabs)/transactions")
    expect(popPreviousShellTab("/transactions")?.key).toBe("showcase")
    expect(popPreviousShellTab("/showcase")).toBeUndefined()
  })
})
