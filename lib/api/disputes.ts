import { readList } from "@/lib/api/response"
/**
 * Kahade — domain `disputes` (sengketa pesanan; evidence, claim, pesan, call).
 *
 * Kontrak DTO di sini mengikuti SOURCE BACKEND PRODUKSI (release f498385),
 * bukan spec lama: DisputeMessageDto { message, attachments }, CallActionDto
 * { callId }, MutualResolutionProposeDto { buyerPercent, sellerPercent,
 * reason }, MutualResolutionRespondDto { action, responseNote }. Spec lama
 * mendeklarasikan keempatnya sebagai objek KOSONG dan telah menyebabkan
 * bug body 400 di tiga fitur sengketa.
 */
import { http, seg } from "@/lib/api/client"
import type {
  CallActionDto,
  DisputeMessageDto,
  MutualResolutionProposeDto,
  MutualResolutionRespondDto,
  SubmitClaimDto,
  SubmitEvidenceDto,
} from "@/lib/api/types"

/**
 * POST /mutual-resolution — produksi memakai PERSENTASE pembagian
 * (buyerPercent + sellerPercent = 100, integer) + alasan 10–2000 char.
 * Kontrak lama { amount, note } tidak pernah diterima backend (DTO produksi
 * MutualResolutionProposeDto menolak field amount/note).
 */
export type MutualResolutionProposeBody = MutualResolutionProposeDto

export type MutualResolutionRespondBody = MutualResolutionRespondDto

/** Bukti sengketa — UNVERIFIED. */
export type DisputeEvidence = {
  id: string
  url?: string
  fileKey?: string
  fileType?: string
  description?: string
  uploadedByMe?: boolean
  mine?: boolean
  createdAt: string
}

/** Pesan dalam ruang sengketa. */
export type DisputeMessage = {
  id: string
  text: string
  fromUser: boolean
  createdAt: string
}

/** Panggilan (record) — UNVERIFIED. */
export type DisputeCall = {
  id: string
  status: "REQUESTED" | "ACCEPTED" | "REJECTED" | "ENDED" | "MISSED" | "CANCELLED" | string
  requesterId?: string
  requestedAt?: string
  startedAt?: string
  endedAt?: string
  durationSeconds?: number
  withMediator?: boolean
  createdAt?: string
}

export type MutualResolutionProposal = {
  id: string
  proposerId: string
  /** Nominal ke pembeli — UNVERIFIED */
  amount?: number
  buyerAmount?: number
  sellerAmount?: number
  note?: string
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN" | "EXPIRED" | string
  createdAt: string
  respondedAt?: string | null
  expiresAt?: string | null
}

/** Sengketa penuh (GET /v1/disputes/{disputeId}). */
export type DisputeDetail = {
  id: string
  orderId: string
  status: string
  claim: string
  /** Pihak pembuka sengketa — UNVERIFIED */
  openedById?: string
  createdAt: string
  updatedAt?: string
  messages?: DisputeMessage[]
}

export function listMyDisputes(query?: { page?: number; limit?: number }, signal?: AbortSignal) {
  return http
    .get<Array<DisputeDetail>>("/v1/disputes/my", { query, auth: "required", retry: 1, signal })
    .then((raw) => readList<DisputeDetail>(raw, ["disputes"]))
}

export function getDispute(disputeId: string, signal?: AbortSignal) {
  return http.get<DisputeDetail>(`/v1/disputes/${seg(disputeId)}`, { auth: "required", retry: 1, signal })
}

export function getDisputeEvidence(disputeId: string, signal?: AbortSignal) {
  return http
    .get<DisputeEvidence[]>(`/v1/disputes/${seg(disputeId)}/evidence`, {
      auth: "required",
      retry: 1,
      signal,
    })
    .then((raw) => readList<DisputeEvidence>(raw, ["evidence", "evidences"]))
}

export function submitDisputeEvidence(disputeId: string, dto: SubmitEvidenceDto) {
  return http.post<DisputeEvidence, SubmitEvidenceDto>(
    `/v1/disputes/${seg(disputeId)}/evidence`,
    dto,
    {
      auth: "required",
    },
  )
}

export function deleteDisputeEvidence(disputeId: string, evidenceId: string) {
  return http.delete<void>(`/v1/disputes/${seg(disputeId)}/evidence/${seg(evidenceId)}`, {
    auth: "required",
    responseType: "void",
  })
}

export function submitDisputeClaim(disputeId: string, dto: SubmitClaimDto) {
  return http.post<DisputeDetail, SubmitClaimDto>(`/v1/disputes/${seg(disputeId)}/claim`, dto, {
    auth: "required",
  })
}

export function getDisputeMessages(disputeId: string, signal?: AbortSignal) {
  return http
    .get<DisputeMessage[]>(`/v1/disputes/${seg(disputeId)}/messages`, {
      auth: "required",
      signal,
    })
    .then((raw) => readList<DisputeMessage>(raw, ["messages"]))
}

export function sendDisputeMessage(disputeId: string, text: string) {
  // DTO produksi: DisputeMessageDto { message?, attachments? } — bukan { text }.
  return http.post<DisputeMessage, DisputeMessageDto>(
    `/v1/disputes/${seg(disputeId)}/messages`,
    { message: text },
    { auth: "required" },
  )
}

export function requestDisputeCall(disputeId: string) {
  return http.post<DisputeCall>(`/v1/disputes/${seg(disputeId)}/call/request`, undefined, {
    auth: "required",
  })
}

/**
 * Aksi panggilan produksi memakai CallActionDto { callId } WAJIB — bukan {}
 * seperti spec lama. `callId` = id panggilan dari GET /calls (atau respons
 * POST /call/request). Tanpa callId backend menolak 400 "callId should not
 * be empty".
 */
export function acceptDisputeCall(disputeId: string, callId: string) {
  return http.post<DisputeCall, CallActionDto>(
    `/v1/disputes/${seg(disputeId)}/call/accept`,
    { callId },
    { auth: "required" },
  )
}

export function rejectDisputeCall(disputeId: string, callId: string) {
  return http.post<DisputeCall, CallActionDto>(
    `/v1/disputes/${seg(disputeId)}/call/reject`,
    { callId },
    { auth: "required" },
  )
}

export function endDisputeCall(disputeId: string, callId: string) {
  return http.post<DisputeCall, CallActionDto>(
    `/v1/disputes/${seg(disputeId)}/call/end`,
    { callId },
    { auth: "required" },
  )
}

export function getDisputeCalls(disputeId: string, signal?: AbortSignal) {
  return http
    .get<DisputeCall[]>(`/v1/disputes/${seg(disputeId)}/calls`, {
      auth: "required",
      signal,
    })
    .then((raw) => readList<DisputeCall>(raw, ["calls"]))
}

export function getMutualResolution(disputeId: string, signal?: AbortSignal) {
  return http
    .get<MutualResolutionProposal[]>(`/v1/disputes/${seg(disputeId)}/mutual-resolution`, {
      auth: "required",
      retry: 1,
      signal,
    })
    .then((raw) => readList<MutualResolutionProposal>(raw, ["proposals"]))
}

export function proposeMutualResolution(disputeId: string, dto: MutualResolutionProposeBody) {
  return http.post<MutualResolutionProposal, MutualResolutionProposeBody>(
    `/v1/disputes/${seg(disputeId)}/mutual-resolution`,
    dto,
    { auth: "required" },
  )
}

export function respondMutualResolution(
  disputeId: string,
  proposalId: string,
  dto: MutualResolutionRespondBody,
) {
  return http.post<MutualResolutionProposal, MutualResolutionRespondBody>(
    `/v1/disputes/${seg(disputeId)}/mutual-resolution/${seg(proposalId)}/respond`,
    dto,
    { auth: "required" },
  )
}

export function withdrawMutualResolution(disputeId: string, proposalId: string) {
  return http.delete<void>(`/v1/disputes/${seg(disputeId)}/mutual-resolution/${seg(proposalId)}`, {
    auth: "required",
    responseType: "void",
  })
}

/**
 * POST /v1/disputes/{id}/escalate — eskalasi manual ke admin (8.3).
 * Body `{reason?}` (controller memakai tipe inline anonim, tanpa class DTO).
 * Syarat backend: pemanggil = salah satu pihak sengketa; status bukan
 * RESOLVED/ESCALATED; maks 2x eskalasi per sengketa.
 */
export function escalateDispute(disputeId: string, reason?: string) {
  return http.post<Record<string, unknown>, { reason?: string }>(
    `/v1/disputes/${seg(disputeId)}/escalate`,
    { ...(reason && reason.trim() ? { reason: reason.trim() } : {}) },
    { auth: "required" },
  )
}
