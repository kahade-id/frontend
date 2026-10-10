/**
 * FD-07 (audit etalase 2026-10-10): tujuan kembali setelah login dibaca dari
 * snapshot rute (satu pelanggan di root layout) — bukan usePathname/
 * useGlobalSearchParams per kartu feed.
 */
import { afterEach, describe, expect, it } from "vitest"

import { buildReturnPath, getRouteSnapshot, resetRouteSnapshotForTests, setRouteSnapshot } from "@/lib/current-route"

afterEach(resetRouteSnapshotForTests)

describe("buildReturnPath", () => {
  it("rute aktif + param string tidak kosong → path?query (C-03: kembali ke layar asal)", () => {
    setRouteSnapshot({ pathname: "/showcase", params: { category: "Sneakers lokal", q: "", tab: ["a", "b"] } })
    expect(buildReturnPath("/showcase/x")).toBe("/showcase?category=Sneakers%20lokal")
  })

  it("snapshot kosong atau root → fallback (detail etalase)", () => {
    expect(buildReturnPath("/showcase/x")).toBe("/showcase/x")
    setRouteSnapshot({ pathname: "/", params: {} })
    expect(buildReturnPath("/showcase/x")).toBe("/showcase/x")
  })

  it("snapshot eksplisit menang atas store (pure)", () => {
    setRouteSnapshot({ pathname: "/a", params: {} })
    expect(buildReturnPath("/f", { pathname: "/b", params: { x: "1" } })).toBe("/b?x=1")
    expect(getRouteSnapshot().pathname).toBe("/a")
  })
})
