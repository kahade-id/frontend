/**
 * Kahade — domain `returns` (GAP-D G201–G225): retur/tukar barang purnajual.
 *
 * Backend: /v1/returns (buyer/seller) + /v1/admin/returns.
 * Status ReturnRequest TERPISAH dari OrderStatus (G202).
 */
import { http } from "@/lib/api/client"
import { readList, readPage, pickString } from "@/lib/api/response"

export type ReturnStatus =
  | "REQUESTED"
  | "SELLER_REVIEW"
  | "CLARIFICATION_NEEDED"
  | "APPROVED"
  | "REJECTED"
  | "RETURN_SHIPPING"
  | "RECEIVED"
  | "RESOLVED_REFUND"
  | "RESOLVED_EXCHANGE"
  | "RESOLVED_REPAIR"
  | "ESCALATED"
  | "CANCELLED"
  | "EXPIRED"

export type ReturnReasonCode =
  | "BARANG_RUSAK"
  | "BARANG_TIDAK_SESUAI_DESKRIPSI"
  | "BARANG_TIDAK_LENGKAP"
  | "BARANG_PALSU"
  | "SALAH_KIRIM_VARIAN"
  | "BARANG_KEDALUWARSA"
  | "KEMASAN_RUSAK_PARAH"
  | "LAINNYA"

export type ReturnResolutionType = "REFUND" | "EXCHANGE" | "REPAIR" | "MUTUAL_AGREED"

export const RETURN_REASON_LABEL: Record<ReturnReasonCode, string> = {
  BARANG_RUSAK: "Barang rusak",
  BARANG_TIDAK_SESUAI_DESKRIPSI: "Tidak sesuai deskripsi",
  BARANG_TIDAK_LENGKAP: "Barang tidak lengkap",
  BARANG_PALSU: "Barang palsu",
  SALAH_KIRIM_VARIAN: "Salah kirim varian",
  BARANG_KEDALUWARSA: "Barang kedaluwarsa",
  KEMASAN_RUSAK_PARAH: "Kemasan rusak parah",
  LAINNYA: "Lainnya",
}

export const RETURN_STATUS_LABEL: Record<ReturnStatus, string> = {
  REQUESTED: "Diajukan",
  SELLER_REVIEW: "Ditinjau penjual",
  CLARIFICATION_NEEDED: "Butuh klarifikasi",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  RETURN_SHIPPING: "Pengiriman balik",
  RECEIVED: "Diterima penjual",
  RESOLVED_REFUND: "Selesai (refund)",
  RESOLVED_EXCHANGE: "Selesai (tukar)",
  RESOLVED_REPAIR: "Selesai (perbaikan)",
  ESCALATED: "Dieskalasi",
  CANCELLED: "Dibatalkan",
  EXPIRED: "Kedaluwarsa",
}

export const RETURN_RESOLUTION_LABEL: Record<ReturnResolutionType, string> = {
  REFUND: "Refund dana",
  EXCHANGE: "Tukar barang",
  REPAIR: "Perbaikan",
  MUTUAL_AGREED: "Kesepakatan bersama",
}

/**
 * UI-T003 (audit UI/UX 2026-09-27): label manusia untuk peran aktor di
 * timeline & catatan negosiasi — enum mentah ("BUYER"/"SELLER") tidak
 * ditampilkan ke pengguna. Fallback ke nilai mentah untuk nilai asing.
 */
export const RETURN_ACTOR_ROLE_LABEL: Record<string, string> = {
  BUYER: "Pembeli",
  SELLER: "Penjual",
}

export type ReturnListItem = {
  id: string
  returnId: string
  orderId: string
  status: ReturnStatus
  reasonCode: ReturnReasonCode
  resolutionType?: ReturnResolutionType | null
  refundAmount?: string | number | null
  sellerRespondBy?: string | null
  createdAt: string
}

export type ReturnDetail = ReturnListItem & {
  buyerId: string
  sellerId: string
  reasonDetail?: string | null
  returnInstructions?: string | null
  shipBy?: string | null
  returnTrackingNumber?: string | null
  returnCourier?: string | null
  receivedAt?: string | null
  disputeId?: string | null
  attachments: Array<{ id: string; fileName: string; fileType: string; fileSize: number; createdAt: string }>
  notes: Array<{ id: string; authorId: string; authorRole: string; message: string; createdAt: string }>
  timeline: Array<{ id: string; event: string; fromStatus?: string | null; toStatus?: string | null; actorRole: string; createdAt: string; metadata?: unknown }>
}

export type ReturnEligibility = {
  eligible: boolean
  reason?: string
  deadlineAt?: string | null
  windowDays?: number
}

export function getReturnEligibility(orderId: string, signal?: AbortSignal) {
  return http.get<ReturnEligibility>("/v1/returns/eligibility", { query: { orderId }, auth: "required", signal })
}

export function listMyReturns(query?: { page?: number; limit?: number; role?: "buyer" | "seller" }, signal?: AbortSignal) {
  const q = { page: query?.page ?? 1, limit: query?.limit ?? 50, role: query?.role }
  return http
    .get<unknown>("/v1/returns/my", { query: q, auth: "required", signal })
    .then((raw) => readPage<ReturnListItem>(raw, q, ["returns", "items"]))
}

export function listOrderReturns(orderId: string, signal?: AbortSignal) {
  return http
    .get<unknown>(`/v1/returns/order/${orderId}`, { auth: "required", signal })
    .then((raw) => readList<ReturnListItem>(raw, ["returns", "items"]))
}

export function getReturn(id: string, signal?: AbortSignal) {
  return http.get<ReturnDetail>(`/v1/returns/${id}`, { auth: "required", signal })
}

export type CreateReturnBody = {
  orderId: string
  itemRef?: string
  reasonCode: ReturnReasonCode
  reasonDetail?: string
  attachments?: Array<{ fileKey: string; fileName: string; fileType: string; fileSize: number }>
}

export function createReturn(body: CreateReturnBody) {
  return http.post<ReturnDetail, CreateReturnBody>("/v1/returns", body, { auth: "required" })
}

export function addReturnNote(id: string, body: { message: string }) {
  return http.post(`/v1/returns/${id}/notes`, body, { auth: "required" })
}

export function cancelReturn(id: string) {
  return http.post(`/v1/returns/${id}/cancel`, undefined, { auth: "required" })
}

/** Seller: mulai meninjau (REQUESTED → SELLER_REVIEW). */
export function reviewReturn(id: string) {
  return http.post(`/v1/returns/${id}/review`, undefined, { auth: "required" })
}

export type RespondReturnBody = {
  /** P2: backend SellerRespondDto memakai `decision`, bukan `action`. */
  decision: "APPROVE" | "REJECT" | "CLARIFY"
  resolutionType?: ReturnResolutionType
  refundAmountSen?: number
  rejectReasonCode?: string
  /** P2: backend hanya kenal `note` (2000 char) — bukan `rejectNote`/`clarificationQuestion`. */
  note?: string
  returnInstructions?: string
}

export function respondReturn(id: string, body: RespondReturnBody) {
  return http.post(`/v1/returns/${id}/respond`, body, { auth: "required" })
}

export function submitReturnTracking(id: string, body: { trackingNumber: string; courier?: string }) {
  return http.post(`/v1/returns/${id}/ship`, body, { auth: "required" })
}

export function confirmReturnReceived(id: string, body?: { note?: string }) {
  return http.post(`/v1/returns/${id}/receive`, body, { auth: "required" })
}

export function resolveReturn(id: string, body: { outcome: "REFUND" | "EXCHANGE" | "REPAIR"; note?: string }) {
  // P2: backend ResolveReturnDto memakai `outcome` (bukan `resolution`) dan
  // tidak mengenal `refundAmountSen`.
  return http.post(`/v1/returns/${id}/resolve`, body, { auth: "required" })
}

/** Eskalasi ke sengketa — backend me-link dispute existing, tidak membuat ganda (G217). */
export function escalateReturn(id: string, body?: { reason?: string }) {
  // P2: backend EscalateReturnDto memakai `reason` (bukan `note`).
  return http.post(`/v1/returns/${id}/escalate`, body, { auth: "required" })
}

export function answerClarification(id: string, body: { message: string }) {
  return http.post(`/v1/returns/${id}/clarify`, body, { auth: "required" })
}

/** FE-055: `formatIdrSen` kini alias helper kanonis — definisi duplikat dihapus. */
export { formatRupiahFromSen as formatIdrSen } from "../format"

export function returnIdShort(r: Pick<ReturnListItem, "returnId">): string {
  return pickString(r as unknown as Record<string, unknown>, ["returnId"]) || "—"
}
