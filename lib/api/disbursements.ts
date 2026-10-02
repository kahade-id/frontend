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
 * scope ∈ ORDER_ESCROW | MILESTONE | LEGACY_WALLET_PAYOUT | DISPUTE_RELEASE
 *        | CASHBACK | REFERRAL
 * status ∈ PENDING | HELD_NO_BANK | PROCESSING | SUCCESS | FAILED | CANCELLED
 *        | NEEDS_REVIEW
 * Kode mentah DANA 00/01-03/04-07 dipetakan via danaRawCodeToDisbursementStatus
 * (00→SUCCESS, 01-03→PROCESSING, 04-07→FAILED; di luar itu NEEDS_REVIEW).
 *
 * Dipakai untuk menampilkan status pencairan ke rekening bank seller
 * (escrow order, milestone, cashback, referral) — tanpa wallet internal.
 */

import { http } from "@/lib/api/client"
import { asRecord, pickString } from "@/lib/api/response"
import { toAmount } from "@/lib/api/orders-shared"

/** Scope pencairan — cerminan `EscrowDisbursementScope` backend.
 *
 * BFI-081: selaraskan ke enum BE — backend juga punya LEGACY_WALLET_PAYOUT
 * (payout satu arah saldo lama); sebelumnya hilang di tipe FE.
 */
export type DisbursementScope =
  | "ORDER_ESCROW"
  | "MILESTONE"
  | "LEGACY_WALLET_PAYOUT"
  | "DISPUTE_RELEASE"
  | "CASHBACK"
  | "REFERRAL"

/** Status pencairan — cerminan `EscrowDisbursementStatus` backend.
 *
 * BFI-081: selaraskan ke enum BE — backend punya NEEDS_REVIEW (status DANA
 * di luar 00–07: JANGAN otomatis FAILED, butuh review manual); sebelumnya
 * hilang di tipe FE sehingga jatuh ke "tidak diketahui".
 */
export type DisbursementStatus =
  | "PENDING"
  | "HELD_NO_BANK"
  | "PROCESSING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED"
  | "NEEDS_REVIEW"

/**
 * BFI-082: kode status mentah DANA → status disbursement kanonis.
 * Cerminan mapping webhook BE (`dana-webhook-disbursement.service.ts`):
 *   00 → SUCCESS · 01/02/03 → PROCESSING · 04/05/06/07 → FAILED.
 * Di luar 00–07 → null (BE: NEEDS_REVIEW, bukan FAILED — keputusan eksplisit
 * 2026-09-30, jangan ditebak).
 */
export function danaRawCodeToDisbursementStatus(code: string): DisbursementStatus | null {
  const c = code.trim()
  if (c === "00") return "SUCCESS"
  if (c === "01" || c === "02" || c === "03") return "PROCESSING"
  if (c === "04" || c === "05" || c === "06" || c === "07") return "FAILED"
  return null
}

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
  /**
   * BFI-084: info refund — backend BELUM expose endpoint user-facing untuk
   * status refund (usulan aditif di GET payment-status, lihat laporan).
   * Field ini defensif (optional chaining di semua pembaca): bila backend
   * kelak mengirim info refund di item disbursement, langsung terbaca tanpa
   * crash; bila tidak ada, null dan UI tidak menampilkan apa-apa.
   */
  refund?: {
    status: string | null
    /** Rupiah. */
    amount: number | null
    refundedAt: string | null
  } | null
}

/**
 * Normalisasi status: terima enum kanonis backend DAN kode mentah DANA
 * ("00".."07") secara defensif — bila suatu item membawa kode mentah,
 * petakan via `danaRawCodeToDisbursementStatus` agar label Indonesia tetap
 * benar (BFI-082).
 */
function normalizeDisbursementStatus(rec: Record<string, unknown>): string {
  const raw =
    pickString(rec, [
      "status",
      "danaStatusCode",
      "dana_status_code",
      "responseCode",
      "response_code",
    ]) ?? "UNKNOWN"
  // Kode mentah DANA ("00".."07") → status kanonis; di luar itu null →
  // NEEDS_REVIEW bila memang kode DANA tak dikenal, selain itu UNKNOWN.
  const mapped = danaRawCodeToDisbursementStatus(raw)
  if (mapped) return mapped
  if (/^\d{2}$/.test(raw)) return "NEEDS_REVIEW"
  return raw
}

function normalizeDisbursement(entry: unknown): Disbursement | undefined {
  const rec = asRecord(entry)
  if (!rec) return undefined
  const id = pickString(rec, ["id"])
  if (!id) return undefined
  // BFI-084: baca info refund secara defensif — semua akses optional.
  const refundRec = asRecord(rec["refund"])
  const refundAmountRaw = refundRec?.["amount"] ?? refundRec?.["amountSen"]
  return {
    id,
    scope: pickString(rec, ["scope"]) ?? "UNKNOWN",
    scopeRefId: pickString(rec, ["scopeRefId", "scope_ref_id"]) ?? null,
    orderId: pickString(rec, ["orderId", "order_id"]) ?? null,
    amount: toAmount(rec.amountSen ?? rec.amount) ?? 0,
    status: normalizeDisbursementStatus(rec),
    heldReason: pickString(rec, ["heldReason", "held_reason"]) ?? null,
    lastError: pickString(rec, ["lastError", "last_error"]) ?? null,
    danaReferenceNo: pickString(rec, ["danaReferenceNo", "dana_reference_no"]) ?? null,
    createdAt: pickString(rec, ["createdAt", "created_at"]) ?? null,
    updatedAt: pickString(rec, ["updatedAt", "updated_at"]) ?? null,
    refund: refundRec
      ? {
          status: pickString(refundRec, ["status"]) ?? null,
          amount: toAmount(refundAmountRaw) ?? null,
          refundedAt: pickString(refundRec, ["refundedAt", "refunded_at"]) ?? null,
        }
      : null,
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

/*
 * BFE-077 (2026-10-03): `getOrderDisbursement` + `getDisbursementStatus`
 * DIHAPUS — dead code (nol pemanggil). Selain mati, `getOrderDisbursement`
 * mencocokkan `d.orderId` dengan id publik padahal backend mengirim id
 * internal (cuid) → tidak akan pernah cocok bila dipakai. Bila dibutuhkan
 * lagi, cocokkan via id publik yang benar.
 */

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
    case "NEEDS_REVIEW":
      // BFI-081: status DANA di luar 00–07 — butuh peninjauan manual,
      // jangan ditampilkan sebagai gagal/sukses (keputusan BE 2026-09-30).
      // Tampilkan sebagai "perlu pengecekan" agar user tidak panik dan tahu
      // ada yang ditangani tim, bukan diam.
      return {
        title: "Pencairan perlu diperiksa",
        description:
          d.lastError ?? "Status dari bank belum jelas — tim kami sedang memeriksanya.",
      }
    default:
      return { title: "Status pencairan tidak diketahui" }
  }
}
