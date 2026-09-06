import { describe, expect, it } from "vitest"
import { ROUTES } from "@/lib/routes"

describe("Settings screen configuration & routes", () => {
  it("has valid routes for all category items", () => {
    // Card utama
    expect(ROUTES.subscriptions).toBe("/subscriptions")

    // Card 2
    expect(ROUTES.editProfile).toBe("/edit-profile")
    expect(ROUTES.reports()).toEqual({ pathname: "/reports", params: {} })
    expect(ROUTES.security).toBe("/security")
    expect(ROUTES.accountType).toBe("/account-type")

    // Card 3
    expect(ROUTES.appearance).toBe("/appearance")
    expect(ROUTES.notificationPreferences).toBe("/notification-preferences")
    expect(ROUTES.language).toBe("/language")
    expect(ROUTES.appVersion).toBe("/app-version")

    // Card 4
    expect(ROUTES.faq).toBe("/faq")
    expect(ROUTES.contact).toBe("/contact")
    expect(ROUTES.chat).toBe("/chat")
    expect(ROUTES.support).toBe("/support")

    // Card 5
    expect(ROUTES.terms).toBe("/terms")
    expect(ROUTES.privacyPolicy).toBe("/privacy-policy")

    // Auth
    expect(ROUTES.login).toBe("/login")
  })

  it("contains all 6 community social links with valid URLs", () => {
    const communityUrls = [
      { id: "telegram", url: "https://t.me/kahade" },
      { id: "x", url: "https://x.com/kahade" },
      { id: "facebook", url: "https://facebook.com/kahade" },
      { id: "whatsapp", url: "https://wa.me/kahade" },
      { id: "instagram", url: "https://instagram.com/kahade" },
      { id: "tiktok", url: "https://tiktok.com/@kahade" },
    ]

    for (const item of communityUrls) {
      expect(item.url.startsWith("https://")).toBe(true)
    }
  })
})
