/**
 * Kahade — domain `courier` (GAP-D G226–G250): integrasi kurir & tracking.
 *
 * Backend: /v1/courier (quote, booking, tracking) + /v1/admin/courier.
 * Label = fileKey privat; unduhan hanya via signed URL terautentikasi (G234).
 */
import { http } from "@/lib/api/client"
import { readList } from "@/lib/api/response"

export type ShipmentStatus =
  | "CREATED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "EXCEPTION"
  | "RETURNED"
  | "UNKNOWN"

export type ShipmentMode = "PICKUP" | "DROPOFF"
export type ShippingCostBearer = "SELLER" | "BUYER" | "SPLIT"
export type ShipmentBookingState = "DRAFT" | "BOOKED" | "FAILED" | "VOIDED"

export const SHIPMENT_STATUS_LABEL: Record<ShipmentStatus, string> = {
  CREATED: "Dibuat",
  PICKED_UP: "Di-pickup",
  IN_TRANSIT: "Dalam perjalanan",
  OUT_FOR_DELIVERY: "Diantar kurir",
  DELIVERED: "Tiba",
  EXCEPTION: "Kendala",
  RETURNED: "Dikembalikan",
  UNKNOWN: "Tidak diketahui",
}

export type CourierQuote = {
  providerCode: string
  providerName: string
  serviceCode: string
  serviceName: string
  /** Ongkir dalam RUPIAH (number) — kontrak backend, BUKAN sen. */
  cost: number
  currency: string
  etaMinDays: number
  etaMaxDays: number
  supportsPickup: boolean
  supportsDropoff: boolean
}

export type Shipment = {
  id: string
  orderId: string
  providerCode: string
  serviceCode?: string | null
  /** BFI-143: nama layanan dari katalog kurir (BE MaskedShipment.serviceName). */
  serviceName?: string | null
  mode: ShipmentMode
  bookingState: ShipmentBookingState
  status: ShipmentStatus
  trackingNumber?: string | null
  costBearer: ShippingCostBearer
  estimatedCost?: string | number | null
  actualCost?: string | number | null
  /** BFI-143: kode mata uang biaya (BE selalu mengirim, mis. "IDR"). */
  currency?: string | null
  etaMinDays?: number | null
  etaMaxDays?: number | null
  slaDueAt?: string | null
  /** BFI-143: flag keterlambatan hitungan server (BE MaskedShipment.slaBreached). */
  slaBreached?: boolean | null
  lastEventAt?: string | null
  isManual: boolean
  manualTrackingNumber?: string | null
  manualCourierName?: string | null
  /** BFI-143: alamat termasking (kota + kode pos) — BE origin/destination. */
  origin?: { city?: string | null; postalCode?: string | null } | null
  destination?: { city?: string | null; postalCode?: string | null } | null
  createdAt: string
}

export type TrackingEvent = {
  id: string
  status: ShipmentStatus
  rawStatus: string
  locationMasked?: string | null
  description?: string | null
  occurredAt?: string | null
  createdAt: string
}

/**
 * BFI-001: selaras `QuoteRequestDto` backend —
 * `destinationPostalCode` (bukan `destPostalCode`); dimensi flat tidak
 * di-whitelist BE (422) sehingga dihapus; filter provider opsional =
 * `providers?: string[]` (BE), bukan field `provider` tunggal.
 */
export type QuoteBody = {
  originPostalCode: string
  destinationPostalCode: string
  weightGrams: number
  originCity?: string
  destinationCity?: string
  sort?: "price" | "eta"
  providers?: string[]
}

export function getQuotes(body: QuoteBody, signal?: AbortSignal) {
  return http
    .post<unknown, QuoteBody>("/v1/courier/quotes", body, { auth: "required", signal })
    .then((raw) => readList<CourierQuote>(raw, ["quotes", "items"]))
}

export type BookShipmentBody = {
  orderId: string
  providerCode: string
  serviceCode: string
  mode: ShipmentMode
  costBearer: ShippingCostBearer
  origin: { name: string; phone: string; address: string; city: string; postalCode: string }
  destination: { name: string; phone: string; address: string; city: string; postalCode: string }
  weightGrams: number
}

export function bookShipment(body: BookShipmentBody) {
  return http.post<Shipment, BookShipmentBody>("/v1/courier/shipments", body, { auth: "required" })
}

export function getShipmentByOrder(orderId: string, signal?: AbortSignal) {
  return http.get<Shipment | null>(`/v1/courier/shipments/by-order/${orderId}`, { auth: "required", signal })
}

export function getShipment(id: string, signal?: AbortSignal) {
  return http.get<Shipment>(`/v1/courier/shipments/${id}`, { auth: "required", signal })
}

export function getTrackingTimeline(id: string, signal?: AbortSignal) {
  return http
    .get<unknown>(`/v1/courier/shipments/${id}/tracking`, { auth: "required", signal })
    .then((raw) => readList<TrackingEvent>(raw, ["events", "items"]))
}

export function refreshTracking(id: string) {
  return http.post<Shipment>(`/v1/courier/shipments/${id}/refresh`, undefined, { auth: "required" })
}

export function voidShipment(id: string, body: { reason: string }) {
  return http.post<Shipment, { reason: string }>(`/v1/courier/shipments/${id}/void`, body, { auth: "required" })
}

export function submitManualResi(id: string, body: { trackingNumber: string; courierName: string }) {
  return http.post<Shipment, { trackingNumber: string; courierName: string }>(`/v1/courier/shipments/${id}/manual-resi`, body, { auth: "required" })
}

/** Path unduh label — signed, expiry singkat; JANGAN di-cache/di-share (G234). */
export function labelDownloadPath(shipmentId: string): string {
  return `/v1/courier/shipments/${shipmentId}/label/file`
}

/** `amount` dalam SEN (bigint di DB) — field backend bernama `amount`, bukan `amountSen`. */
export function requestShippingRefund(shipmentId: string, body: { amount: number; reason: string }) {
  return http.post(`/v1/courier/shipments/${shipmentId}/refunds`, body, { auth: "required" })
}

/** FE-055: `formatIdrSen` kini alias helper kanonis — definisi duplikat dihapus. */
export { formatRupiahFromSen as formatIdrSen } from "../format"
