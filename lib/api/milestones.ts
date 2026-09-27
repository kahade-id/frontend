/**
 * Kahade — domain `milestones` (escrow bertahap / milestone).
 *
 * KONTRAK (final, backend GRUP C):
 * - GET  /v1/orders/:orderId/milestones            → { orderId, orderStatus, summary, milestones: [...] }
 * - POST /v1/orders/:orderId/milestones            { milestones: [{ title, amountIdr, description?, deadline? }] }
 * - POST /v1/orders/:orderId/milestones/cancel-remaining
 * - GET  /v1/milestones/:id                       → detail tahap + evidence + events
 * - POST /v1/milestones/:id/submit                { evidenceKeys?, note? }
 * - POST /v1/milestones/:id/accept
 * - POST /v1/milestones/:id/release               (retry idempoten)
 * - POST /v1/milestones/:id/request-revision      { note }
 * - POST /v1/milestones/:id/change-request        { change: { title?, amountIdr?, deadline? }, note? }
 * - POST /v1/milestones/:id/approve-change
 * - POST /v1/milestones/:id/evidence              { fileKey, caption? }
 * - POST /v1/milestones/:id/extend-deadline        { deadline }
 * - POST /v1/milestones/:id/dispute               { reason, description?, evidenceUrls? }
 *
 * Nominal di API dalam RUPIAH (integer), selaras kontrak order mobile.
 *
 * Nominal BigInt backend dapat tiba sebagai number ATAU string di JSON;
 * normalizer di sini memaksanya ke number (rupiah = integer).
 *
 * Escrow satu tahap existing TIDAK disentuh: tahap hanya dipakai bila order
 * memang memilikinya (endpoint mengembalikan daftar kosong sebaliknya).
 */
import { http, seg } from "@/lib/api/client"
import { readList } from "@/lib/api/response"

export type MilestoneStatus =
  | "DRAFT"
  | "AWAITING_ACTIVATION"
  | "SUBMITTED"
  | "REVISION_REQUESTED"
  | "ACCEPTED"
  | "RELEASED"
  | "CANCELLED"
  | "DISPUTED"

export type MilestoneEvidence = {
  id: string
  fileKey: string
  fileType?: string | null
  caption?: string | null
  uploadedById?: string | null
  createdAt: string
}

export type MilestoneEvent = {
  id: string
  eventType: string
  actorType?: string | null
  payload?: Record<string, unknown> | null
  createdAt: string
}

export type MilestoneChangeRequest = {
  title?: string
  amount?: number
  deadline?: string | null
  note?: string
} | null

export type OrderMilestone = {
  id: string
  orderId: string
  seq: number
  title: string
  description?: string | null
  /** Nilai tahap (rupiah, integer). */
  amount: number
  /** Bagian net penjual untuk tahap ini (fee proporsional). */
  sellerAmount: number
  escrowHeld: number
  status: MilestoneStatus
  deadline?: string | null
  reviewDeadline?: string | null
  submittedAt?: string | null
  acceptedAt?: string | null
  releasedAt?: string | null
  /** Sisa putaran revisi = maxRevisionRounds - revisionRounds. */
  revisionRounds: number
  maxRevisionRounds: number
  /** Usulan perubahan yang menunggu persetujuan dua pihak. */
  changeRequest?: MilestoneChangeRequest
  buyerApprovedChange: boolean
  sellerApprovedChange: boolean
  evidence?: MilestoneEvidence[]
  events?: MilestoneEvent[]
  createdAt: string
}

/** Koersi aman number|string → number untuk nominal rupiah. */
function moneyOf(value: unknown): number {
  if (typeof value === "number") return Number.isSafeInteger(value) ? value : 0
  if (typeof value === "string") {
    const n = Number(value)
    return Number.isSafeInteger(n) ? n : 0
  }
  return 0
}

export function normalizeMilestone(raw: unknown): OrderMilestone | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== "string" || typeof r.orderId !== "string") return null
  return {
    id: r.id,
    orderId: r.orderId,
    seq: typeof r.seq === "number" ? r.seq : 0,
    title: typeof r.title === "string" ? r.title : "Tahap",
    description: typeof r.description === "string" ? r.description : null,
    amount: moneyOf(r.amount),
    sellerAmount: moneyOf(r.sellerAmount),
    escrowHeld: moneyOf(r.escrowHeld),
    status: typeof r.status === "string" ? (r.status as MilestoneStatus) : "DRAFT",
    deadline: typeof r.deadline === "string" ? r.deadline : null,
    reviewDeadline: typeof r.reviewDeadline === "string" ? r.reviewDeadline : null,
    submittedAt: typeof r.submittedAt === "string" ? r.submittedAt : null,
    acceptedAt: typeof r.acceptedAt === "string" ? r.acceptedAt : null,
    releasedAt: typeof r.releasedAt === "string" ? r.releasedAt : null,
    revisionRounds: typeof r.revisionRounds === "number" ? r.revisionRounds : 0,
    maxRevisionRounds: typeof r.maxRevisionRounds === "number" ? r.maxRevisionRounds : 2,
    changeRequest: (r.changeRequest as MilestoneChangeRequest) ?? null,
    buyerApprovedChange: r.buyerApprovedChange === true,
    sellerApprovedChange: r.sellerApprovedChange === true,
    evidence: Array.isArray(r.evidence)
      ? (r.evidence as Record<string, unknown>[]).map((e) => ({
          id: typeof e.id === "string" ? e.id : "",
          fileKey: typeof e.fileKey === "string" ? e.fileKey : "",
          fileType: typeof e.fileType === "string" ? e.fileType : null,
          caption: typeof e.caption === "string" ? e.caption : null,
          uploadedById: typeof e.uploadedById === "string" ? e.uploadedById : null,
          createdAt: typeof e.createdAt === "string" ? e.createdAt : "",
        }))
      : [],
    events: Array.isArray(r.events)
      ? (r.events as Record<string, unknown>[]).map((e) => ({
          id: typeof e.id === "string" ? e.id : "",
          eventType: typeof e.eventType === "string" ? e.eventType : "",
          actorType: typeof e.actorType === "string" ? e.actorType : null,
          payload: e.payload && typeof e.payload === "object" ? (e.payload as Record<string, unknown>) : null,
          createdAt: typeof e.createdAt === "string" ? e.createdAt : "",
        }))
      : [],
    createdAt: typeof r.createdAt === "string" ? r.createdAt : "",
  }
}

/** Sisa putaran revisi yang masih bisa diminta buyer. */
export function remainingRevisions(m: OrderMilestone): number {
  return Math.max(0, m.maxRevisionRounds - m.revisionRounds)
}

export function listOrderMilestones(orderId: string, signal?: AbortSignal) {
  return http
    .get<unknown>(`/v1/orders/${seg(orderId)}/milestones`, {
      auth: "required",
      retry: 1,
      signal,
    })
    .then((raw) =>
      readList<unknown>(raw, ["milestones"]).map(normalizeMilestone).filter((m): m is OrderMilestone => m !== null),
    )
}

/** Buat rencana tahap (penjual, sebelum order dibayar). Nominal dalam rupiah. */
export function createMilestones(
  orderId: string,
  input: {
    milestones: { title: string; amountIdr: number; description?: string; deadline?: string }[]
  },
  signal?: AbortSignal,
) {
  return http.post<unknown, typeof input>(`/v1/orders/${seg(orderId)}/milestones`, input, {
    auth: "required",
    signal,
  })
}

/** Batalkan sisa tahap yang belum dicairkan; escrow sisa dikembalikan (refund). */
export function cancelRemainingMilestones(orderId: string, signal?: AbortSignal) {
  return http.post<unknown>(
    `/v1/orders/${seg(orderId)}/milestones/cancel-remaining`,
    undefined,
    { auth: "required", signal },
  )
}

export function getMilestone(milestoneId: string, signal?: AbortSignal) {
  return http
    .get<unknown>(`/v1/milestones/${seg(milestoneId)}`, {
      auth: "required",
      retry: 1,
      signal,
    })
    .then(normalizeMilestone)
}

export function submitMilestone(
  milestoneId: string,
  input: { evidenceKeys?: string[]; note?: string },
  signal?: AbortSignal,
) {
  return http.post<unknown, { evidenceKeys?: string[]; note?: string }>(
    `/v1/milestones/${seg(milestoneId)}/submit`,
    input,
    { auth: "required", signal },
  )
}

export function acceptMilestone(milestoneId: string, signal?: AbortSignal) {
  return http.post<unknown>(`/v1/milestones/${seg(milestoneId)}/accept`, undefined, {
    auth: "required",
    signal,
  })
}

export function requestMilestoneRevision(milestoneId: string, note: string, signal?: AbortSignal) {
  return http.post<unknown, { note: string }>(
    `/v1/milestones/${seg(milestoneId)}/request-revision`,
    { note },
    { auth: "required", signal },
  )
}

/**
 * Usulkan perubahan tahap (judul/nilai/tenggat). Backend: POST
 * /v1/milestones/:id/change-request { change: { title?, amountIdr?, deadline? }, note? }.
 * Nominal `amount` di sini dalam rupiah.
 */
export function proposeMilestoneChange(
  milestoneId: string,
  input: { title?: string; amount?: number; deadline?: string; note?: string },
  signal?: AbortSignal,
) {
  const change: { title?: string; amountIdr?: number; deadline?: string } = {}
  if (input.title !== undefined) change.title = input.title
  if (input.amount !== undefined) change.amountIdr = input.amount
  if (input.deadline !== undefined) change.deadline = input.deadline
  return http.post<unknown, { change: typeof change; note?: string }>(
    `/v1/milestones/${seg(milestoneId)}/change-request`,
    { change, note: input.note },
    { auth: "required", signal },
  )
}

export function approveMilestoneChange(milestoneId: string, signal?: AbortSignal) {
  return http.post<unknown>(`/v1/milestones/${seg(milestoneId)}/approve-change`, undefined, {
    auth: "required",
    signal,
  })
}

export function attachMilestoneEvidence(
  milestoneId: string,
  input: { fileKey: string; caption?: string },
  signal?: AbortSignal,
) {
  return http.post<unknown, { fileKey: string; caption?: string }>(
    `/v1/milestones/${seg(milestoneId)}/evidence`,
    input,
    { auth: "required", signal },
  )
}

/** Coba ulang pencairan yang gagal dicatat (idempoten). */
export function retryMilestoneRelease(milestoneId: string, signal?: AbortSignal) {
  return http.post<unknown>(`/v1/milestones/${seg(milestoneId)}/release`, undefined, {
    auth: "required",
    signal,
  })
}

/** Perpanjang tenggat pengerjaan tahap (penjual). `deadline` ISO-8601. */
export function extendMilestoneDeadline(
  milestoneId: string,
  input: { deadline: string },
  signal?: AbortSignal,
) {
  return http.post<unknown, { deadline: string }>(
    `/v1/milestones/${seg(milestoneId)}/extend-deadline`,
    input,
    { auth: "required", signal },
  )
}

/** Buka sengketa untuk satu tahap (tidak mengubah tahap lain). */
export function disputeMilestone(
  milestoneId: string,
  input: { reason: string; description?: string; evidenceUrls?: string[] },
  signal?: AbortSignal,
) {
  return http.post<unknown, typeof input>(
    `/v1/milestones/${seg(milestoneId)}/dispute`,
    input,
    { auth: "required", signal },
  )
}
