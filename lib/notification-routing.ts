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
  /**
   * SH-F-008 (audit 2026-09-27): id komentar untuk deep-link highlight
   * (`?comment=<id>` di detail etalase). Payload backend saat ini TIDAK
   * mendokumentasikan field ini — gap kontrak; bila tak tersedia, route
   * jatuh ke detail polos (highlight tidak menyala).
   */
  commentId?: string | null
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
    // Nilai `type`/`notificationType` di payload push backend untuk pesan chat:
    // `type: "CHAT_NEW"` (chat.service) dan enum `CHAT_NEW_MESSAGE`. Tanpa
    // alias ini, push chat yang tiba TANPA `actionUrl` jatuh ke tab Notifikasi
    // alih-alih membuka ruang chat.
    case "chatnew":
    case "chatnewmessage":
      return id ? ROUTES.chatRoom(id) : ROUTES.chat
    case "supportticket":
    case "ticket":
    case "support":
    // F15: backend mengirim `SUPPORT_TICKET_UPDATE` saat status tiket berubah
    // (admin-support.service → emitNotificationCreated).
    case "supportticketupdate":
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
      // Audit Etalase I-02: notifikasi suka karya → detail item.
      return id ? ROUTES.showcaseDetail(id) : ROUTES.showcase
    case "showcasecomment": {
      // SH-F-008: teruskan id komentar bila payload menyediakannya agar
      // highlight `?comment=` di detail menyala; tanpa id komentar → detail
      // polos (gap kontrak payload, bukan bug routing).
      const comment = ref.commentId?.trim()
      return id ? ROUTES.showcaseDetail(id, { comment: comment || undefined }) : ROUTES.showcase
    }
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
    case "chatnew":
    case "chatnewmessage":
      return "Buka chat"
    case "supportticket":
    case "ticket":
    case "support":
    case "supportticketupdate":
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
  // `notificationType` ikut dibaca: payload push backend selalu menyertakan
  // enum kanonisnya (mis. CHAT_NEW_MESSAGE) walau `type`-nya alias
  // (CHAT_NEW) — keduanya dinormalisasi ke alias tabel di atas.
  const referenceType = str("referenceType") ?? str("type") ?? str("notificationType") ?? str("kind")
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
  // SH-F-008: id komentar untuk highlight deep-link; kunci payload tidak
  // didokumentasikan backend (gap kontrak) — terima varian yang lazim.
  const commentId = str("commentId") ?? str("comment_id") ?? str("comment")

  return routeForNotificationReference({ referenceType, referenceId, commentId })
}

/**
 * Parse `actionUrl` backend menjadi route internal.
 * Format yang dikenal: `/chat/<id>`, `/order/<id>`, `/o/<id>`,
 * `/dispute/<id>`, `/showcase/<id>`, `/support/tickets/<id>` (F15),
 * `/wallet/transaction?id=<txId>`, `/notifications`, `/badges`. Return `null` bila tidak dikenali.
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
    // Query diparse di sini juga: bentuk `/wallet/transaction?id=<txId>`
    // (payload push backend) punya DUA segmen, bukan satu.
    const params = new URLSearchParams(query ?? "")
    switch (head) {
      case "chat":
        return ROUTES.chatRoom(id)
      case "order":
      case "o":
        return ROUTES.orderDetail(id)
      case "dispute":
        return ROUTES.disputeDetail(id)
      case "support": {
        // F15: `/support/tickets/<id>` atau `/support/<id>` (actionUrl push
        // status tiket) → detail tiket; `/support` → daftar tiket.
        const tail = rest[rest.length - 1]
        return tail ? ROUTES.supportTicket(tail) : ROUTES.support
      }
      case "showcase":
        return ROUTES.showcaseDetail(id)
      case "wallet": {
        // /wallet/transaction?id=<txId> → detail mutasi; /wallet/<lainnya> → dompet.
        const txId = params.get("id")
        return txId ? ROUTES.walletTransaction(txId) : ROUTES.wallet
      }
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
        // Bentuk satu-segmen ber-query (`/wallet?id=<txId>`) — robustness.
        const txId = new URLSearchParams(query ?? "").get("id")
        return txId ? ROUTES.walletTransaction(txId) : ROUTES.wallet
      }
      case "badges":
        return ROUTES.notifications
      case "support":
        return ROUTES.support
      default:
        break
    }
  }

  return null
}
