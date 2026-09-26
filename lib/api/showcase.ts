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
 *
 * KEBIJAKAN RETRY per endpoint (K-05 audit 2026-09-24) — dulu hanya tersebar
 * sebagai komentar di titik pemakaian, sehingga mudah dilanggar tanpa jejak.
 * `check-retry.mjs` hanya menjaga "mutasi tidak pernah retry otomatis"; tabel
 * ini menjaga sisi sebaliknya (endpoint GET mana yang AMAN untuk retry):
 *
 *   | Endpoint                              | retry | alasan                      |
 *   |---------------------------------------|-------|-----------------------------|
 *   | GET /v1/showcase/feed                 |   1   | idempoten, murni baca       |
 *   | GET /v1/showcase/:id                  |   0   | MENAIKKAN viewCount         |
 *   | GET /v1/showcase/:id/comments         |   1   | idempoten, murni baca       |
 *   | GET /v1/users/me/showcase             |   1   | idempoten, murni baca       |
 *   | GET /v1/users/:username/showcase      |   0   | selaras daftar detail       |
 *   | semua mutasi (POST/PUT/PATCH/DELETE)  |   0   | selalu; lihat check-retry   |
 */
import { http, seg } from "./client"
import { readList, asRecord, invalidResponse } from "./response"
import { translate } from "@/lib/i18n/translate"
import { logWarn } from "@/lib/telemetry"
import type { SealTier } from "@/components/ui/verified-seal"

/** Tier seal yang valid dari backend (`sealTier`); nilai lain dibuang. */
function asSealTier(value: unknown): SealTier | null {
  return value === "gold" || value === "blue" || value === "gray" ? value : null
}

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
  /** S1 (audit 2026-09-26): badge verifikasi 3-tier dari backend — dipakai
   * <VerifiedSeal>; fallback ke isKycVerified bila kosong/belum dimuat. */
  badges?: Array<{ type: string }>
  /** R1 (audit 2026-09-26): tier seal dari payload backend (`sealTier`) —
   * diutamakan <VerifiedSeal> di atas komputasi dari `badges`. */
  sealTier?: SealTier | null
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
  /** Karya terkait (kategori sama → populer). Diisi backend di detail. */
  related?: ShowcaseSocialItem[]
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
  /**
   * Filter lokasi (opsional): hanya item yang pemiliknya punya free-text
   * alamat (users.address) yang cocok case-insensitive, mis. "Jakarta".
   */
  location?: string
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
      // D-08 (audit): feed publik — `auth` kini wajib eksplisit.
      auth: "optional",
      signal,
      query: {
        cursor: query.cursor,
        limit: query.limit ?? 20,
        sort: query.sort ?? "latest",
        category: query.category?.trim().replace(/\s+/g, " ").slice(0, 60),
        search: query.search?.trim().slice(0, 100),
        location: query.location?.trim().slice(0, 100) || undefined,
      },
      retry: 1,
    })
    .then((raw) => {
      const record = (raw ?? {}) as Record<string, unknown>
      if (record.hasMore === true && (typeof record.nextCursor !== "string" || !record.nextCursor || record.nextCursor === query.cursor)) {
        throw invalidResponse("showcase:cursor")
      }
      return {
        // DRIFT-04 (fix 2026-09-26): SATU item buruk tidak boleh meruntuhkan
        // seluruh halaman feed — lewati per-item (pola sama seperti `related`
        // di parseShowcaseItem).
        items: readList<unknown>(record, ["items"]).flatMap((rawItem) => {
          try {
            return [parseShowcaseItem(rawItem)]
          } catch (err) {
            logWarn("showcase:feed:skip-item", err)
            return []
          }
        }),
        sort: record.sort === "popular" ? "popular" : "latest",
        limit: typeof record.limit === "number" ? record.limit : 20,
        hasMore: record.hasMore === true,
        nextCursor: typeof record.nextCursor === "string" ? record.nextCursor : null,
      } satisfies ShowcaseFeedPage
    })
}

/** GET /v1/showcase/:showcaseId — detail item (menghitung viewCount). */
export function getShowcaseDetail(showcaseId: string, signal?: AbortSignal) {
  return http.get<ShowcaseSocialItem>(`/v1/showcase/${seg(showcaseId)}`, {
    auth: "optional",
    // D-08 (audit 2026-09-23): `retry: 0` DIHAPUS dari lapis hook (pemanggil
    // mendapat 1 retry F-11). Di lapis transport TETAP 0 — kontrak endpoint
    // ini MENAIKKAN viewCount, auto-retry transport bisa menghitung dua kali
    // (lihat tests/showcase-api-contract "disables view retries").
    retry: 0,
    signal,
  }).then(parseShowcaseItem)
}

/**
 * GET /v1/showcase/:showcaseId/comments — komentar bersarang (offset).
 * Root dipaginasi; tiap root menyertakan `replies` satu tingkat.
 */
export function listShowcaseComments(
  showcaseId: string,
  params: { page?: number; limit?: number } = {},
  signal?: AbortSignal,
) {
  return http
    .get<unknown>(`/v1/showcase/${seg(showcaseId)}/comments`, {
      auth: "optional",
      query: { page: params.page ?? 1, limit: params.limit ?? 20 },
      retry: 1,
      signal,
    })
    .then((raw) => {
      const record = (raw ?? {}) as Record<string, unknown>
      const data = readList<unknown>(record, ["data"]).map((rawComment) => {
        const c = asRecord(rawComment)
        return { ...parseShowcaseComment(c), replies: Array.isArray(c?.replies) ? c.replies.map(parseShowcaseComment) : [] }
      })
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
/**
 * `idempotencyKey` (S-03, audit 2026-09-24): komposer memakai satu kunci per
 * (item × isi komentar) sehingga percobaan ulang setelah waktu habis tidak
 * menciptakan komentar kedua bila kiriman pertama sebenarnya berhasil.
 */
export function addShowcaseComment(
  showcaseId: string,
  dto: { content: string; parentId?: string },
  idempotencyKey?: string,
) {
  return http.post<ShowcaseComment, { content: string; parentId?: string }>(
    `/v1/showcase/${seg(showcaseId)}/comments`,
    dto,
    {
      auth: "required",
      ...(idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : {}),
    },
  )
}

/** PATCH /v1/showcase/comments/:commentId — edit komentar sendiri. */
export function updateShowcaseComment(commentId: string, content: string) {
  return http.patch<ShowcaseComment, { content: string }>(
    `/v1/showcase/comments/${seg(commentId)}`,
    { content },
    { auth: "required" },
  )
}

/** DELETE /v1/showcase/comments/:commentId — pengarang ATAU pemilik item. */
export function deleteShowcaseComment(commentId: string) {
  return http.delete<{ message: string }>(`/v1/showcase/comments/${seg(commentId)}`, {
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
    `/v1/showcase/comments/${seg(commentId)}/hide`,
    { reason },
    { auth: "required" },
  )
}

/** POST /v1/showcase/comments/:commentId/unhide — buka kembali komentar. */
export function unhideShowcaseComment(commentId: string) {
  return http.post<ShowcaseComment>(`/v1/showcase/comments/${seg(commentId)}/unhide`, undefined, {
    auth: "required",
  })
}

/** State suka final server (audit H-01: baca defensif, jangan cast mentah).
 * K-04 (audit 2026-09-23): `likeCount` yang hilang → `fallbackCount` (nilai
 * optimistis pemanggil), BUKAN 0 — "0 Suka" setelah like sukses adalah bohong. */
function toLikeState(raw: unknown, fallbackCount = 0): { liked: boolean; likeCount: number } {
  const record = (raw ?? {}) as Record<string, unknown>
  const fallback = Number.isFinite(fallbackCount) ? Math.max(0, Math.floor(fallbackCount)) : 0
  return {
    liked: record.liked === true,
    likeCount:
      typeof record.likeCount === "number" && Number.isFinite(record.likeCount)
        ? Math.max(0, Math.floor(record.likeCount))
        : fallback,
  }
}

/** POST /v1/showcase/:showcaseId/like → `{ liked: true, likeCount }`. */
export function likeShowcase(showcaseId: string, fallbackCount = 0) {
  return http
    .post<unknown>(`/v1/showcase/${seg(showcaseId)}/like`, undefined, { auth: "required" })
    .then((raw) => toLikeState(raw, fallbackCount))
}

/** DELETE /v1/showcase/:showcaseId/like → `{ liked: false, likeCount }`. */
export function unlikeShowcase(showcaseId: string, fallbackCount = 0) {
  return http
    .delete<unknown>(`/v1/showcase/${seg(showcaseId)}/like`, { auth: "required" })
    .then((raw) => toLikeState(raw, fallbackCount))
}

/** GET /v1/showcase/:showcaseId/share — metadata deep link (publik). */
export function getShowcaseSharePayload(showcaseId: string, signal?: AbortSignal) {
  return http.get<ShowcaseSharePayload>(`/v1/showcase/${seg(showcaseId)}/share`, {
    auth: "none",
    retry: 1,
    signal,
  })
}

/** Item kategori populer dari GET /v1/showcase/categories. */
export type PopularCategory = {
  category: string
  count: number
}

function parsePopularCategory(raw: unknown): PopularCategory | null {
  const value = asRecord(raw)
  if (!value || typeof value.category !== "string") return null
  const count = typeof value.count === "number" && Number.isFinite(value.count) ? value.count : 0
  return { category: value.category, count }
}

/**
 * GET /v1/showcase/categories — daftar kategori populer beserta jumlah karya.
 * Dipakai sebagai saran saat mengisi kategori (mengurangi fragmentasi ejaan
 * teks bebas). Murni baca + idempoten → retry 1 aman.
 */
export async function getPopularCategories(
  limit = 20,
  signal?: AbortSignal,
): Promise<PopularCategory[]> {
  const body = await http.get<unknown>(`/v1/showcase/categories?limit=${limit}`, {
    auth: "none",
    retry: 1,
    signal,
  })
  const record = asRecord(body)
  const rawList = Array.isArray(record?.categories) ? record.categories : []
  return rawList
    .map(parsePopularCategory)
    .filter((c): c is PopularCategory => c !== null && c.category.trim().length > 0)
}

/**
 * POST /v1/showcase/:showcaseId/report — laporkan item (throttle 5/jam).
 * `reason` mengikuti kategori moderasi konten backend.
 */
/**
 * S-03 (audit 2026-09-24): pemanggil boleh mengirim `Idempotency-Key` untuk
 * SATU aksi logis. Lapisan transport memang sudah membuat kunci per panggilan,
 * tapi percobaan ULANG manual (setelah timeout/gagal jaringan) adalah panggilan
 * baru — tanpa kunci yang dibawa pemanggil, laporan yang sebenarnya sudah
 * terkirim bisa tercatat dua kali.
 */
export function reportShowcase(
  showcaseId: string,
  dto: { reason: string; description?: string },
  idempotencyKey?: string,
) {
  return http.post<{ reported: boolean; reportId?: string }, { reason: string; description?: string }>(
    `/v1/showcase/${seg(showcaseId)}/report`,
    dto,
    {
      auth: "required",
      ...(idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : {}),
    },
  )
}

/** Decode network entities before they reach renderers; generic casts are not validation.
 * K-01 (audit 2026-09-23): TANPA spread `...value` — setiap field dibaca
 * tipe-demi-tipe. Dulu `orderLink.title: 5` & `visibility: 42` lolos mentah ke
 * prefill transaksi (`routes.ts`). B-02: judul kosong → fallback "Tanpa judul"
 * sudah di LAPIsan parser (bukan hanya jalur toSocialShowcaseItem). */
export function parseShowcaseItem(raw: unknown): ShowcaseSocialItem {
  const value = asRecord(raw)
  const author = asRecord(value?.author)
  if (!value || typeof value.id !== "string" || !value.id ||
      !author || typeof author.userId !== "string") {
    throw invalidResponse("showcase:item")
  }
  // DRIFT-04 (fix 2026-09-26): `author.username` NULLABLE di DB (registrasi via
  // HP) — jangan lempar untuk satu field null; fallback berlapis supaya tipe
  // `username: string` tetap terpenuhi dan UI tidak render "@null".
  const authorUsername =
    typeof author.username === "string" && author.username
      ? author.username
      : typeof author.fullName === "string" && author.fullName
        ? author.fullName
        : author.userId
  const count = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0
  const str = (v: unknown): string | null => (typeof v === "string" ? v : null)
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null
  const images = Array.isArray(value.images) ? value.images.flatMap((rawImage, index) => {
    const image = asRecord(rawImage)
    return image && typeof image.imageUrl === "string" ? [{
      id: typeof image.id === "string" ? image.id : `${value.id}-${index}`,
      imageUrl: image.imageUrl,
      sortOrder: typeof image.sortOrder === "number" ? image.sortOrder : index,
    }] : []
  }).sort((a, b) => a.sortOrder - b.sortOrder) : []
  /** `orderLink` dipakai prefill transaksi — semua bagian harus bertipe benar. */
  const rawLink = asRecord(value.orderLink)
  const orderLink = rawLink
    ? {
        title: typeof rawLink.title === "string" ? rawLink.title : "",
        description: typeof rawLink.description === "string" ? rawLink.description : "",
        orderValue: num(rawLink.orderValue),
        orderValueValid: rawLink.orderValueValid === true,
        ...(typeof rawLink.counterpartUsername === "string" && rawLink.counterpartUsername
          ? { counterpartUsername: rawLink.counterpartUsername }
          : {}),
      }
    : null
  return {
    id: value.id,
    title: typeof value.title === "string" && value.title.trim() ? value.title : translate("Tanpa judul"),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : "",
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
    images,
    description: typeof value.description === "string" ? value.description : null,
    // G-20 (audit 2026-09-23): kategori bebas-teks dinormalisasi (trim + spasi
    // ganda) supaya "Kriya " / "Kriya  Jaya" tidak jadi kelompok sendiri.
    category: typeof value.category === "string"
      ? value.category.trim().replace(/\s+/g, " ")
      : null,
    visibility: typeof value.visibility === "string" ? value.visibility : undefined,
    isActive: typeof value.isActive === "boolean" ? value.isActive : undefined,
    coverImageUrl: typeof value.coverImageUrl === "string" ? value.coverImageUrl : null,
    imageUrl: typeof value.imageUrl === "string" ? value.imageUrl : null,
    priceMin: num(value.priceMin),
    priceMax: num(value.priceMax),
    author: {
      userId: author.userId,
      username: authorUsername,
      fullName: typeof author.fullName === "string" ? author.fullName : null,
      avatarUrl: str(author.avatarUrl),
      membershipRank: str(author.membershipRank),
      isKycVerified: author.isKycVerified === true,
      isVip: author.isVip === true,
      // S1: teruskan badge 3-tier dari backend untuk <VerifiedSeal>.
      badges: Array.isArray(author.badges)
        ? author.badges
            .filter((b) => b && typeof (b as { type?: unknown }).type === "string")
            .map((b) => ({ type: (b as { type: string }).type }))
        : [],
      // R1: tier seal dari payload backend — diutamakan <VerifiedSeal>.
      sealTier: asSealTier(author.sealTier),
    },
    likeCount: count(value.likeCount), commentCount: count(value.commentCount), viewCount: count(value.viewCount),
    isLiked: value.isLiked === true, isOwner: value.isOwner === true,
    orderLink,
    shareUrl: typeof value.shareUrl === "string" && value.shareUrl ? value.shareUrl : undefined,
    // Karya terkait (audit Discovery 2026-09-26): backend mengirim `related`
    // (maks 6, bentuk serialize sama) di respons detail — parser sebelumnya
    // MEMBUANG field ini sehingga section "Karya terkait" di [id].tsx tidak
    // pernah tampil. Entri yang gagal validasi dilewati, bukan menggagalkan
    // seluruh halaman detail.
    related: Array.isArray(value.related)
      ? value.related.flatMap((rawRelated) => {
          try {
            return [parseShowcaseItem(rawRelated)]
          } catch {
            return []
          }
        })
      : undefined,
  }
}

/** K-05 (audit 2026-09-23): createdAt/showcaseId/isHidden kini tervalidasi. */
export function parseShowcaseComment(raw: unknown): ShowcaseComment {
  const value = asRecord(raw)
  const author = asRecord(value?.author)
  if (!value || typeof value.id !== "string" || typeof value.content !== "string" ||
      !author || typeof author.userId !== "string") {
    throw invalidResponse("showcase:comment")
  }
  // DRIFT-04 (fix 2026-09-26): pola sama seperti parseShowcaseItem — username
  // nullable di DB; fallback berlapis agar satu komentar tidak meruntuhkan list.
  const commentAuthorUsername =
    typeof author.username === "string" && author.username
      ? author.username
      : typeof author.fullName === "string" && author.fullName
        ? author.fullName
        : author.userId
  const reason = value.hiddenReason
  return {
    id: value.id,
    showcaseId: typeof value.showcaseId === "string" ? value.showcaseId : "",
    parentId: typeof value.parentId === "string" ? value.parentId : null,
    content: value.content,
    isHidden: value.isHidden === true,
    hiddenReason:
      reason === "SPAM" || reason === "INAPPROPRIATE" || reason === "HARASSMENT" || reason === "OTHER"
        ? reason
        : null,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : "",
    // K-04 (audit 2026-09-24): `updatedAt` dipakai UI untuk penanda "(diedit)"
    // — bentuknya dinormalkan di sini supaya nilai tak terurai tidak pernah
    // sampai ke perbandingan waktu (lihat isEditedComment).
    updatedAt:
      typeof value.updatedAt === "string" && Number.isFinite(Date.parse(value.updatedAt))
        ? value.updatedAt
        : undefined,
    author: {
      userId: author.userId,
      username: commentAuthorUsername,
      fullName: typeof author.fullName === "string" ? author.fullName : null,
      avatarUrl: typeof author.avatarUrl === "string" ? author.avatarUrl : null,
    },
  }
}
