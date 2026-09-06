import { asRecord, readEntity, readPage, readList } from "@/lib/api/response"
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
  CreateShowcaseDto,
  RequestAccountDeletionDto,
  UpdateLinksDto,
  UpdateProfileDto,
  UpdateShowcaseDto,
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

/** GET /v1/users/me — profil lengkap user yang sedang login. */
export function getMe(signal?: AbortSignal) {
  return http.get<UserProfile>("/v1/users/me", { auth: "required", signal })
}

/**
 * PUT /v1/users/me — update profil (partial).
 * Hanya field yang diisi yang dikirim; sisanya tidak berubah.
 */
export function updateProfile(dto: UpdateProfileDto) {
  return http.put<UserProfile, UpdateProfileDto>("/v1/users/me", dto, { auth: "required" })
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
export function getLinks() {
  return http
    .get<UserLinkItemDto[]>("/v1/users/me/links", { auth: "required", retry: 1 })
    .then((raw) => readList<UserLinkItemDto>(raw, ["links"]))
}

/** PUT /v1/users/me/links — ganti semua tautan sosial. */
export function updateLinks(dto: UpdateLinksDto) {
  return http.put<UserLinkItemDto[], UpdateLinksDto>("/v1/users/me/links", dto, {
    auth: "required",
  })
}

/** GET /v1/users/{username} — profil publik user. */
export function getUserByUsername(username: string) {
  return http
    .get<unknown>(`/v1/users/${seg(username)}`, { auth: "required", retry: 1 })
    .then((raw) => {
      const profile = readEntity<Record<string, unknown>>(raw, "user")
      const stats = asRecord(profile.stats)
      return {
        ...profile,
        id: profile.id ?? profile.userId ?? "",
        verified: profile.verified ?? profile.isKycVerified,
        trustScore: profile.trustScore ?? stats?.trustScore,
        rating: profile.rating ?? stats?.rating,
        createdAt: profile.createdAt ?? profile.created_at,
      } as PublicUserProfile
    })
}

export type PublicUserProfile = {
  id: string
  username?: string | null
  fullName?: string
  bio?: string | null
  avatarUrl?: string | null
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

export function getMyStats() {
  return http.get<UserStats>("/v1/users/me/stats", { auth: "required", retry: 1 })
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
export function getMyAnalytics(period: AnalyticsPeriod = "30d") {
  return http.get<UserAnalytics>("/v1/users/me/analytics", {
    query: { period },
    auth: "required",
    retry: 1,
  })
}

export function getMyTrustScore() {
  return http.get<{
    score: number
    tier?: string
    factors?: Array<{ key: string; label: string; value: number; max: number }>
    updatedAt?: string
  }>("/v1/users/me/trust-score", { auth: "required", retry: 1 })
}

export function getMyDashboard() {
  return http.get<Record<string, unknown>>("/v1/users/me/dashboard", { auth: "required", retry: 1 })
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

export function discoverUsers(
  options: { page?: number; limit?: number; sort?: string } = {},
  signal?: AbortSignal,
) {
  const query = { page: 1, limit: 20, ...options }
  return http
    .get<unknown>("/v1/users/discover", { query, auth: "required", retry: 1, signal })
    .then((raw) => readPage<DiscoveredUser>(raw, query, ["users"]))
}

export function getFavorites() {
  return http
    .get<
      Array<{ id: string; username: string; fullName?: string; avatarUrl?: string | null }>
    >("/v1/users/favorites", { auth: "required", retry: 1 })
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

export function isFavorite(username: string) {
  return http.get<{ favorited: boolean; count?: number }>(`/v1/users/${seg(username)}/favorite`, {
    auth: "required",
    retry: 1,
  })
}

export function addFavorite(username: string) {
  return http.post<{ favorited: boolean; count?: number }>(
    `/v1/users/${seg(username)}/favorite`,
    undefined,
    {
      auth: "required",
    },
  )
}

export function removeFavorite(username: string) {
  return http.delete<{ favorited: boolean; count?: number }>(
    `/v1/users/${seg(username)}/favorite`,
    {
      auth: "required",
    },
  )
}

// ------------------------------------------------------------------
// Showcase
// ------------------------------------------------------------------

/**
 * Item showcase — field mengikuti CreateShowcaseDto/UpdateShowcaseDto
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
  priceMin?: number | null
  priceMax?: number | null
  isActive?: boolean
  createdAt: string
  sortOrder?: number
}

/** Respons upload gambar showcase — spec 201 tanpa schema (UNVERIFIED). */
export type ShowcaseUploadResult = Partial<ShowcaseItem> & { url?: string; key?: string }

export function getMyShowcase() {
  return http
    .get<ShowcaseItem[]>("/v1/users/me/showcase", { auth: "required", retry: 1 })
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

export async function createShowcase(dto: CreateShowcaseDto) {
  const result = await http.post<ShowcaseItem, CreateShowcaseDto>("/v1/users/me/showcase", dto, {
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

export async function updateShowcase(id: string, dto: UpdateShowcaseDto) {
  const result = await http.put<ShowcaseItem, UpdateShowcaseDto>(`/v1/users/me/showcase/${seg(id)}`, dto, {
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

export function getPublicShowcase(username: string) {
  return http
    .get<unknown>(`/v1/users/${seg(username)}/showcase`, {
      auth: "required",
      retry: 1,
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
export function getMyQuestions(query: { type: MyQuestionsType; page: number; limit: number }) {
  return http.get<QuestionListResponse>("/v1/users/me/questions", {
    query,
    auth: "required",
    retry: 1,
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
export function getPublicQuestions(username: string, query: { page: number; limit: number }) {
  return http.get<QuestionListResponse>(`/v1/users/${seg(username)}/questions`, {
    query,
    auth: "required",
    retry: 1,
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
export function getQuestionComments(questionId: string, query: { page: number; limit: number }) {
  return http.get<QuestionCommentListResponse>(`/v1/users/questions/${seg(questionId)}/comments`, {
    query,
    auth: "required",
    retry: 1,
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
