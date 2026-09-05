/**
 * Kahade — domain `ratings` (ulasan pesanan masuk/keluar).
 */
import { http, seg } from "@/lib/api/client"
import type { CreateRatingDto, RatingReplyDto, UpdateRatingDto } from "@/lib/api/types"

/** Satu ulasan / balasannya — UNVERIFIED. */
export type Rating = {
  id: string
  orderId?: string
  orderTitle?: string
  stars: number
  comment?: string | null
  authorUsername?: string
  authorAvatarUrl?: string | null
  replied?: boolean
  reply?: string | null
  createdAt: string
}

export function getMyRatings(query?: { page?: number; limit?: number }) {
  return http.get<Array<Rating>>("/v1/ratings/my", { query, auth: "required", retry: 1 })
}

/** GET /v1/users/{username}/ratings — ulasan publik milik profil user. */
export function getPublicRatings(username: string) {
  return http.get<Array<Rating>>(`/v1/users/${seg(username)}/ratings`, { auth: "none", retry: 1 })
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
