/**
 * Kahade — util bersama item Etalase sosial (normalisasi, cover, share).
 *
 * Dipakai tiga layar (feed, tab Etalase profil, galeri) supaya pemetaan
 * bentuk respons → bentuk tampilan tidak ditulis ulang dengan hasil berbeda
 * (audit E-01/E-02: galeri publik membaca key lama dan mengosongkan sel;
 * audit C-07/J-04: judul fallback bahasa Inggris yang inkonsisten).
 */
import {
  getShowcaseSharePayload,
  type ShowcaseAuthor,
  type ShowcaseComment,
  type ShowcaseCommentWithReplies,
  type ShowcaseMedia,
  type ShowcaseSharePayload,
  type ShowcaseSocialItem,
  type ShowcaseSocialItem as SocialItem,
} from "@/lib/api/showcase"
import type { ShowcaseImage, ShowcaseItem } from "@/lib/api/users"
import { showcaseUrl } from "@/lib/deeplinks"
import { copyToClipboard } from "@/lib/clipboard"
import { translate } from "@/lib/i18n/translate"
import { resolveMediaUrl } from "@/lib/media"
import { showcasePriceLabel } from "@/lib/showcase-labels"
import { shareContent, type ShareOutcome } from "@/lib/share"

/**
 * Terapkan delta hitungan komentar (ledger `showcase-social-prefs`) ke sebuah
 * daftar item. Mengembalikan ARRAY YANG SAMA bila tidak ada item yang cocok —
 * supaya pemanggil tidak memicu render ulang yang tidak perlu
 * (F-01/F-03 audit 2026-09-24: hitungan komentar tidak lagi lewat refetch).
 */
export function applyShowcaseCommentCountDelta(
  items: ShowcaseSocialItem[],
  events: readonly { id: string; delta: number }[],
): ShowcaseSocialItem[] {
  if (events.length === 0 || items.length === 0) return items
  const deltas = new Map<string, number>()
  for (const event of events) deltas.set(event.id, (deltas.get(event.id) ?? 0) + event.delta)
  let changed = false
  const next = items.map((entry) => {
    const delta = deltas.get(entry.id)
    if (!delta) return entry
    changed = true
    return { ...entry, commentCount: Math.max(0, entry.commentCount + delta) }
  })
  return changed ? next : items
}

/**
 * Clamp hitungan sosial: negatif/NaN/Infinity/bukan-angka → 0.
 * Selaras dengan `count()` di `parseShowcaseItem` (lib/api/showcase.ts) —
 * satu semantik agar jalur profil tidak lagi menampilkan "-3 Suka"
 * (SH-F-010, audit 2026-09-27).
 */
export function clampShowcaseCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}

/** Nilai like dari SERVER untuk satu item (snapshot pembanding override). */
export type ServerLikeState = { isLiked: boolean; likeCount: number }

/**
 * SH-F-001 (audit 2026-09-27): kapan override like optimistis boleh dibuang
 * saat objek `item` berganti identitas?
 *
 * `mergeById` (load-more) dan ledger komentar (`applyShowcaseCommentCountDelta`)
 * membuat objek BARU untuk data yang SAMA — override yang sudah dikonfirmasi
 * server tidak boleh hilang karenanya (hati padam sendiri).
 *
 *  - mutasi like masih berjalan → JANGAN (hasil optimistis belum pasti)
 *  - belum ada snapshot server → JANGAN (tak bisa membuktikan data berubah)
 *  - nilai server BERUBAH vs snapshot → YA (data definitif baru tiba)
 *  - nilai server sama → TIDAK (identitas baru, data sama)
 */
export function shouldClearLikeOverride(
  prevServer: ServerLikeState | undefined,
  nextServer: ServerLikeState,
  mutationPending: boolean,
): boolean {
  if (mutationPending) return false
  if (!prevServer) return false
  return prevServer.isLiked !== nextServer.isLiked || prevServer.likeCount !== nextServer.likeCount
}

/** Judul fallback SATU-SATUNYA untuk item tanpa judul (audit J-04). */
export function untitledShowcaseTitle(): string {
  return translate("Tanpa judul")
}

/** Pemilik item pada normalisasi list per-username (endpoint sudah per-user). */
export type ShowcaseOwner = {
  id: string
  username: string
  fullName?: string
  avatarUrl?: string | null
  verified?: boolean
}

/**
 * Cover item mentah (GET /v1/users/{username}/showcase & /me/showcase):
 * kanonik `coverImageUrl`/`images[0]`, terakhir `fileKey`. SATU resolver agar
 * grid manajemen, galeri publik, dan normalisasi sosial tidak lagi memilih
 * key yang berbeda (E-01).
 *
 * NP-007 (perf-fix, 2026-09-29): alias top-level `imageUrl` DIHAPUS dari
 * backend — fallback ke sana dihapus; satu sumber kebenaran gambar.
 *
 * Kontrak final Tim A (2026-09-28): entri video memakai `thumbnailUrl`
 * sebagai cover (imageUrl-nya = berkas video, bukan gambar).
 */
export function showcaseCoverOf(item: ShowcaseItem): string | undefined {
  const first = Array.isArray(item.images) ? item.images[0] : undefined
  const firstUrl =
    first?.kind === "video"
      ? (first.thumbnailUrl ?? first.imageUrl)
      : first?.imageUrl
  const fromImages = firstUrl
  return (
    resolveMediaUrl(item.coverImageUrl) ??
    resolveMediaUrl(fromImages) ??
    resolveMediaUrl(item.fileKey)
  )
}

/**
 * Normalisasi SATU entri images kaya (kontrak final Tim A) dari bentuk
 * mentah `ShowcaseItem` (users.ts) ke `ShowcaseMedia` (showcase.ts).
 * Entri tanpa imageUrl dibuang; kind asing → "image" HANYA bila kind tidak
 * dikirim (payload lama), kind string asing yang eksplisit dibuang.
 */
function toRichMedia(
  image: ShowcaseImage | undefined,
  index: number,
  fallbackId: string,
): ShowcaseMedia | null {
  const url = resolveMediaUrl(image?.imageUrl)
  if (!url) return null
  const kindRaw = image?.kind
  if (typeof kindRaw === "string" && kindRaw !== "image" && kindRaw !== "video" && kindRaw !== "spin360") {
    return null
  }
  const kind = kindRaw === "video" || kindRaw === "spin360" ? kindRaw : "image"
  const groupKey =
    typeof image?.groupKey === "string" && image.groupKey ? image.groupKey : undefined
  const groupOrder =
    typeof image?.groupOrder === "number" && Number.isFinite(image.groupOrder)
      ? Math.floor(image.groupOrder)
      : undefined
  if (kind === "spin360" && (groupKey == null || groupOrder == null)) return null
  const sortOrder =
    typeof image?.sortOrder === "number" && Number.isFinite(image.sortOrder)
      ? image.sortOrder
      : index
  const thumbnailUrl = resolveMediaUrl(image?.thumbnailUrl) ?? undefined
  const media: ShowcaseMedia = {
    id: image?.id ?? `${fallbackId}-${index}`,
    kind,
    imageUrl: url,
    sortOrder,
  }
  if (thumbnailUrl) media.thumbnailUrl = thumbnailUrl
  if (typeof image?.durationSec === "number" && Number.isFinite(image.durationSec) && image.durationSec >= 0) {
    media.durationSec = image.durationSec
  }
  if (groupKey != null) media.groupKey = groupKey
  if (groupOrder != null) media.groupOrder = groupOrder
  return media
}

/**
 * Normalisasi item mentah (ShowcaseItem) → bentuk sosial (ShowcaseSocialItem).
 * Respons backend BISA sudah membawa field sosial (likeCount/isLiked/images[]) —
 * semuanya dibaca defensif; yang tidak ada diisi nilai netral.
 */
export function toSocialShowcaseItem(
  item: ShowcaseItem,
  owner: ShowcaseOwner,
  /** Profil/list milik sendiri → isOwner true (moderasi & sembunyi bendera). */
  isSelf = false,
): ShowcaseSocialItem {
  const raw = item as ShowcaseItem & Partial<SocialItem>
  const images = (
    Array.isArray(raw.images)
      ? raw.images
          .map((image, index) => toRichMedia(image, index, item.id))
          .filter((m): m is ShowcaseMedia => m != null)
          // SH-F-010: urutkan by sortOrder seperti parseShowcaseItem — cover di
          // tab Etalase profil tidak boleh beda urutan dari feed/detail.
          .sort((a, b) => a.sortOrder - b.sortOrder)
      : []
  )
  if (images.length === 0) {
    const cover = showcaseCoverOf(item)
    if (cover)
      images.push({ id: item.id, kind: "image", imageUrl: cover, sortOrder: 0 })
  }
  return {
    id: item.id,
    title: item.title ?? item.caption ?? untitledShowcaseTitle(),
    description: item.description ?? item.caption ?? null,
    category: raw.category ?? null,
    // Kontrak final Tim A (2026-09-28): kondisi barang.
    condition:
      raw.condition === "BARU" || raw.condition === "BEKAS" ? raw.condition : null,
    images,
    // NP-007: satu sumber kebenaran gambar — `coverImageUrl`/`images[]`.
    // Alias top-level `imageUrl` tidak lagi dikirim backend.
    coverImageUrl: item.coverImageUrl ?? null,
    priceMin: item.priceMin ?? null,
    priceMax: item.priceMax ?? null,
    likeCount: clampShowcaseCount(raw.likeCount),
    commentCount: clampShowcaseCount(raw.commentCount),
    viewCount: clampShowcaseCount(raw.viewCount),
    // Kontrak final Tim A (2026-09-28): simpan.
    saveCount: clampShowcaseCount(raw.saveCount),
    isSaved: raw.isSaved === true ? true : undefined,
    isLiked: getInitialIsLiked(raw),
    isOwner: raw.isOwner === true || isSelf ? true : undefined,
    createdAt: item.createdAt,
    updatedAt: (raw as { updatedAt?: string }).updatedAt ?? item.createdAt,
    author: authorOf(raw, owner),
    shareUrl: typeof raw.shareUrl === "string" ? raw.shareUrl : undefined,
  }
}

function getInitialIsLiked(raw: Partial<SocialItem>): boolean {
  return raw.isLiked === true
}

function authorOf(raw: Partial<SocialItem>, owner: ShowcaseOwner): ShowcaseAuthor {
  const a = raw.author
  const rawTier = (a as { sealTier?: unknown } | undefined)?.sealTier
  return {
    userId: a?.userId ?? owner.id,
    username: a?.username ?? owner.username,
    fullName: a?.fullName ?? owner.fullName ?? null,
    avatarUrl: a?.avatarUrl ?? owner.avatarUrl ?? null,
    membershipRank: a?.membershipRank ?? null,
    isKycVerified: a?.isKycVerified ?? owner.verified === true,
    isVip: a?.isVip ?? false,
    // SS-010 (audit 2026-09-26): badges & sealTier sebelumnya dibuang —
    // tab Etalase profil kehilangan seal di samping nama. Salin & validasi
    // seperti normalizer lib/api/showcase.ts.
    badges: Array.isArray(a?.badges)
      ? a.badges
          .filter((b) => b && typeof (b as { type?: unknown }).type === "string")
          .map((b) => ({ type: (b as { type: string }).type }))
      : [],
    sealTier: rawTier === "gold" || rawTier === "blue" || rawTier === "gray" ? rawTier : null,
  }
}

// ------------------------------------------------------------------
// Share bersama (audit I-04): payload → share sheet → fallback SALIN TAUTAN
// bila WebShare tidak tersedia, alih-alih berhenti di toast info.
// ------------------------------------------------------------------

export type ShowcaseShareResult = {
  outcome: ShareOutcome | "copied"
  payload: ShowcaseSharePayload
}

/**
 * Ambil payload share & buka sheet OS. Bila share tidak tersedia (web
 * desktop tanpa WebShare API), tautan disalin ke clipboard dan hasilnya
 * dilaporkan sebagai "copied" supaya pemanggil menampilkan toast yang benar
 * ("Tautan disalin", bukan "Share tidak tersedia").
 *
 * Metadata (judul/harga/penulis) tetap berasal dari item/backend; URL yang
 * dibagikan aplikasi selalu mengikuti format publik final /p/<id> (1 Okt
 * 2026), bukan shareUrl lama dari metadata yang mungkin masih ter-cache.
 */
export async function shareShowcaseById(id: string, item?: ShowcaseSocialItem): Promise<ShowcaseShareResult> {
  // Known item: invoke OS/browser share within the original user gesture, no network await.
  const payload: ShowcaseSharePayload = item ? {
    showcaseId: id, title: item.title, description: item.description ?? "",
    priceLabel: showcasePriceLabel(item) ?? undefined,
    authorUsername: item.author.username, authorFullName: item.author.fullName,
    shareUrl: showcaseUrl(id),
  } : await getShowcaseSharePayload(id)
    .then((metadata) => ({ ...metadata, shareUrl: showcaseUrl(id) }))
    .catch(() => ({
      showcaseId: id, title: translate("Etalase"), description: "", authorUsername: "", shareUrl: showcaseUrl(id),
    }))
  const price = payload.priceLabel ? ` — ${payload.priceLabel}` : ""
  const outcome = await shareContent({
    message: `${payload.title}${price} — ${payload.authorFullName ?? "@" + payload.authorUsername}`,
    url: payload.shareUrl,
    title: payload.title,
  })
  if (outcome === "unavailable" && payload.shareUrl) {
    const copied = await copyToClipboard(payload.shareUrl)
    if (copied) return { outcome: "copied", payload }
  }
  return { outcome, payload }
}

/**
 * Identical media fallback and ordering on feed, detail and gallery.
 *
 * Kontrak final Tim A (2026-09-28): entri video memakai `thumbnailUrl`
 * sebagai gambar wakil (imageUrl-nya = berkas video); spin360 tidak
 * dimasukkan (dirender terpisah via `showcaseSpin360Groups`).
 */
export function showcaseImages(item: ShowcaseSocialItem): { id: string; url: string }[] {
  const source = Array.isArray(item.images) ? item.images : []
  const images = source.flatMap((image) => {
    const rawUrl = image.kind === "video" ? (image.thumbnailUrl ?? image.imageUrl) : image.imageUrl
    const url = resolveMediaUrl(rawUrl)
    return url ? [{ id: image.id, url }] : []
  })
  const cover = resolveMediaUrl(item.coverImageUrl)
  return images.length ? images : cover ? [{ id: item.id, url: cover }] : []
}

/**
 * Satu slide galeri: gambar atau video.
 * `spin360` sengaja TIDAK dimasukkan — viewer 360° dirender terpisah di
 * halaman detail (<Spin360Viewer> via `showcaseSpin360Groups`), bukan
 * sebagai slide karosel.
 *
 * C01 (batch 139): `aspectRatio` = rasio w/h media dari respons list
 * (fallback 1 = persegi). Placeholder memakai rasio ini supaya konten tidak
 * meloncat saat gambar/video selesai dimuat.
 */
export type GalleryMedia = {
  id: string
  kind: "image" | "video"
  url: string
  /**
   * PERF-FIX (NP-001/LR-002): URL full-res (`imageUrl`) — dipakai viewer /
   * detail fullscreen. Di feed, `url` memakai `thumbnailUrl` bila ada.
   */
  fullUrl?: string
  posterUrl?: string
  durationSec?: number
  aspectRatio?: number
}

/**
 * Opsi `showcaseMedia` — PERF-FIX (NP-001/LR-002).
 */
export type ShowcaseMediaOptions = {
  /**
   * true (default) = slide gambar memakai `thumbnailUrl` bila ada (hemat
   * kuota — dipakai FEED); false = selalu `imageUrl` penuh (viewer / detail
   * fullscreen). Video tidak terpengaruh (url = berkas video asli).
   */
  thumbnails?: boolean
}

/**
 * Daftar slide galeri karya (kontrak final Tim A, 2026-09-28).
 *
 * Dibangun dari `item.images` yang kaya: image → slide gambar, video →
 * slide video (url = berkas video, posterUrl = thumbnail). Hasil di-cache
 * per instance item (WeakMap) agar referensi stabil antar render — kunci
 * cache kini mencakup mode thumbnail/full karena hasilnya berbeda.
 */
const mediaCache = new WeakMap<ShowcaseSocialItem, Map<boolean, GalleryMedia[]>>()
/**
 * C01 (batch 139): rasio media dari respons list. `width`/`height` opsional
 * di kontrak — bila hilang/tidak valid, fallback 1 (persegi, perilaku lama).
 * Di-clamp ke rentang wajar agar data rusak tidak merusak layout feed.
 */
export function showcaseMediaAspectRatio(width: unknown, height: unknown): number {
  const w = typeof width === "number" && Number.isFinite(width) ? width : 0
  const h = typeof height === "number" && Number.isFinite(height) ? height : 0
  if (w <= 0 || h <= 0) return 1
  const ratio = w / h
  if (!Number.isFinite(ratio)) return 1
  return Math.min(4, Math.max(0.25, ratio))
}
export function showcaseMedia(item: ShowcaseSocialItem, opts: ShowcaseMediaOptions = {}): GalleryMedia[] {
  // PERF-FIX (NP-001/LR-002): feed memuat varian kecil, bukan full-res.
  const useThumbnails = opts.thumbnails !== false
  const byMode = mediaCache.get(item)
  const cached = byMode?.get(useThumbnails)
  if (cached) return cached
  // Defensif: parser menjamin `images: []`, tetapi item dari cache lama /
  // sumber lain tidak boleh meruntuhkan seluruh feed lewat satu kartu.
  const images = Array.isArray(item.images) ? item.images : []
  const rich = images.flatMap((m): GalleryMedia[] => {
    // C01: bawa rasio dari respons list ke tiap slide galeri.
    const aspectRatio = showcaseMediaAspectRatio(m.width, m.height)
    if (m.kind === "video") {
      const url = resolveMediaUrl(m.imageUrl)
      if (!url) return []
      const poster = m.thumbnailUrl ? (resolveMediaUrl(m.thumbnailUrl) ?? undefined) : undefined
      // Item 57 (FE-IMP-1): teruskan durasi untuk badge "1:25" di thumbnail.
      const durationSec =
        typeof m.durationSec === "number" && Number.isFinite(m.durationSec) && m.durationSec >= 0
          ? Math.round(m.durationSec)
          : undefined
      return poster
        ? [{ id: m.id, kind: m.kind, url, posterUrl: poster, durationSec, aspectRatio }]
        : [{ id: m.id, kind: m.kind, url, durationSec, aspectRatio }]
    }
    if (m.kind === "image") {
      // PERF-FIX (NP-001/LR-002): di feed, slide gambar memakai thumbnail
      // backend (~640px) bila tersedia — full-res hanya di viewer/detail.
      const fullUrl = resolveMediaUrl(m.imageUrl)
      if (!fullUrl) return []
      const thumbUrl = useThumbnails && m.thumbnailUrl ? resolveMediaUrl(m.thumbnailUrl) : undefined
      const url = thumbUrl ?? fullUrl
      return [{ id: m.id, kind: m.kind, url, fullUrl, aspectRatio }]
    }
    return []
  })
  const result: GalleryMedia[] = rich.length > 0
    ? rich
    : showcaseImages(item).map((g) => ({ id: g.id, kind: "image" as const, url: g.url, aspectRatio: 1 }))
  const modes = mediaCache.get(item) ?? new Map<boolean, GalleryMedia[]>()
  modes.set(useThumbnails, result)
  mediaCache.set(item, modes)
  return result
}

/**
 * Grup frame spin360 untuk <Spin360Viewer> (kontrak final Tim A, 2026-09-28).
 *
 * Mengelompokkan entri `kind: "spin360"` per `groupKey`, mengurutkan tiap
 * grup menurut `groupOrder` (0..n-1 kontinu), dan mengembalikan daftar frame
 * (URL) per grup. Grup dengan < 2 frame yang valid dibuang (tak bisa
 * diputar). Urutan grup mengikuti `sortOrder` terkecil tiap grup.
 */
export function showcaseSpin360Groups(item: ShowcaseSocialItem): string[][] {
  const byGroup = new Map<string, { order: number; sortOrder: number; url: string }[]>()
  for (const m of item.images) {
    if (m.kind !== "spin360" || !m.groupKey || m.groupOrder == null) continue
    const url = resolveMediaUrl(m.imageUrl)
    if (!url) continue
    const list = byGroup.get(m.groupKey) ?? []
    list.push({ order: m.groupOrder, sortOrder: m.sortOrder, url })
    byGroup.set(m.groupKey, list)
  }
  const groups = [...byGroup.values()]
    .map((list) => {
      list.sort((a, b) => a.order - b.order)
      return list
    })
    .filter((list) => list.length >= 2)
    .sort((a, b) => a[0]!.sortOrder - b[0]!.sortOrder)
  return groups.map((list) => list.map((e) => e.url))
}

/**
 * Urutan komentar (mega-batch FE-IMP-1, item 49/160).
 *
 * Backend TIDAK punya param sort untuk GET /v1/showcase/:id/comments
 * (kontrak final Tim A tidak mendefinisikannya) → urutkan sisi klien secara
 * deterministik dari komentar yang sudah dimuat. `createdAt` tidak valid
 * diperlakukan sebagai 0 (paling tua); seri dipecah lewat `id` agar urutan
 * stabil antar render.
 */
export type ShowcaseCommentOrder = "newest" | "oldest"

export function sortShowcaseComments<T extends { id: string; createdAt: string }>(
  comments: readonly T[],
  order: ShowcaseCommentOrder,
): T[] {
  // TIM-8 (audit performa 2026-09-30): decorate-sort-undecorate — `Date.parse`
  // sekali per item, bukan per perbandingan (sebelumnya O(n log n) parse).
  const decorated = comments.map((item) => {
    const parsed = Date.parse(item.createdAt)
    return { item, time: Number.isFinite(parsed) ? parsed : 0 }
  })
  decorated.sort((a, b) => {
    const diff = a.time - b.time
    if (diff !== 0) return order === "newest" ? -diff : diff
    if (a.item.id === b.item.id) return 0
    const idDiff = a.item.id < b.item.id ? -1 : 1
    return order === "newest" ? -idDiff : idDiff
  })
  return decorated.map((d) => d.item)
}

/**
 * C13 (batch 139): transisi optimistis like/save — murni & unit-testable.
 * Dari state sebelumnya, hitung state "seakan berhasil": status dibalik,
 * hitungan ±1 (dijepit di 0). Rollback = terapkan ulang snapshot `previous`
 * (hook melakukannya saat request gagal + toast danger).
 */
export function optimisticToggleState(previous: {
  active: boolean
  count: number
}): { active: boolean; count: number } {
  const active = !previous.active
  return { active, count: Math.max(0, previous.count + (active ? 1 : -1)) }
}

/**
 * C14 (batch 139): cari komentar deep link di utas yang sudah dimuat.
 * Mengembalikan `{ root, reply }` — `reply` null bila target adalah komentar
 * root. Murni & unit-testable (dipakai alur fokus `?comment=`).
 */
export function findShowcaseComment(
  comments: readonly ShowcaseCommentWithReplies[],
  commentId: string,
): { root: ShowcaseCommentWithReplies; reply: ShowcaseComment | null } | null {
  for (const root of comments) {
    if (root.id === commentId) return { root, reply: null }
    const reply = root.replies?.find((candidate) => candidate.id === commentId) ?? null
    if (reply) return { root, reply }
  }
  return null
}

/**
 * C14 (batch 139): bolehkan ambil halaman komentar berikutnya untuk mencari
 * target deep link? Bounded — berhenti saat target ketemu, halaman habis
 * (`hasNext` tercermin dari status), atau batas halaman tercapai. Murni &
 * unit-testable.
 */
export function shouldFetchNextCommentPage(args: {
  commentId: string | undefined
  focusDone: boolean
  targetFound: boolean
  /** "idle" = halaman terakhir selesai & masih ada berikutnya. */
  commentsStatus: string
  commentsPage: number
  maxPages: number
}): boolean {
  const { commentId, focusDone, targetFound, commentsStatus, commentsPage, maxPages } = args
  if (!commentId || focusDone || targetFound) return false
  if (commentsStatus !== "idle") return false
  return commentsPage < maxPages
}
