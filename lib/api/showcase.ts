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
  /**
   * BFI-131 (audit integrasi 2026-09-30): apakah viewer mem-follow author
   * ini — DIKIRIM backend (`showcase.service.ts`), sebelumnya tak bertipe.
   */
  isFollowing?: boolean
}

/**
 * Item showcase ter-serialize (feed + detail + list publik).
 * `orderLink` siap pakai untuk pr-pengisian alur transaksi.
 */
export type ShowcaseSocialItem = {
  id: string
  title: string
  description?: string | null
  /**
   * DC-007 (audit Discovery 2026-09-26): deskripsi HTML subscriber Kahade+
   * (benefit 7). Backend mengirim apa adanya; frontend WAJIB render via
   * <ShowcaseHtmlView> (sanitasi) — JANGAN render mentah.
   */
  descriptionHtml?: string | null
  category?: string | null
  visibility?: string
  isActive?: boolean
  /**
   * KONTRAK FINAL Tim A (2026-09-28): `images[]` berisi objek kaya
   * `ShowcaseMedia` — image | video (imageUrl = berkas video, thumbnailUrl =
   * poster) | spin360 (imageUrl = satu frame, groupKey + groupOrder).
   * Selalu array (bisa kosong); diurutkan sortOrder oleh parser.
   */
  images: ShowcaseMedia[]
  coverImageUrl?: string | null
  /**
   * NP-007 (perf-fix, 2026-09-29): alias top-level `imageUrl` DIHAPUS dari
   * backend — tidak lagi dikirim. Field dipertahankan di tipe supaya kode
   * lama tetap kompilasi, tetapi JANGAN dibaca: sumber kebenaran gambar
   * adalah `images[]` + `coverImageUrl`.
   */
  imageUrl?: string | null
  priceMin?: number | null
  priceMax?: number | null
  /**
   * Kondisi barang dari backend ("BARU" | "BEKAS" | null) — kontrak final
   * Tim A (2026-09-28). null = tidak diisi penjual.
   */
  condition?: "BARU" | "BEKAS" | null
  likeCount: number
  commentCount: number
  /**
   * BFI-131: OPSIONAL — feed excerpt backend (`serializeShowcase(excerpt:true)`)
   * SENGAJA tidak mengirim `viewCount`/`updatedAt` (NP-007); parser fallback
   * ke 0/"" untuk kartu feed. Nilai nyata hanya ada di respons detail.
   */
  viewCount?: number
  /** DC-008: berapa kali deep link share item ini dibuka (backend S-4). */
  shareCount?: number
  /** Berapa kali item ini disimpan (kontrak final Tim A, 2026-09-28). */
  saveCount: number
  /** viewer menyimpan item ini (butuh auth; false bila anonim). */
  isSaved?: boolean
  /** viewer menyukai item ini (butuh auth; false bila anonim). */
  isLiked?: boolean
  /** viewer adalah pemilik item (moderasi komentar terbuka). */
  isOwner?: boolean
  createdAt: string
  /**
   * BFI-131: OPSIONAL — tidak dikirim feed excerpt (lihat `viewCount`).
   * Parser fallback ke "" untuk kartu feed.
   */
  updatedAt?: string
  author: ShowcaseAuthor
  orderLink?: {
    title: string
    description: string
    orderValue?: number | null
    orderValueValid?: boolean
    counterpartUsername?: string
  } | null
  shareUrl?: string
  /**
   * D1-001 (perf 2026-09-29): badge commerce (["TERLARIS","DISKON"]) diserialkan
   * LANGSUNG di payload feed — kartu tidak lagi N+1
   * GET /v1/commerce/products/:id/badges per kartu.
   */
  badges?: string[]
  /**
   * D1-011: flag commerce EKSPLISIT pengganti pemicu lama "orderLink ada"
   * (yang selalu truthy). true = harga valid & bisa dipesan.
   */
  isCommerce?: boolean
  /** Karya terkait (kategori sama → populer). Diisi backend di detail. */
  related?: ShowcaseSocialItem[]
}

/**
 * Satu entri `images[]` respons backend — KONTRAK FINAL Tim A (2026-09-28).
 * - `image`: `imageUrl` = URL gambar.
 * - `video`: `imageUrl` = URL berkas video, `thumbnailUrl` = poster/thumbnail
 *   (wajib ada menurut kontrak upload; viewer memakai ini sebagai cover).
 * - `spin360`: `imageUrl` = URL SATU frame; frame se-grup berbagi `groupKey`
 *   dan diurutkan `groupOrder` (0..n-1 kontinu; viewer wrap-around).
 */
export type ShowcaseMediaKind = "image" | "video" | "spin360"

export type ShowcaseMedia = {
  id: string
  kind: ShowcaseMediaKind
  imageUrl: string
  thumbnailUrl?: string
  /** video: durasi detik (dari upload). */
  durationSec?: number
  width?: number
  height?: number
  /** spin360: kunci grup frame. */
  groupKey?: string
  /** spin360: urutan frame dalam grup (0..n-1). */
  groupOrder?: number
  sortOrder: number
}

/**
 * Parser kontrak final `images[]` (Tim A, 2026-09-28). Aturan:
 * - `kind` hilang/null → "image" (payload lama tetap valid);
 * - `kind` string di luar whitelist → entri DIBUANG (bukan fail-open);
 * - `imageUrl` wajib non-kosong untuk semua kind;
 * - `spin360` tanpa `groupKey`/`groupOrder` valid → dibuang (tak bisa
 *   dirangkai jadi putaran);
 * - hasil diurutkan `sortOrder` (fallback indeks).
 */
export function parseShowcaseMedia(raw: unknown, fallbackId = ""): ShowcaseMedia[] {
  if (!Array.isArray(raw)) return []
  const out: ShowcaseMedia[] = []
  raw.forEach((entry, index) => {
    const rec = asRecord(entry)
    if (!rec) return
    const id = typeof rec.id === "string" && rec.id ? rec.id : `${fallbackId}-media-${index}`
    const kindRaw = rec.kind
    if (typeof kindRaw === "string" && kindRaw !== "image" && kindRaw !== "video" && kindRaw !== "spin360") {
      return
    }
    const kind: ShowcaseMediaKind =
      kindRaw === "video" || kindRaw === "spin360" ? kindRaw : "image"
    const imageUrl = typeof rec.imageUrl === "string" && rec.imageUrl ? rec.imageUrl : null
    if (!imageUrl) return
    const thumbnailUrl =
      typeof rec.thumbnailUrl === "string" && rec.thumbnailUrl ? rec.thumbnailUrl : undefined
    const num = (v: unknown): number | undefined =>
      typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined
    const groupKey =
      typeof rec.groupKey === "string" && rec.groupKey ? rec.groupKey : undefined
    const groupOrderRaw = num(rec.groupOrder)
    const groupOrder = groupOrderRaw == null ? undefined : Math.floor(groupOrderRaw)
    if (kind === "spin360" && (groupKey == null || groupOrder == null)) return
    const sortOrder =
      typeof rec.sortOrder === "number" && Number.isFinite(rec.sortOrder) ? rec.sortOrder : index
    out.push({
      id,
      kind,
      imageUrl,
      sortOrder,
      ...(thumbnailUrl ? { thumbnailUrl } : {}),
      ...(() => {
        const extra: Partial<ShowcaseMedia> = {}
        const durationSec = num(rec.durationSec)
        if (durationSec != null) extra.durationSec = durationSec
        const width = num(rec.width)
        if (width != null) extra.width = width
        const height = num(rec.height)
        if (height != null) extra.height = height
        if (groupKey != null) extra.groupKey = groupKey
        if (groupOrder != null) extra.groupOrder = groupOrder
        return extra
      })(),
    })
  })
  return out.sort((a, b) => a.sortOrder - b.sortOrder)
}

/** Komentar + balasan satu tingkat (kedalaman dibatasi backend). */
export type ShowcaseComment = {
  id: string
  showcaseId: string
  parentId?: string | null
  content: string
  /** true = komentar di-soft-delete (tampil sebagai placeholder). */
  isDeleted?: boolean
  /** true = disembunyikan pemilik item (hanya pemilik yang melihat). */
  isHidden?: boolean
  hiddenReason?: "SPAM" | "INAPPROPRIATE" | "HARASSMENT" | "OTHER" | null
  /**
   * Like komentar (mega-batch item 48; BFE-117/FAL-009 fix 2026-10-03).
   * Backend mengirim `likes`/`dislikes`/`userVote` (lihat
   * POST /v1/showcase/comments/:commentId/like di bawah) — dibaca defensif.
   * Field lawas `likeCount`/`isLiked` dipertahankan sebagai fallback bila
   * backend lama belum mengirim field baru.
   */
  likeCount?: number
  isLiked?: boolean
  /** Total "suka" dari server. */
  likes?: number
  /** Total "tidak suka" dari server. */
  dislikes?: number
  /**
   * Vote viewer saat ini: 1 = suka, -1 = tidak suka, 0/absen = belum vote.
   * Nilai di luar {1,-1,0} dinormalkan ke 0 saat parse.
   */
  userVote?: 1 | -1 | 0
  /**
   * BFE-118: total SEMUA balasan dari server (replies[] inline dibatasi
   * backend, mis. 20). Dipakai untuk label toggle "N balasan" agar tidak
   * undercount pada utas panjang.
   */
  replyCount?: number
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

export type ShowcaseFeedSort = "latest" | "popular" | "foryou"

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
  /**
   * DC-012 (audit Discovery 2026-09-26): filter harga (IDR, integer >= 0).
   * Backend: minPrice/maxPrice (showcase-feed-query.dto.ts) — irisan rentang
   * terhadap [priceMin, priceMax] item.
   */
  minPrice?: number
  maxPrice?: number
  /**
   * KONTRAK FINAL Tim A (2026-09-28): filter kondisi & rating penjual.
   * `condition`: "baru" | "bekas" (backend: ?condition=baru|bekas).
   * `minSellerRating`: mis. 4.0 / 4.5 (backend: ?minSellerRating=4.0).
   */
  condition?: "baru" | "bekas"
  minSellerRating?: number
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
  /** NP-008: kursor keyset untuk halaman berikut (null = habis). */
  nextCursor?: string | null
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
        // DC-012: teruskan filter harga bila valid (integer >= 0).
        minPrice:
          typeof query.minPrice === "number" && Number.isFinite(query.minPrice) && query.minPrice >= 0
            ? Math.floor(query.minPrice)
            : undefined,
        maxPrice:
          typeof query.maxPrice === "number" && Number.isFinite(query.maxPrice) && query.maxPrice >= 0
            ? Math.floor(query.maxPrice)
            : undefined,
        // Kontrak final Tim A (2026-09-28): ?condition=baru|bekas,
        // ?minSellerRating=4.0. Nilai di luar kontrak tidak dikirim
        // (fail-closed — bukan menebak param).
        condition: query.condition === "baru" || query.condition === "bekas" ? query.condition : undefined,
        minSellerRating:
          typeof query.minSellerRating === "number" &&
          Number.isFinite(query.minSellerRating) &&
          query.minSellerRating >= 0 &&
          query.minSellerRating <= 5
            ? query.minSellerRating
            : undefined,
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
 * GET /v1/showcase/:showcaseId/comments — komentar bersarang.
 * Root dipaginasi; tiap root menyertakan `replies` satu tingkat.
 *
 * NP-008 (perf-fix): `cursor` (dari `nextCursor` respons sebelumnya) memakai
 * keyset pagination backend — tanpa `skip` besar. Tanpa cursor, offset
 * (?page) lama tetap dipakai (kompatibel mundur).
 */
export function listShowcaseComments(
  showcaseId: string,
  params: { page?: number; limit?: number; cursor?: string | null; sort?: "newest" | "oldest" } = {},
  signal?: AbortSignal,
) {
  const query: Record<string, number | string> = {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
  }
  if (params.cursor) query.cursor = params.cursor
  // BFE-114: backend mendukung ?sort=newest|oldest (default newest) —
  // kirim pilihan user ke server, jangan sort ulang sisi klien.
  if (params.sort === "oldest" || params.sort === "newest") query.sort = params.sort
  return http
    .get<unknown>(`/v1/showcase/${seg(showcaseId)}/comments`, {
      auth: "optional",
      query,
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
        nextCursor: typeof record.nextCursor === "string" ? record.nextCursor : null,
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

/**
 * BFE-117 / FAL-009 (fix 2026-10-03): vote komentar — PERSISTEN di server.
 *
 * KONTRAK (TERVERIFIKASI 2026-10-03 di backend-wt-auditfix:
 * showcase.controller.ts:194 + showcase.service.ts toggleCommentLike +
 * dto/showcase-comment.dto.ts ToggleCommentLikeDto):
 *   POST /v1/showcase/comments/:commentId/like   (auth wajib, throttle 30/mnt)
 *   body: { value: 1 | -1 | 0 }   (1 = suka, -1 = tidak suka, 0 = batalkan vote)
 *   → { likes: number, dislikes: number, userVote: 1 | -1 | 0 }
 *   404 = komentar tidak ada/dihapus · 403 = komentar disembunyikan.
 *
 * Respons di-parse defensif (audit H-01): field hilang → fallback aman,
 * bukan throw. Pemanggil (lib/showcase-comment-likes.ts) memakai ini dengan
 * optimistic UI + rollback bila request gagal.
 */
export type ShowcaseCommentVoteValue = 1 | -1 | 0
export type ShowcaseCommentVoteResult = {
  likes: number
  dislikes: number
  userVote: ShowcaseCommentVoteValue
}

export function voteShowcaseComment(
  commentId: string,
  value: ShowcaseCommentVoteValue,
): Promise<ShowcaseCommentVoteResult> {
  return http
    .post<unknown, { value: ShowcaseCommentVoteValue }>(
      `/v1/showcase/comments/${seg(commentId)}/like`,
      { value },
      { auth: "required" },
    )
    .then((raw) => {
      const r = asRecord(raw) ?? {}
      const likes = toNonNegativeInt(r.likes) ?? 0
      const dislikes = toNonNegativeInt(r.dislikes) ?? 0
      const userVote: ShowcaseCommentVoteValue =
        r.userVote === 1 ? 1 : r.userVote === -1 ? -1 : 0
      return { likes, dislikes, userVote }
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
    .post<unknown>(`/v1/showcase/${seg(showcaseId)}/like`, undefined, {
      auth: "required",
      // Item #27: boleh diantrekan saat offline (aksi sosial).
      offlineBehavior: "enqueue-social",
      offlineLabel: "Suka karya",
    })
    .then((raw) => toLikeState(raw, fallbackCount))
}

/** DELETE /v1/showcase/:showcaseId/like → `{ liked: false, likeCount }`. */
export function unlikeShowcase(showcaseId: string, fallbackCount = 0) {
  return http
    .delete<unknown>(`/v1/showcase/${seg(showcaseId)}/like`, {
      auth: "required",
      // Item #27: boleh diantrekan saat offline (aksi sosial).
      offlineBehavior: "enqueue-social",
      offlineLabel: "Batal suka karya",
    })
    .then((raw) => toLikeState(raw, fallbackCount))
}

/**
 * State simpan final server — KONTRAK FINAL Tim A (2026-09-28).
 * K-04: `saveCount` yang hilang → `fallbackCount` (nilai optimistis
 * pemanggil), BUKAN 0.
 */
function toSaveState(raw: unknown, fallbackCount = 0): { saved: boolean; saveCount: number } {
  const record = (raw ?? {}) as Record<string, unknown>
  const fallback = Number.isFinite(fallbackCount) ? Math.max(0, Math.floor(fallbackCount)) : 0
  return {
    saved: record.saved === true,
    saveCount:
      typeof record.saveCount === "number" && Number.isFinite(record.saveCount)
        ? Math.max(0, Math.floor(record.saveCount))
        : fallback,
  }
}

/**
 * POST /v1/showcase/:showcaseId/save → `{ saved: true, saveCount }`.
 * 409 SHOWCASE_ALREADY_SAVED = sudah tersimpan (diperlakukan sebagai sukses
 * idempoten oleh pemanggil — bukan error fatal).
 */
export function saveShowcase(showcaseId: string, fallbackCount = 0) {
  return http
    .post<unknown>(`/v1/showcase/${seg(showcaseId)}/save`, undefined, {
      auth: "required",
      offlineBehavior: "enqueue-social",
      offlineLabel: "Simpan karya",
    })
    .then((raw) => toSaveState(raw, fallbackCount))
}

/**
 * DELETE /v1/showcase/:showcaseId/save → `{ saved: false, saveCount }`.
 * 404 SHOWCASE_NOT_SAVED = tidak tersimpan (diperlakukan sebagai sukses
 * idempoten oleh pemanggil).
 */
export function unsaveShowcase(showcaseId: string, fallbackCount = 0) {
  return http
    .delete<unknown>(`/v1/showcase/${seg(showcaseId)}/save`, {
      auth: "required",
      offlineBehavior: "enqueue-social",
      offlineLabel: "Batal simpan karya",
    })
    .then((raw) => toSaveState(raw, fallbackCount))
}

/** Satu entri daftar likers/savers (kontrak final Tim A, 2026-09-28). */
export type ShowcaseLiker = {
  userId: string
  username: string
  fullName: string | null
  avatarUrl?: string | null
  /** likers → likedAt; savers → savedAt. */
  at: string
}

export type ShowcaseLikersPage = {
  data: ShowcaseLiker[]
  total: number
  page: number
  limit: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
  /** NP-008: kursor keyset untuk halaman berikut (null = habis). */
  nextCursor?: string | null
}

function parseShowcaseLikersPage(raw: unknown, timeField: "likedAt" | "savedAt"): ShowcaseLikersPage {
  const record = (raw ?? {}) as Record<string, unknown>
  const data = readList<unknown>(record, ["data"]).flatMap((entry) => {
    const rec = asRecord(entry)
    if (!rec || typeof rec.userId !== "string" || !rec.userId) return []
    const username =
      typeof rec.username === "string" && rec.username
        ? rec.username
        : typeof rec.fullName === "string" && rec.fullName
          ? rec.fullName
          : rec.userId
    const at = rec[timeField]
    return [
      {
        userId: rec.userId,
        username,
        fullName: typeof rec.fullName === "string" ? rec.fullName : null,
        avatarUrl: typeof rec.avatarUrl === "string" ? rec.avatarUrl : null,
        at: typeof at === "string" ? at : "",
      },
    ]
  })
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : fallback
  return {
    data,
    total: num(record.total, data.length),
    page: num(record.page, 1),
    limit: num(record.limit, 20),
    totalPages: num(record.totalPages, 1),
    hasNext: record.hasNext === true,
    hasPrev: record.hasPrev === true,
    nextCursor: typeof record.nextCursor === "string" ? record.nextCursor : null,
  }
}

/**
 * GET /v1/showcase/saved — koleksi "disimpan" per-akun dari backend
 * (mega-batch FE-IMP-1, item 54). Kartu publik bentuk feed + `savedAt`;
 * pagination HALAMAN (?page&limit, kontrak final backend BE-IMP item 54).
 */
export type SavedShowcaseEntry = { item: ShowcaseSocialItem; savedAt: string }
export type SavedShowcasesPage = {
  data: SavedShowcaseEntry[]
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
  /** NP-008: kursor keyset untuk halaman berikut (null = habis). */
  nextCursor?: string | null
}

export function getSavedShowcases(
  params: { page?: number; limit?: number; cursor?: string | null } = {},
  signal?: AbortSignal,
) {
  const query: Record<string, number | string> = {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
  }
  // NP-008: bila cursor diberikan, server memakai keyset pagination.
  if (params.cursor) query.cursor = params.cursor
  return http
    .get<unknown>("/v1/showcase/saved", {
      auth: "required",
      query,
      retry: 1,
      signal,
    })
    .then((raw) => {
      const record = (raw ?? {}) as Record<string, unknown>
      const page = typeof record.page === "number" ? record.page : 1
      const limit = typeof record.limit === "number" ? record.limit : 20
      const total = typeof record.total === "number" ? record.total : 0
      const totalPages = typeof record.totalPages === "number" ? record.totalPages : 0
      // DRIFT-04: item rusak dilewati per-item, jangan runtuhkan koleksi.
      const data = readList<unknown>(record, ["data"]).flatMap((rawItem) => {
        try {
          const asRec = (rawItem ?? {}) as Record<string, unknown>
          const item = parseShowcaseItem(asRec.item ?? rawItem)
          const savedAt =
            typeof asRec.savedAt === "string"
              ? asRec.savedAt
              : typeof asRec.createdAt === "string"
                ? asRec.createdAt
                : new Date(0).toISOString()
          return [{ item, savedAt }]
        } catch (err) {
          logWarn("showcase:saved:skip-item", err)
          return []
        }
      })
      return {
        data,
        page,
        limit,
        total,
        totalPages,
        hasNext: typeof record.nextCursor === "string" ? true : record.hasNext === true,
        hasPrev: record.hasPrev === true,
        // NP-008: kehadiran nextCursor = masih ada halaman berikut.
        nextCursor: typeof record.nextCursor === "string" ? record.nextCursor : null,
      } satisfies SavedShowcasesPage
    })
}

/** POST /v1/showcase/saved/:showcaseId — simpan ke koleksi backend (item 54). */
export function addSavedShowcase(showcaseId: string) {
  return http.post<void, Record<string, never>>(
    `/v1/showcase/saved/${seg(showcaseId)}`,
    {},
    { auth: "required", retry: 1 },
  )
}

/** DELETE /v1/showcase/saved/:showcaseId — hapus dari koleksi backend (item 54). */
export function removeSavedShowcase(showcaseId: string) {
  return http.delete<void>(`/v1/showcase/saved/${seg(showcaseId)}`, {
    auth: "required",
    retry: 1,
  })
}

/**
 * GET /v1/showcase/:id/likers?page&limit — PUBLIK (kontrak final Tim A).
 * Idempoten → retry 1 aman.
 * NP-008: `cursor` opsional memakai keyset pagination (tanpa skip besar).
 */
export function getShowcaseLikers(
  showcaseId: string,
  params: { page?: number; limit?: number; cursor?: string | null } = {},
  signal?: AbortSignal,
) {
  const query: Record<string, number | string> = {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
  }
  if (params.cursor) query.cursor = params.cursor
  return http
    .get<unknown>(`/v1/showcase/${seg(showcaseId)}/likers`, {
      auth: "optional",
      query,
      retry: 1,
      signal,
    })
    .then((raw) => parseShowcaseLikersPage(raw, "likedAt"))
}

/**
 * GET /v1/showcase/:id/savers?page&limit — HANYA PEMILIK (kontrak final Tim A).
 * anon → 401; bukan pemilik → 403 SHOWCASE_FORBIDDEN (pemanggil WAJIB
 * menyembunyikan tab, bukan menampilkan error).
 * NP-008: `cursor` opsional memakai keyset pagination (tanpa skip besar).
 */
export function getShowcaseSavers(
  showcaseId: string,
  params: { page?: number; limit?: number; cursor?: string | null } = {},
  signal?: AbortSignal,
) {
  const query: Record<string, number | string> = {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
  }
  if (params.cursor) query.cursor = params.cursor
  return http
    .get<unknown>(`/v1/showcase/${seg(showcaseId)}/savers`, {
      auth: "required",
      query,
      retry: 1,
      signal,
    })
    .then((raw) => parseShowcaseLikersPage(raw, "savedAt"))
}

/** GET /v1/showcase/:showcaseId/share — metadata deep link (publik). */
export function getShowcaseSharePayload(showcaseId: string, signal?: AbortSignal) {
  return http.get<ShowcaseSharePayload>(`/v1/showcase/${seg(showcaseId)}/share`, {
    auth: "none",
    retry: 1,
    signal,
  })
}

/**
 * POST /v1/showcase/:showcaseId/share — catat SATU aksi share nyata (SS-005).
 * Dipanggil saat user menyelesaikan aksi berbagi (salin tautan / share sheet /
 * buka aplikasi eksternal), BUKAN saat sheet dibuka. Publik + throttled.
 * Best-effort: kegagalan tidak boleh mengganggu alur berbagi.
 */
export function recordShowcaseShare(showcaseId: string): Promise<{ shareCount?: number }> {
  return http
    .post<{ shareCount?: number }, Record<string, never>>(`/v1/showcase/${seg(showcaseId)}/share`, {}, { auth: "none", retry: 0 })
    .catch(() => ({ shareCount: undefined }))
}

/** Item dari GET /v1/users/me/showcase/deleted (SS-012). */
export type DeletedShowcaseItem = {
  id: string
  title?: string
  deletedAt?: string
  /** Sisa hari sebelum hard-delete otomatis (jendela 30 hari). */
  daysRemaining?: number
  /** Masih bisa dipulihkan. */
  restorable?: boolean
}

/** Respons GET /v1/users/me/showcase/deleted. */
export type DeletedShowcaseList = {
  items: DeletedShowcaseItem[]
  total: number
  page: number
  limit: number
}

/**
 * GET /v1/users/me/showcase/deleted — item etalase milik sendiri yang
 * di-soft-delete, beserta sisa masa pemulihan (SS-012).
 */
export function getDeletedShowcase(params?: { page?: number; limit?: number }, signal?: AbortSignal) {
  const q = new URLSearchParams()
  if (params?.page) q.set("page", String(params.page))
  if (params?.limit) q.set("limit", String(params.limit))
  const qs = q.toString()
  return http.get<DeletedShowcaseList>(`/v1/users/me/showcase/deleted${qs ? `?${qs}` : ""}`, {
    auth: "required",
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
  const images = parseShowcaseMedia(value.images, value.id)
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
    // SH-F-011 (audit 2026-09-27): whitelist enum — nilai asing ("FOLLOWERS",
    // "UNLISTED", dst.) JANGAN fail-open ke publik; turunkan ke undefined
    // dan biarkan pemanggil memutuskan aman (fail-closed).
    visibility:
      value.visibility === "PUBLIC" || value.visibility === "PRIVATE"
        ? value.visibility
        : undefined,
    isActive: typeof value.isActive === "boolean" ? value.isActive : undefined,
    coverImageUrl: typeof value.coverImageUrl === "string" ? value.coverImageUrl : null,
    // NP-007: alias `imageUrl` tidak lagi dikirim backend — sengaja tidak
    // diparse; pembaca memakai `coverImageUrl`/`images[]`.
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
      // BFI-131: isFollowing dikirim backend — teruskan (boolean strict).
      isFollowing: author.isFollowing === true,
    },
    likeCount: count(value.likeCount), commentCount: count(value.commentCount), viewCount: count(value.viewCount),
    // DC-008: shareCount dikirim backend, sebelumnya dibuang parser.
    shareCount: count(value.shareCount),
    // DC-007: descriptionHtml (Kahade+ benefit 7) — render via
    // <ShowcaseHtmlView>, jangan pernah mentah.
    descriptionHtml: typeof value.descriptionHtml === "string" && value.descriptionHtml.trim()
      ? value.descriptionHtml
      : null,
    isLiked: value.isLiked === true, isOwner: value.isOwner === true,
    // Kontrak final Tim A (2026-09-28): simpan & kondisi barang.
    saveCount: count(value.saveCount),
    isSaved: value.isSaved === true,
    condition:
      value.condition === "BARU" || value.condition === "BEKAS" ? value.condition : null,
    orderLink,
    shareUrl: typeof value.shareUrl === "string" && value.shareUrl ? value.shareUrl : undefined,
    // D1-001: badge commerce dari payload feed (TERLARIS/DISKON) — whitelist
    // string supaya nilai asing tidak dirender.
    badges: Array.isArray(value.badges)
      ? value.badges.filter((b): b is string => typeof b === "string" && (b === "TERLARIS" || b === "DISKON"))
      : undefined,
    // D1-011: flag commerce eksplisit (pengganti pemicu "orderLink ada").
    isCommerce: value.isCommerce === true,
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
/** BFE-117/BFE-118: int non-negatif defensif — absen/invalid → undefined. */
function toNonNegativeInt(raw: unknown): number | undefined {
  return typeof raw === "number" && Number.isFinite(raw) && raw >= 0
    ? Math.floor(raw)
    : undefined
}
export function parseShowcaseComment(raw: unknown): ShowcaseComment {
  const value = asRecord(raw)
  const author = asRecord(value?.author)
  // 2026-10-03: komentar yang di-soft-delete dikirim backend dengan content=null
  // (placeholder agar thread balasan tidak yatim). Terima null bila isDeleted.
  const isDeleted = value?.isDeleted === true
  const contentOk = typeof value?.content === "string" || (isDeleted && value?.content == null)
  if (!value || typeof value.id !== "string" || !contentOk ||
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
    content: typeof value.content === "string" ? value.content : "",
    isDeleted,
    isHidden: value.isHidden === true,
    hiddenReason:
      reason === "SPAM" || reason === "INAPPROPRIATE" || reason === "HARASSMENT" || reason === "OTHER"
        ? reason
        : null,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : "",
    // BFE-117: baca likes/dislikes/userVote defensif dari serializeComment —
    // backend mengirimkannya sejak kontrak POST .../comments/:id/like ada.
    // Field lawas likeCount/isLiked tetap dibaca sebagai fallback.
    likeCount:
      typeof value.likeCount === "number" && Number.isFinite(value.likeCount) && value.likeCount >= 0
        ? Math.floor(value.likeCount)
        : undefined,
    isLiked: value.isLiked === true ? true : undefined,
    likes: toNonNegativeInt(value.likes),
    dislikes: toNonNegativeInt(value.dislikes),
    userVote: value.userVote === 1 ? 1 : value.userVote === -1 ? -1 : 0,
    // BFE-118: total balasan (root-level, dihitung listComments dari
    // replyCountByParent) — untuk label toggle "N balasan".
    replyCount: toNonNegativeInt(value.replyCount),
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
