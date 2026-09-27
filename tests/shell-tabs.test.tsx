/**
 * Unit `lib/shell-tabs.ts` (redesign navigasi mobile 2026-09-27).
 *
 * Kontrak yang dikunci:
 *  - SHELL_TABS = persis 4 tab dengan urutan Etalase, Transaksi, Pesan,
 *    Notifikasi — dan kuncinya identik dengan TAB_ROUTE_NAMES.
 *  - isShellTabPath true hanya untuk 4 path tab persis (toleran trailing
 *    slash & query); false untuk sub-path, rute stack lama, dan /more.
 */
import { describe, expect, it } from "vitest"

import { TAB_ROUTE_NAMES } from "@/lib/routes"
import {
  SHELL_TABS,
  SHELL_TAB_PATHS,
  isShellTabPath,
  shellTabForPath,
} from "@/lib/shell-tabs"

describe("SHELL_TABS", () => {
  it("empat tab dengan urutan yang dikunci", () => {
    expect(SHELL_TABS.map((t) => t.key)).toEqual([
      "showcase",
      "transactions",
      "chat",
      "notifications",
    ])
    expect(SHELL_TABS.map((t) => t.label)).toEqual([
      "Etalase",
      "Transaksi",
      "Pesan",
      "Notifikasi",
    ])
  })

  it("kunci tab identik dengan TAB_ROUTE_NAMES (registri rute grup tabs)", () => {
    expect(SHELL_TABS.map((t) => t.key)).toEqual([...TAB_ROUTE_NAMES])
    expect(new Set(SHELL_TAB_PATHS).size).toBe(SHELL_TABS.length)
  })
})

describe("isShellTabPath", () => {
  it("true untuk keempat halaman tab", () => {
    for (const path of ["/showcase", "/transactions", "/chat", "/notifications"]) {
      expect(isShellTabPath(path)).toBe(true)
    }
  })

  it("toleran trailing slash & query string", () => {
    expect(isShellTabPath("/showcase/")).toBe(true)
    expect(isShellTabPath("/chat?room=1")).toBe(true)
  })

  it("false untuk sub-path (bar tidak tampil di layar detail)", () => {
    expect(isShellTabPath("/chat/room-1")).toBe(false)
    expect(isShellTabPath("/notifications/settings")).toBe(false)
    expect(isShellTabPath("/showcase/abc")).toBe(false)
  })

  it("false untuk rute stack lama & /more", () => {
    for (const path of ["/wallet", "/vouchers", "/wallet-history", "/more", "/settings", "/"]) {
      expect(isShellTabPath(path)).toBe(false)
    }
  })
})

describe("shellTabForPath", () => {
  it("mengembalikan def tab untuk path persis", () => {
    expect(shellTabForPath("/notifications")?.key).toBe("notifications")
    expect(shellTabForPath("/showcase")?.label).toBe("Etalase")
  })

  it("undefined untuk bukan halaman tab", () => {
    expect(shellTabForPath("/wallet")).toBeUndefined()
    expect(shellTabForPath("/chat/room-1")).toBeUndefined()
  })
})
