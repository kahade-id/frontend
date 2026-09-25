/**
 * Mode E-Commerce ⇄ E-Wallet: rencana navigasi murni (tanpa router) dan
 * preferensi perangkat yang tidak boleh hilang saat logout.
 */
import { beforeEach, describe, expect, it } from "vitest"

import {
  activeShellSlot,
  applyModeNavigation,
  getModeShift,
  markModeShift,
  modeShiftIsFresh,
  parkShellTab,
  pathMatchesBase,
  planModeChange,
  planSlotPress,
  primaryTabFor,
  registerShellTabNavigator,
  resetAppModeForTest,
  setAppMode,
  SHELL_DESTINATIONS,
  type ModeNavigator,
} from "@/lib/app-mode"
import { getUiPrefsSnapshot, resetUiPrefsForTest } from "@/lib/ui-prefs"

function callsOf() {
  const calls: string[] = []
  const nav: ModeNavigator = {
    push: (href) => calls.push(`push:${href}`),
    replace: (href) => calls.push(`replace:${href}`),
    navigate: (href) => calls.push(`navigate:${href}`),
    dismissTo: (href) => calls.push(`dismiss:${href}`),
  }
  return { calls, nav }
}

beforeEach(() => {
  resetAppModeForTest()
  resetUiPrefsForTest()
})

describe("path shell", () => {
  it("tidak menyamakan prefix yang hanya kebetulan mirip", () => {
    expect(pathMatchesBase("/wallet-history", "/wallet")).toBe(false)
    expect(pathMatchesBase("/showcase-management", "/showcase")).toBe(false)
    expect(pathMatchesBase("/chat/room-1", "/chat")).toBe(true)
    expect(pathMatchesBase("/wallet/", "/wallet")).toBe(true)
  })

  it("menyorot slot dari pathname, hanya di 8 halaman shell", () => {
    expect(activeShellSlot("/home", "commerce")).toBeNull()
    expect(activeShellSlot("/discover", "wallet")).toBeNull()
    expect(activeShellSlot("/showcase", "commerce")).toBe("primary")
    expect(activeShellSlot("/showcase/abc", "commerce")).toBeNull()
    expect(activeShellSlot("/showcase-management", "commerce")).toBeNull()
    expect(activeShellSlot("/transactions", "commerce")).toBe("secondary")
    expect(activeShellSlot("/chat", "commerce")).toBe("tertiary")
    expect(activeShellSlot("/chat/room-1", "commerce")).toBeNull()
    expect(activeShellSlot("/more", "commerce")).toBe("more")
    expect(activeShellSlot("/wallet", "wallet")).toBe("primary")
    expect(activeShellSlot("/vouchers", "wallet")).toBe("secondary")
    expect(activeShellSlot("/wallet-history", "wallet")).toBe("tertiary")
    expect(activeShellSlot("/more", "wallet")).toBe("more")
    expect(activeShellSlot("/user/ada", "wallet")).toBeNull()
    expect(activeShellSlot("/user/ada/edit", "wallet")).toBeNull()
  })
})

describe("planModeChange", () => {
  it("home dan discover masuk ke primer mode baru", () => {
    expect(planModeChange("/home", "wallet")).toEqual({
      kind: "go",
      href: "/wallet",
      method: "navigate",
      parkTab: "wallet",
    })
    expect(planModeChange("/discover", "commerce")).toEqual({
      kind: "go",
      href: "/showcase",
      method: "leave-to-tab",
      parkTab: "showcase",
    })
  })

  it("memetakan slot yang sama, bukan selalu ke primer", () => {
    expect(planModeChange("/transactions", "wallet")).toMatchObject({
      kind: "go",
      href: "/vouchers",
      method: "navigate",
      parkTab: "vouchers",
    })
    expect(planModeChange("/chat", "wallet")).toMatchObject({
      kind: "go",
      href: "/wallet-history",
      method: "navigate",
      parkTab: "wallet-history",
    })
    expect(planModeChange("/vouchers", "commerce")).toMatchObject({
      kind: "go",
      href: "/transactions",
      method: "navigate",
      parkTab: "transactions",
    })
  })

  it("profil sendiri tetap, rute netral tetap, keduanya memarkir primer baru", () => {
    expect(planModeChange("/user/ada", "wallet")).toEqual({
      kind: "stay",
      parkTab: "wallet",
    })
    expect(planModeChange("/settings", "commerce")).toEqual({
      kind: "stay",
      parkTab: "showcase",
    })
    expect(primaryTabFor("commerce")).toBe("showcase")
  })
})

describe("planSlotPress", () => {
  it("menavigasi antar tab dan memarkir tab tujuan", () => {
    expect(planSlotPress("/home", SHELL_DESTINATIONS.commerce.tertiary)).toEqual({
      kind: "go",
      href: "/chat",
      method: "navigate",
      parkTab: "chat",
    })
  })

  it("tetap di tempat bila sudah di tujuan atau slot Lainnya", () => {
    expect(planSlotPress("/chat", SHELL_DESTINATIONS.commerce.tertiary)).toEqual({
      kind: "stay",
      parkTab: null,
    })
    expect(planSlotPress("/more", SHELL_DESTINATIONS.wallet.more).kind).toBe("stay")
  })

  it("dari stack ke tab memakai leave-to-tab dan memarkir tab tujuan", () => {
    expect(planSlotPress("/settings", SHELL_DESTINATIONS.commerce.primary)).toEqual({
      kind: "go",
      href: "/showcase",
      method: "leave-to-tab",
      parkTab: "showcase",
    })
  })
})

describe("applyModeNavigation", () => {
  it("leave-to-tab memarkir dulu, lalu dismissTo, dan tidak navigate lagi", () => {
    const { calls, nav } = callsOf()
    registerShellTabNavigator({ navigate: (name) => calls.push(`park:${name}`) })
    applyModeNavigation(
      { kind: "go", href: "/wallet", method: "leave-to-tab", parkTab: "wallet" },
      nav,
    )
    expect(calls).toEqual(["park:wallet", "dismiss:/wallet"])
  })

  it("tanpa dismissTo jatuh ke navigate setelah park", () => {
    const calls: string[] = []
    registerShellTabNavigator({ navigate: (name) => calls.push(`park:${name}`) })
    applyModeNavigation(
      { kind: "go", href: "/showcase", method: "leave-to-tab", parkTab: "showcase" },
      {
        push: () => calls.push("push"),
        replace: () => calls.push("replace"),
        navigate: (href) => calls.push(`navigate:${href}`),
      },
    )
    expect(calls).toEqual(["park:showcase", "navigate:/showcase"])
  })

  it("push/replace jalan dulu, park null tidak menyentuh navigator", () => {
    const { calls, nav } = callsOf()
    registerShellTabNavigator({ navigate: (name) => calls.push(`park:${name}`) })
    applyModeNavigation(
      { kind: "go", href: "/chat", method: "push", parkTab: null },
      nav,
    )
    expect(calls).toEqual(["push:/chat"])
  })

  it("menyimpan park sampai navigator tab terpasang lagi", () => {
    const calls: string[] = []
    parkShellTab("wallet")
    expect(calls).toEqual([])
    registerShellTabNavigator({ navigate: (name) => calls.push(`park:${name}`) })
    expect(calls).toEqual(["park:wallet"])
  })

  it("melewati park bila navigator belum siap", () => {
    const calls: string[] = []
    registerShellTabNavigator({
      navigate: (name) => calls.push(`park:${name}`),
      isReady: () => false,
    })
    applyModeNavigation({ kind: "stay", parkTab: "wallet" }, callsOf().nav)
    expect(calls).toEqual([])
  })
})

describe("shift dan preferensi", () => {
  it("menandai arah dan menganggap shift basi setelah jendela", () => {
    markModeShift("commerce", "wallet", "/wallet", 1_000)
    expect(getModeShift()).toMatchObject({ dir: 1, href: "/wallet" })
    expect(modeShiftIsFresh(1_000 + 699)).toBe(true)
    expect(modeShiftIsFresh(1_000 + 700)).toBe(false)

    markModeShift("wallet", "commerce", null, 2_000)
    expect(getModeShift()).toMatchObject({ dir: -1, href: null })
  })

  it("setAppMode menulis preferensi perangkat", () => {
    setAppMode("wallet")
    expect(getUiPrefsSnapshot().appMode).toBe("wallet")
  })
})
