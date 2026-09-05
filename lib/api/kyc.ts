import { readList } from "@/lib/api/response"
/**
 * Kahade — domain `kyc` (verifikasi identitas KTP + selfie).
 */
import { http } from "@/lib/api/client"
import type { SubmitKycDto } from "@/lib/api/types"

export type KycStatus =
  | "UNSUBMITTED"
  | "PENDING"
  | "VERIFIED"
  | "REJECTED"
  | "EXPIRED"
  | (string & {})

/**
 * Status yang dipahami komponen UI (<KycStatusCard>, <KycHistoryListItem>).
 * Spec tidak mendokumentasikan enum status KYC, jadi backend bisa memakai
 * salah satu dari dua kosakata; normalisasi di SATU tempat ini supaya layar
 * tidak salah menampilkan "Belum diverifikasi" untuk akun yang VERIFIED.
 */
export type KycUiStatus = "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED" | "REVOKED"

const KYC_STATUS_ALIASES: Record<string, KycUiStatus> = {
  UNSUBMITTED: "NOT_SUBMITTED",
  NOT_SUBMITTED: "NOT_SUBMITTED",
  NONE: "NOT_SUBMITTED",
  PENDING: "PENDING",
  SUBMITTED: "PENDING",
  IN_REVIEW: "PENDING",
  UNDER_REVIEW: "PENDING",
  VERIFIED: "APPROVED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  EXPIRED: "REVOKED",
  REVOKED: "REVOKED",
}

export function toKycUiStatus(status: KycStatus | null | undefined): KycUiStatus {
  if (!status) return "NOT_SUBMITTED"
  return KYC_STATUS_ALIASES[status.toUpperCase()] ?? "NOT_SUBMITTED"
}

/** Status KYC — UNVERIFIED. */
export type KycState = {
  status: KycStatus
  fullName?: string
  nikMasked?: string
  submittedAt?: string | null
  reviewedAt?: string | null
  rejectionReason?: string | null
}

export type KycHistoryEntry = {
  id: string
  status: KycStatus
  submittedAt: string
  reviewedAt?: string | null
  rejectionReason?: string | null
}

export function getKycStatus() {
  return http.get<KycState>("/v1/kyc/status", { auth: "required", retry: 1 })
}

/** GET /v1/kyc/history — paginated (page ≥1, limit ≤100; default 1/20). */
export function getKycHistory(query: { page?: number; limit?: number } = {}) {
  return http
    .get<KycHistoryEntry[]>("/v1/kyc/history", { query, auth: "required", retry: 1 })
    .then((raw) => readList<KycHistoryEntry>(raw, ["history"]))
}

export function submitKyc(dto: SubmitKycDto) {
  return http.post<KycState, SubmitKycDto>("/v1/kyc/submit", dto, { auth: "required" })
}

export function resubmitKyc(dto: SubmitKycDto) {
  return http.post<KycState, SubmitKycDto>("/v1/kyc/resubmit", dto, { auth: "required" })
}
