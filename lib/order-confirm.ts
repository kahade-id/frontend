/**
 * Kahade — aksi "Konfirmasi terima" dari notifikasi (item #24).
 *
 * Dipakai DUA jalur:
 *   1. Push: action button kategori `kahade-order-actions` (expo-notifications
 *      category actions). Mengetuknya membuka app (foreground) lalu dieksekusi
 *      di sini — TIDAK PERNAH background: aksi melepas dana escrow wajib
 *      berjalan dalam sesi foreground yang terverifikasi.
 *   2. In-app: tombol di layar detail notifikasi (`/notification/[id]`) bila
 *      notifikasi merujuk ke order.
 *
 * FAIL-CLOSED: tombol/aksi HANYA tampil/dieksekusi bila API mengonfirmasi
 * order berstatus bisa-dikonfirmasi DAN peran saya pembeli. Ragu (network
 * error, status tak dikenal, peran tak diketahui) = sembunyikan/tolak.
 * Ini cermin gerbang `canReviewDelivery` di `app/order/[id].tsx`
 * (IN_DELIVERY/SHIPPED/DELIVERED × myRole === "BUYER"), tetapi diverifikasi
 * ulang via API saat aksi dipicu — status di push bisa basi.
 *
 * CATATAN BACKEND (TIM B): agar action button muncul di push, payload push
 * untuk tipe ORDER_SHIPPED (dan sejenisnya) harus menyertakan
 * `categoryId: "kahade-order-actions"`. Tanpa itu, push tampil normal tanpa
 * tombol aksi — jalur in-app tetap berfungsi.
 */
import { api } from "@/lib/api"
import { createIdempotencyKey } from "@/lib/api/client"
import { invalidateQueryCache } from "@/lib/query-cache"
import type { Order } from "@/lib/api/orders-shared"

/** Kategori notifikasi expo untuk aksi order (diisi ke push payload backend). */
export const ORDER_ACTION_CATEGORY = "kahade-order-actions"
/** Identifier action button "Konfirmasi terima". */
export const CONFIRM_RECEIPT_ACTION = "kahade-confirm-receipt"

/**
 * Status order di mana pembeli boleh konfirmasi terima (= dana escrow cair
 * ke penjual). Sama dengan `canReviewDelivery` di app/order/[id].tsx.
 */
export const CONFIRM_RECEIPT_STATUSES = ["IN_DELIVERY", "SHIPPED", "DELIVERED"] as const

export type ConfirmEligibility =
  | { eligible: true; order: Order }
  | { eligible: false; reason: string }

const ORDER_REF_TYPES = new Set(["order", "transaction", "escrow"])

function normalizeRefType(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase().replace(/[^a-z]/g, "") : ""
}

/**
 * Ambil orderId dari payload push apa pun bentuknya (fail-closed: null bila
 * tidak ketemu — pemanggil yang menampilkan pesan).
 */
export function orderIdFromPushData(data: unknown): string | null {
  if (!data || typeof data !== "object") return null
  const d = data as Record<string, unknown>
  const direct =
    (typeof d.orderId === "string" && d.orderId) ||
    (typeof d.order_id === "string" && d.order_id) ||
    null
  if (direct) return direct
  const refType = normalizeRefType(d.referenceType ?? d.type)
  const refId = typeof d.referenceId === "string" ? d.referenceId.trim() : ""
  if (refId && (ORDER_REF_TYPES.has(refType) || refType.includes("order"))) return refId
  const actionUrl = typeof d.actionUrl === "string" ? d.actionUrl : ""
  const m = actionUrl.match(/\/order\/([A-Za-z0-9_-]+)/)
  if (m) return m[1]
  return null
}

/** orderId dari notifikasi in-app (referenceType/referenceId terverifikasi). */
export function orderIdFromNotification(notif: {
  referenceType?: string | null
  referenceId?: string | null
  actionUrl?: string | null
}): string | null {
  const type = normalizeRefType(notif.referenceType)
  const id = (notif.referenceId ?? "").trim()
  if (id && ORDER_REF_TYPES.has(type)) return id
  return orderIdFromPushData({
    referenceType: notif.referenceType,
    referenceId: notif.referenceId,
    actionUrl: notif.actionUrl,
  })
}

/**
 * Cek kelayakan via API (GET /v1/orders/:id). Fail-closed: error jaringan,
 * status tak dikenal, atau peran bukan pembeli → tidak eligible.
 */
export async function checkConfirmReceiptEligible(
  orderId: string,
): Promise<ConfirmEligibility> {
  let order: Order
  try {
    order = await api.orders.getOrder(orderId)
  } catch {
    return { eligible: false, reason: "Tidak dapat memuat status pesanan saat ini." }
  }
  if (!order || typeof order !== "object") {
    return { eligible: false, reason: "Data pesanan tidak valid." }
  }
  if (order.myRole !== "BUYER") {
    return { eligible: false, reason: "Hanya pembeli yang dapat konfirmasi terima." }
  }
  if (!(CONFIRM_RECEIPT_STATUSES as readonly string[]).includes(order.status)) {
    return { eligible: false, reason: "Order tidak dalam status yang bisa dikonfirmasi." }
  }
  return { eligible: true, order }
}

/**
 * Eksekusi "Konfirmasi terima": verifikasi ulang kelayakan via API, lalu
 * POST /v1/orders/:id/complete (melepas dana escrow — pola idempotensi sama
 * seperti layar detail order). Setelah sukses: refresh cache + kembalikan
 * order terbaru.
 */
export async function confirmReceipt(orderId: string): Promise<Order> {
  const eligibility = await checkConfirmReceiptEligible(orderId)
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason)
  }
  const result = await api.orders.completeOrder(orderId, createIdempotencyKey())
  invalidateQueryCache()
  return result
}
