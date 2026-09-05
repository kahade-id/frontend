import { expect, it } from "vitest"
import { compareVersions, safeHttpsUrl } from "@/lib/version"
it.each([
  ["1.2", "1.2.0", 0],
  ["1.9.0", "1.10.0", -1],
  ["2.0.0", "1.9999.0", 1],
  ["1.0.0+build.2", "1.0.0", 0],
  ["garbage", "1.0.0", null],
  ["", "1", null],
])("compareVersions(%s,%s)", (a, b, value) =>
  expect(compareVersions(a as string, b as string)).toBe(value),
)
it("only opens credential-free HTTPS links from remote config", () => {
  expect(safeHttpsUrl("javascript:alert(1)")).toBeUndefined()
  expect(safeHttpsUrl("https://user:pass@example.com")).toBeUndefined()
  expect(safeHttpsUrl("https://example.com")).toBe("https://example.com/")
})
