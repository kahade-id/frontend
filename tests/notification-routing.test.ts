/**
 * Regresi deep-link push CHAT (klaster Notifikasi, batch 2).
 *
 * Kontrak: ketuk push chat dari luar aplikasi HARUS membuka ruang chat
 * (`/chat/[roomId]`), bukan tab Notifikasi — baik saat app hidup, background,
 * maupun cold start (lihat `subscribeNotificationOpened` di
 * lib/push-notifications.ts dan handler di app/_layout.tsx).
 *
 * Payload push chat backend (chat.service + push.service):
 *   { type: "CHAT_NEW", notificationType: "CHAT_NEW_MESSAGE",
 *     chatRoomId: "<id>", roomId: "<id>", actionUrl: "/chat/<id>" }
 * Item inbox (GET /v1/notifications):
 *   { referenceType: "CHAT_ROOM", referenceId: "<id>" }
 */
import { describe, expect, it } from "vitest"

import {
  labelForNotificationReference,
  routeForActionUrl,
  routeForNotificationReference,
  routeForPushData,
} from "@/lib/notification-routing"
import { ROUTES } from "@/lib/routes"

/** Ekstrak path aktual dari Href object `{ pathname: "/chat/[roomId]", params }`. */
function hrefPath(href: unknown): string | null {
  if (typeof href === "string") return href
  if (href && typeof href === "object") {
    const o = href as { pathname?: string; params?: Record<string, string> }
    if (typeof o.pathname === "string") {
      return o.pathname.replace(/\[([^\]]+)\]/g, (_, key: string) => o.params?.[key] ?? "")
    }
  }
  return null
}

describe("routeForPushData — chat selalu ke ruang chat", () => {
  it("payload lengkap backend (actionUrl) → /chat/<id>", () => {
    const href = routeForPushData({
      type: "CHAT_NEW",
      notificationType: "CHAT_NEW_MESSAGE",
      chatRoomId: "room-123",
      roomId: "room-123",
      actionUrl: "/chat/room-123",
    })
    expect(hrefPath(href)).toBe("/chat/room-123")
  })

  it("tanpa actionUrl: type CHAT_NEW + roomId → /chat/<id>", () => {
    const href = routeForPushData({ type: "CHAT_NEW", roomId: "room-456" })
    expect(hrefPath(href)).toBe("/chat/room-456")
  })

  it("tanpa actionUrl/type: notificationType CHAT_NEW_MESSAGE + chatRoomId → /chat/<id>", () => {
    const href = routeForPushData({
      notificationType: "CHAT_NEW_MESSAGE",
      chatRoomId: "room-789",
    })
    expect(hrefPath(href)).toBe("/chat/room-789")
  })

  it("payload tak dikenal → null (pemanggil jatuh ke tab Notifikasi)", () => {
    expect(routeForPushData({})).toBeNull()
    expect(routeForPushData(null)).toBeNull()
    expect(routeForPushData({ type: "SOMETHING_ELSE_ENTIRELY" })).toBeNull()
  })
})

describe("routeForNotificationReference — alias chat", () => {
  it.each([
    ["CHAT_ROOM", "r1"],
    ["chat", "r2"],
    ["chatroom", "r3"],
    ["message", "r4"],
    ["CHAT_NEW", "r5"],
    ["CHAT_NEW_MESSAGE", "r6"],
  ])("referenceType %s → /chat/<id>", (type, id) => {
    expect(hrefPath(routeForNotificationReference({ referenceType: type, referenceId: id }))).toBe(
      `/chat/${id}`,
    )
  })

  it("chat tanpa id → daftar chat, bukan null", () => {
    expect(routeForNotificationReference({ referenceType: "CHAT_NEW" })).toBe(ROUTES.chat)
  })

  it("label CTA untuk alias push backend = 'Buka chat'", () => {
    expect(labelForNotificationReference({ referenceType: "CHAT_NEW" })).toBe("Buka chat")
    expect(labelForNotificationReference({ referenceType: "CHAT_NEW_MESSAGE" })).toBe("Buka chat")
  })
})

describe("routeForActionUrl — non-regresi tipe lain", () => {
  it("/order/<id> tetap ke detail order", () => {
    expect(hrefPath(routeForActionUrl("/order/ord-1"))).toBe("/order/ord-1")
  })

  it("/dispute/<id> tetap ke detail sengketa", () => {
    expect(hrefPath(routeForActionUrl("/dispute/dsp-1"))).toBe("/dispute/dsp-1")
  })

  it("/wallet/transaction?id=<tx> tetap ke detail mutasi", () => {
    const href = routeForActionUrl("/wallet/transaction?id=tx-1")
    expect(hrefPath(href)).toContain("tx-1")
  })

  it("/showcase/<id> tetap ke detail karya", () => {
    expect(hrefPath(routeForActionUrl("/showcase/sc-1"))).toBe("/showcase/sc-1")
  })

  it("path tak dikenal → null", () => {
    expect(routeForActionUrl("/nope/xyz")).toBeNull()
    expect(routeForActionUrl("https://evil.example/x")).toBeNull()
  })
})

describe("routeForNotificationReference — non-regresi tipe lain", () => {
  it("order/dispute/wallet tidak berubah", () => {
    expect(hrefPath(routeForNotificationReference({ referenceType: "ORDER", referenceId: "o1" }))).toBe(
      "/order/o1",
    )
    expect(hrefPath(routeForNotificationReference({ referenceType: "DISPUTE", referenceId: "d1" }))).toBe(
      "/dispute/d1",
    )
    const wallet = routeForNotificationReference({ referenceType: "WALLET" })
    expect(wallet).toBe(ROUTES.wallet)
  })

  it("tipe tak dikenal → null", () => {
    expect(routeForNotificationReference({ referenceType: "BOGUS", referenceId: "x" })).toBeNull()
  })
})
