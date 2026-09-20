import {
  asRecord,
  pickUserId,
  readEntity,
  readList,
  readPage,
  readVerdict,
} from "@/lib/api/response"
/**
 * Kahade — domain `users` (tag "users" di kahade-api-mobile.json).
 *
 * Hanya endpoint yang dipakai alur auth (setup profil) dan navigasi dasar
 * yang diimplementasikan di sini. Endpoint lain (follow, block, report,
 * showcase, questions, analytics, dll) ditambahkan saat screen terkait
 * dibangun — mengikuti aturan "jangan implementasi yang belum dipakai".
 *
 * Semua endpoint di sini memakai `auth: "required"` (butuh Bearer token).
 *
 * Keputusan non-obvious:
 *   - `updateProfile` hanya mengirim field yang diisi (partial update).
 *     DTO class-validator menerima field opsional yang di-omit.
 *   - Avatar upload mengikuti pola 2 langkah: `uploadAvatarDirect` (multipart)
 *     → `confirmAvatar` (key). Spec menyediakan `PUT /v1/users/me/avatar`
 *     untuk presigned URL, tapi direct upload lebih simple untuk mobile
 *     (tidak perlu round-trip presigned URL).
 */
import { http, seg } from "@/lib/api/client"
import type {
  AddCommentDto,
  ConfirmAvatarDto,
  ConfirmHeaderDto,
  CreateShowcaseItemDto,
  RequestAccountDeletionDto,
  UpdateLinksDto,
  UpdateProfileDto,
  UpdateShowcaseItemDto,
  UserLinkItemDto,
} from "@/lib/api/types"

// ------------------------------------------------------------------
// Tipe response — UNVERIFIED (spec auth tidak menyertakan response schema)
// ------------------------------------------------------------------

/** Profil user — subset field yang dipakai UI. */
export type UserProfile = {
  id: string
  fullName?: string
  username?: string | null
  email?: string
  emailVerified?: boolean
  phoneNumber?: string | null
  avatarUrl?: string | null
  /**
   * Foto sampul/header profil (POST /v1/users/me/header/direct + /confirm).
   * Backend menyediakan endpoint-nya; tanpa field ini UI tidak pernah bisa
   * menampilkannya. UNVERIFIED di spec GET (spec tidak menyertakan schema
   * response), nama alias dibaca di normalizeUserProfile.
   */
  headerUrl?: string | null
  bio?: string | null
  accountType?: "PERSONAL" | "BUSINESS"
  /** Kontak publik (UpdateProfileDto.contactEmail/contactPhone) — UNVERIFIED di spec GET */
  contactEmail?: string | null
  contactPhone?: string | null
  showContactEmail?: boolean
  showContactPhone?: boolean
}

export type AvatarResult = {
  avatarUrl: string
  avatarKey?: string
}

// ------------------------------------------------------------------
// Profil
// ------------------------------------------------------------------

/**
 * Alias field profil yang mungkin dikirim backend (spec GET tanpa schema).
 * Satu tempat supaya layar tidak menulis `?? (x as any).snake_case` sendiri.
 */
function firstString(
  source: Record<string, unknown>,
  keys: readonly string[],
): string | null | undefined {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === "string" && value.trim()) return value
  }
  return undefined
}

export function normalizeUserProfile(raw: UserProfile): UserProfile {
  const record = raw as unknown as Record<string, unknown>
  return {
    ...raw,
    avatarUrl: firstString(record, ["avatarUrl", "avatar_url", "avatar"]),
    headerUrl: firstString(record, ["headerUrl", "header_url", "headerImage", "coverUrl"]),
  }
}

/** GET /v1/users/me — profil lengkap user yang sedang login. */
export function getMe(signal?: AbortSignal) {
  return http
    .get<UserProfile>("/v1/users/me", { auth: "required", retry: 1, signal })
    .then(normalizeUserProfile)
}

/**
 * PUT /v1/users/me — update profil (partial).
 * Hanya field yang diisi yang dikirim; sisanya tidak berubah.
 */
export function updateProfile(dto: UpdateProfileDto) {
  return http.put<UserProfile, UpdateProfileDto>("/v1/users/me", dto, { auth: "required" })
}

/** GET /v1/users/availability?username=... — cek username sebelum menyimpan profil. */
export function checkUsernameAvailability(username: string, signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/users/availability", {
      query: { username },
      auth: "required",
      retry: 0,
      signal,
    })
    .then((raw) => {
      if (typeof raw === "boolean") return raw
      const record = asRecord(raw)
      return Boolean(
        record?.available ?? record?.isAvailable ?? record?.is_available ?? record?.availableUsername,
      )
    })
}

// ------------------------------------------------------------------
// Avatar
// ------------------------------------------------------------------

/**
 * POST /v1/users/me/avatar/direct — upload avatar langsung lewat server
 * (multipart/form-data). Bypasses presigned URL — lebih simple untuk mobile.
 *
 * File harus sudah divalidasi klien (JPG/PNG, maks 10MB, idealnya < 2MB
 * setelah kompresi — §9.19). Server yang menangani kompresi jika perlu.
 */
export async function uploadAvatarDirect(formData: FormData) {
  const result = await http.post<AvatarResult>("/v1/users/me/avatar/direct", undefined, {
    auth: "required",
    formData,
  })
  return {
    ...result,
    avatarUrl: result.avatarUrl ?? (result as any).avatar_url,
    avatarKey: result.avatarKey ?? (result as any).avatar_key,
  }
}

/** POST /v1/users/me/avatar/confirm — konfirmasi avatar yang sudah di-upload. */
export async function confirmAvatar(dto: ConfirmAvatarDto) {
  const result = await http.post<AvatarResult, ConfirmAvatarDto>("/v1/users/me/avatar/confirm", dto, {
    auth: "required",
  })
  return {
    ...result,
    avatarUrl: result.avatarUrl ?? (result as any).avatar_url,
    avatarKey: result.avatarKey ?? (result as any).avatar_key,
  }
}

/** DELETE /v1/users/me/avatar — hapus avatar (kembali ke inisial default). */
export function deleteAvatar() {
  return http.delete<void>("/v1/users/me/avatar", { auth: "required", responseType: "void" })
}

// ------------------------------------------------------------------
// Foto sampul (header image) profil
// ------------------------------------------------------------------

/** Hasil unggah foto sampul — bentuk mengikuti AvatarResult (UNVERIFIED). */
export type HeaderImageResult = {
  headerUrl: string
  headerKey?: string
}

function normalizeHeaderResult(result: HeaderImageResult): HeaderImageResult {
  const record = result as unknown as Record<string, unknown>
  return {
    ...result,
    headerUrl:
      result.headerUrl ??
      firstString(record, ["header_url", "headerImage", "coverUrl", "url"]) ??
      "",
    headerKey: result.headerKey ?? firstString(record, ["header_key", "fileKey"]) ?? undefined,
  }
}

/**
 * POST /v1/users/me/header/direct — unggah foto sampul langsung (multipart
 * `file`). Pola sama dengan avatar: direct upload memangkas round-trip
 * presigned URL (PUT /v1/users/me/header) yang tidak dibutuhkan mobile.
 */
export async function uploadHeaderDirect(formData: FormData) {
  const result = await http.post<HeaderImageResult>("/v1/users/me/header/direct", undefined, {
    auth: "required",
    formData,
  })
  return normalizeHeaderResult(result)
}

/** POST /v1/users/me/header/confirm — konfirmasi sampul yang sudah diunggah. */
export async function confirmHeader(dto: ConfirmHeaderDto) {
  const result = await http.post<HeaderImageResult, ConfirmHeaderDto>(
    "/v1/users/me/header/confirm",
    dto,
    { auth: "required" },
  )
  return normalizeHeaderResult(result)
}

/** DELETE /v1/users/me/header — hapus foto sampul profil. */
export function deleteHeader() {
  return http.delete<void>("/v1/users/me/header", { auth: "required", responseType: "void" })
}

/** POST /v1/users/me/delete-request — minta penghapusan akun. */
export function requestAccountDeletion(dto: RequestAccountDeletionDto) {
  return http.post<{ message: string }, RequestAccountDeletionDto>(
    "/v1/users/me/delete-request",
    dto,
    {
      auth: "required",
    },
  )
}

/** GET /v1/users/me/links — tautan sosial profil. */
export function getLinks(signal?: AbortSignal) {
  return http
    .get<UserLinkItemDto[]>("/v1/users/me/links", { auth: "required", signal })
    .then((raw) => readList<UserLinkItemDto>(raw, ["links"]))
}

/** PUT /v1/users/me/links — ganti semua tautan sosial. */
export function updateLinks(dto: UpdateLinksDto) {
  return http.put<UserLinkItemDto[], UpdateLinksDto>("/v1/users/me/links", dto, {
    auth: "required",
  })
}

/** GET /v1/users/{username} — profil publik user. */
export function getUserByUsername(username: string, signal?: AbortSignal) {
  return http
    .get<unknown>(`/v1/users/${seg(username)}`, { auth: "required", signal })
    .then((raw) => {
      const profile = readEntity<Record<string, unknown>>(raw, "user")
      const stats = asRecord(profile.stats)
      return {
        ...profile,
        // `pickUserId` memindai `id`/`userId`/`_id` dan satu tingkat sarang
        // (`user`/`data`/`profile`). Versi lama hanya membaca `profile.id ??
        // profile.userId`, dan spec tidak mendokumentasikan bentuk respons
        // endpoint ini — bila backend menaruh id di tempat lain, `profile.id`
        // menjadi `""` dan Blokir/Laporkan gagal diam-diam atau dengan "user
        // tidak tersedia". Layar juga mengirim username sebagai cadangan.
        id: pickUserId(profile) || pickUserId(raw),
        verified: profile.verified ?? profile.isKycVerified,
        trustScore: profile.trustScore ?? stats?.trustScore,
        rating: profile.rating ?? stats?.rating,
        createdAt: profile.createdAt ?? profile.created_at,
        avatarUrl: firstString(profile, ["avatarUrl", "avatar_url", "avatar"]),
        headerUrl: firstString(profile, ["headerUrl", "header_url", "headerImage", "coverUrl"]),
      } as PublicUserProfile
    })
}

export type PublicUserProfile = {
  id: string
  username?: string | null
  fullName?: string
  bio?: string | null
  avatarUrl?: string | null
  /** Foto sampul profil publik — alias dibaca di getUserByUsername. */
  headerUrl?: string | null
  verified?: boolean
  trustScore?: number
  rating?: number
  createdAt?: string
  showcase?: unknown
  ratings?: unknown
}

// ------------------------------------------------------------------
// Analitik & skor kepercayaan
// ------------------------------------------------------------------

export type UserStats = {
  transactions: number
  completedOrders?: number
  followers?: number
  following?: number
  rating?: number
  reviews?: number
}

export type AnalyticsPoint = { label: string; value: number }
export type UserAnalytics = {
  summary?: Record<string, number>
  volumeByPeriod?: Array<{ label: string; value: number }>
  revenueByPeriod?: Array<{ label: string; value: number }>
  avgOrderValue?: number
  completionRate?: number
}

export function getMyStats(signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/users/me/stats", { auth: "required", retry: 1, signal })
    .then((raw) => {
      const stats = raw as Record<string, unknown>
      return {
        transactions: stats.totalOrders ?? stats.transactions ?? 0,
        completedOrders: stats.completedOrders,
        followers: stats.followersCount ?? stats.followers,
        following: stats.followingCount ?? stats.following,
        rating: stats.avgRating ?? stats.rating,
        reviews: stats.ratingCount ?? stats.reviews,
      } as UserStats
    })
}

/**
 * Periode analitik — spec menandai `period` REQUIRED (string) tanpa enum.
 * Nilai di bawah adalah asumsi terdokumentasi (pola umum "7d/30d/90d/1y");
 * satu tempat untuk dikoreksi bila backend memakai kosakata lain.
 */
export type AnalyticsPeriod = "7d" | "30d" | "90d" | "1y"
export const ANALYTICS_PERIODS: ReadonlyArray<{ value: AnalyticsPeriod; label: string }> = [
  { value: "7d", label: "7 hari" },
  { value: "30d", label: "30 hari" },
  { value: "90d", label: "90 hari" },
  { value: "1y", label: "1 tahun" },
]

/** GET /v1/users/me/analytics?period= — dashboard analitik per periode. */
export function getMyAnalytics(period: AnalyticsPeriod = "30d", signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/users/me/analytics", {
      query: { period },
      auth: "required",
      signal,
      retry: 1,
    })
    .then((raw) => {
      const data = raw as Record<string, any>
      const overview = data.overview ?? {}
      const current = data.period ?? {}
      const ordersByDay = data.charts?.ordersByDay ?? {}
      return {
        summary: {
          revenue: current.volume ?? overview.totalVolume,
          totalOrders: current.ordersTotal ?? overview.totalOrders,
        },
        volumeByPeriod: Object.entries(ordersByDay).map(([label, value]) => ({
          label,
          value: Number(value) || 0,
        })),
        avgOrderValue:
          current.ordersTotal > 0 ? (current.volume ?? 0) / current.ordersTotal : undefined,
        completionRate:
          current.ordersTotal > 0 ? (current.ordersCompleted ?? 0) / current.ordersTotal : undefined,
      } as UserAnalytics
    })
}

export function getMyTrustScore(signal?: AbortSignal) {
  return http.get<{
    score: number
    tier?: string
    factors?: Array<{ key: string; label: string; value: number; max: number }>
    updatedAt?: string
  }>("/v1/users/me/trust-score", { auth: "required", retry: 1, signal })
}

export function getMyDashboard(signal?: AbortSignal) {
  return http.get<Record<string, unknown>>("/v1/users/me/dashboard", { auth: "required", retry: 1, signal })
}

// ------------------------------------------------------------------
// Discover & favorites
// ------------------------------------------------------------------

export type DiscoveredUser = {
  id: string
  username: string
  fullName?: string
  avatarUrl?: string | null
  verified?: boolean
  transactionCount?: number
  rating?: number
  following?: boolean
}

/**
 * `GET /v1/users/discover`.
 *
 * Query yang dikirim dibatasi pada yang DIDOKUMENTASIKAN spec (`page`, `limit`).
 * Opsi `sort` yang dulu ada di signature tidak pernah dikirim layar mana pun dan
 * TIDAK ada di spec — bila backend memakai whitelist query, ia dibuang diam-diam
 * sehingga urutan hasil tidak pernah berubah meski UI menawarkannya. Dihapus
 * sampai backend mendeklarasikannya (lihat audit API-08).
 */
export function discoverUsers(
  options: { page?: number; limit?: number } = {},
  signal?: AbortSignal,
) {
  const query = { page: 1, limit: 20, ...options }
  return http
    .get<unknown>("/v1/users/discover", { query, auth: "required", retry: 1, signal })
    .then((raw) => {
      const page = readPage<Record<string, unknown>>(raw, query, ["users"])
      return {
        ...page,
        data: page.data.map((user) => ({
          ...user,
          id: String(user.id ?? user.userId ?? ""),
          verified: user.verified ?? user.isKycVerified,
          rating: user.rating ?? user.avgRating,
          transactionCount: user.transactionCount ?? user.totalOrdersCompleted,
        })) as DiscoveredUser[],
      }
    })
}

/** GET /v1/users/saved — profil yang disimpan user (pagination wajib). */
/** Entri GET /v1/users/saved — profil yang disimpan (terbaru dulu). */
export type SavedProfileEntry = {
  id: string
  savedUserId: string
  createdAt: string
  user: {
    id: string
    userId: string
    fullName: string | null
    username: string
    avatarUrl?: string | null
    isKahadePlus?: boolean
    kycStatus?: string
    stats?: { averageRating: number; totalOrdersCompleted: number }
  }
}

/**
 * GET /v1/users/saved — daftar profil tersimpan.
 * Meta (total/page/limit) dikirim di TOP-LEVEL respons (bukan di `meta`),
 * jadi tidak memakai readPage umum.
 */
export function getSavedProfiles(
  options: { page?: number; limit?: number } = {},
  signal?: AbortSignal,
) {
  const query = { page: 1, limit: 20, ...options }
  return http
    .get<unknown>("/v1/users/saved", { query, auth: "required", retry: 1, signal })
    .then((raw) => {
      const record = (raw ?? {}) as Record<string, unknown>
      return {
        data: Array.isArray(record.saved) ? (record.saved as SavedProfileEntry[]) : [],
        total: typeof record.total === "number" ? record.total : 0,
        page: typeof record.page === "number" ? record.page : 1,
        limit: typeof record.limit === "number" ? record.limit : 20,
      }
    })
}

export function getFavorites(signal?: AbortSignal) {
  return http
    .get<
      Array<{ id: string; username: string; fullName?: string; avatarUrl?: string | null }>
    >("/v1/users/favorites", { auth: "required", retry: 1, signal })
    .then((raw) =>
      readList<{ id: string; username: string; fullName?: string; avatarUrl?: string | null }>(
        raw,
        ["users", "favorites"],
      ),
    )
}

export type UserConnection = {
  id: string
  username: string
  fullName?: string
  avatarUrl?: string | null
}
export function getFollowers(
  username: string,
  options: { page?: number; limit?: number; search?: string } = {},
  signal?: AbortSignal,
) {
  const query = { page: 1, limit: 20, search: "", ...options }
  return http
    .get<unknown>(`/v1/users/${seg(username)}/followers`, {
      query,
      auth: "required",
      retry: 1,
      signal,
    })
    .then((raw) => readPage<UserConnection>(raw, query, ["followers", "users"]))
}
export function getFollowing(
  username: string,
  options: { page?: number; limit?: number } = {},
  signal?: AbortSignal,
) {
  const query = { page: 1, limit: 20, ...options }
  return http
    .get<unknown>(`/v1/users/${seg(username)}/following`, {
      query,
      auth: "required",
      retry: 1,
      signal,
    })
    .then((raw) => readPage<UserConnection>(raw, query, ["following", "users"]))
}

export function followUser(username: string) {
  return http.post<void>(`/v1/users/${seg(username)}/follow`, undefined, { auth: "required" })
}

export function unfollowUser(username: string) {
  return http.delete<void>(`/v1/users/${seg(username)}/follow`, {
    auth: "required",
    responseType: "void",
  })
}

export type FavoriteState = { favorited: boolean; count?: number }

/**
 * Normalizer respons favorit.
 *
 * `app/user/[username].tsx` menulis `setFavorite(Boolean(r?.favorited))`. Bila
 * backend menjawab `{ isFavorite: true }`, `favorited` menjadi `undefined` dan
 * ikon favorit selalu tampil kosong — pengguna mengira simpanannya hilang, lalu
 * menekan lagi dan malah membatalkan. Fallback memakai nilai yang DIHARAPKAN
 * dari aksinya (`addFavorite` → true) supaya keadaan UI tidak berbalik sendiri.
 */
function normalizeFavorite(raw: unknown, expected: boolean): FavoriteState {
  const { value, record } = readVerdict(
    raw,
    ["favorited", "isFavorite", "is_favorite", "favorite", "saved"],
    expected,
  )
  const count = record.count ?? record.total
  return {
    favorited: value,
    count: typeof count === "number" && Number.isFinite(count) ? count : undefined,
  }
}

export function isFavorite(username: string, signal?: AbortSignal) {
  return http
    .get<unknown>(`/v1/users/${seg(username)}/favorite`, { auth: "required", signal })
    .then((raw) => normalizeFavorite(raw, false))
}

export function addFavorite(username: string) {
  return http
    .post<unknown>(`/v1/users/${seg(username)}/favorite`, undefined, { auth: "required" })
    .then((raw) => normalizeFavorite(raw, true))
}

export function removeFavorite(username: string) {
  return http
    .delete<unknown>(`/v1/users/${seg(username)}/favorite`, { auth: "required" })
    .then((raw) => normalizeFavorite(raw, false))
}

// ------------------------------------------------------------------
// Showcase
// ------------------------------------------------------------------

/**
 * Item showcase — field mengikuti CreateShowcaseItemDto/UpdateShowcaseItemDto
 * (title, description, imageUrl, priceMin/Max, isActive, sortOrder);
 * `caption`/`fileKey` dipertahankan untuk kompatibilitas respons lama
 * (UNVERIFIED — GET tanpa schema).
 */
export type ShowcaseItem = {
  id: string
  title?: string
  description?: string | null
  caption?: string
  imageUrl?: string
  fileKey?: string
  /** Galeri terurut; gambar pertama = cover. */
  images?: ShowcaseImage[]
  /** URL cover — sama dengan images[0].imageUrl (imageUrl alias deprecated). */
  coverImageUrl?: string | null
  priceMin?: number | null
  priceMax?: number | null
  isActive?: boolean
  createdAt: string
  sortOrder?: number
}

/** Satu gambar item showcase (GET /v1/users/me/showcase → items[].images). */
export type ShowcaseImage = {
  id: string
  imageUrl: string
  sortOrder: number
}

/** Respons upload gambar showcase — spec 201 tanpa schema (UNVERIFIED). */
export type ShowcaseUploadResult = Partial<ShowcaseItem> & { url?: string; key?: string }

export function getMyShowcase(signal?: AbortSignal) {
  return http
    .get<ShowcaseItem[]>("/v1/users/me/showcase", { auth: "required", retry: 1, signal })
    .then((raw) => readList<ShowcaseItem>(raw, ["showcase", "items"]))
}

/**
 * POST /v1/users/me/showcase/upload — unggah gambar. Backend bisa langsung
 * membuat item (mengembalikan ShowcaseItem) ATAU hanya mengembalikan
 * `imageUrl`/`url` untuk dipakai di createShowcase (UNVERIFIED).
 */
export async function uploadShowcase(formData: FormData) {
  const result = await http.post<ShowcaseUploadResult>("/v1/users/me/showcase/upload", undefined, {
    formData,
    auth: "required",
  })
  return {
    ...result,
    imageUrl: result.imageUrl ?? (result as any).image_url,
    fileKey: result.fileKey ?? (result as any).file_key,
    priceMin: result.priceMin ?? (result as any).price_min,
    priceMax: result.priceMax ?? (result as any).price_max,
    isActive: result.isActive ?? (result as any).is_active,
    sortOrder: result.sortOrder ?? (result as any).sort_order,
  }
}

export async function createShowcase(dto: CreateShowcaseItemDto) {
  const result = await http.post<ShowcaseItem, CreateShowcaseItemDto>("/v1/users/me/showcase", dto, {
    auth: "required",
  })
  return {
    ...result,
    imageUrl: result.imageUrl ?? (result as any).image_url,
    fileKey: result.fileKey ?? (result as any).file_key,
    priceMin: result.priceMin ?? (result as any).price_min,
    priceMax: result.priceMax ?? (result as any).price_max,
    isActive: result.isActive ?? (result as any).is_active,
    sortOrder: result.sortOrder ?? (result as any).sort_order,
    createdAt: result.createdAt ?? (result as any).created_at,
  }
}

export async function updateShowcase(id: string, dto: UpdateShowcaseItemDto) {
  const result = await http.put<ShowcaseItem, UpdateShowcaseItemDto>(`/v1/users/me/showcase/${seg(id)}`, dto, {
    auth: "required",
  })
  return {
    ...result,
    imageUrl: result.imageUrl ?? (result as any).image_url,
    fileKey: result.fileKey ?? (result as any).file_key,
    priceMin: result.priceMin ?? (result as any).price_min,
    priceMax: result.priceMax ?? (result as any).price_max,
    isActive: result.isActive ?? (result as any).is_active,
    sortOrder: result.sortOrder ?? (result as any).sort_order,
    createdAt: result.createdAt ?? (result as any).created_at,
  }
}

export function deleteShowcase(id: string) {
  return http.delete<void>(`/v1/users/me/showcase/${seg(id)}`, {
    auth: "required",
    responseType: "void",
  })
}

export function getPublicShowcase(username: string, signal?: AbortSignal) {
  return http
    .get<unknown>(`/v1/users/${seg(username)}/showcase`, {
      auth: "required",
      signal,
    })
    .then((raw) => readList<ShowcaseItem>(raw, ["items", "showcase"]))
}

// ------------------------------------------------------------------
// Questions & answers
// ------------------------------------------------------------------

export type QuestionItem = {
  id: string
  question: string
  answer?: string | null
  answeredAt?: string | null
  createdAt: string
  asker?: { id: string; username: string; fullName?: string; avatarUrl?: string | null }
  /** Pemilik profil yang ditanya (ada pada daftar "asked") — UNVERIFIED */
  target?: { id: string; username: string; fullName?: string; avatarUrl?: string | null }
  commentCount?: number
  /** Total dukungan (GET list sudah menyertakan; +isUpvotedByViewer). */
  upvoteCount?: number
  isUpvotedByViewer?: boolean
  /** Moderasi pemilik profil (hanya dikirim bila viewer pemilik). */
  isHidden?: boolean
  hiddenReason?: HiddenReason | null
}

/** Query `GET /v1/users/me/questions` — spec: `type`, `page`, `limit` REQUIRED. */
export type MyQuestionsType = "received" | "asked"

/** Daftar bisa array polos ATAU {data, meta} (spec tanpa schema; UNVERIFIED). */
export type QuestionListResponse =
  | QuestionItem[]
  | {
      data: QuestionItem[]
      meta?: { page: number; limit: number; total: number; totalPages: number }
    }

export function readQuestionList(body: QuestionListResponse | null | undefined): {
  items: QuestionItem[]
  totalPages?: number
} {
  if (!body) return { items: [] }
  if (Array.isArray(body)) return { items: body }
  const record = body as unknown as {
    data?: QuestionItem[]
    meta?: { totalPages?: number; total_pages?: number }
    questions?: QuestionItem[]
    totalPages?: number
    total_pages?: number
  }
  return {
    items: record.data ?? record.questions ?? [],
    totalPages:
      record.meta?.totalPages ??
      (record.meta as any)?.total_pages ??
      record.totalPages ??
      record.total_pages,
  }
}

/** Nilai enum `type` tidak didokumentasikan — asumsi "received" | "asked" (dari summary endpoint). */
export function getMyQuestions(
  query: { type: MyQuestionsType; page: number; limit: number },
  signal?: AbortSignal,
) {
  return http.get<QuestionListResponse>("/v1/users/me/questions", {
    query,
    auth: "required",
    retry: 1,
    signal,
  })
}

export function addQuestion(username: string, question: string) {
  return http.post<QuestionItem, { question: string }>(
    `/v1/users/${seg(username)}/questions`,
    { question },
    {
      auth: "required",
    },
  )
}

/** Spec: `page` & `limit` REQUIRED. */
export function getPublicQuestions(
  username: string,
  query: { page: number; limit: number },
  signal?: AbortSignal,
) {
  return http.get<QuestionListResponse>(`/v1/users/${seg(username)}/questions`, {
    query,
    auth: "required",
    signal,
  })
}

export function answerQuestion(questionId: string, answer: string) {
  return http.put<QuestionItem, { answer: string }>(
    `/v1/users/questions/${seg(questionId)}/answer`,
    { answer },
    {
      auth: "required",
    },
  )
}

export function deleteQuestion(questionId: string) {
  return http.delete<void>(`/v1/users/questions/${seg(questionId)}`, {
    auth: "required",
    responseType: "void",
  })
}

export type QuestionComment = {
  id: string
  content: string
  authorId?: string
  authorName?: string
  authorUsername?: string
  authorAvatarUrl?: string | null
  /** Komentar dari pemilik profil */
  isOwner?: boolean
  parentId?: string | null
  createdAt: string
  reply?: boolean
  deleted?: boolean
}

export type QuestionCommentListResponse =
  | QuestionComment[]
  | {
      data: QuestionComment[]
      meta?: { page: number; limit: number; total: number; totalPages: number }
    }

export function readQuestionComments(body: QuestionCommentListResponse | null | undefined): {
  items: QuestionComment[]
  totalPages?: number
} {
  if (!body) return { items: [] }
  if (Array.isArray(body)) return { items: body }
  return { items: body.data ?? [], totalPages: body.meta?.totalPages ?? (body.meta as any)?.total_pages }
}

/** Spec: `page` & `limit` REQUIRED. */
export function getQuestionComments(
  questionId: string,
  query: { page: number; limit: number },
  signal?: AbortSignal,
) {
  return http.get<QuestionCommentListResponse>(`/v1/users/questions/${seg(questionId)}/comments`, {
    query,
    auth: "required",
    retry: 1,
    signal,
  })
}

/** AddCommentDto { content 1–1000, parentId? } */
export function addQuestionComment(questionId: string, dto: AddCommentDto) {
  return http.post<QuestionComment, AddCommentDto>(
    `/v1/users/questions/${seg(questionId)}/comments`,
    dto,
    {
      auth: "required",
    },
  )
}

export function deleteQuestionComment(commentId: string) {
  return http.delete<void>(`/v1/users/comments/${seg(commentId)}`, {
    auth: "required",
    responseType: "void",
  })
}

// ==================================================================
// Sosial profil & moderasi (sesi P1, 2026-09-15)
// Kontrak diverifikasi terhadap users.controller / profile-qa.service /
// verification-badge.service / showcase.service di backend.
// ==================================================================

/** Badge verifikasi aktif (GET /v1/users/{username}/badges). */
export type VerificationBadge = {
  /** Identifier stabil — branch di UI wajib pakai ini, bukan label. */
  type: string
  labelKey: string
  label: string
  shortLabel: string
  description: string
  /** Nama ikon Phosphor (string) — frontend yang memilih aset. */
  icon: string
  earnedAt?: string | null
  /** 1 = prioritas tampil tertinggi (sudah terurut dari server). */
  priority: number
}

/**
 * Simpan / cek profil (POST|DELETE|GET /v1/users/{username}/saved).
 * "Saved profile" terpisah dari "favorite": saved = daftar pribadi untuk
 * dilihat lagi (app/saved), favorite = dukungan publik dengan counter.
 */
export function checkSavedProfile(username: string, signal?: AbortSignal) {
  return http
    .get<{ isSaved: boolean }>(`/v1/users/${seg(username)}/saved`, {
      auth: "required",
      retry: 1,
      signal,
    })
    .then((r) => (r && typeof r.isSaved === "boolean" ? r.isSaved : false))
}

export function saveProfile(username: string) {
  return http.post<{ message: string }>(`/v1/users/${seg(username)}/saved`, undefined, {
    auth: "required",
  })
}

export function unsaveProfile(username: string) {
  return http.delete<{ message: string }>(`/v1/users/${seg(username)}/saved`, {
    auth: "required",
  })
}

/** Item hasil GET /v1/users/search (q wajib ≥ 2 karakter, throttle 10 rpm). */
export type UserSearchResult = {
  userId: string
  username: string | null
  fullName: string
  avatarUrl?: string | null
  membershipRank?: string | null
}

export function searchUsers(
  q: string,
  options: { page?: number; limit?: number } = {},
  signal?: AbortSignal,
) {
  const query = { q, page: options.page ?? 1, limit: options.limit ?? 10 }
  return http
    .get<unknown>("/v1/users/search", { query, auth: "required", retry: 1, signal })
    .then((raw) => {
      const record = (raw ?? {}) as Record<string, unknown>
      return {
        users: Array.isArray(record.users)
          ? (record.users as UserSearchResult[])
          : [],
        total: typeof record.total === "number" ? record.total : 0,
        page: typeof record.page === "number" ? record.page : 1,
        limit: typeof record.limit === "number" ? record.limit : 10,
      }
    })
}

/**
 * Badge verifikasi publik (GET /v1/users/{username}/badges) — terurut
 * prioritas: KYC > Business > Kahade+ > Trusted Admin > Email/Phone.
 * Revoke terpancar dalam detik (cache TTL pendek di backend).
 */
export function getVerificationBadges(username: string, signal?: AbortSignal) {
  return http
    .get<{ username: string; badges: VerificationBadge[] }>(
      `/v1/users/${seg(username)}/badges`,
      { retry: 1, signal },
    )
    .then((r) => (Array.isArray(r?.badges) ? r.badges : []))
}

/** DELETE /v1/users/me/devices/{deviceId} — lupakan perangkat (bukan cabut sesi). */
export function removeDevice(deviceId: string) {
  return http.delete<{ message: string }>(`/v1/users/me/devices/${seg(deviceId)}`, {
    auth: "required",
  })
}

// ── Kelola gambar showcase (multi-image per item) ─────────────────────────

/**
 * POST /v1/users/me/showcase/{id}/images — lampirkan object key hasil
 * presigned upload (purpose SHOWCASE_IMAGE) yang sudah di-confirm.
 */
export function attachShowcaseImages(itemId: string, fileKeys: string[]) {
  return http.post<object, { fileKeys: string[] }>(
    `/v1/users/me/showcase/${seg(itemId)}/images`,
    { fileKeys },
    { auth: "required" },
  )
}

/**
 * PUT /v1/users/me/showcase/{id}/images/order — kirim SELURUH id gambar
 * dalam urutan baru (disimpan ulang sebagai sortOrder 0..n-1).
 */
export function reorderShowcaseImages(itemId: string, imageIds: string[]) {
  return http.put<object, { imageIds: string[] }>(
    `/v1/users/me/showcase/${seg(itemId)}/images/order`,
    { imageIds },
    { auth: "required" },
  )
}

/** DELETE /v1/users/me/showcase/images/{imageId} — hapus satu gambar. */
export function deleteShowcaseImage(imageId: string) {
  return http.delete<{ message: string }>(`/v1/users/me/showcase/images/${seg(imageId)}`, {
    auth: "required",
  })
}

// ── Q&A: upvote & moderasi ─────────────────────────────────────────────────

export type QuestionUpvoteResult = { upvoted: boolean; upvoteCount: number }

/** POST /v1/users/questions/{questionId}/upvote (satu upvote per user). */
export function upvoteQuestion(questionId: string) {
  return http.post<QuestionUpvoteResult>(`/v1/users/questions/${seg(questionId)}/upvote`, undefined, {
    auth: "required",
  })
}

/** DELETE /v1/users/questions/{questionId}/upvote. */
export function removeQuestionUpvote(questionId: string) {
  return http.delete<QuestionUpvoteResult>(`/v1/users/questions/${seg(questionId)}/upvote`, {
    auth: "required",
  })
}

export type HiddenReason = "SPAM" | "INAPPROPRIATE" | "HARASSMENT" | "OTHER"

/** Respons hide/unhide: baris ter-update { id, isHidden, hiddenReason, hiddenAt }. */
export type ContentHiddenState = {
  id: string
  isHidden: boolean
  hiddenReason?: HiddenReason | null
  hiddenAt?: string | null
}

/** POST /v1/users/questions/{questionId}/hide — hanya pemilik profil. */
export function hideQuestion(questionId: string, reason: HiddenReason) {
  return http.post<ContentHiddenState, { reason: HiddenReason }>(
    `/v1/users/questions/${seg(questionId)}/hide`,
    { reason },
    { auth: "required" },
  )
}

/** POST /v1/users/questions/{questionId}/unhide — hanya pemilik profil. */
export function unhideQuestion(questionId: string) {
  return http.post<ContentHiddenState>(`/v1/users/questions/${seg(questionId)}/unhide`, undefined, {
    auth: "required",
  })
}

/** POST /v1/users/comments/{commentId}/hide — komentar Q&A, pemilik profil. */
export function hideQAComment(commentId: string, reason: HiddenReason) {
  return http.post<ContentHiddenState, { reason: HiddenReason }>(
    `/v1/users/comments/${seg(commentId)}/hide`,
    { reason },
    { auth: "required" },
  )
}

/** POST /v1/users/comments/{commentId}/unhide — komentar Q&A. */
export function unhideQAComment(commentId: string) {
  return http.post<ContentHiddenState>(`/v1/users/comments/${seg(commentId)}/unhide`, undefined, {
    auth: "required",
  })
}

// ── Laporkan pengguna ──────────────────────────────────────────────────────

export type ReportUserCategory =
  | "FRAUD"
  | "FAKE_IDENTITY"
  | "INAPPROPRIATE_CONTENT"
  | "TNC_VIOLATION"
  | "MONEY_LAUNDERING"
  | "SPAM"
  | "OTHER"

export type ReportUserDto = {
  category: ReportUserCategory
  /** Wajib 20–500 karakter (validasi backend). */
  description: string
  /** URL bukti dari storage platform (maks 10). */
  evidenceUrls?: string[]
}

/** POST /v1/users/{userId}/report — throttle 5/hari per user. */
export function reportUser(userId: string, dto: ReportUserDto) {
  return http.post<{ message: string }, ReportUserDto>(`/v1/users/${seg(userId)}/report`, dto, {
    auth: "required",
  })
}
