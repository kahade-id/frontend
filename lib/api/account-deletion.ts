/**
 * Kahade — domain `account-deletion` (GAP-A G051–G075).
 *
 * Kontrak backend (diverifikasi 2026-09-27):
 *   POST /v1/users/me/delete-request    → DeletionRequestResult (auth)
 *   GET  /v1/users/me/deletion-eligibility → { eligible, blockers[] } (auth)
 *   POST /v1/users/me/deletion-otp      → OTP WhatsApp utk re-auth (auth)
 *   POST /v1/auth/deletion/status       → { requiresOtp, maskedPhone? } (publik)
 *   POST /v1/auth/deletion/status/verify → status + deletionToken (publik)
 *   POST /v1/auth/deletion/cancel       → batalkan (publik, deletionToken)
 *
 * Masa tenggang 30 hari: request aktif berstatus REQUESTED dengan purgeAt =
 * requestedAt + 30 hari. Setelah purgeAt, purge worker menganonimkan data.
 */

import { http } from "@/lib/api/client"
import { asRecord, invalidResponse, pickBoolean, pickNumber, pickString } from "@/lib/api/response"

export type DeletionRequestStatus =
  | "PENDING"
  | "REQUESTED"
  | "CANCELLED"
  | "PURGED"
  | "ON_HOLD"
  | "REJECTED"

export interface DeletionBlocker {
  code: string
  message: string
}

export interface DeletionRequestResult {
  message: string
  referenceCode: string
  status: DeletionRequestStatus
  requestedAt: string
  purgeAt: string
  serverNow: string
}

export interface DeletionEligibility {
  eligible: boolean
  blockers: DeletionBlocker[]
}

export interface DeletionStatus {
  referenceCode: string
  status: DeletionRequestStatus
  requestedAt: string
  purgeAt: string
  daysRemaining: number
  serverNow: string
  deletionToken: string
  deletionTokenExpiresIn: number
}

/** POST /v1/users/me/delete-request — minta penghapusan (auth). */
type RequestDeletionDto = {
  password?: string
  reason?: string
  mfaCode?: string
  otpCode?: string
  idempotencyKey?: string
}

export async function requestAccountDeletion(dto: RequestDeletionDto): Promise<DeletionRequestResult> {
  const raw = await http.post<unknown, RequestDeletionDto>("/v1/users/me/delete-request", dto, {
    auth: "required",
    headers: dto.idempotencyKey ? { "x-idempotency-key": dto.idempotencyKey } : undefined,
  })
  const record = asRecord(raw)
  if (!record) throw invalidResponse("delete-request")
  const referenceCode = pickString(record, ["referenceCode"])
  const purgeAt = pickString(record, ["purgeAt"])
  if (!referenceCode || !purgeAt) throw invalidResponse("delete-request/referenceCode")
  return {
    message: pickString(record, ["message"]) ?? "",
    referenceCode,
    status: (pickString(record, ["status"]) ?? "REQUESTED") as DeletionRequestStatus,
    requestedAt: pickString(record, ["requestedAt"]) ?? "",
    purgeAt,
    serverNow: pickString(record, ["serverNow"]) ?? "",
  }
}

/** GET /v1/users/me/deletion-eligibility — blocker dari server (auth). */
export async function getDeletionEligibility(signal?: AbortSignal): Promise<DeletionEligibility> {
  const raw = await http.get<unknown>("/v1/users/me/deletion-eligibility", {
    auth: "required",
    signal,
  })
  const record = asRecord(raw)
  if (!record) throw invalidResponse("deletion-eligibility")
  const blockersRaw = Array.isArray(record.blockers) ? record.blockers : []
  const blockers: DeletionBlocker[] = blockersRaw.map((b) => {
    const r = asRecord(b) ?? {}
    return {
      code: pickString(r, ["code"]) ?? "UNKNOWN",
      message: pickString(r, ["message"]) ?? "Tidak memenuhi syarat penghapusan.",
    }
  })
  return {
    eligible: pickBoolean(record, ["eligible"]) ?? blockers.length === 0,
    blockers,
  }
}

/** POST /v1/users/me/deletion-otp — OTP WhatsApp utk re-auth (auth). */
export function sendDeletionOtp(): Promise<{ message: string }> {
  return http.post<{ message: string }, Record<string, never>>("/v1/users/me/deletion-otp", {}, { auth: "required" })
}

/**
 * POST /v1/auth/deletion/status — langkah 1 pra-login: cari akun dalam masa
 * tenggang, kirim OTP WhatsApp ke nomor terdaftar (publik).
 */
type DeletionStatusLookupDto = { phoneNumber?: string; email?: string }

export async function requestDeletionStatus(
  dto: DeletionStatusLookupDto,
): Promise<{ requiresOtp: boolean; maskedPhone?: string }> {
  const raw = await http.post<unknown, DeletionStatusLookupDto>("/v1/auth/deletion/status", dto, { auth: "none" })
  const record = asRecord(raw)
  if (!record) throw invalidResponse("deletion-status")
  return {
    requiresOtp: pickBoolean(record, ["requiresOtp"]) ?? false,
    maskedPhone: pickString(record, ["maskedPhone"]),
  }
}

/**
 * POST /v1/auth/deletion/status/verify — langkah 2 pra-login: verifikasi OTP
 * → status lengkap + deletionToken 15 menit. TIDAK membuat sesi login.
 */
type VerifyDeletionStatusDto = { phoneNumber?: string; email?: string; otp: string }

export async function verifyDeletionStatus(dto: VerifyDeletionStatusDto): Promise<DeletionStatus> {
  const raw = await http.post<unknown, VerifyDeletionStatusDto>("/v1/auth/deletion/status/verify", dto, {
    auth: "none",
  })
  const record = asRecord(raw)
  if (!record) throw invalidResponse("deletion-status-verify")
  const deletionToken = pickString(record, ["deletionToken"])
  const referenceCode = pickString(record, ["referenceCode"])
  if (!deletionToken || !referenceCode) throw invalidResponse("deletion-status-verify/token")
  return {
    referenceCode,
    status: (pickString(record, ["status"]) ?? "REQUESTED") as DeletionRequestStatus,
    requestedAt: pickString(record, ["requestedAt"]) ?? "",
    purgeAt: pickString(record, ["purgeAt"]) ?? "",
    daysRemaining: pickNumber(record, ["daysRemaining"]) ?? 0,
    serverNow: pickString(record, ["serverNow"]) ?? "",
    deletionToken,
    deletionTokenExpiresIn: pickNumber(record, ["deletionTokenExpiresIn"]) ?? 900,
  }
}

/**
 * POST /v1/auth/deletion/cancel — batalkan penghapusan pra-login (publik,
 * butuh deletionToken).
 */
type CancelAccountDeletionDto = { deletionToken: string; cancelReason?: string }

export async function cancelAccountDeletion(
  dto: CancelAccountDeletionDto,
): Promise<{ message: string; referenceCode: string; status: DeletionRequestStatus; reactivatedAt: string }> {
  const raw = await http.post<unknown, CancelAccountDeletionDto>("/v1/auth/deletion/cancel", dto, {
    auth: "none",
  })
  const record = asRecord(raw)
  if (!record) throw invalidResponse("deletion-cancel")
  return {
    message: pickString(record, ["message"]) ?? "",
    referenceCode: pickString(record, ["referenceCode"]) ?? "",
    status: (pickString(record, ["status"]) ?? "CANCELLED") as DeletionRequestStatus,
    reactivatedAt: pickString(record, ["reactivatedAt"]) ?? "",
  }
}
