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

/** Lampiran pesan mediasi — bentuk Json backend {fileKey,fileName,fileType,fileSize}. */
export type DisputeMessageAttachment = {
  fileKey: string
  fileName: string
  fileType: string
  fileSize?: number
}

/** Pesan dalam ruang sengketa. */
export type DisputeMessage = {
  id: string
  text: string
  fromUser: boolean
  createdAt: string
  /** Lampiran; pesan khusus-lampiran punya text "" (DP-006). */
  attachments?: DisputeMessageAttachment[]
}

/** Panggilan (record) — enum backend DisputeCallStatus. */
export type DisputeCall = {
  id: string
  status:
    | "REQUESTED"
    | "ACCEPTED"
    | "IN_PROGRESS"
    | "ENDED"
    | "REJECTED"
    | "EXPIRED"
    | "MISSED"
    | "CANCELLED"
    | string
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

/** Hasil putusan admin atas sengketa (relasi `decision`, DP-005).
 *
 * Kontrak respons aktual `getDisputeDetail`: decision { id, decisionType,
 * buyerAmount, sellerAmount, buyerPercent, sellerPercent, createdAt }.
 * PENTING: buyerAmount/sellerAmount SUDAH dalam IDR — backend mengonversi
 * dari sen ("FIX ×100", disputes.service.ts:260-264); JANGAN konversi lagi.
 * buyerPercent/sellerPercent Decimal(5,2) tiba sebagai string ("50.00").
 * `decisionNotes` ada di model tapi TIDAK di-select backend → tak ada di
 * respons; dipetakan defensif bila kelak ditambahkan. decision null =
 * belum ada putusan (musyawarah ditangani backend 2a; tetap null-safe).
 */
export type DisputeDecision = {
  id: string
  decisionType: "FULL_BUYER" | "FULL_SELLER" | "SPLIT" | string
  buyerAmount?: number
  sellerAmount?: number
  buyerPercent?: number
  sellerPercent?: number
  decisionNotes?: string
  decidedAt?: string
}

/** Sengketa penuh (GET /v1/disputes/{disputeId}). */
export type DisputeDetail = {
  id: string
  orderId: string
  status: string
  claim: string
  /** Kategori sengketa (enum backend DisputeCategory) — nullable untuk data lama. */
  category?: string | null
  /** Pihak pembuka sengketa — UNVERIFIED */
  openedById?: string
  createdAt: string
  updatedAt?: string
  messages?: DisputeMessage[]
  /** Hasil putusan admin; null/undefined bila belum diputuskan. */
  decision?: DisputeDecision | null
}

/**
 * Parser persen toleran: backend mengirim Decimal sebagai string ("50.00")
 * atau number. `toAmount` hanya menerima string integer — tidak cocok.
 */
function toPercent(value: unknown): number | undefined {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))
        ? Number(value)
        : undefined
  return typeof n === "number" && n >= 0 && n <= 100 ? n : undefined
}

/** Normalisasi relasi decision (DP-005) — null-safe, tanpa konversi unit. */
function normalizeDisputeDecision(raw: unknown): DisputeDecision | null {
  const d = (raw ?? {}) as Record<string, unknown>
  const id = pickString(d, ["id", "decisionId", "decision_id"])
  if (!id) return null
  const createdAtRaw = d.createdAt ?? d.created_at ?? d.decidedAt ?? d.decided_at
  return {
    id,
    decisionType: pickString(d, ["decisionType", "decision_type", "type"]) ?? "",
    buyerAmount: toAmount(d.buyerAmount ?? d.buyer_amount),
    sellerAmount: toAmount(d.sellerAmount ?? d.seller_amount),
    buyerPercent: toPercent(d.buyerPercent ?? d.buyer_percent),
    sellerPercent: toPercent(d.sellerPercent ?? d.seller_percent),
    decisionNotes: pickString(d, ["decisionNotes", "decision_notes", "notes"]),
    decidedAt: typeof createdAtRaw === "string" ? createdAtRaw : undefined,
  }
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
  // DRIFT-03 (fix 2026-09-26): backend mengirim public order ID di nested
  // `order.orderId` (bukan top-level) — baca sebagai fallback agar tombol
  // "Lihat transaksi" tidak hilang.
  const nestedOrder = d.order as Record<string, unknown> | undefined
  return {
    id: pickString(d, ["id", "disputeId", "dispute_id"]) ?? "",
    orderId:
      pickString(d, ["orderId", "order_id", "transactionId", "transaction_id"]) ??
      pickString(nestedOrder ?? {}, ["orderId", "order_id"]) ??
      "",
    status: pickString(d, ["status", "state"]) ?? "",
    claim: typeof claimRaw === "string" ? claimRaw : "",
    category: pickString(d, ["category"]) ?? null,
    openedById: pickString(d, ["openedById", "opened_by_id", "claimantId", "claimant_id", "reporterId"]),
    createdAt: pickString(d, ["createdAt", "created_at", "openedAt", "opened_at"]) ?? "",
    updatedAt: pickString(d, ["updatedAt", "updated_at", "lastUpdatedAt"]),
    messages: Array.isArray(d.messages) ? (d.messages as DisputeMessage[]) : undefined,
    // DP-005: jangan buang relasi decision dari backend.
    decision: normalizeDisputeDecision(d.decision),
  }
}

/**
 * Item daftar sengketa (GET /v1/disputes/my) — membawa field mentah yang
 * dibutuhkan kartu daftar: pihak pembuka, waktu klaim tiap pihak, dan
 * ringkasan order (judul, nilai tertahan, id pembeli/penjual).
 * `adminNotes` TIDAK dibawa — backend men-strip-nya sebelum serialisasi.
 */
export type DisputeListItem = DisputeDetail & {
  initiatedBy?: "BUYER" | "SELLER" | string
  buyerClaimedAt?: string
  sellerClaimedAt?: string
  order?: {
    orderId?: string
    title?: string
    orderValue?: number
    buyerId?: string
    sellerId?: string
  }
}

function normalizeDisputeListItem(raw: unknown): DisputeListItem {
  const d = normalizeDisputeDetail(raw as DisputeDetail)
  const r = (raw ?? {}) as Record<string, unknown>
  const o = (r.order ?? {}) as Record<string, unknown>
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined)
  return {
    ...d,
    initiatedBy: pickString(r, ["initiatedBy", "initiated_by"]),
    buyerClaimedAt: pickString(r, ["buyerClaimedAt", "buyer_claimed_at"]),
    sellerClaimedAt: pickString(r, ["sellerClaimedAt", "seller_claimed_at"]),
    order: {
      orderId: pickString(o, ["orderId", "order_id"]),
      title: pickString(o, ["title"]),
      orderValue: num(o.orderValue),
      buyerId: pickString(o, ["buyerId", "buyer_id"]),
      sellerId: pickString(o, ["sellerId", "seller_id"]),
    },
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
          const d = normalizeDisputeListItem(entry)
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

/**
 * DP-020: kembalikan juga `total` dari respons paginasi backend
 * (PaginatedResponse {data,total,page,limit,...}) agar UI bisa menampilkan
 * "Menampilkan X dari Y bukti". Bila backend tak mengirim total, undefined —
 * UI null-safe (indikator disembunyikan).
 */
export function getDisputeEvidence(disputeId: string, signal?: AbortSignal) {
  return http
    .get<DisputeEvidence[]>(`/v1/disputes/${seg(disputeId)}/evidence`, {
      auth: "required",
      retry: 1,
      signal,
    })
    .then((raw) => {
      const page = readPage<DisputeEvidence>(raw, { page: 1, limit: 50 }, ["evidence", "evidences"])
      const total = Number.isFinite(page.meta.total) ? page.meta.total : undefined
      return { items: page.data, total }
    })
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
 * `text` dinormalisasi dari `text|message|content`.
 *
 * DP-006 (audit 2026-09-26): JANGAN buang attachments dan JANGAN buang pesan
 * khusus-lampiran. Backend `sendMessage` valid bila teks ATAU attachments ada
 * (keduanya kosong → 400); pesan hanya-lampiran adalah kasus nyata.
 * `getMessages` tidak menyertakan signed URL — hanya fileKey/fileName/
 * fileType/fileSize; unduhan butuh endpoint baru (follow-up backend).
 */
function normalizeDisputeMessageAttachment(raw: unknown): DisputeMessageAttachment | null {
  const a = (raw ?? {}) as Record<string, unknown>
  const fileKey = pickString(a, ["fileKey", "file_key", "key"])
  const fileName = pickString(a, ["fileName", "file_name", "name"])
  if (!fileKey && !fileName) return null
  const size = a.fileSize ?? a.file_size ?? a.size
  return {
    fileKey: fileKey ?? "",
    fileName: fileName ?? "Lampiran",
    fileType: pickString(a, ["fileType", "file_type", "mimeType", "mime_type"]) ?? "",
    fileSize: typeof size === "number" && Number.isFinite(size) ? size : undefined,
  }
}

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
  const attachments = Array.isArray(record.attachments)
    ? record.attachments
        .map(normalizeDisputeMessageAttachment)
        .filter((a): a is DisputeMessageAttachment => a !== null)
    : []
  // DP-006: buang hanya bila tak ada teks DAN tak ada lampiran.
  if (!text && attachments.length === 0) return null
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
    ...(attachments.length > 0 ? { attachments } : {}),
  }
}

/** Input lampiran untuk kirim pesan (DP-025): fileKey dari upload terkonfirmasi. */
export type DisputeMessageAttachmentInput = {
  fileKey: string
  fileName: string
  fileType: string
  fileSize: number
}

export function sendDisputeMessage(
  disputeId: string,
  text: string,
  attachments?: DisputeMessageAttachmentInput[],
) {
  // DTO produksi: DisputeMessageDto { message?, attachments? } — bukan { text }.
  // I-22: lihat submitDisputeEvidence (assert pesan kosong/terlalu panjang).
  // DP-025: backend menolak bila teks DAN attachments kosong — cegah di klien.
  const cleanAttachments = (attachments ?? []).filter(
    (a) => a && typeof a.fileKey === "string" && a.fileKey.length > 0,
  )
  assertDtoConstraints({ message: text, attachments: cleanAttachments }, API_CONSTRAINTS.DisputeMessageDto)
  if (!text.trim() && cleanAttachments.length === 0) {
    throw new Error("Pesan atau lampiran wajib diisi.")
  }
  return http.post<DisputeMessage, DisputeMessageDto>(
    `/v1/disputes/${seg(disputeId)}/messages`,
    {
      message: text,
      ...(cleanAttachments.length > 0 ? { attachments: cleanAttachments } : {}),
    },
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
        // DP-004: backend tak pernah mengirim "ONGOING" (enum: REQUESTED,
        // ACCEPTED, IN_PROGRESS, ENDED, REJECTED, EXPIRED) — petakan defensif
        // bila ada payload lama/asing yang masih memakainya.
        const rawStatus = pickString(c, ["status", "callStatus", "call_status"]) ?? ""
        const status = rawStatus === "ONGOING" ? "IN_PROGRESS" : rawStatus
        return {
          id: pickString(c, ["id", "callId", "call_id"]) ?? "",
          status: status as DisputeCall["status"],
          // DP-015: field kanonik backend = requestedById (bukan requesterId).
          requesterId: pickString(c, [
            "requestedById",
            "requested_by_id",
            "requesterId",
            "requester_id",
            "callerId",
            "caller_id",
          ]),
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
