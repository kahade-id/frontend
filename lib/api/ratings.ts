/**
 * Kahade — domain `ratings` (ulasan pesanan masuk/keluar).
 */
import { http, seg } from "@/lib/api/client"
import type { CreateRatingDto, RatingReplyDto, UpdateRatingDto } from "@/lib/api/types"

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
  replied?: boolean
  reply?: string | null
  replyId?: string | null
  replyCreatedAt?: string | null
  createdAt: string
  updatedAt?: string | null
}

/** Bentuk respons `GET /v1/ratings/my` — array polos ATAU {data, meta} (UNVERIFIED). */
export type MyRatingsResponse =
  | Rating[]
  | { data: Rating[]; meta?: { page: number; limit: number; total: number; totalPages: number } }

export function getMyRatings(query?: { page?: number; limit?: number }) {
  return http.get<MyRatingsResponse>("/v1/ratings/my", { query, auth: "required", retry: 1 })
}

/** Normalisasi respons my-ratings → { items, totalPages? }. */
export function readMyRatings(body: MyRatingsResponse | null | undefined): {
  items: Rating[]
  totalPages?: number
} {
  if (!body) return { items: [] }
  if (Array.isArray(body)) return { items: body }
  return { items: body.data ?? [], totalPages: body.meta?.totalPages }
}

/**
 * Filter ulasan publik — spec: query `filter` REQUIRED tanpa enum. Asumsi
 * nilai: "all" | "positive" (4–5★) | "negative" (1–2★) | "with_comment"
 * (UNVERIFIED; backend mengabaikan nilai tak dikenal atau 400 → UI
 * menampilkan pesan server).
 */
export type PublicRatingFilter = "all" | "positive" | "negative" | "with_comment"

/** GET /v1/users/{username}/ratings?page&limit&filter — ulasan publik milik profil user (semua query REQUIRED). */
export function getPublicRatings(
  username: string,
  query: { page: number; limit: number; filter: PublicRatingFilter },
) {
  return http.get<MyRatingsResponse>(`/v1/users/${seg(username)}/ratings`, {
    query,
    auth: "none",
    retry: 1,
  })
}

export function createRating(dto: CreateRatingDto) {
  return http.post<Rating, CreateRatingDto>("/v1/ratings", dto, { auth: "required" })
}

export function updateRating(ratingId: string, dto: UpdateRatingDto) {
  return http.put<Rating, UpdateRatingDto>(`/v1/ratings/${seg(ratingId)}`, dto, { auth: "required" })
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
