import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import ts from "typescript"
import { forwardRef, memo } from "react"
import { describe, expect, it } from "vitest"

import { profileUrl, showcaseUrl } from "@/lib/deeplinks"
import { resolveStatus, resolveVerifyTarget } from "@/lib/payment-finish"
import { ROUTES } from "@/lib/routes"
import { supportsVideoModule } from "@/lib/showcase-video-play"

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8")

function jsxAttributes(path: string, tag: string) {
  const file = ts.createSourceFile(path, source(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const attributes: string[] = []
  const walk = (node: ts.Node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(file) === tag) {
      attributes.push(node.attributes.getText(file))
    }
    ts.forEachChild(node, walk)
  }
  walk(file)
  return attributes
}

describe("A1 — payment status is API-only and fail-closed", () => {
  it.each([{}, { status: "success" }, { status: "pending" }, { status: "failed" }, { responseCode: "2005600" }])(
    "redirect without an identifier cannot establish status: %j", (params) => {
      expect(resolveVerifyTarget(params)).toBeNull()
    },
  )

  it.each(["orderId", "order_id", "merchantOrderId", "merchantOrderNo"])("accepts the supported order alias %s", (key) => {
    expect(resolveVerifyTarget({ [key]: "ord-123", status: "failed" })).toEqual({ kind: "order", id: "ord-123" })
  })

  it("accepts a subscription and ignores redirect status", () => {
    expect(resolveVerifyTarget({ subscription_id: "sub-123", status: "success" })).toEqual({ kind: "subscription", id: "sub-123" })
  })

  it.each([
    { orderId: "" }, { orderId: "../other" }, { orderId: ["one", "two"] },
    { orderId: "one", order_id: "two" }, { orderId: "one", subscriptionId: "sub" },
    { orderId: "one", order_id: "" }, { subscriptionId: ["one", "two"] },
  ])("rejects ambiguous or malformed identifiers: %j", (params) => {
    expect(resolveVerifyTarget(params)).toBeNull()
  })

  it("permits identical aliases rather than choosing conflicting values", () => {
    expect(resolveVerifyTarget({ orderId: "one", order_id: ["one"] })).toEqual({ kind: "order", id: "one" })
  })

  it.each(["", "UNKNOWN", "PROCESSING", "SUCCESS", "REFUNDED", "ACTIVE", undefined, null, true, {}])(
    "an unrecognized order response remains unknown: %j", (status) => {
      expect(resolveStatus("order", { status })).toBe("unknown")
    },
  )

  it("only whitelisted API enums establish a status", () => {
    expect(resolveStatus("order", { status: "PAID" })).toBe("success")
    expect(resolveStatus("subscription", { status: "ACTIVE" })).toBe("success")
    expect(resolveStatus("subscription", { status: "PAID" })).toBe("unknown")
    for (const kind of ["order", "subscription"] as const) {
      expect(resolveStatus(kind, { status: "PENDING" })).toBe("pending")
      for (const status of ["FAILED", "EXPIRED", "CANCELLED"]) expect(resolveStatus(kind, { status })).toBe("failed")
      expect(resolveStatus(kind, {})).toBe("unknown")
    }
  })
})

describe("A4 — canonical generated public URLs", () => {
  it("generates profile and showcase paths without old prefixes or sensitive query params", () => {
    expect(profileUrl("budi_santoso")).toBe("https://kahade.id/budi_santoso")
    expect(showcaseUrl("item-123")).toBe("https://kahade.id/p/item-123")
    expect(new URL(profileUrl("budi_santoso")).search).toBe("")
    expect(new URL(showcaseUrl("item-123")).search).toBe("")
  })
  it("encodes each identifier as a single path segment", () => {
    expect(profileUrl("a/b?c#d")).toBe("https://kahade.id/a%2Fb%3Fc%23d")
    expect(showcaseUrl("a/b?c#d")).toBe("https://kahade.id/p/a%2Fb%3Fc%23d")
  })
  it("the profile QR value and caption use the same URL helper", () => {
    const qr = jsxAttributes("components/screens/user-profile-screen.tsx", "QRCodeDisplay").join("\n")
    expect(qr).toContain("value={profileUrl(handle)}")
    expect(qr).toContain('caption={profileUrl(handle).replace("https://", "")}')
  })
})

describe("screen wiring regressions", () => {
  it("B1 — all settings entry points converge on the server+device screen", () => {
    expect(ROUTES.notificationSettings).toBe(ROUTES.notificationPreferences)
    expect(jsxAttributes("app/notification-settings.tsx", "Redirect")).toEqual(["href={ROUTES.notificationPreferences}"])
    expect(source("components/screens/notifications-tab-screen.tsx")).toContain('label: "Pengaturan notifikasi"')
  })
  it("B5 — Appearance delegates scroll to Screen", () => {
    expect(jsxAttributes("app/appearance.tsx", "Screen")[0]).toMatch(/\bscroll\b/)
  })
  it("B7 — dragging the chat thread does not dismiss the composer keyboard", () => {
    expect(jsxAttributes("components/screens/chat-room-screen.tsx", "FlatList")[0]).toContain('keyboardDismissMode="none"')
    expect(jsxAttributes("components/screens/chat-room-screen.tsx", "FlatList")[0]).not.toContain("onScrollBeginDrag")
  })
  it("B9 — the shared numeric-pill frame is exactly 18px", () => {
    const pill = jsxAttributes("components/ui/count-badge.tsx", "View").join("\n")
    expect(pill).toContain("h-[18px] min-w-[18px]")
    expect(jsxAttributes("components/ui/badge.tsx", "CountBadge")).toHaveLength(1)
    expect(jsxAttributes("components/ui/tabs.tsx", "CountBadge")).toHaveLength(1)
  })
  it("B11 — focus/error change colors only, never border thickness or padding", () => {
    const select = jsxAttributes("components/ui/select.tsx", "PressableScale")[0]
    const composer = jsxAttributes("components/ui/chat-composer.tsx", "View").find((attrs) => attrs.includes("min-h-12"))
    for (const attributes of [select, composer]) {
      expect(attributes).toContain("border-[1.5px]")
      expect(attributes).toContain("px-4")
      expect(attributes).not.toMatch(/border-2|px-\[15px\]/)
    }
  })
  it("B12 — loaded-message search and server search have distinct, visible labels", () => {
    expect(source("components/ui/chat-inline-search.tsx")).toContain('placeholder={translate("Cari pesan termuat")}')
    expect(source("components/ui/chat-room-menu.tsx")).toContain('label: "Cari semua pesan"')
  })
  it("B13 — backup-code regeneration uses SensitiveConfirm with password and OTP fields", () => {
    const screen = source("app/two-factor.tsx")
    const dialog = screen.slice(screen.indexOf('title="Buat kode cadangan baru?"'), screen.indexOf("</SensitiveConfirmDialog>", screen.indexOf('title="Buat kode cadangan baru?"')))
    expect(dialog).toContain("<PasswordField")
    expect(dialog).toContain("<OtpInput")
    expect(source("components/ui/sensitive-confirm.tsx")).toContain("avoidKeyboard={!!children}")
  })
  it("C1 — direct follow buttons can never reappear in feed or author row", () => {
    for (const path of ["components/ui/showcase-feed-item.tsx", "components/showcase-author-row.tsx"]) {
      expect(jsxAttributes(path, "FeedFollowButton")).toEqual([])
      expect(jsxAttributes(path, "Button").join("\n")).not.toMatch(/onToggle|follow|[Ii]kuti/)
    }
    const author = source("components/showcase-author-row.tsx")
    expect(author).toContain("<AuthorFollowMenu")
    expect(author).toContain('key: "follow"')
    expect(source("components/ui/showcase-feed-item.tsx")).not.toContain("useFeedFollow")
  })
})

describe("B3 — expo-video component availability", () => {
  it.each([() => null, forwardRef(() => null), memo(() => null)])("accepts class/function and exotic React component exports", (VideoView) => {
    expect(supportsVideoModule({ VideoView, useVideoPlayer: () => null })).toBe(true)
  })
  it.each([null, {}, { VideoView: {}, useVideoPlayer: () => null }, { VideoView: () => null }])("preserves the unavailable-module fallback", (mod) => {
    expect(supportsVideoModule(mod)).toBe(false)
  })
})
