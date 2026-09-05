import { describe, expect, it } from "vitest"
import { resolveApiConfiguration } from "@/lib/api/environment"
const input = { platform: "web", development: true }
describe("API deployment configuration", () => {
  it("uses real HTTPS API even in development", () =>
    expect(resolveApiConfiguration(input).baseUrl).toBe("https://api.kahade.id"))
  it("never guesses a staging host", () =>
    expect(() => resolveApiConfiguration({ ...input, env: "staging" })).toThrow())
  it("ignores a blank URL override", () =>
    expect(resolveApiConfiguration({ ...input, url: " " }).baseUrl).toBe("https://api.kahade.id"))
  it("supports a same-origin web proxy", () =>
    expect(resolveApiConfiguration({ ...input, env: "dev", url: "/api/" }).baseUrl).toBe("/api"))
  it.each(["http://localhost:3000", "http://127.0.0.1:3000", "http://10.0.2.2:3000"])(
    "rejects browser loopback %s",
    (url) => expect(() => resolveApiConfiguration({ ...input, env: "dev", url })).toThrow(),
  )
  it.each([
    "http://api.kahade.id",
    "https://user:password@api.kahade.id",
    "https://api.kahade.id/v1",
    "https://api.kahade.id?token=bad",
  ])("rejects unsafe production config %s", (url) =>
    expect(() => resolveApiConfiguration({ ...input, url })).toThrow(),
  )
})
