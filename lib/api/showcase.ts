/**
 * Adapter — Showcase sosial (controller `/v1/showcase`, section 3 backend).
 *
 * Dipisah dari CRUD milik sendiri (`users.ts` → `/v1/users/me/showcase*`)
 * karena controller & kontraknya berbeda: permukaan PUBLIK + interaksi sosial
 * (like, komentar bersarang 1 tingkat, share, report, moderasi komentar).
 *
 * Kontrak respons diverifikasi terhadap `showcase.service.ts` (sesi P1,
 * 2026-09-15): feed kursor-based (keyset), komentar offset + tiebreak id,
 * like/unlike mengembalikan `{ liked, likeCount }` final.
 */
import { http } from "./client"
import { readList } from "./response"

// ------------------------------------------------------------------
// Tipe
// ------------------------------------------------------------------

/** Author ter-serialize (field sama untuk feed/detail/komentar). */
export type ShowcaseAuthor = {
  userId: string
  username: string
  fullName: string | null
  avatarUrl?: string | null
  membershipRank?: string | null
  isKycVerified?: boolean
  isVip?: boolean
}

/**
 * Item showcase ter-serialize (feed + detail + list publik).
 * `orderLink` siap pakai untuk pr-pengisian alur transaksi.
 */
export type ShowcaseSocialItem = {
  id: string
  title: string
  description?: string | null
  category?: string | null
  visibility?: string
  isActive?: boolean
  images: { id: string; imageUrl: string; sortOrder: number }[]
  coverImageUrl?: string | null
  /** Alias deprecated `imageUrl` = cover; tetap dikirim backend. */
  imageUrl?: string | null
  priceMin?: number | null
  priceMax?: number | null
  likeCount: number
  commentCount: number
  viewCount: number
  /** viewer menyukai item ini (butuh auth; false bila anonim). */
  isLiked?: boolean
  /** viewer adalah pemilik item (moderasi komentar terbuka). */
  isOwner?: boolean
  createdAt: string
  updatedAt: string
  author: ShowcaseAuthor
  orderLink?: {
    title: string
    description: string
    orderValue?: number | null
    orderValueValid?: boolean
    counterpartUsername?: string
  } | null
  shareUrl?: string
}

/** Komentar + balasan satu tingkat (kedalaman dibatasi backend). */
export type ShowcaseComment = {
  id: string
  showcaseId: string
  parentId?: string | null
  content: string
  /** true = disembunyikan pemilik item (hanya pemilik yang melihat). */
  isHidden?: boolean
  hiddenReason?: "SPAM" | "INAPPROPRIATE" | "HARASSMENT" | "OTHER" | null
  createdAt: string
  updatedAt?: string
  author: ShowcaseAuthor
}

export type ShowcaseCommentWithReplies = ShowcaseComment & {
  replies?: ShowcaseComment[]
}

/** Respons GET /v1/showcase/:id/share — metadata deep link. */
export type ShowcaseSharePayload = {
  showcaseId: string
  title: string
  description: string
  imageUrl?: string | null
  priceLabel?: string
  authorUsername: string
  authorFullName?: string | null
  shareUrl: string
  appUrl?: string
}

export type ShowcaseFeedSort = "latest" | "popular"

export type ShowcaseFeedQuery = {
  /** Token opaque dari `nextCursor` respons sebelumnya. */
  cursor?: string
  limit?: number
  sort?: ShowcaseFeedSort
  category?: string
  /** Cari di title, description, category, dan username penjual. */
  search?: string
}

export type ShowcaseFeedPage = {
  items: ShowcaseSocialItem[]
  sort: ShowcaseFeedSort
  limit: number
  hasMore: boolean
  nextCursor?: string | null
}

export type ShowcaseCommentsPage = {
  data: ShowcaseCommentWithReplies[]
  total: number
  page: number
  limit: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

// ------------------------------------------------------------------
// Endpoint
// ------------------------------------------------------------------

/** GET /v1/showcase/feed — feed discover (cursor/keyset, publik). */
export function getShowcaseFeed(query: ShowcaseFeedQuery = {}, signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/showcase/feed", {
      signal,
      query: {
        cursor: query.cursor,
        limit: query.limit ?? 20,
        sort: query.sort ?? "latest",
        category: query.category,
        search: query.search,
      },
      retry: 1,
    })
    .then((raw) => {
      const record = (raw ?? {}) as Record<string, unknown>
      return {
        items: readList<ShowcaseSocialItem>(record, ["items"]),
        sort: record.sort === "popular" ? "popular" : "latest",
        limit: typeof record.limit === "number" ? record.limit : 20,
        hasMore: record.hasMore === true,
        nextCursor: (record.nextCursor as string | null | undefined) ?? null,
      } satisfies ShowcaseFeedPage
    })
}

/** GET /v1/showcase/:showcaseId — detail item (menghitung viewCount). */
export function getShowcaseDetail(showcaseId: string, signal?: AbortSignal) {
  return http.get<ShowcaseSocialItem>(`/v1/showcase/${showcaseId}`, { retry: 1, signal })
}

/**
 * GET /v1/showcase/:showcaseId/comments — komentar bersarang (offset).
 * Root dipaginasi; tiap root menyertakan `replies` satu tingkat.
 */
export function listShowcaseComments(
  showcaseId: string,
  params: { page?: number; limit?: number } = {},
) {
  return http
    .get<unknown>(`/v1/showcase/${showcaseId}/comments`, {
      query: { page: params.page ?? 1, limit: params.limit ?? 20 },
      retry: 1,
    })
    .then((raw) => {
      const record = (raw ?? {}) as Record<string, unknown>
      const data = readList<ShowcaseCommentWithReplies>(record, ["data"]).map((c) => ({
        ...c,
        replies: Array.isArray(c.replies) ? c.replies : [],
      }))
      return {
        data,
        total: typeof record.total === "number" ? record.total : data.length,
        page: typeof record.page === "number" ? record.page : 1,
        limit: typeof record.limit === "number" ? record.limit : 20,
        totalPages: typeof record.totalPages === "number" ? record.totalPages : 1,
        hasNext: record.hasNext === true,
        hasPrev: record.hasPrev === true,
      } satisfies ShowcaseCommentsPage
    })
}

/** POST /v1/showcase/:showcaseId/comments — komentar / balas (`parentId`). */
export function addShowcaseComment(
  showcaseId: string,
  dto: { content: string; parentId?: string },
) {
  return http.post<ShowcaseComment, { content: string; parentId?: string }>(
    `/v1/showcase/${showcaseId}/comments`,
    dto,
    { auth: "required" },
  )
}

/** PATCH /v1/showcase/comments/:commentId — edit komentar sendiri. */
export function updateShowcaseComment(commentId: string, content: string) {
  return http.patch<ShowcaseComment, { content: string }>(
    `/v1/showcase/comments/${commentId}`,
    { content },
    { auth: "required" },
  )
}

/** DELETE /v1/showcase/comments/:commentId — pengarang ATAU pemilik item. */
export function deleteShowcaseComment(commentId: string) {
  return http.delete<{ message: string }>(`/v1/showcase/comments/${commentId}`, {
    auth: "required",
  })
}

/**
 * POST /v1/showcase/comments/:commentId/hide — moderasi (pemilik item).
 * Komentar tetap terlihat pemiliknya (dengan alasan) agar bisa dibuka lagi.
 */
export function hideShowcaseComment(
  commentId: string,
  reason: "SPAM" | "INAPPROPRIATE" | "HARASSMENT" | "OTHER",
) {
  return http.post<ShowcaseComment, { reason: string }>(
    `/v1/showcase/comments/${commentId}/hide`,
    { reason },
    { auth: "required" },
  )
}

/** POST /v1/showcase/comments/:commentId/unhide — buka kembali komentar. */
export function unhideShowcaseComment(commentId: string) {
  return http.post<ShowcaseComment>(`/v1/showcase/comments/${commentId}/unhide`, undefined, {
    auth: "required",
  })
}

/** POST /v1/showcase/:showcaseId/like → `{ liked: true, likeCount }`. */
export function likeShowcase(showcaseId: string) {
  return http.post<{ liked: boolean; likeCount: number }>(
    `/v1/showcase/${showcaseId}/like`,
    undefined,
    { auth: "required" },
  )
}

/** DELETE /v1/showcase/:showcaseId/like → `{ liked: false, likeCount }`. */
export function unlikeShowcase(showcaseId: string) {
  return http.delete<{ liked: boolean; likeCount: number }>(`/v1/showcase/${showcaseId}/like`, {
    auth: "required",
  })
}

/** GET /v1/showcase/:showcaseId/share — metadata deep link (publik). */
export function getShowcaseSharePayload(showcaseId: string) {
  return http.get<ShowcaseSharePayload>(`/v1/showcase/${showcaseId}/share`, { retry: 1 })
}

/**
 * POST /v1/showcase/:showcaseId/report — laporkan item (throttle 5/jam).
 * `reason` mengikuti kategori moderasi konten backend.
 */
export function reportShowcase(
  showcaseId: string,
  dto: { reason: string; description?: string },
) {
  return http.post<{ reported: boolean; reportId?: string }, { reason: string; description?: string }>(
    `/v1/showcase/${showcaseId}/report`,
    dto,
    { auth: "required" },
  )
}
