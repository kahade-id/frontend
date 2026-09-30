/**
 * Kahade — domain `ratings` (ulasan pesanan masuk/keluar).
 */

import { asRecord, invalidResponse, readList } from "@/lib/api/response"

import { http, seg } from "@/lib/api/client"
import type { CreateRatingDto, RatingReplyDto, UpdateRatingDto } from "@/lib/api/types"

/**
 * Satu item array `replies` — SELARAS dengan `normalizeRating` backend
 * (`ratings.service.ts`): `reply ? [{ ...reply, userId: reply.replierId }] : []`
 * dengan select `{ id, content, createdAt, replierId }`. Satu ulasan hanya bisa
 * punya SATU balasan (relasi 1:1 di DB) — array selalu 0/1 item.
 */
export type RatingReplyItem = {
  id: string
  content?: string | null
  createdAt?: string | null
  replierId?: string | null
  /** = replierId (dihydrated backend untuk kompatibilitas klien). */
  userId?: string | null
}

/**
 * Satu ulasan / balasannya — UNVERIFIED (spec `GET /v1/ratings/my` tanpa
 * schema). Field arah & id balasan opsional:
 *   - `isMine`/`direction`: apakah ulasan ini SAYA yang menulis (bisa
 *     diedit via PUT /v1/ratings/{id}) atau saya yang menerima (bisa dibalas).
 *     Bila backend tidak mengirim keduanya, UI membandingkan
 *     `authorUsername`/`authorId` dengan profil saya.
 *   - `replyId`: id balasan untuk PUT/DELETE /v1/ratings/replies/{replyId}.
 *     Tanpa id itu, edit/hapus balasan tidak bisa ditawarkan.
 */
export type Rating = {
  id: string
  orderId?: string
  orderTitle?: string
  stars: number
  comment?: string | null
  authorId?: string
  authorUsername?: string
  authorAvatarUrl?: string | null
  targetUsername?: string
  isMine?: boolean
  direction?: "GIVEN" | "RECEIVED" | (string & {})
  /** Jumlah penanda "berguna" (kolom model Rating). */
  helpfulCount?: number | null
  replied?: boolean
  /**
   * BFI-128 (audit integrasi 2026-09-30): balasan penjual — backend mengirim
   * ARRAY `replies` (bukan field `reply` datar; field datar lama selalu
   * `undefined` sehingga balasan tak pernah tampil). Layar membaca item
   * pertama via `firstRatingReply()`.
   */
  replies?: RatingReplyItem[] | null
  /**
   * Fallback runtime untuk data cache lama yang masih membawa bentuk datar
   * pre-BFI-128 — dibaca `firstRatingReply()` sebagai cadangan, JANGAN
   * dipakai untuk logika baru. Field ini TIDAK pernah dikirim backend.
   * @deprecated gunakan `replies`
   */
  reply?: string | null
  replyId?: string | null
  replyCreatedAt?: string | null
  createdAt: string
  updatedAt?: string | null
}

/**
 * BFI-128: baca balasan pertama ulasan — `replies[0]` (bentuk backend),
 * dengan fallback ke bentuk datar lama (`reply`) untuk cache pra-fix.
 */
export function firstRatingReply(
  r: Pick<Rating, "replies" | "reply" | "replyId" | "replyCreatedAt">,
): { id: string; content: string; createdAt?: string | null } | undefined {
  const item = Array.isArray(r.replies) ? r.replies[0] : undefined
  if (item) {
    return {
      id: item.id,
      content: typeof item.content === "string" ? item.content : "",
      createdAt: item.createdAt ?? null,
    }
  }
  if (r.reply) {
    return {
      id: typeof r.replyId === "string" && r.replyId ? r.replyId : "",
      content: r.reply,
      createdAt: r.replyCreatedAt ?? null,
    }
  }
  return undefined
}

/** Bentuk respons `GET /v1/ratings/my` — array polos ATAU {data, meta} (UNVERIFIED). */
export type MyRatingsResponse =
  | Rating[]
  | {
      data?: Rating[]
      meta?: { page: number; limit: number; total: number; totalPages: number }
      given?: { data?: Rating[]; totalPages?: number }
      received?: { data?: Rating[]; totalPages?: number }
    }

export function getMyRatings(query?: { page?: number; limit?: number }, signal?: AbortSignal) {
  return http.get<MyRatingsResponse>("/v1/ratings/my", { query, auth: "required", retry: 1, signal })
}

/** Normalisasi respons my-ratings → { items, totalPages? }. */
export function readMyRatings(body: MyRatingsResponse | null | undefined): {
  items: Rating[]
  totalPages?: number
} {
  if (Array.isArray(body)) return { items: body }
  if (!body) return { items: [] }
  if (body.given || body.received) {
    const given = (body.given?.data ?? []).map((rating) => ({ ...rating, direction: "GIVEN" as const }))
    const received = (body.received?.data ?? []).map((rating) => ({ ...rating, direction: "RECEIVED" as const }))
    return {
      items: [...given, ...received],
      totalPages: Math.max(body.given?.totalPages ?? 0, body.received?.totalPages ?? 0) || undefined,
    }
  }
  return { items: readList<Rating>(body, ["ratings"]), totalPages: body.meta?.totalPages }
}

/**
 * Filter ulasan publik yang diterima backend production. Untuk semua ulasan,
 * parameter `filter` harus dihilangkan; `all` dan `with_comment` ditolak.
 */
export type PublicRatingFilter = "all" | "positive" | "neutral" | "negative"

/**
 * GET /v1/users/{username}/ratings?page&limit&filter — ulasan publik milik
 * profil user (semua query REQUIRED).
 *
 * Audit: sebelumnya `auth: "none"`. Spec tetap menandai endpoint ini
 * `security: [{ access-token: [] }]`, dan `auth: "none"` membuat client.ts
 * mengirim `token = null` — jadi saat user SUDAH login token-nya tetap
 * ditahan dan backend membalas 401, sementara seluruh app lain berjalan
 * normal. Mode 401-refresh (client.ts:394) juga dilewati.
 *
 * Dipilih `"optional"` (bukan `"required"`) karena ini rute profil publik
 * yang bisa dimuat lewat deep link web tanpa sesi; `"required"` akan
 * melempar UNAUTHORIZED di client sebelum request dikirim. `"optional"`
 * mengirim token bila ada dan tetap mencoba bila tidak.
 */
export function getPublicRatings(
  username: string,
  query: { page: number; limit: number; filter?: Exclude<PublicRatingFilter, "all"> },
  signal?: AbortSignal,
) {
  return http.get<MyRatingsResponse>(`/v1/users/${seg(username)}/ratings`, {
    query,
    auth: "optional",
    retry: 1,
    signal,
  })
}

export function createRating(dto: CreateRatingDto) {
  return http.post<Rating, CreateRatingDto>("/v1/ratings", dto, { auth: "required" })
}

export function updateRating(ratingId: string, dto: UpdateRatingDto) {
  return http.put<Rating, UpdateRatingDto>(`/v1/ratings/${seg(ratingId)}`, dto, {
    auth: "required",
  })
}

export function replyRating(ratingId: string, dto: RatingReplyDto) {
  return http.post<Rating, RatingReplyDto>(`/v1/ratings/${seg(ratingId)}/reply`, dto, {
    auth: "required",
  })
}

export function updateRatingReply(replyId: string, dto: RatingReplyDto) {
  return http.put<Rating, RatingReplyDto>(`/v1/ratings/replies/${seg(replyId)}`, dto, {
    auth: "required",
  })
}

export function deleteRatingReply(replyId: string) {
  return http.delete<void>(`/v1/ratings/replies/${seg(replyId)}`, {
    auth: "required",
    responseType: "void",
  })
}

/**
 * POST /v1/ratings/{id}/helpful — toggle "berguna" untuk ulasan (tanpa body).
 * Balasan `{ helpful, helpfulCount }` = status SETELAH toggle.
 * Aturan backend: ulasan sendiri TIDAK bisa ditandai berguna; ulasan
 * tersembunyi → 404.
 */
export function toggleRatingHelpful(ratingId: string) {
  return http.post<{ helpful: boolean; helpfulCount: number }>(
    `/v1/ratings/${seg(ratingId)}/helpful`,
    undefined,
    { auth: "required" },
  )
}

/**
 * DELETE /v1/ratings/{id} — hapus ulasan SAYA (giver).
 * Aturan backend: hanya dalam 7 hari sejak dibuat (jendela tutup →
 * RATING_WINDOW_CLOSED).
 */
export function deleteMyRating(ratingId: string) {
  return http.delete<{ deleted: boolean }>(`/v1/ratings/${seg(ratingId)}`, {
    auth: "required",
  })
}

// ------------------------------------------------------------------
// Distribusi bintang (item 21, 2026-09-28)
// ------------------------------------------------------------------

/**
 * KONTRAK FINAL TIM A (2026-09-28): `GET /v1/users/:username/ratings`
 * menyertakan `distribution: {"1": n, …, "5": n}` dan `averageRating` —
 * TIDAK dipengaruhi parameter filter.
 */
export type RatingDistribution = {
  /** counts[0] = jumlah 1★ … counts[4] = jumlah 5★. */
  counts: [number, number, number, number, number]
  total: number
}

/** Ringkasan rating publik: distribusi + rata-rata dari server. */
export type PublicRatingSummary = {
  distribution: RatingDistribution
  /** `averageRating` server; null bila backend tidak mengirimnya. */
  averageRating: number | null
}

function parseDistributionCounts(raw: unknown): [number, number, number, number, number] | null {
  const d = asRecord(raw)
  if (!d) return null
  const counts = [1, 2, 3, 4, 5].map((star) => {
    const v = d[String(star)]
    return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0
  })
  return counts as [number, number, number, number, number]
}

/**
 * Parse ringkasan dari respons `GET /v1/users/:username/ratings`.
 * Mengembalikan null bila respons tidak memuat `distribution` (kontrak lama
 * atau bentuk tak dikenal) — pemanggil menyembunyikan komponen (fail closed).
 */
export function parsePublicRatingSummary(body: unknown): PublicRatingSummary | null {
  const root = asRecord(body)
  if (!root) return null
  const counts = parseDistributionCounts(root.distribution)
  if (!counts) return null
  const total = counts.reduce((a, b) => a + b, 0)
  const avg = root.averageRating
  return {
    distribution: { counts, total },
    averageRating: typeof avg === "number" && Number.isFinite(avg) ? avg : null,
  }
}

/**
 * Ambil ringkasan distribusi + rata-rata milik username.
 * `limit=1` — daftar ulasannya tidak dibutuhkan; distribusi tidak dipengaruhi
 * filter maupun paginasi.
 */
export function getPublicRatingSummary(
  username: string,
  signal?: AbortSignal,
): Promise<PublicRatingSummary> {
  return http
    .get<unknown>(`/v1/users/${seg(username)}/ratings`, {
      query: { page: 1, limit: 1 },
      auth: "optional",
      retry: 1,
      signal,
    })
    .then((body) => {
      const summary = parsePublicRatingSummary(body)
      if (!summary) throw invalidResponse("rating-summary")
      return summary
    })
}
