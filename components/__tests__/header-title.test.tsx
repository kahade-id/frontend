import { describe, expect, it } from "vitest"

import { defaultHeaderTitleVariant } from "@/lib/header-title"

describe("native header title hierarchy", () => {
  it("keeps main/list routes at H2 and makes detail routes compact H3", () => {
    expect(defaultHeaderTitleVariant("/showcase")).toBe("h2")
    expect(defaultHeaderTitleVariant("/transactions")).toBe("h2")
    expect(defaultHeaderTitleVariant("/showcase/create")).toBe("h2")
    expect(defaultHeaderTitleVariant("/(tabs)/notifications")).toBe("h2")
    expect(defaultHeaderTitleVariant("/order/ord-123")).toBe("h3")
    expect(defaultHeaderTitleVariant("/showcase/item-123")).toBe("h3")
    expect(defaultHeaderTitleVariant("/support/ticket-123")).toBe("h3")
    expect(defaultHeaderTitleVariant("/products/product-123")).toBe("h3")
    expect(defaultHeaderTitleVariant("/jastip/jastip-123")).toBe("h3")
  })
})
