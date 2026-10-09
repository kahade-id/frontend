/**
 * Kahade — Story (ala WhatsApp Status): foto/teks yang hilang otomatis 24 jam.
 *
 * SEMUA akses API story lewat berkas ini. Komponen/layar TIDAK boleh memanggil
 * `http` untuk endpoint `/v1/stories*` secara langsung.
 *
 * ── Aturan visibilitas (keputusan produk, dijaga server) ──
 *   Story HANYA terlihat oleh viewer yang MENYIMPAN profil pembuat
 *   (`POST /v1/users/{username}/saved`, lihat lib/api/users.ts). Follow
 *   TIDAK memberi akses story — follow hanya untuk feed etalase. Klien tidak
 *   menghitung ulang aturan ini: yang ditampilkan adalah apa yang dikembalikan
 *   server. Privasi per-story (`StoryAudience`) mempersempit kumpulan penyimpan
 *   itu: semua penyimpan, atau semua penyimpan KECUALI daftar tertentu.
 *
 * ── Kontrak ──
 *   Bentuk tipe di bawah adalah KONTRAK. Mengubah nama field/endpoint = breaking
 *   change lintas tim; tambahkan field baru sebagai opsional saja. Daftar
 *   endpoint lengkap (method, path, request/response, status) ada di
 *   docs/integrasi_backend.md.
 *
 * ── Mode transport ──
 *   `STORY_API_MODE` = "mock" (default) memakai penyimpanan in-memory yang
 *   berperilaku seperti server (latensi, validasi, 404/409). `"live"` (set
 *   `EXPO_PUBLIC_STORY_API=live`) memanggil endpoint sungguhan. Mock HARUS
 *   dimatikan sebelum rilis — lihat catatan di docs/integrasi_backend.md.
 *
 * ── Retry ──
 *   GET boleh retry (idempoten). Semua mutasi TIDAK pernah di-retry otomatis
 *   (lihat scripts/check-retry.mjs).
 */
import { http, seg } from "@/lib/api/client"
import { ApiError, codeFromStatus } from "@/lib/api/errors"
import { uploadFileWithProgress, type UploadFileOptions } from "@/lib/api/upload"
import { asRecord, invalidResponse } from "@/lib/api/response"
import { serverNow } from "@/lib/server-time"

// ------------------------------------------------------------------
// Konstanta kontrak
// ------------------------------------------------------------------

/** Umur story (server menetapkan `expiresAt` = `createdAt` + 24 jam). */
export const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000
/** Batas teks story bertipe `text`. */
export const STORY_TEXT_MAX = 200
/** Batas produk yang bisa di-tag pada satu story. */
export const STORY_PRODUCT_TAGS_MAX = 5
/** Batas judul highlight. */
export const STORY_HIGHLIGHT_TITLE_MAX = 24
/** Batas story per highlight. */
export const STORY_HIGHLIGHT_ITEMS_MAX = 30
/** Batas harga pada stiker harga (rupiah, bilangan bulat). */
export const STORY_PRICE_MAX = 999_999_999
/** Emoji reaksi cepat yang diterima server. */
export const STORY_REACTIONS = ["❤️", "😂", "😮", "😢", "👏", "🔥"] as const
export type StoryReaction = (typeof STORY_REACTIONS)[number]

export const STORY_API_MODE: "mock" | "live" =
  process.env.EXPO_PUBLIC_STORY_API === "live" ? "live" : "mock"

// ------------------------------------------------------------------
// Tipe (kontrak)
// ------------------------------------------------------------------

export type StoryKind = "image" | "text"

/**
 * Privasi per-story. `all_savers` = semua orang yang menyimpan profil pembuat.
 * `savers_except` = semua penyimpan kecuali `excludedUserIds`.
 */
export type StoryAudience =
  | { mode: "all_savers" }
  | { mode: "savers_except"; excludedUserIds: string[] }

export type StoryAuthor = {
  userId: string
  username: string
  fullName: string | null
  avatarUrl: string | null
}

/** Tag produk etalase pada story. `x`/`y` = posisi ternormalisasi 0..1. */
export type StoryProductTag = {
  productId: string
  title: string
  coverUrl: string | null
  priceAmount: number | null
  x: number
  y: number
}

export type StoryPriceSticker = { amount: number; currency: "IDR" }

/** Tombol "Tanya Stok". `productId` null = tanya umum (tanpa produk spesifik). */
export type StoryAskStock = { productId: string | null }

export type Story = {
  id: string
  author: StoryAuthor
  kind: StoryKind
  /** URL foto (kind = image). */
  mediaUrl: string | null
  /** Teks (kind = text, atau caption opsional). */
  text: string | null
  /** Warna latar hex `#RRGGBB` (kind = text). */
  backgroundColor: string | null
  productTags: StoryProductTag[]
  priceSticker: StoryPriceSticker | null
  askStock: StoryAskStock | null
  createdAt: string
  expiresAt: string
  /** Viewer ini sudah melihat story (klien menimpanya secara optimistis). */
  viewed: boolean
  /** Hanya terisi untuk pemilik; 0 untuk viewer lain. */
  viewCount: number
  /** Reaksi viewer ini; null bila belum. */
  myReaction: StoryReaction | null
  /** Hanya terisi pada GET /v1/stories/me (pemilik). */
  audience: StoryAudience | null
}

/** Satu baris tray: penulis + ringkasan story aktifnya. */
export type StoryTrayEntry = {
  author: StoryAuthor
  storyCount: number
  latestAt: string
  hasUnseen: boolean
  /** Viewer telah membisukan story kontak ini (tidak tampil di depan tray). */
  muted: boolean
}

export type StoryTray = {
  /** Story sendiri; null bila tidak ada story aktif. */
  own: StoryTrayEntry | null
  others: StoryTrayEntry[]
}

export type StoryUserStories = {
  author: StoryAuthor
  stories: Story[]
}

export type StoryViewer = {
  user: StoryAuthor
  viewedAt: string
  reaction: StoryReaction | null
}

export type StoryViewersPage = {
  viewers: StoryViewer[]
  total: number
  page: number
  limit: number
}

/** Highlight = arsip permanen. `stories` berisi SALINAN media (tidak hilang saat expired). */
export type StoryHighlight = {
  id: string
  title: string
  coverUrl: string | null
  storyCount: number
  stories: Story[]
  createdAt: string
  updatedAt: string
}

export type StoryMediaUpload = { mediaId: string; url: string }

export type CreateStoryInput = {
  kind: StoryKind
  /** Wajib untuk kind = image (hasil POST /v1/stories/media). */
  mediaId?: string
  text?: string
  backgroundColor?: string
  productTags: Array<{ productId: string; x: number; y: number }>
  priceSticker?: { amount: number } | null
  askStock?: { productId?: string | null } | null
  audience: StoryAudience
}

export type StoryReplyResult = { roomId: string }

export type StoryAudienceCandidate = StoryAuthor

/** Galat dengan bentuk sama seperti galat HTTP sungguhan (dipakai mock & validasi klien). */
function storyError(status: number, backendCode: string, message: string): ApiError {
  return new ApiError({
    message,
    status,
    code: codeFromStatus(status, false),
    backendCode,
  })
}

// ------------------------------------------------------------------
// Parser respons (defensif — payload salah bentuk = invalidResponse)
// ------------------------------------------------------------------

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback
}

function parseAuthor(raw: unknown): StoryAuthor {
  const r = asRecord(raw)
  const userId = str(r?.userId) ?? str(r?.id)
  const username = str(r?.username)
  if (!r || !userId || !username) throw invalidResponse("story-author")
  return {
    userId,
    username,
    fullName: str(r.fullName),
    avatarUrl: str(r.avatarUrl),
  }
}

function parseAudience(raw: unknown): StoryAudience | null {
  const r = asRecord(raw)
  if (!r) return null
  if (r.mode === "all_savers") return { mode: "all_savers" }
  if (r.mode === "savers_except") {
    const ids = Array.isArray(r.excludedUserIds)
      ? r.excludedUserIds.filter((v): v is string => typeof v === "string")
      : []
    return { mode: "savers_except", excludedUserIds: ids }
  }
  return null
}

function parseReaction(v: unknown): StoryReaction | null {
  return typeof v === "string" && (STORY_REACTIONS as readonly string[]).includes(v)
    ? (v as StoryReaction)
    : null
}

function parseProductTags(raw: unknown): StoryProductTag[] {
  if (!Array.isArray(raw)) return []
  const out: StoryProductTag[] = []
  for (const item of raw) {
    const r = asRecord(item)
    const productId = str(r?.productId)
    if (!r || !productId) continue
    out.push({
      productId,
      title: str(r.title) ?? "",
      coverUrl: str(r.coverUrl),
      priceAmount: typeof r.priceAmount === "number" ? r.priceAmount : null,
      x: Math.min(1, Math.max(0, num(r.x, 0.5))),
      y: Math.min(1, Math.max(0, num(r.y, 0.5))),
    })
  }
  return out
}

export function parseStory(raw: unknown): Story {
  const r = asRecord(raw)
  const id = str(r?.id)
  if (!r || !id) throw invalidResponse("story")
  const kind: StoryKind = r.kind === "text" ? "text" : "image"
  const sticker = asRecord(r.priceSticker)
  const ask = asRecord(r.askStock)
  return {
    id,
    author: parseAuthor(r.author),
    kind,
    mediaUrl: str(r.mediaUrl),
    text: str(r.text),
    backgroundColor: str(r.backgroundColor),
    productTags: parseProductTags(r.productTags),
    priceSticker:
      sticker && typeof sticker.amount === "number"
        ? { amount: sticker.amount, currency: "IDR" }
        : null,
    askStock: ask ? { productId: str(ask.productId) } : null,
    createdAt: str(r.createdAt) ?? "",
    expiresAt: str(r.expiresAt) ?? "",
    viewed: r.viewed === true,
    viewCount: num(r.viewCount, 0),
    myReaction: parseReaction(r.myReaction),
    audience: parseAudience(r.audience),
  }
}

function parseTrayEntry(raw: unknown): StoryTrayEntry {
  const r = asRecord(raw)
  if (!r) throw invalidResponse("story-tray")
  return {
    author: parseAuthor(r.author),
    storyCount: num(r.storyCount, 0),
    latestAt: str(r.latestAt) ?? "",
    hasUnseen: r.hasUnseen === true,
    muted: r.muted === true,
  }
}

function parseHighlight(raw: unknown): StoryHighlight {
  const r = asRecord(raw)
  const id = str(r?.id)
  const title = str(r?.title)
  if (!r || !id || !title) throw invalidResponse("story-highlight")
  const stories = Array.isArray(r.stories) ? r.stories.map(parseStory) : []
  return {
    id,
    title,
    coverUrl: str(r.coverUrl),
    storyCount: num(r.storyCount, stories.length),
    stories,
    createdAt: str(r.createdAt) ?? "",
    updatedAt: str(r.updatedAt) ?? "",
  }
}

/** Story yang sudah kedaluwarsa menurut jam server — jangan pernah ditampilkan. */
export function isStoryActive(story: Pick<Story, "expiresAt">, now = serverNow()): boolean {
  const exp = Date.parse(story.expiresAt)
  return Number.isFinite(exp) && exp > now
}

// ------------------------------------------------------------------
// Mock transport (in-memory, berperilaku seperti server)
// ------------------------------------------------------------------

const MOCK_LATENCY_MS = 220

type MockDb = {
  me: StoryAuthor
  /** Penulis yang menyimpan profil saya (kumpulan penonton yang sah). */
  savers: StoryAuthor[]
  /** Story semua penulis, termasuk milik saya. */
  stories: Story[]
  viewedIds: Set<string>
  mutedUserIds: Set<string>
  highlights: StoryHighlight[]
  /** Untuk pengujian rollback: panggilan berikutnya yang namanya ada di sini gagal. */
  failNext: Set<string>
}

function mockAuthor(id: string, username: string, fullName: string): StoryAuthor {
  return { userId: id, username, fullName, avatarUrl: null }
}

function mockStory(
  id: string,
  author: StoryAuthor,
  hoursAgo: number,
  partial: Partial<Story> = {},
): Story {
  const created = serverNow() - hoursAgo * 3_600_000
  return {
    id,
    author,
    kind: "text",
    mediaUrl: null,
    text: "Stok baru datang hari ini",
    backgroundColor: "#1F2937",
    productTags: [],
    priceSticker: null,
    askStock: null,
    createdAt: new Date(created).toISOString(),
    expiresAt: new Date(created + STORY_LIFETIME_MS).toISOString(),
    viewed: false,
    viewCount: 0,
    myReaction: null,
    audience: null,
    ...partial,
  }
}

function seedMock(): MockDb {
  const me = mockAuthor("usr-me", "saya", "Saya")
  const ana = mockAuthor("usr-ana", "ana.store", "Ana Store")
  const budi = mockAuthor("usr-budi", "budi.jastip", "Budi Jastip")
  const sari = mockAuthor("usr-sari", "sari.craft", "Sari Craft")
  return {
    me,
    savers: [ana, budi, sari],
    stories: [
      mockStory("st-ana-1", ana, 2, {
        kind: "text",
        text: "Restock sepatu lari! Ukuran lengkap",
        backgroundColor: "#0F766E",
        priceSticker: { amount: 350_000, currency: "IDR" },
        askStock: { productId: "prd-ana-1" },
        productTags: [
          { productId: "prd-ana-1", title: "Sepatu Lari Ringan", coverUrl: null, priceAmount: 350_000, x: 0.5, y: 0.7 },
        ],
      }),
      mockStory("st-ana-2", ana, 1, { kind: "text", text: "Diskon weekend", backgroundColor: "#7C2D12" }),
      mockStory("st-budi-1", budi, 5, { kind: "text", text: "Jastip Korea buka lagi", backgroundColor: "#4C1D95" }),
      mockStory("st-sari-1", sari, 20, { kind: "text", text: "Pesanan custom sudah open", backgroundColor: "#831843" }),
    ],
    viewedIds: new Set(["st-sari-1"]),
    mutedUserIds: new Set(),
    highlights: [],
    failNext: new Set(),
  }
}

let mockDb: MockDb | null = null
function db(): MockDb {
  if (!mockDb) mockDb = seedMock()
  return mockDb
}

/** Hanya untuk test: reset penyimpanan mock ke kondisi awal. */
export function __resetStoryMock(): void {
  mockDb = null
}

/** Hanya untuk test: paksa panggilan mock berikutnya dengan nama `op` gagal (rollback). */
export function __failNextStoryCall(op: string): void {
  db().failNext.add(op)
}

function delay<T>(value: () => T, op: string): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const d = db()
      if (d.failNext.has(op)) {
        d.failNext.delete(op)
        reject(
          new ApiError({
            message: "Gagal terhubung ke server.",
            code: "NETWORK",
            backendCode: "NETWORK_ERROR",
          }),
        )
        return
      }
      try {
        resolve(value())
      } catch (err) {
        reject(err)
      }
    }, MOCK_LATENCY_MS)
  })
}

function liveStories(): Story[] {
  const now = serverNow()
  return db().stories.filter((s) => Date.parse(s.expiresAt) > now)
}

function viewerFor(story: Story): Story {
  const d = db()
  return {
    ...story,
    viewed: d.viewedIds.has(story.id),
    viewCount: story.author.userId === d.me.userId ? 3 : 0,
    audience: story.author.userId === d.me.userId ? { mode: "all_savers" } : null,
  }
}

function notFound(code: string): ApiError {
  return storyError(404, code, "Story tidak ditemukan.")
}

// ------------------------------------------------------------------
// API publik
// ------------------------------------------------------------------

/** Tray di atas daftar chat (story yang boleh dilihat viewer + story sendiri). */
export async function getStoryTray(signal?: AbortSignal): Promise<StoryTray> {
  if (STORY_API_MODE === "mock") {
    return delay(() => {
      const d = db()
      const active = liveStories()
      const byAuthor = new Map<string, Story[]>()
      for (const s of active) {
        const list = byAuthor.get(s.author.userId) ?? []
        list.push(s)
        byAuthor.set(s.author.userId, list)
      }
      const entries: StoryTrayEntry[] = []
      let own: StoryTrayEntry | null = null
      for (const [authorId, list] of byAuthor) {
        const sorted = [...list].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        const entry: StoryTrayEntry = {
          author: sorted[0].author,
          storyCount: sorted.length,
          latestAt: sorted[0].createdAt,
          hasUnseen: sorted.some((s) => !d.viewedIds.has(s.id)),
          muted: d.mutedUserIds.has(authorId),
        }
        if (authorId === d.me.userId) own = entry
        else if (d.savers.some((s) => s.userId === authorId)) entries.push(entry)
      }
      entries.sort((a, b) => {
        if (a.muted !== b.muted) return a.muted ? 1 : -1
        if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1
        return Date.parse(b.latestAt) - Date.parse(a.latestAt)
      })
      return { own, others: entries }
    }, "getStoryTray")
  }
  const raw = await http.get<unknown>("/v1/stories/tray", { auth: "required", retry: 1, signal })
  const r = asRecord(raw)
  if (!r) throw invalidResponse("story-tray")
  return {
    own: r.own ? parseTrayEntry(r.own) : null,
    others: Array.isArray(r.others) ? r.others.map(parseTrayEntry) : [],
  }
}

/** Story aktif satu penulis (urut terlama → terbaru, seperti pemutaran). */
export async function getUserStories(userId: string, signal?: AbortSignal): Promise<StoryUserStories> {
  if (STORY_API_MODE === "mock") {
    return delay(() => {
      const d = db()
      const list = liveStories()
        .filter((s) => s.author.userId === userId)
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      const author = list[0]?.author ?? d.savers.find((s) => s.userId === userId)
      if (!author) throw notFound("STORY_NOT_FOUND")
      if (userId !== d.me.userId && !d.savers.some((s) => s.userId === userId))
        throw storyError(403, "STORY_NOT_VISIBLE", "Story tidak tersedia.")
      return { author, stories: list.map(viewerFor) }
    }, "getUserStories")
  }
  const raw = await http.get<unknown>(`/v1/stories/users/${seg(userId)}`, {
    auth: "required",
    retry: 1,
    signal,
  })
  const r = asRecord(raw)
  if (!r) throw invalidResponse("story-user")
  return {
    author: parseAuthor(r.author),
    stories: Array.isArray(r.stories) ? r.stories.map(parseStory) : [],
  }
}

/** Story aktif milik sendiri (dengan audiens & jumlah viewer). */
export async function getMyStories(signal?: AbortSignal): Promise<Story[]> {
  if (STORY_API_MODE === "mock") {
    return delay(
      () => liveStories().filter((s) => s.author.userId === db().me.userId).map(viewerFor),
      "getMyStories",
    )
  }
  const raw = await http.get<unknown>("/v1/stories/me", { auth: "required", retry: 1, signal })
  const r = asRecord(raw)
  return Array.isArray(r?.stories) ? r.stories.map(parseStory) : []
}

/**
 * Unggah foto story. Hasil `mediaId` dipakai di `createStory`.
 *
 * Audit 2026-10-09 (B4): JOIN transport XHR terpusat
 * (`uploadFileWithProgress`) — dulu `http.post` (fetch) tanpa `timeoutMs`,
 * jadi deadline 20 dtk global membunuh foto story 10 MB di koneksi lambat
 * (10 MB @ 100 KB/s ≈ 100 dtk transfer — mustahil lolos 20 dtk). Kini
 * timeout ADAPTIF dari `fileBytes` (basis 60 dtk + jatah transfer, cap 5
 * menit), progress byte jujur, bisa dibatalkan, dan cek offline-terverifikasi
 * sebelum kirim.
 */
export async function uploadStoryMedia(
  file: FormData,
  opts: Pick<UploadFileOptions, "fileBytes" | "onProgress" | "signal" | "timeoutMs"> = {},
): Promise<StoryMediaUpload> {
  if (STORY_API_MODE === "mock") {
    return delay(
      () => ({ mediaId: `med-${Date.now().toString(36)}`, url: "" }),
      "uploadStoryMedia",
    )
  }
  const raw = await uploadFileWithProgress(file, {
    path: "/v1/stories/media",
    fileBytes: opts.fileBytes,
    onProgress: opts.onProgress,
    signal: opts.signal,
    timeoutMs: opts.timeoutMs,
  })
  const r = asRecord(raw)
  const mediaId = str(r?.mediaId)
  const url = str(r?.url)
  if (!mediaId || !url) throw invalidResponse("story-media")
  return { mediaId, url }
}

function validateCreate(input: CreateStoryInput): void {
  if (input.kind === "image" && !input.mediaId)
    throw storyError(400, "STORY_MEDIA_REQUIRED", "Pilih foto untuk story.")
  if (input.kind === "text") {
    const text = (input.text ?? "").trim()
    if (!text) throw storyError(400, "STORY_TEXT_REQUIRED", "Tulis teks untuk story.")
    if (text.length > STORY_TEXT_MAX)
      throw storyError(400, "STORY_TEXT_TOO_LONG", "Teks story terlalu panjang.")
  }
  if (input.productTags.length > STORY_PRODUCT_TAGS_MAX)
    throw storyError(400, "STORY_TAGS_LIMIT", "Terlalu banyak produk ditandai.")
}

/** Buat story. Server menetapkan `expiresAt` = createdAt + 24 jam. */
export async function createStory(input: CreateStoryInput): Promise<Story> {
  validateCreate(input)
  if (STORY_API_MODE === "mock") {
    return delay(() => {
      const d = db()
      const created = serverNow()
      const story: Story = {
        id: `st-${created.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        author: d.me,
        kind: input.kind,
        mediaUrl: input.kind === "image" ? `mock://story/${input.mediaId}` : null,
        text: input.text?.trim() || null,
        backgroundColor: input.kind === "text" ? (input.backgroundColor ?? "#1F2937") : null,
        productTags: input.productTags.map((t) => ({
          productId: t.productId,
          title: "",
          coverUrl: null,
          priceAmount: null,
          x: t.x,
          y: t.y,
        })),
        priceSticker: input.priceSticker
          ? { amount: input.priceSticker.amount, currency: "IDR" }
          : null,
        askStock: input.askStock ? { productId: input.askStock.productId ?? null } : null,
        createdAt: new Date(created).toISOString(),
        expiresAt: new Date(created + STORY_LIFETIME_MS).toISOString(),
        viewed: false,
        viewCount: 0,
        myReaction: null,
        audience: input.audience,
      }
      d.stories.push(story)
      return viewerFor(story)
    }, "createStory")
  }
  const raw = await http.post<unknown, CreateStoryInput>("/v1/stories", input, {
    auth: "required",
  })
  return parseStory(raw)
}

/** Hapus story sendiri. Idempoten dari sisi klien (404 = sudah tidak ada). */
export async function deleteStory(storyId: string): Promise<void> {
  if (STORY_API_MODE === "mock") {
    return delay(() => {
      const d = db()
      const idx = d.stories.findIndex((s) => s.id === storyId && s.author.userId === d.me.userId)
      if (idx < 0) throw notFound("STORY_NOT_FOUND")
      d.stories.splice(idx, 1)
    }, "deleteStory")
  }
  await http.delete<unknown>(`/v1/stories/${seg(storyId)}`, { auth: "required" })
}

/** Tandai story dilihat. Idempoten: memanggil ulang tidak mengubah apa pun. */
export async function markStoryViewed(storyId: string): Promise<void> {
  if (STORY_API_MODE === "mock") {
    return delay(() => {
      db().viewedIds.add(storyId)
    }, "markStoryViewed")
  }
  await http.post<unknown, undefined>(`/v1/stories/${seg(storyId)}/views`, undefined, {
    auth: "required",
  })
}

/** Daftar viewer (hanya pemilik). Urut terbaru dulu. */
export async function getStoryViewers(
  storyId: string,
  opts: { page?: number; limit?: number } = {},
  signal?: AbortSignal,
): Promise<StoryViewersPage> {
  const page = opts.page ?? 1
  const limit = opts.limit ?? 30
  if (STORY_API_MODE === "mock") {
    return delay(() => {
      const d = db()
      const story = d.stories.find((s) => s.id === storyId && s.author.userId === d.me.userId)
      if (!story) throw notFound("STORY_NOT_FOUND")
      const all: StoryViewer[] = d.savers.slice(0, 3).map((user, i) => ({
        user,
        viewedAt: new Date(Date.parse(story.createdAt) + (i + 1) * 60_000).toISOString(),
        reaction: i === 0 ? "🔥" : null,
      }))
      const start = (page - 1) * limit
      return { viewers: all.slice(start, start + limit), total: all.length, page, limit }
    }, "getStoryViewers")
  }
  const raw = await http.get<unknown>(`/v1/stories/${seg(storyId)}/viewers`, {
    auth: "required",
    retry: 1,
    query: { page, limit },
    signal,
  })
  const r = asRecord(raw) ?? {}
  const viewers = Array.isArray(r.viewers)
    ? r.viewers.map((v) => {
        const row = asRecord(v) ?? {}
        return {
          user: parseAuthor(row.user),
          viewedAt: str(row.viewedAt) ?? "",
          reaction: parseReaction(row.reaction),
        }
      })
    : []
  return {
    viewers,
    total: num(r.total, viewers.length),
    page: num(r.page, page),
    limit: num(r.limit, limit),
  }
}

/** Reaksi cepat pada story. `null` = hapus reaksi. */
export async function setStoryReaction(storyId: string, emoji: StoryReaction | null): Promise<void> {
  if (emoji !== null && !(STORY_REACTIONS as readonly string[]).includes(emoji))
    throw storyError(400, "STORY_REACTION_INVALID", "Reaksi tidak didukung.")
  if (STORY_API_MODE === "mock") {
    return delay(() => {
      const d = db()
      const story = d.stories.find((s) => s.id === storyId)
      if (!story) throw notFound("STORY_NOT_FOUND")
      // Mock: reaksi disimpan di story global (cukup untuk demo).
      story.myReaction = emoji
    }, "setStoryReaction")
  }
  if (emoji === null) {
    await http.delete<unknown>(`/v1/stories/${seg(storyId)}/reaction`, { auth: "required" })
    return
  }
  await http.put<unknown, { emoji: StoryReaction }>(
    `/v1/stories/${seg(storyId)}/reaction`,
    { emoji },
    { auth: "required" },
  )
}

/**
 * Balas story → pesan masuk ke ruang chat dengan pemilik. Server membuat DM
 * bila belum ada (dengan aturan privasi DM yang sama seperti chat biasa).
 */
export async function replyToStory(storyId: string, text: string): Promise<StoryReplyResult> {
  const trimmed = text.trim()
  if (!trimmed) throw storyError(400, "STORY_REPLY_EMPTY", "Balasan tidak boleh kosong.")
  if (trimmed.length > STORY_TEXT_MAX)
    throw storyError(400, "STORY_REPLY_TOO_LONG", "Balasan terlalu panjang.")
  if (STORY_API_MODE === "mock") {
    return delay(() => {
      const story = db().stories.find((s) => s.id === storyId)
      if (!story) throw notFound("STORY_NOT_FOUND")
      return { roomId: `room-${story.author.userId}` }
    }, "replyToStory")
  }
  const raw = await http.post<unknown, { text: string }>(
    `/v1/stories/${seg(storyId)}/replies`,
    { text: trimmed },
    { auth: "required" },
  )
  const r = asRecord(raw)
  const roomId = str(r?.roomId)
  if (!roomId) throw invalidResponse("story-reply")
  return { roomId }
}

/** Daftar story yang sedang dibisukan oleh viewer. */
export async function getMutedStoryAuthors(signal?: AbortSignal): Promise<StoryAuthor[]> {
  if (STORY_API_MODE === "mock") {
    return delay(() => {
      const d = db()
      return d.savers.filter((s) => d.mutedUserIds.has(s.userId))
    }, "getMutedStoryAuthors")
  }
  const raw = await http.get<unknown>("/v1/stories/mutes", { auth: "required", retry: 1, signal })
  const r = asRecord(raw)
  return Array.isArray(r?.mutes) ? r.mutes.map(parseAuthor) : []
}

/** Bisukan story kontak tertentu (tidak menghapus, hanya menurunkan prioritas & menyembunyikan dari depan tray). */
export async function muteStoryAuthor(userId: string): Promise<void> {
  if (STORY_API_MODE === "mock") {
    return delay(() => {
      db().mutedUserIds.add(userId)
    }, "muteStoryAuthor")
  }
  await http.put<unknown, undefined>(`/v1/stories/mutes/${seg(userId)}`, undefined, {
    auth: "required",
  })
}

/** Batalkan bisu. */
export async function unmuteStoryAuthor(userId: string): Promise<void> {
  if (STORY_API_MODE === "mock") {
    return delay(() => {
      db().mutedUserIds.delete(userId)
    }, "unmuteStoryAuthor")
  }
  await http.delete<unknown>(`/v1/stories/mutes/${seg(userId)}`, { auth: "required" })
}

/** Kandidat untuk "kecuali beberapa orang": penyimpan profil sendiri. */
export async function getStoryAudienceCandidates(
  signal?: AbortSignal,
): Promise<StoryAudienceCandidate[]> {
  if (STORY_API_MODE === "mock") {
    return delay(() => [...db().savers], "getStoryAudienceCandidates")
  }
  const raw = await http.get<unknown>("/v1/stories/audience/candidates", {
    auth: "required",
    retry: 1,
    signal,
  })
  const r = asRecord(raw)
  return Array.isArray(r?.users) ? r.users.map(parseAuthor) : []
}

/** Highlight publik seorang user (arsip permanen di profil). */
export async function getStoryHighlights(userId: string, signal?: AbortSignal): Promise<StoryHighlight[]> {
  if (STORY_API_MODE === "mock") {
    return delay(() => db().highlights.filter((h) => h.stories.length > 0), "getStoryHighlights")
  }
  const raw = await http.get<unknown>(`/v1/stories/highlights/users/${seg(userId)}`, {
    auth: "required",
    retry: 1,
    signal,
  })
  const r = asRecord(raw)
  return Array.isArray(r?.highlights) ? r.highlights.map(parseHighlight) : []
}

export type CreateStoryHighlightInput = { title: string; storyIds: string[] }
export type UpdateStoryHighlightInput = { title?: string; storyIds?: string[] }

function validateHighlightTitle(title: string): string {
  const t = title.trim()
  if (!t) throw storyError(400, "STORY_HIGHLIGHT_TITLE_REQUIRED", "Judul sorotan wajib diisi.")
  if (t.length > STORY_HIGHLIGHT_TITLE_MAX)
    throw storyError(400, "STORY_HIGHLIGHT_TITLE_TOO_LONG", "Judul sorotan terlalu panjang.")
  return t
}

/**
 * Buat highlight dari story (salinan media disimpan server — tidak ikut hilang
 * setelah 24 jam). `storyIds` harus story milik sendiri yang masih aktif.
 */
export async function createStoryHighlight(input: CreateStoryHighlightInput): Promise<StoryHighlight> {
  const title = validateHighlightTitle(input.title)
  if (input.storyIds.length === 0 || input.storyIds.length > STORY_HIGHLIGHT_ITEMS_MAX)
    throw storyError(400, "STORY_HIGHLIGHT_ITEMS_INVALID", "Pilih 1–30 story.")
  if (STORY_API_MODE === "mock") {
    return delay(() => {
      const d = db()
      const stories = input.storyIds.map((id) => {
        const s = d.stories.find((x) => x.id === id)
        if (!s) throw notFound("STORY_NOT_FOUND")
        return viewerFor(s)
      })
      const now = new Date(serverNow()).toISOString()
      const hl: StoryHighlight = {
        id: `hl-${Math.random().toString(36).slice(2, 8)}`,
        title,
        coverUrl: null,
        storyCount: stories.length,
        stories,
        createdAt: now,
        updatedAt: now,
      }
      d.highlights.push(hl)
      return hl
    }, "createStoryHighlight")
  }
  const raw = await http.post<unknown, { title: string; storyIds: string[] }>(
    "/v1/stories/highlights",
    { title, storyIds: input.storyIds },
    { auth: "required" },
  )
  return parseHighlight(raw)
}

/** Ubah judul dan/atau daftar story highlight (`storyIds` = daftar LENGKAP yang baru). */
export async function updateStoryHighlight(
  highlightId: string,
  input: UpdateStoryHighlightInput,
): Promise<StoryHighlight> {
  const body: UpdateStoryHighlightInput = {}
  if (input.title !== undefined) body.title = validateHighlightTitle(input.title)
  if (input.storyIds !== undefined) {
    if (input.storyIds.length === 0 || input.storyIds.length > STORY_HIGHLIGHT_ITEMS_MAX)
      throw storyError(400, "STORY_HIGHLIGHT_ITEMS_INVALID", "Pilih 1–30 story.")
    body.storyIds = input.storyIds
  }
  if (STORY_API_MODE === "mock") {
    return delay(() => {
      const d = db()
      const hl = d.highlights.find((h) => h.id === highlightId)
      if (!hl) throw notFound("STORY_HIGHLIGHT_NOT_FOUND")
      if (body.title !== undefined) hl.title = body.title
      if (body.storyIds) {
        hl.stories = body.storyIds.map((id) => {
          const existing = hl.stories.find((s) => s.id === id)
          if (existing) return existing
          const live = d.stories.find((s) => s.id === id)
          if (!live) throw notFound("STORY_NOT_FOUND")
          return viewerFor(live)
        })
        hl.storyCount = hl.stories.length
      }
      hl.updatedAt = new Date(serverNow()).toISOString()
      return { ...hl, stories: [...hl.stories] }
    }, "updateStoryHighlight")
  }
  const raw = await http.patch<unknown, UpdateStoryHighlightInput>(
    `/v1/stories/highlights/${seg(highlightId)}`,
    body,
    { auth: "required" },
  )
  return parseHighlight(raw)
}

/** Hapus highlight (story di dalamnya tidak terpengaruh). */
export async function deleteStoryHighlight(highlightId: string): Promise<void> {
  if (STORY_API_MODE === "mock") {
    return delay(() => {
      const d = db()
      const idx = d.highlights.findIndex((h) => h.id === highlightId)
      if (idx < 0) throw notFound("STORY_HIGHLIGHT_NOT_FOUND")
      d.highlights.splice(idx, 1)
    }, "deleteStoryHighlight")
  }
  await http.delete<unknown>(`/v1/stories/highlights/${seg(highlightId)}`, { auth: "required" })
}

/** Hitung sisa umur story dalam ms (0 bila sudah habis). Jam server. */
export function storyRemainingMs(story: Pick<Story, "expiresAt">, now = serverNow()): number {
  const exp = Date.parse(story.expiresAt)
  return Number.isFinite(exp) ? Math.max(0, exp - now) : 0
}
