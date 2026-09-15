import { readPage } from "@/lib/api/response"
/**
 * Kahade — domain `business-verification` (badge "Business Verified").
 *
 * Cermin dari `kyc.ts`: submit / resubmit / status / history. Dokumen
 * (NPWP / akta / SIUP, jpg·png·pdf, maks 10MB, maks 5 berkas) diupload
 * terpisah lewat `api.upload.uploadPresigned("BUSINESS_DOCUMENT", …)`
 * lalu `fileKey`-nya dikirim lewat submit.
 *
 * Keputusan non-obvious:
 *   - Hanya akun `accountType === "BUSINESS"` yang boleh submit (backend
 *     menolak 403 selain itu). Gerbang UI ada di layar, adapter tetap
 *     netral — backend adalah sumber kebenaran.
 *   - `resubmit` hanya boleh saat pengajuan terakhir REJECTED + cooldown
 *     24 jam lewat; `submit` untuk pengajuan pertama. Sama seperti KYC,
 *     endpoint dipilih dari status — memanggil yang salah ditolak backend.
 *   - Status dari server dinormalkan `toBusinessVerificationUiStatus()` di
 *     SATU tempat ini (null = belum ada pengajuan = NOT_SUBMITTED) supaya
 *     layar tidak salah menampilkan status.
 */
import { http } from "@/lib/api/client"
import type { SubmitBusinessVerificationDto } from "@/lib/api/types"
import { mapValue } from "@/lib/has-own"

/** Status mentah dari backend (enum Prisma `BusinessVerificationStatus`). */
export type BusinessVerificationStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "REVOKED"
  | (string & {})

/** Status yang dipahami komponen UI. */
export type BusinessVerificationUiStatus =
  | "NOT_SUBMITTED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "REVOKED"

const BIZ_STATUS_ALIASES: Record<string, BusinessVerificationUiStatus> = {
  PENDING: "PENDING",
  SUBMITTED: "PENDING",
  IN_REVIEW: "PENDING",
  UNDER_REVIEW: "PENDING",
  APPROVED: "APPROVED",
  VERIFIED: "APPROVED",
  REJECTED: "REJECTED",
  REVOKED: "REVOKED",
  EXPIRED: "REVOKED",
}

export function toBusinessVerificationUiStatus(
  status: BusinessVerificationStatus | null | undefined,
): BusinessVerificationUiStatus {
  if (!status) return "NOT_SUBMITTED"
  return mapValue(BIZ_STATUS_ALIASES, status.toUpperCase(), "NOT_SUBMITTED")
}

/** Pengajuan terbaru (field `latestRequest` dari GET …/status). */
export type BusinessVerificationLatestRequest = {
  verificationId?: string
  status?: BusinessVerificationStatus
  businessName?: string
  deedNumber?: string | null
  siupNumber?: string | null
  rejectionReason?: string | null
  attemptNumber?: number
  createdAt?: string
  reviewedAt?: string | null
  approvedAt?: string | null
  revokedAt?: string | null
}

/** GET /v1/business-verification/status. */
export type BusinessVerificationState = {
  /** null = belum pernah mengajukan. */
  status: BusinessVerificationStatus | null
  /** Badge "Business Verified" aktif (status APPROVED). */
  isBusinessVerified?: boolean
  latestRequest: BusinessVerificationLatestRequest | null
}

/** Satu baris riwayat (GET …/history, terurut terbaru). */
export type BusinessVerificationHistoryEntry = {
  verificationId: string
  status: BusinessVerificationStatus
  businessName?: string
  rejectionReason?: string | null
  attemptNumber?: number
  createdAt: string
  reviewedAt?: string | null
}

export function getBusinessVerificationStatus(signal?: AbortSignal) {
  return http.get<BusinessVerificationState>("/v1/business-verification/status", {
    auth: "required",
    retry: 1,
    signal,
  })
}

/** GET /v1/business-verification/history — paginated (page ≥1, limit ≤100; default 1/20). */
export function getBusinessVerificationHistory(
  query: { page?: number; limit?: number } = {},
  signal?: AbortSignal,
) {
  return http
    .get<unknown>("/v1/business-verification/history", { query, auth: "required", retry: 1, signal })
    .then((raw) => readPage<BusinessVerificationHistoryEntry>(raw, query, ["requests", "history"]))
}

/** POST /v1/business-verification/submit — pengajuan pertama. */
export function submitBusinessVerification(dto: SubmitBusinessVerificationDto) {
  return http.post<Record<string, unknown>, SubmitBusinessVerificationDto>(
    "/v1/business-verification/submit",
    dto,
    { auth: "required" },
  )
}

/** POST /v1/business-verification/resubmit — hanya setelah REJECTED (+ cooldown 24 jam). */
export function resubmitBusinessVerification(dto: SubmitBusinessVerificationDto) {
  return http.post<Record<string, unknown>, SubmitBusinessVerificationDto>(
    "/v1/business-verification/resubmit",
    dto,
    { auth: "required" },
  )
}
