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

export function getKycHistory() {
  return http.get<KycHistoryEntry[]>("/v1/kyc/history", { auth: "required", retry: 1 })
}

export function submitKyc(dto: SubmitKycDto) {
  return http.post<KycState, SubmitKycDto>("/v1/kyc/submit", dto, { auth: "required" })
}

export function resubmitKyc(dto: SubmitKycDto) {
  return http.post<KycState, SubmitKycDto>("/v1/kyc/resubmit", dto, { auth: "required" })
}

