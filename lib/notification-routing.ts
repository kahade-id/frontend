/**
 * Kahade — notifikasi → route tujuan (list Notifikasi & tap push).
 *
 * Spec `GET /v1/notifications` dan payload push TIDAK mendokumentasikan
 * bentuk referensi (UNVERIFIED). Kami menerima dua sumber yang lazim:
 *   1. `referenceType` + `referenceId` pada item notifikasi
 *      (mis. ORDER/abc, DISPUTE/xyz, WALLET_TRANSACTION/123, CHAT_ROOM/…,
 *      SUPPORT_TICKET/…, USER/<username>, KYC/*, ORDER_LINK/<token>)
 *   2. `data` payload push (expo-notifications) dengan kunci yang sama
 *      (`referenceType`/`referenceId`) atau `type`/`id`/`orderId`/…
 *
 * Pencocokan tipe TIDAK case-sensitive dan menoleransi variasi
 * (`order`, `ORDER`, `Order`, `order_link`, `orderLink`). Bila tidak
 * dikenali → `null`; pemanggil membuka tab Notifikasi / tidak navigasi.
 *
 * Satu tempat untuk pemetaan ini supaya list notifikasi dan handler push
 * tidak punya dua tabel yang diam-diam berbeda.
 */
import type { Href } from "expo-router"

import { ROUTES } from "@/lib/routes"

export type NotificationReference = {
  referenceType?: string | null
  referenceId?: string | null
  /** Fallback: path backend (mis. `/chat/<id>`) bila referenceType/Id kosong. */
  actionUrl?: string | null
}

/** Normalisasi "Order_Link" / "order-link" / "orderLink" → "orderlink" */
function normalizeType(t: string): string {
  return t.replace(/[\s_-]/g, "").toLowerCase()
}

/**
 * Route untuk sebuah referensi; `null` bila tidak dikenali / id kosong.
 * Tipe tanpa id (KYC, WALLET) tetap punya tujuan.
 * Bila `referenceType` kosong, coba parse `actionUrl` sebagai fallback.
 */
export function routeForNotificationReference(ref: NotificationReference): Href | null {
  const type = ref.referenceType ? normalizeType(ref.referenceType) : ""
  const id = ref.referenceId?.trim() ?? ""
  if (!type) return routeForActionUrl(ref.actionUrl)

  switch (type) {
    case "order":
    case "transaction":
    case "escrow":
      return id ? ROUTES.orderDetail(id) : ROUTES.transactions
    case "orderlink":
      return id ? ROUTES.orderLink(id) : ROUTES.orderLinks
    case "dispute":
      return id ? ROUTES.disputeDetail(id) : ROUTES.disputes
    case "wallettransaction":
    case "wallettx":
    case "topup":
    case "withdraw":
    case "withdrawal":
    case "transfer":
      return id ? ROUTES.walletTransaction(id) : ROUTES.wallet
    case "wallet":
      return ROUTES.wallet
    case "chat":
    case "chatroom":
    case "message":
      return id ? ROUTES.chatRoom(id) : ROUTES.chat
    case "supportticket":
    case "ticket":
    case "support":
      return id ? ROUTES.supportTicket(id) : ROUTES.support
    case "user":
    case "profile":
    case "follow":
    case "follower":
      return id ? ROUTES.userProfile(id) : null
    case "kyc":
    case "verification":
      return ROUTES.kyc
    case "subscription":
      return ROUTES.subscriptions
    case "referral":
      return ROUTES.referral
    case "rating":
    case "review":
      return ROUTES.ratings
    case "showcase":
    case "etalase":
    case "showcaselike":
    case "showcasecomment":
      // Audit Etalase I-02: notifikasi suka/komentar karya → detail item.
      return id ? ROUTES.showcaseDetail(id) : ROUTES.showcase
    case "security":
    case "session":
    case "login":
      return ROUTES.security
    default:
      return null
  }
}

/**
 * Label CTA layar detail ("Lihat order", "Buka chat", …) untuk sebuah
 * referensi; `null` bila tidak dikenali (detail tetap tampil tanpa CTA).
 * Tabel sejajar dengan `routeForNotificationReference` di atas.
 * Bila `referenceType` kosong, label diturunkan dari `actionUrl`.
 */
export function labelForNotificationReference(ref: NotificationReference): string | null {
  const type = ref.referenceType ? normalizeType(ref.referenceType) : ""
  if (!type) return labelForActionUrl(ref.actionUrl)

  switch (type) {
    case "order":
    case "transaction":
    case "escrow":
      return "Lihat order"
    case "orderlink":
      return "Buka order link"
    case "dispute":
      return "Lihat sengketa"
    case "wallettransaction":
    case "wallettx":
    case "topup":
    case "withdraw":
    case "withdrawal":
    case "transfer":
      return "Lihat mutasi"
    case "wallet":
      return "Buka dompet"
    case "chat":
    case "chatroom":
    case "message":
      return "Buka chat"
    case "supportticket":
    case "ticket":
    case "support":
      return "Lihat tiket bantuan"
    case "user":
    case "profile":
    case "follow":
    case "follower":
      return "Lihat profil"
    case "kyc":
    case "verification":
      return "Buka verifikasi"
    case "subscription":
      return "Lihat langganan"
    case "referral":
      return "Lihat referral"
    case "rating":
    case "review":
      return "Lihat ulasan"
    case "showcase":
    case "etalase":
    case "showcaselike":
    case "showcasecomment":
      return "Lihat karya"
    case "security":
    case "session":
    case "login":
      return "Buka keamanan"
    default:
      return null
  }
}

/**
 * Label CTA dari `actionUrl` backend; `null` bila tidak dikenali.
 * Sejajar dengan `routeForActionUrl` di atas.
 */
export function labelForActionUrl(actionUrl: string | null | undefined): string | null {
  if (!actionUrl) return null
  const path = actionUrl.startsWith("http") ? null : actionUrl.startsWith("/") ? actionUrl : `/${actionUrl}`
  if (!path) return null
  const head = path.split("?", 1)[0].split("/").filter(Boolean)[0]
  switch (head) {
    case "chat":
      return "Buka chat"
    case "order":
    case "o":
      return "Lihat order"
    case "dispute":
      return "Lihat sengketa"
    case "showcase":
      return "Lihat karya"
    case "wallet":
      return "Lihat mutasi"
    case "questions":
      return "Lihat pertanyaan"
    case "notifications":
    case "badges":
      return "Lihat notifikasi"
    default:
      return null
  }
}

/**
 * Route dari `data` payload push. Prioritas:
 *   1. `actionUrl` backend (mis. `/chat/<id>`, `/order/<id>`, `/o/<id>`,
 *      `/wallet/transaction?id=<txId>`) — sumber paling akurat.
 *   2. `referenceType`/`referenceId`, atau pasangan `type` + salah satu
 *      `id | orderId | disputeId | roomId | ticketId | txId | username | token`.
 */
export function routeForPushData(data: unknown): Href | null {
  if (!data || typeof data !== "object") return null
  const d = data as Record<string, unknown>
  const str = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : undefined)

  // 1. actionUrl lebih dulu — payload backend selalu menyertakannya.
  const fromActionUrl = routeForActionUrl(str("actionUrl"))
  if (fromActionUrl) return fromActionUrl

  // 2. Fallback ke referenceType/referenceId atau type + id.
  const referenceType = str("referenceType") ?? str("type") ?? str("kind")
  const referenceId =
    str("referenceId") ??
    str("id") ??
    str("orderId") ??
    str("disputeId") ??
    str("roomId") ??
    str("chatRoomId") ??
    str("ticketId") ??
    str("txId") ??
    str("transactionId") ??
    str("username") ??
    str("token")

  return routeForNotificationReference({ referenceType, referenceId })
}

/**
 * Parse `actionUrl` backend menjadi route internal.
 * Format yang dikenal: `/chat/<id>`, `/order/<id>`, `/o/<id>`,
 * `/dispute/<id>`, `/showcase/<id>`, `/wallet/transaction?id=<txId>`,
 * `/notifications`, `/badges`. Return `null` bila tidak dikenali.
 */
export function routeForActionUrl(actionUrl: string | null | undefined): Href | null {
  if (!actionUrl) return null
  // Hanya path internal; abaikan URL absolut eksternal.
  const path = actionUrl.startsWith("http")
    ? null
    : actionUrl.startsWith("/")
      ? actionUrl
      : `/${actionUrl}`
  if (!path) return null

  const [pathname, query] = path.split("?", 2)
  const segments = pathname.split("/").filter(Boolean)

  if (segments.length >= 2) {
    const [head, ...rest] = segments
    const id = decodeURIComponent(rest.join("/"))
    switch (head) {
      case "chat":
        return ROUTES.chatRoom(id)
      case "order":
      case "o":
        return ROUTES.orderDetail(id)
      case "dispute":
        return ROUTES.disputeDetail(id)
      case "showcase":
        return ROUTES.showcaseDetail(id)
      case "questions":
        // Discovery Q&A — belum ada route khusus, arahkan ke daftar.
        return ROUTES.notifications
      default:
        break
    }
  }

  if (segments.length === 1) {
    switch (segments[0]) {
      case "notifications":
        return ROUTES.notifications
      case "wallet": {
        // /wallet/transaction?id=<txId>
        if (query) {
          const params = new URLSearchParams(query)
          const txId = params.get("id")
          if (txId) return ROUTES.walletTransaction(txId)
        }
        return ROUTES.wallet
      }
      case "badges":
        return ROUTES.notifications
      default:
        break
    }
  }

  return null
}
