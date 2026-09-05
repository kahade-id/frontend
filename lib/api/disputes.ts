/**
 * Kahade — domain `disputes` (sengketa pesanan; evidence, claim, pesan, call).
 */
import { http, seg } from "@/lib/api/client"
import type {
  MutualResolutionProposeDto,
  MutualResolutionRespondDto,
  SubmitClaimDto,
  SubmitEvidenceDto,
} from "@/lib/api/types"

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
  status: "REQUESTED" | "ACCEPTED" | "REJECTED" | "ENDED" | string
  requesterId?: string
  startedAt?: string
  endedAt?: string
}

export type MutualResolutionProposal = {
  id: string
  proposerId: string
  amount?: number
  note?: string
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN" | string
  createdAt: string
}

/** Sengketa penuh (GET /v1/disputes/{disputeId}). */
export type DisputeDetail = {
  id: string
  orderId: string
  status: string
  claim: string
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

export function proposeMutualResolution(disputeId: string, dto: MutualResolutionProposeDto) {
  return http.post<MutualResolutionProposal, MutualResolutionProposeDto>(
    `/v1/disputes/${seg(disputeId)}/mutual-resolution`,
    dto,
    { auth: "required" },
  )
}

export function respondMutualResolution(disputeId: string, proposalId: string, dto: MutualResolutionRespondDto) {
  return http.post<MutualResolutionProposal, MutualResolutionRespondDto>(
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
