/**
 * orders-delivery.ts — perpanjangan tenggat + bukti pengiriman (R2 #97:
 * pecahan facade orders.ts). Mutasi tak idempoten → tanpa retry.
 */
import { API_CONSTRAINTS } from "@/lib/api/constraints"
import { assertDtoConstraints } from "@/lib/financial"
import { asRecord, pickString, readList, readPage } from "@/lib/api/response"
import { http, seg } from "@/lib/api/client"
import { toAmount, type DeliveryProof, type Order, type OrderExtension, type PageQuery } from "@/lib/api/orders-shared"
import type {
  ConfirmDeliveryDto,
  RejectDeliveryDto,
  RequestExtensionDto,
  RespondExtensionDto,
  SubmitDeliveryProofDto,
} from "@/lib/api/types"

export function requestExtension(orderId: string, dto: RequestExtensionDto) {
  assertDtoConstraints(dto, API_CONSTRAINTS.RequestExtensionDto)
  return http
    .post<unknown, RequestExtensionDto>(`/v1/orders/${seg(orderId)}/extensions`, dto, {
      auth: "required",
    })
    .then((raw) => normalizeOrderExtension(raw))
}

/**
 * D-03 (audit escrow 2026-09-24): akar sama dengan D-02 — cast polos membuat
 * daftar perpanjangan kosong SENYAP bila backend membungkus dengan kunci
 * `extensions`. Kini `readPage` + normalizer (F-06: `requesterId` dibaca).
 */
export function listExtensions(orderId: string, query: PageQuery, signal?: AbortSignal) {
  return http
    .get<unknown>(`/v1/orders/${seg(orderId)}/extensions`, {
      query,
      auth: "required",
      signal,
    })
    .then((raw) => {
      const page = readPage<OrderExtension & Record<string, unknown>>(raw, query, [
        "extensions",
        "requests",
      ])
      return {
        ...page,
        // I-10: entri tanpa id dibuang (prinsip D-11) — tombol Setujui/Tolak
        // pada entri `id: ""` melempar `seg("")` "Identitas data tidak valid".
        data: page.data.map(normalizeOrderExtension).filter((ext) => ext.id !== ""),
      }
    })
}

export function normalizeOrderExtension(raw: unknown): OrderExtension {
  const item = asRecord(raw) ?? {}
  return {
    id: pickString(item, ["id", "extensionId"]) ?? "",
    extensionDays: toAmount(item.extensionDays ?? item.extension_days ?? item.days) ?? 0,
    reason: pickString(item, ["reason", "note"]) ?? "",
    status: (pickString(item, ["status", "state"]) ?? "PENDING") as OrderExtension["status"],
    note: pickString(item, ["note", "rejectReason", "reject_reason"]) ?? null,
    requesterId: pickString(item, ["requesterId", "requester_id", "requestedBy", "userId"]) ?? null,
    createdAt: pickString(item, ["createdAt", "created_at"]) ?? "",
  }
}

export function respondExtension(orderId: string, extensionId: string, dto: RespondExtensionDto) {
  assertDtoConstraints(dto, API_CONSTRAINTS.RespondExtensionDto)
  return http
    .put<unknown, RespondExtensionDto>(
      `/v1/orders/${seg(orderId)}/extensions/${seg(extensionId)}`,
      dto,
      { auth: "required" },
    )
    .then((raw) => normalizeOrderExtension(raw))
}

// ------------------------------------------------------------------
// Bukti pengiriman
// ------------------------------------------------------------------

export function submitDeliveryProof(orderId: string, dto: SubmitDeliveryProofDto) {
  assertDtoConstraints(dto, API_CONSTRAINTS.SubmitDeliveryProofDto)
  return http
    .post<unknown, SubmitDeliveryProofDto>(`/v1/orders/${seg(orderId)}/delivery-proof`, dto, {
      auth: "required",
    })
    .then((raw) => normalizeDeliveryProof(raw))
}

/**
 * D-01 (audit escrow 2026-09-24): dulu `http.get<DeliveryProof[]>` cast polos —
 * bentuk `{proofs:[…]}`/`{data:[…]}` menjatuhkan SELURUH layar bukti
 * pengiriman ("ps is not iterable") dan escrow macet di IN_DELIVERY.
 * Kini `readList` + `normalizeDeliveryProof` (M-02: status dipaksa string
 * berhuruf besar agar "rejected" yang ejaannya beda tidak dianggap pending).
 */
export function listDeliveryProofs(orderId: string, signal?: AbortSignal) {
  return http
    .get<unknown>(`/v1/orders/${seg(orderId)}/delivery-proof`, {
      auth: "required",
      signal,
    })
    .then((raw) =>
      readList<unknown>(raw, ["deliveryProofs", "proofs"]).map(normalizeDeliveryProof),
    )
}

/**
 * M-02/L-01 (audit escrow 2026-09-24): normalizer bukti pengiriman.
 *   - `status` di-trim + uppercase (kasus salah eja paling lazim: case).
 *   - `fileUrls` dipertahankan apa adanya (URL siap tampil dari server);
 *     pemetaan "bukan URL = jangan dirender sebagai gambar" ada di layar.
 */
export function normalizeDeliveryProof(raw: unknown): DeliveryProof {
  const item = asRecord(raw) ?? {}
  const stringArray = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v !== "") : []
  return {
    id: pickString(item, ["id", "proofId"]) ?? "",
    description: pickString(item, ["description", "note", "notes"]) ?? "",
    fileUrls: stringArray(item.fileUrls ?? item.file_urls ?? item.urls ?? item.files),
    linkUrls: stringArray(item.linkUrls ?? item.link_urls ?? item.links),
    status: (pickString(item, ["status", "state"]) ?? "SUBMITTED").trim().toUpperCase() as DeliveryProof["status"],
    note: pickString(item, ["note", "rejectReason", "reject_reason", "rejectionNote"]) ?? null,
    createdAt: pickString(item, ["createdAt", "created_at"]) ?? "",
  }
}

export function confirmDelivery(
  orderId: string,
  dto: ConfirmDeliveryDto = {},
  idempotencyKey?: string,
) {
  // R2 (audit ronde-2, butir #17): konfirmasi penerimaan melepas dana dari
  // escrow — header idempotensi per-siklus-form (pola C-06 createOrder/payOrder).
  assertDtoConstraints(dto, API_CONSTRAINTS.ConfirmDeliveryDto)
  return http.post<Order, ConfirmDeliveryDto>(
    `/v1/orders/${seg(orderId)}/delivery-proof/confirm`,
    dto,
    {
      auth: "required",
      ...(idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : {}),
    },
  )
}

export function rejectDelivery(orderId: string, dto: RejectDeliveryDto) {
  assertDtoConstraints(dto, API_CONSTRAINTS.RejectDeliveryDto)
  return http
    .post<unknown, RejectDeliveryDto>(`/v1/orders/${seg(orderId)}/delivery-proof/reject`, dto, {
      auth: "required",
    })
    .then((raw) => normalizeDeliveryProof(raw))
}

// ------------------------------------------------------------------
// Order via Link
// ------------------------------------------------------------------
