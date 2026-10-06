import { describe, expect, it } from "vitest"

import { validateLoginIdentifier } from "@/lib/login-method-validation"

describe("method-specific login identifier validation", () => {
  it("accepts a well-formed email and rejects malformed addresses", () => {
    expect(validateLoginIdentifier("email", "buyer@example.com")).toBeNull()
    expect(validateLoginIdentifier("email", " buyer@example.com ")).toBeNull()
    expect(validateLoginIdentifier("email", "buyer.example.com")).toMatch(/Format email/)
    expect(validateLoginIdentifier("email", "buyer @example.com")).toMatch(/Format email/)
    expect(validateLoginIdentifier("email", "")).toMatch(/email/i)
  })

  it("accepts a username without spaces or @ and rejects either character", () => {
    expect(validateLoginIdentifier("username", "johndoe")).toBeNull()
    expect(validateLoginIdentifier("username", "john doe")).toMatch(/spasi/)
    expect(validateLoginIdentifier("username", "john@doe")).toMatch(/@/)
    expect(validateLoginIdentifier("username", "")).toMatch(/username/i)
  })
})
