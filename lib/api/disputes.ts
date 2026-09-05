/**
 * Kahade — domain `disputes` (sengketa pesanan; evidence, claim, pesan, call).
 *
 * Catatan spec (docs/api/kahade-api-mobile.json): schema
 * `MutualResolutionProposeDto`, `MutualResolutionRespondDto`,
 * `DisputeMessageDto`, dan `CallActionDto` dideklarasikan `type: object`
 * TANPA properti (generator menghasilkan `Record<string, never>`). Layar
 * tidak boleh mengirim `{}` untuk aksi yang jelas butuh data (nominal usulan,
 * accept/reject), maka bentuk body didefinisikan di sini — UNVERIFIED,
 * mengikuti penamaan field respons (`amount`, `note`) dan pola `action`
 * yang dipakai endpoint lain di API ini. Sesuaikan bila spec diperbarui.
 */
import { http, seg } from "@/lib/api/client"
import type { SubmitClaimDto, SubmitEvidenceDto } from "@/lib/api/types"

/** Body POST /mutual-resolution — UNVERIFIED (spec kosong). */
export type MutualResolutionProposeBody = {
  /** Nominal yang diusulkan kembali ke PEMBELI (sisa ke penjual) */
  amount: number
  note?: string
}

/** Body POST /mutual-resolution/{proposalId}/respond — UNVERIFIED (spec kosong). */
export type MutualResolutionRespondBody = {
  action: "ACCEPT" | "REJECT"
  note?: string
}

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

export function listMyDisputes(query?: { page?: number; limit?: number }) {
  return http.get<Array<DisputeDetail>>("/v1/disputes/my", { query, auth: "required", retry: 1 })
}

export function getDispute(disputeId: string) {
  return http.get<DisputeDetail>(`/v1/disputes/${seg(disputeId)}`, { auth: "required", retry: 1 })
}

export function getDisputeEvidence(disputeId: string) {
  return http.get<DisputeEvidence[]>(`/v1/disputes/${seg(disputeId)}/evidence`, {
    auth: "required",
    retry: 1,
  })
}

export function submitDisputeEvidence(disputeId: string, dto: SubmitEvidenceDto) {
  return http.post<DisputeEvidence, SubmitEvidenceDto>(`/v1/disputes/${seg(disputeId)}/evidence`, dto, {
    auth: "required",
  })
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

export function getDisputeMessages(disputeId: string) {
  return http.get<DisputeMessage[]>(`/v1/disputes/${seg(disputeId)}/messages`, {
    auth: "required",
    retry: 1,
  })
}

export function sendDisputeMessage(disputeId: string, text: string) {
  return http.post<DisputeMessage, { text: string }>(`/v1/disputes/${seg(disputeId)}/messages`, {
    text,
  }, { auth: "required" })
}

export function requestDisputeCall(disputeId: string) {
  return http.post<DisputeCall>(`/v1/disputes/${seg(disputeId)}/call/request`, undefined, {
    auth: "required",
  })
}

export function acceptDisputeCall(disputeId: string) {
  return http.post<DisputeCall>(`/v1/disputes/${seg(disputeId)}/call/accept`, undefined, {
    auth: "required",
  })
}

export function rejectDisputeCall(disputeId: string) {
  return http.post<DisputeCall>(`/v1/disputes/${seg(disputeId)}/call/reject`, undefined, {
    auth: "required",
  })
}

export function endDisputeCall(disputeId: string) {
  return http.post<DisputeCall>(`/v1/disputes/${seg(disputeId)}/call/end`, undefined, {
    auth: "required",
  })
}

export function getDisputeCalls(disputeId: string) {
  return http.get<DisputeCall[]>(`/v1/disputes/${seg(disputeId)}/calls`, {
    auth: "required",
    retry: 1,
  })
}

export function getMutualResolution(disputeId: string) {
  return http.get<MutualResolutionProposal[]>(`/v1/disputes/${seg(disputeId)}/mutual-resolution`, {
    auth: "required",
    retry: 1,
  })
}

export function proposeMutualResolution(disputeId: string, dto: MutualResolutionProposeBody) {
  return http.post<MutualResolutionProposal, MutualResolutionProposeBody>(
    `/v1/disputes/${seg(disputeId)}/mutual-resolution`,
    dto,
    { auth: "required" },
  )
}

export function respondMutualResolution(disputeId: string, proposalId: string, dto: MutualResolutionRespondBody) {
  return http.post<MutualResolutionProposal, MutualResolutionRespondBody>(
    `/v1/disputes/${seg(disputeId)}/mutual-resolution/${seg(proposalId)}/respond`,
    dto,
    { auth: "required" },
  )
}

export function withdrawMutualResolution(disputeId: string, proposalId: string) {
  return http.delete<void>(
    `/v1/disputes/${seg(disputeId)}/mutual-resolution/${seg(proposalId)}`,
    { auth: "required", responseType: "void" },
  )
}
