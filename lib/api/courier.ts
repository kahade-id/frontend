/**
 * Kahade — domain `courier` (GAP-D G226–G250): integrasi kurir & tracking.
 *
 * Backend: /v1/courier (quote, booking, tracking) + /v1/admin/courier.
 * Label = fileKey privat; unduhan hanya via signed URL terautentikasi (G234).
 *
 * SATUAN UANG (audit alamat & kurir 2026-10-10, E01/E10): semua biaya di
 * domain ini — `cost` quote, `estimatedCost`/`actualCost` shipment — adalah
 * RUPIAH UTUH (kolom BigInt rupiah di backend), BUKAN sen. Jangan pernah
 * membagi 100; pakai `formatRupiah` langsung.
 */
import { http } from "@/lib/api/client"
import { readList } from "@/lib/api/response"
import { translate } from "@/lib/i18n/translate"

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

/**
 * E11: label status siap tampil (diterjemahkan). Status asing dari backend
 * tampil apa adanya — jangan pernah Badge kosong (UI-T009).
 */
export function shipmentStatusText(status: string): string {
  const label = (SHIPMENT_STATUS_LABEL as Record<string, string>)[status]
  return label ? translate(label) : status
}

/** E07: tone Badge semantik per status — tiba hijau, kendala merah, tak diketahui kuning. */
export function shipmentStatusTone(status: string): "neutral" | "success" | "danger" | "warning" | "info" {
  switch (status) {
    case "DELIVERED":
      return "success"
    case "EXCEPTION":
    case "RETURNED":
      return "danger"
    case "UNKNOWN":
      return "warning"
    case "IN_TRANSIT":
    case "OUT_FOR_DELIVERY":
    case "PICKED_UP":
      return "info"
    default:
      return "neutral"
  }
}

/** Selaras `ShippingQuote` backend (`providers/courier-provider.interface.ts`). */
export type CourierQuote = {
  providerCode: string
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

/** Selaras `QuoteRequestDto` backend (E09). */
export type CourierQuoteRequest = {
  originPostalCode: string
  destinationPostalCode: string
  originCity?: string
  destinationCity?: string
  /** Berat dalam gram (1–100000). */
  weightGrams: number
  sort?: "price" | "eta"
  providers?: string[]
}

export type Shipment = {
  id: string
  /** orderId PUBLIK (`ORD-…`) — A05: backend kini mengirim kode publik, bukan cuid internal. */
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
  /** RUPIAH utuh (string BigInt dari backend). */
  estimatedCost?: string | number | null
  /** RUPIAH utuh (string BigInt dari backend). */
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
 * E02: respons `POST /shipments/:id/refresh` — BUKAN Shipment. `timeout: true`
 * berarti provider tidak merespons (status → UNKNOWN) dan user harus diberi
 * tahu, bukan diam-diam "berhasil".
 */
export type RefreshTrackingResult = {
  status: ShipmentStatus
  /** Jumlah event BARU yang diterapkan (0 = tidak ada update). */
  events: number
  timeout: boolean
}

/** Biaya rupiah dari string BigInt/number backend → number; null bila tidak ada/tidak valid. */
export function courierCostToNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null
  const n = typeof value === "string" ? Number(value) : value
  return Number.isFinite(n) ? n : null
}

/**
 * E04: urutkan timeline TERBARU di atas berdasar waktu kejadian provider
 * (`occurredAt`), jatuh ke `createdAt`. Provider boleh mengirim out-of-order,
 * jadi urutan server (createdAt) bukan urutan perjalanan paket. Stabil untuk
 * waktu yang sama (pertahankan urutan masuk).
 */
export function sortTrackingEventsLatestFirst(events: readonly TrackingEvent[]): TrackingEvent[] {
  const time = (e: TrackingEvent): number => {
    const t = Date.parse(e.occurredAt ?? e.createdAt)
    return Number.isFinite(t) ? t : 0
  }
  return events
    .map((e, index) => ({ e, index, t: time(e) }))
    .sort((a, b) => b.t - a.t || a.index - b.index)
    .map((x) => x.e)
}

/** Teks estimasi tiba "1–3 hari" / "Hari ini" dari ETA backend; null bila tidak ada. */
export function formatEtaDays(etaMinDays: number | null | undefined, etaMaxDays: number | null | undefined): string | null {
  const min = typeof etaMinDays === "number" && etaMinDays >= 0 ? etaMinDays : null
  const max = typeof etaMaxDays === "number" && etaMaxDays >= 0 ? etaMaxDays : null
  if (min === null && max === null) return null
  const lo = min ?? max!
  const hi = max ?? min!
  if (hi === 0) return translate("Hari ini")
  if (lo === hi) return translate("{x} hari", { x: hi })
  return translate("{x}–{y} hari", { x: lo, y: hi })
}

/**
 * BFI-001: selaras `QuoteRequestDto` backend —
 * `destinationPostalCode` (bukan `destPostalCode`); dimensi flat tidak
 * di-whitelist BE (422) sehingga dihapus; filter provider opsional =
 * `providers?: string[]` (BE), bukan field `provider` tunggal.
 */
export function getQuotes(dto: CourierQuoteRequest, signal?: AbortSignal) {
  return http
    .post<{ quotes?: CourierQuote[]; sortedBy?: string }, CourierQuoteRequest>("/v1/courier/quotes", dto, {
      auth: "required",
      signal,
    })
    .then((raw) => ({ quotes: readList<CourierQuote>(raw, ["quotes"]), sortedBy: raw?.sortedBy ?? dto.sort ?? "price" }))
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
  return http.post<RefreshTrackingResult>(`/v1/courier/shipments/${id}/refresh`, undefined, { auth: "required" })
}
