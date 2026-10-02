import { describe, expect, it } from "vitest"

import {
  BOTTOM_MENU_META,
  HELP_MENU_META,
  getDrawerFooterMenuMeta,
} from "@/lib/drawer-menu"

describe("native drawer support consolidation", () => {
  it("offers one Help Center entry instead of separate feedback/support destinations", () => {
    expect(HELP_MENU_META).toEqual([
      {
        id: "help-center",
        label: "Bantuan",
        href: "/faq",
        accessibilityLabel: "Buka pusat bantuan",
      },
    ])
    expect(HELP_MENU_META.map((item) => item.id)).not.toContain("feedback")
    expect(HELP_MENU_META.map((item) => item.id)).not.toContain("live-support")
    expect(HELP_MENU_META.map((item) => item.id)).not.toContain("support-tickets")
    expect(getDrawerFooterMenuMeta("android")).toEqual(HELP_MENU_META)
    expect(getDrawerFooterMenuMeta("ios")).toEqual(HELP_MENU_META)
    // Legacy web shell remains unchanged; Android/iOS never show its rows.
    expect(BOTTOM_MENU_META).toHaveLength(3)
    expect(getDrawerFooterMenuMeta("web")).toEqual(BOTTOM_MENU_META)
  })
})
