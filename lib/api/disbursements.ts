/**
 * Kahade — status pencairan dana (disbursement) untuk user.
 *
 * KONTRAK KANONIS (2026-09-30, terverifikasi terhadap backend
 * `src/modules/no-wallet/legacy-payout.controller.ts` +
 * `escrow-disbursement.service.ts`):
 *   GET /v1/legacy-payout/disbursements?scope=&limit=
 *     → { items: [{ id, scope, scopeRefId, orderId, amountSen: string,
 *         status, heldReason, lastError, danaReferenceNo, createdAt,
 *         updatedAt }] }
 *
 * scope ∈ ORDER_ESCROW | MILESTONE | DISPUTE_RELEASE | CASHBACK | REFERRAL
 * status ∈ PENDING | HELD_NO_BANK | PROCESSING | SUCCESS | FAILED | CANCELLED
 *
 * Dipakai untuk menampilkan status pencairan ke rekening bank seller
 * (escrow order, milestone, cashback, referral) — tanpa wallet internal.
 */

import { http } from "@/lib/api/client"
import { asRecord, pickString } from "@/lib/api/response"
import { toAmount } from "@/lib/api/orders-shared"

/** Scope pencairan — cerminan `EscrowDisbursementScope` backend. */
export type DisbursementScope =
  | "ORDER_ESCROW"
  | "MILESTONE"
  | "DISPUTE_RELEASE"
  | "CASHBACK"
  | "REFERRAL"

/** Status pencairan — cerminan `EscrowDisbursementStatus` backend. */
export type DisbursementStatus =
  | "PENDING"
  | "HELD_NO_BANK"
  | "PROCESSING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED"

export type Disbursement = {
  id: string
  scope: DisbursementScope | string
  scopeRefId: string | null
  orderId: string | null
  /** Rupiah (backend mengirim `amountSen` sebagai string). */
  amount: number
  status: DisbursementStatus | string
  heldReason: string | null
  lastError: string | null
  danaReferenceNo: string | null
  createdAt: string | null
  updatedAt: string | null
}

function normalizeDisbursement(entry: unknown): Disbursement | undefined {
  const rec = asRecord(entry)
  if (!rec) return undefined
  const id = pickString(rec, ["id"])
  if (!id) return undefined
  return {
    id,
    scope: pickString(rec, ["scope"]) ?? "UNKNOWN",
    scopeRefId: pickString(rec, ["scopeRefId", "scope_ref_id"]) ?? null,
    orderId: pickString(rec, ["orderId", "order_id"]) ?? null,
    amount: toAmount(rec.amountSen ?? rec.amount) ?? 0,
    status: pickString(rec, ["status"]) ?? "UNKNOWN",
    heldReason: pickString(rec, ["heldReason", "held_reason"]) ?? null,
    lastError: pickString(rec, ["lastError", "last_error"]) ?? null,
    danaReferenceNo: pickString(rec, ["danaReferenceNo", "dana_reference_no"]) ?? null,
    createdAt: pickString(rec, ["createdAt", "created_at"]) ?? null,
    updatedAt: pickString(rec, ["updatedAt", "updated_at"]) ?? null,
  }
}

/**
 * Daftar pencairan milik user. `scope` opsional untuk filter
 * (ORDER_ESCROW | MILESTONE | DISPUTE_RELEASE | CASHBACK | REFERRAL).
 * Nilai scope tak dikenal → diabaikan (fail-closed: backend memvalidasi).
 */
export async function getDisbursements(opts?: {
  scope?: DisbursementScope
  limit?: number
  signal?: AbortSignal
}): Promise<Disbursement[]> {
  const params = new URLSearchParams()
  if (opts?.scope) params.set("scope", opts.scope)
  if (opts?.limit) params.set("limit", String(Math.min(Math.max(opts.limit, 1), 100)))
  const qs = params.toString()
  const raw = await http.get<unknown>(`/v1/legacy-payout/disbursements${qs ? `?${qs}` : ""}`, {
    auth: "required",
    signal: opts?.signal,
  })
  // Bentuk respons: { items: [...] } (bukan paginasi standar).
  const rec = asRecord(raw)
  const rawItems = rec?.items
  const items: unknown[] = Array.isArray(rawItems) ? rawItems : []
  return items
    .map(normalizeDisbursement)
    .filter((d): d is Disbursement => d !== undefined)
}

/** Cari pencairan untuk satu order (dipakai layar detail order seller). */
export async function getOrderDisbursement(
  orderId: string,
  opts?: { signal?: AbortSignal },
): Promise<Disbursement | null> {
  const items = await getDisbursements({ scope: "ORDER_ESCROW", limit: 100, signal: opts?.signal })
  return items.find((d) => d.orderId === orderId) ?? null
}

/**
 * Label ringkas status pencairan untuk UI (minimal, tanpa jargon teknis).
 * `heldReason`/`lastError` dari backend dipakai sebagai penjelasan bila ada.
 */
export function disbursementStatusCopy(d: Disbursement): { title: string; description?: string } {
  switch (d.status) {
    case "SUCCESS":
      return { title: "Dana sudah dicairkan" }
    case "PROCESSING":
      return { title: "Pencairan sedang diproses", description: "Dana dalam perjalanan ke rekening bank." }
    case "PENDING":
      return { title: "Pencairan menunggu", description: "Dana akan segera dicairkan ke rekening bank." }
    case "HELD_NO_BANK":
      return {
        title: "Rekening bank belum terdaftar",
        description:
          d.heldReason ?? "Tambahkan rekening bank agar dana bisa dicairkan.",
      }
    case "FAILED":
      return {
        title: "Pencairan gagal",
        description: d.lastError ?? "Coba lagi nanti atau hubungi bantuan.",
      }
    case "CANCELLED":
      return { title: "Pencairan dibatalkan" }
    default:
      return { title: "Status pencairan tidak diketahui" }
  }
}
