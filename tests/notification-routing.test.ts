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
  logicalParentForPath,
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

/**
 * E1-001 — `actionUrl` dengan sekuens persen malformed (mis. `%` mentah
 * dari payload push backend yang rusak) TIDAK boleh melempar URIError;
 * fallback ke id mentah tanpa decode.
 */
describe("routeForActionUrl — E1-001 sekuens persen malformed", () => {
  it("tidak throw untuk `%` mentah", () => {
    expect(() => routeForActionUrl("/order/ord%zz")).not.toThrow()
  })

  it("tidak throw untuk `%` di akhir segmen", () => {
    expect(() => routeForActionUrl("/chat/room%")).not.toThrow()
  })

  it("id malformed dipakai mentah (rute tetap terbentuk)", () => {
    expect(hrefPath(routeForActionUrl("/order/ord%zz"))).toBe("/order/ord%zz")
    expect(hrefPath(routeForActionUrl("/chat/room%"))).toBe("/chat/room%")
  })

  it("id valid tetap di-decode normal", () => {
    expect(hrefPath(routeForActionUrl("/order/ord%20a"))).toBe("/order/ord a")
  })

  it("routeForPushData dengan actionUrl malformed tidak throw", () => {
    expect(() => routeForPushData({ actionUrl: "/dispute/dsp%zz" })).not.toThrow()
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

/**
 * Batch 139 F15 — deep-link notifikasi status tiket.
 *
 * Backend mengirim `SUPPORT_TICKET_UPDATE` + `ticketId` saat status tiket
 * berubah (admin-support.service → emitNotificationCreated). Sisi klien
 * memastikan tipe itu + actionUrl bentuk `/support/tickets/<id>` selalu
 * membuka detail tiket, bukan tab Notifikasi.
 */
describe("routeForPushData — status tiket ke detail tiket (F15)", () => {
  it("payload SUPPORT_TICKET_UPDATE + ticketId → /support/<id>", () => {
    const href = routeForPushData({ type: "SUPPORT_TICKET_UPDATE", ticketId: "t123" })
    expect(hrefPath(href)).toBe("/support/t123")
  })

  it("actionUrl /support/tickets/<id> → detail tiket", () => {
    expect(hrefPath(routeForActionUrl("/support/tickets/t456"))).toBe("/support/t456")
  })

  it("actionUrl /support/<id> → detail tiket", () => {
    expect(hrefPath(routeForActionUrl("/support/t789"))).toBe("/support/t789")
  })

  it("actionUrl /support → daftar tiket", () => {
    expect(routeForActionUrl("/support")).toBe(ROUTES.support)
  })

  it("referenceType SUPPORT_TICKET tanpa id → daftar tiket", () => {
    expect(routeForNotificationReference({ referenceType: "SUPPORT_TICKET" })).toBe(ROUTES.support)
  })
})

describe("logicalParentForPath — fallback back sadar konteks (T5-009)", () => {
  it("ruang chat → /chat (bukan Etalase)", () => {
    expect(logicalParentForPath("/chat/room-123")).toBe(ROUTES.chat)
  })

  it("query string & hash diabaikan", () => {
    expect(logicalParentForPath("/chat/room-123?x=1#y")).toBe(ROUTES.chat)
  })

  it("detail pesanan → /transactions", () => {
    expect(logicalParentForPath("/order/ORD-1")).toBe(ROUTES.transactions)
  })

  it("detail karya → /showcase", () => {
    expect(logicalParentForPath("/showcase/abc")).toBe(ROUTES.showcase)
  })

  it("detail notifikasi → /notifications", () => {
    expect(logicalParentForPath("/notifications/n1")).toBe(ROUTES.notifications)
  })

  it("detail sengketa → /disputes", () => {
    expect(logicalParentForPath("/dispute/d9")).toBe(ROUTES.disputes)
  })

  it("dompet → /wallet", () => {
    expect(logicalParentForPath("/wallet")).toBe(ROUTES.wallet)
  })

  it("segmen pertama case-insensitive", () => {
    expect(logicalParentForPath("/CHAT/room-1")).toBe(ROUTES.chat)
  })

  it("rute tak dikenal & root → Etalase (ROUTES.home)", () => {
    expect(logicalParentForPath("/kebijakan-privasi")).toBe(ROUTES.home)
    expect(logicalParentForPath("/")).toBe(ROUTES.home)
    expect(logicalParentForPath("")).toBe(ROUTES.home)
  })
})
