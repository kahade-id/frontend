/**
 * Kahade — domain `kyc` (verifikasi identitas KTP + selfie).
 */

import { readList } from "@/lib/api/response"

import { http } from "@/lib/api/client"
import type { SubmitKycDto } from "@/lib/api/types"
import { mapValue } from "@/lib/has-own"

/**
 * Status KYC mentah dari backend — selaras enum Prisma `KycStatus`
 * (UNVERIFIED|PENDING|APPROVED|REJECTED|REVOKED, kyc.service#getStatus:
 * `UNVERIFIED` bila belum pernah mengajukan).
 *
 * ESI-005 (audit integrasi 2026-09-30): kosakata lama
 * (UNSUBMITTED/VERIFIED/EXPIRED) TIDAK PERNAH dikirim backend — tiga dari
 * lima nilai lama tidak ada di enum backend. Jangan dipakai lagi untuk
 * logika; hanya dipertahankan di `KYC_STATUS_ALIASES` sebagai toleransi.
 */
export type KycStatus =
  | "UNVERIFIED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "REVOKED"
  | (string & {})

/**
 * Status yang dipahami komponen UI (<KycStatusCard>, <KycHistoryListItem>).
 * Backend mengirim kosakata `KycStatus` (UNVERIFIED|PENDING|APPROVED|REJECTED|
 * REVOKED); normalisasi di SATU tempat ini supaya layar tidak salah
 * menampilkan "Belum diverifikasi" untuk akun yang APPROVED.
 *
 * ESI-005 (audit integrasi 2026-09-30): nilai lama (UNSUBMITTED/VERIFIED/
 * EXPIRED) dipertahankan HANYA sebagai alias toleransi data cache lama —
 * backend tidak pernah mengirimnya.
 */
export type KycUiStatus = "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED" | "REVOKED"

const KYC_STATUS_ALIASES: Record<string, KycUiStatus> = {
  // Nilai resmi backend:
  UNVERIFIED: "NOT_SUBMITTED",
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  REVOKED: "REVOKED",
  // Alias toleransi (tak pernah dikirim backend; ESI-005):
  UNSUBMITTED: "NOT_SUBMITTED",
  NOT_SUBMITTED: "NOT_SUBMITTED",
  NONE: "NOT_SUBMITTED",
  SUBMITTED: "PENDING",
  IN_REVIEW: "PENDING",
  UNDER_REVIEW: "PENDING",
  VERIFIED: "APPROVED",
  EXPIRED: "REVOKED",
}

export function toKycUiStatus(status: KycStatus | null | undefined): KycUiStatus {
  if (!status) return "NOT_SUBMITTED"
  return mapValue(KYC_STATUS_ALIASES, status.toUpperCase(), "NOT_SUBMITTED")
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

/**
 * Bentuk mentah GET /v1/kyc/status dari backend (kyc.service#getStatus):
 * `{ status, latestRequest: { kycId, status, rejectionReason, attemptNumber,
 * createdAt, reviewedAt } | null }`.
 *
 * Audit 2026-09-26: tipe `KycState` (flat) ditulis manual dan TIDAK cocok
 * dengan respons backend (nested) — akibatnya `rejectionReason`,
 * `submittedAt`, dan `reviewedAt` selalu `undefined` di layar: user TIDAK
 * pernah melihat alasan penolakan di kartu status. Normalisasi di SATU
 * tempat ini, bukan di layar.
 */
type RawKycLatestRequest = {
  kycId: string
  status: KycStatus
  rejectionReason?: string | null
  attemptNumber?: number
  createdAt?: string
  reviewedAt?: string | null
  nikMasked?: string | null
  fullName?: string | null
}

type RawKycStatusResponse = {
  status: KycStatus
  latestRequest: RawKycLatestRequest | null
}

export function getKycStatus(signal?: AbortSignal) {
  return http
    .get<RawKycStatusResponse>("/v1/kyc/status", { auth: "required", retry: 1, signal })
    .then((raw): KycState => {
      const latest = raw?.latestRequest ?? null
      return {
        status: raw?.status ?? "UNVERIFIED",
        fullName: latest?.fullName ?? undefined,
        nikMasked: latest?.nikMasked ?? undefined,
        submittedAt: latest?.createdAt ?? null,
        reviewedAt: latest?.reviewedAt ?? null,
        rejectionReason: latest?.rejectionReason ?? null,
      }
    })
}

/**
 * Bentuk mentah satu baris GET /v1/kyc/history dari backend
 * (createPaginatedResponse): `{ kycId, status, rejectionReason,
 * attemptNumber, createdAt, reviewedAt }`.
 *
 * Audit 2026-09-26: frontend memakai `id`/`submittedAt` — backend memakai
 * `kycId`/`createdAt` — sehingga `key={h.id}` selalu undefined dan tanggal
 * pengajuan selalu "—". Dipetakan di sini.
 */
type RawKycHistoryEntry = {
  kycId: string
  status: KycStatus
  rejectionReason?: string | null
  attemptNumber?: number
  createdAt: string
  reviewedAt?: string | null
}

/** GET /v1/kyc/history — paginated (page ≥1, limit ≤100; default 1/20). */
export function getKycHistory(query: { page?: number; limit?: number } = {}, signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/kyc/history", { query, auth: "required", retry: 1, signal })
    .then((raw) =>
      readList<RawKycHistoryEntry>(raw, ["history"]).map(
        (e): KycHistoryEntry => ({
          id: e.kycId,
          status: e.status,
          submittedAt: e.createdAt,
          reviewedAt: e.reviewedAt ?? null,
          rejectionReason: e.rejectionReason ?? null,
        }),
      ),
    )
}

export function submitKyc(dto: SubmitKycDto) {
  return http.post<KycState, SubmitKycDto>("/v1/kyc/submit", dto, { auth: "required" })
}

export function resubmitKyc(dto: SubmitKycDto) {
  return http.post<KycState, SubmitKycDto>("/v1/kyc/resubmit", dto, { auth: "required" })
}
