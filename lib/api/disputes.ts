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

import { pickString, readList, readPage } from "@/lib/api/response"

import { API_CONSTRAINTS } from "@/lib/api/constraints"
import { LOCAL_CONSTRAINTS } from "@/lib/api/local-constraints"
import { assertDtoConstraints } from "@/lib/financial"
import { toAmount } from "@/lib/api/orders"
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
  /** Persentase pembagian (kontrak PRODUKSI) — UNVERIFIED, alias di I-23. */
  buyerPercent?: number
  sellerPercent?: number
  sellerNote?: string
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

/**
 * I-21 (audit end-to-end 2026-09-24): whitelist + alias detail sengketa —
 * dulu `getDispute` mengembalikan mentahan `as DisputeDetail`; `orderId`
 * snake_case (`order_id`) dan `claim` alternatif (`reason`/`title`) tidak
 * terbaca → tautan "Lihat transaksi" dan judul klaim kosong.
 */
function normalizeDisputeDetail(raw: DisputeDetail): DisputeDetail {
  const d = (raw ?? {}) as unknown as Record<string, unknown>
  const claimRaw = d.claim ?? d.reason ?? d.title ?? d.description
  return {
    id: pickString(d, ["id", "disputeId", "dispute_id"]) ?? "",
    orderId: pickString(d, ["orderId", "order_id", "transactionId", "transaction_id"]) ?? "",
    status: pickString(d, ["status", "state"]) ?? "",
    claim: typeof claimRaw === "string" ? claimRaw : "",
    openedById: pickString(d, ["openedById", "opened_by_id", "claimantId", "claimant_id", "reporterId"]),
    createdAt: pickString(d, ["createdAt", "created_at", "openedAt", "opened_at"]) ?? "",
    updatedAt: pickString(d, ["updatedAt", "updated_at", "lastUpdatedAt"]),
    messages: Array.isArray(d.messages) ? (d.messages as DisputeMessage[]) : undefined,
  }
}

/** E-09/R2: seluruh 7 MIME kontrak bukti (sentral di lib/, bukan layar). */
export type EvidenceFileType = SubmitEvidenceDto["fileTypes"][number]
export const EVIDENCE_FILE_TYPES: readonly EvidenceFileType[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]

export function listMyDisputes(query?: { page?: number; limit?: number }, signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/disputes/my", { query, auth: "required", retry: 1, signal })
    .then((raw) => {
      // M-52 (audit end-to-end 2026-09-24, issue #43): hasil berbentuk `Page`
      // (readPage) supaya layar bisa memuat halaman berikutnya — dulu hanya
      // `readList` polos dan layar memuat 50 baris pertama tanpa load-more.
      // Id sintetis page-qualified (pola D-11) untuk entri tanpa id server.
      const page = readPage<unknown>(raw, query ?? { page: 1, limit: 50 }, ["disputes"])
      return {
        ...page,
        data: page.data.map((entry, index) => {
          const d = normalizeDisputeDetail((entry ?? {}) as DisputeDetail)
          return d.id ? d : { ...d, id: `d-${page.meta.page}-${index}` }
        }),
      }
    })
}

export function getDispute(disputeId: string, signal?: AbortSignal) {
  return http
    .get<DisputeDetail>(`/v1/disputes/${seg(disputeId)}`, { auth: "required", retry: 1, signal })
    .then(normalizeDisputeDetail)
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
  // I-22 (audit end-to-end): validasi DTO sebelum kirim — dulu bukti pendek
  // dikirim, backend menolak 400 berisi jargon validasi (temuan B-13, P-J).
  assertDtoConstraints(dto, API_CONSTRAINTS.SubmitEvidenceDto)
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
  // I-22: lihat submitDisputeEvidence — deskripsi < 20 char dulu lolos ke 400.
  assertDtoConstraints(dto, API_CONSTRAINTS.SubmitClaimDto)
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
    .then((raw) => {
      const list = readList<DisputeMessage>(raw, ["messages"])
      return list.map(normalizeDisputeMessage).filter((m): m is DisputeMessage => m !== null)
    })
}

/**
 * D-13 (audit escrow 2026-09-24): DTO produksi memakai `message`, tipe klien
 * lama membaca `text` — bubble kosong bila server mengirim `message`.
 * `text` dinormalisasi dari `text|message|content`; tanpa isi yang terbaca,
 * baris dibuang (pesan kosong bukan bukti komunikasi).
 */
function normalizeDisputeMessage(raw: DisputeMessage): DisputeMessage | null {
  const record = raw as unknown as Record<string, unknown>
  const text =
    typeof record.text === "string" && record.text
      ? record.text
      : typeof record.message === "string" && record.message
        ? record.message
        : typeof record.content === "string" && record.content
          ? record.content
          : ""
  if (!text) return null
  // M-55 (audit end-to-end 2026-09-24, issue #55): cast mentah dibatasi —
  // `fromUser` membaca alias `mine|fromMe` dan `direction` ("OUT"/"SENT" =
  // milik saya), `createdAt` tipe-ketat (D-03). Dulu `direction`/timestamp
  // aneh lolos apa adanya ke bubble dan format waktu.
  const direction = pickString(record, ["direction", "dir", "side"])
  const fromUser =
    record.fromUser === true ||
    record.mine === true ||
    record.fromMe === true ||
    direction === "OUT" ||
    direction === "SENT" ||
    direction === "OWN"
  const createdAtRaw = record.createdAt ?? record.created_at ?? record.sentAt ?? record.sent_at
  return {
    id: pickString(record, ["id", "messageId", "message_id"]) ?? "",
    text,
    fromUser,
    createdAt: typeof createdAtRaw === "string" ? createdAtRaw : "",
  }
}

export function sendDisputeMessage(disputeId: string, text: string) {
  // DTO produksi: DisputeMessageDto { message?, attachments? } — bukan { text }.
  // I-22: lihat submitDisputeEvidence (assert pesan kosong/terlalu panjang).
  assertDtoConstraints({ message: text }, API_CONSTRAINTS.DisputeMessageDto)
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
  // I-22: lihat submitDisputeEvidence (assert callId kosong sebelum 400).
  assertDtoConstraints({ callId }, API_CONSTRAINTS.CallActionDto)
  return http.post<DisputeCall, CallActionDto>(
    `/v1/disputes/${seg(disputeId)}/call/accept`,
    { callId },
    { auth: "required" },
  )
}

export function rejectDisputeCall(disputeId: string, callId: string) {
  // I-22: lihat acceptDisputeCall.
  assertDtoConstraints({ callId }, API_CONSTRAINTS.CallActionDto)
  return http.post<DisputeCall, CallActionDto>(
    `/v1/disputes/${seg(disputeId)}/call/reject`,
    { callId },
    { auth: "required" },
  )
}

export function endDisputeCall(disputeId: string, callId: string) {
  // I-22: lihat acceptDisputeCall.
  assertDtoConstraints({ callId }, API_CONSTRAINTS.CallActionDto)
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
    .then((raw) =>
      // M-55 (audit end-to-end, issue #55): item panggilan dinormalisasi —
      // dulu `readList<DisputeCall>` cast mentah (`createdAt`/`status`/id
      // snake_case tidak terbaca).
      readList<unknown>(raw, ["calls", "records"]).map((entry) => {
        const c = (entry ?? {}) as unknown as Record<string, unknown>
        const createdAtRaw = c.createdAt ?? c.created_at ?? c.requestedAt ?? c.requested_at
        return {
          id: pickString(c, ["id", "callId", "call_id"]) ?? "",
          status: (pickString(c, ["status", "callStatus", "call_status"]) ?? "") as DisputeCall["status"],
          requesterId: pickString(c, ["requesterId", "requester_id", "callerId", "caller_id"]),
          requestedAt: pickString(c, ["requestedAt", "requested_at"]),
          startedAt: pickString(c, ["startedAt", "started_at"]),
          endedAt: pickString(c, ["endedAt", "ended_at"]),
          durationSeconds: toAmount(c.durationSeconds ?? c.duration_seconds),
          withMediator: c.withMediator === true,
          createdAt: typeof createdAtRaw === "string" ? createdAtRaw : undefined,
        } as DisputeCall
      }),
    )
}

/**
 * I-23 (audit end-to-end): normalisasi proposal resolusi — dulu dikembalikan
 * `as MutualResolutionProposal[]` mentah: `buyer_amount`/`seller_amount`
 * snake_case dan `buyer_percent`/`seller_percent` (kontrak PRODUKSI adalah
 * persentase, lihat catatan MutualResolutionProposeBody) tidak terbaca →
 * nominal/persen proposal tampil undefined, alias `amount`→buyer hilang.
 */
function normalizeMutualProposal(raw: unknown): MutualResolutionProposal {
  const p = (raw ?? {}) as unknown as Record<string, unknown>
  const createdAtRaw = p.createdAt ?? p.created_at ?? p.proposedAt ?? p.proposed_at
  const respondedAtRaw = p.respondedAt ?? p.responded_at
  const expiresAtRaw = p.expiresAt ?? p.expires_at
  return {
    id: pickString(p, ["id", "proposalId", "proposal_id", "mutualResolutionId", "mutual_resolution_id"]) ?? "",
    proposerId: pickString(p, ["proposerId", "proposer_id", "proposerUserId", "proposer_user_id", "buyerUserId", "buyer_user_id"]) ?? "",
    // I-23: `amount` = alias nominal-ke-pembeli (temuan audit B-16) — dipertahankan.
    amount: toAmount(p.amount ?? p.buyerAmount ?? p.buyer_amount ?? p.buyerPercent ?? p.buyer_percent),
    buyerAmount: toAmount(p.buyerAmount ?? p.buyer_amount),
    sellerAmount: toAmount(p.sellerAmount ?? p.seller_amount),
    buyerPercent: toAmount(p.buyerPercent ?? p.buyer_percent ?? p.buyerPercentage),
    sellerPercent: toAmount(p.sellerPercent ?? p.seller_percent ?? p.sellerPercentage),
    note: pickString(p, ["note", "reason", "buyer_note", "buyerNote", "notes"]),
    sellerNote: pickString(p, ["seller_note", "sellerNote", "seller_reason", "sellerReason"]),
    status: ((pickString(p, ["status", "state", "proposalStatus", "proposal_status"]) ?? "PENDING").toUpperCase()) as MutualResolutionProposal["status"],
    createdAt: typeof createdAtRaw === "string" ? createdAtRaw : "",
    respondedAt: typeof respondedAtRaw === "string" ? respondedAtRaw : (respondedAtRaw == null ? null : undefined),
    expiresAt: typeof expiresAtRaw === "string" ? expiresAtRaw : (expiresAtRaw == null ? null : undefined),
  }
}

export function getMutualResolution(disputeId: string, signal?: AbortSignal) {
  return http
    .get<MutualResolutionProposal[]>(`/v1/disputes/${seg(disputeId)}/mutual-resolution`, {
      auth: "required",
      retry: 1,
      signal,
    })
    .then((raw) =>
      readList<unknown>(raw, ["proposals", "resolutions", "items"]).map(normalizeMutualProposal),
    )
}

export function proposeMutualResolution(disputeId: string, dto: MutualResolutionProposeBody) {
  // I-22: lihat submitDisputeEvidence — persen tidak valid dulu lolos ke 400.
  assertDtoConstraints(dto, API_CONSTRAINTS.MutualResolutionProposeDto)
  return http
    .post<unknown, MutualResolutionProposeBody>(
      `/v1/disputes/${seg(disputeId)}/mutual-resolution`,
      dto,
      { auth: "required" },
    )
    .then(normalizeMutualProposal)
}

export function respondMutualResolution(
  disputeId: string,
  proposalId: string,
  dto: MutualResolutionRespondBody,
  idempotencyKey?: string,
) {
  // I-22: lihat submitDisputeEvidence.
  // R2 (audit ronde-2, butir #17): ACCEPT membagi dana — pemanggil meneruskan
  // idempotency key per-siklus-form (pola C-06 createOrder/payOrder).
  assertDtoConstraints(dto, API_CONSTRAINTS.MutualResolutionRespondDto)
  return http
    .post<unknown, MutualResolutionRespondBody>(
      `/v1/disputes/${seg(disputeId)}/mutual-resolution/${seg(proposalId)}/respond`,
      dto,
      {
        auth: "required",
        ...(idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : {}),
      },
    )
    .then(normalizeMutualProposal)
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
  // R2 (butir #103): schema eskalasi tidak ada di spec (body anonim) —
  // validasi lokal: reason opsional, bila diisi ≥10 karakter (sama dengan
  // dialog eskalasi di layar; jangan kirim alasan yang pasti ditolak).
  assertDtoConstraints({ reason }, LOCAL_CONSTRAINTS.EscalateDisputeDto)
  return http.post<Record<string, unknown>, { reason?: string }>(
    `/v1/disputes/${seg(disputeId)}/escalate`,
    { ...(reason && reason.trim() ? { reason: reason.trim() } : {}) },
    { auth: "required" },
  )
}
