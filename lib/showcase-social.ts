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
  type ShowcaseSharePayload,
  type ShowcaseSocialItem,
  type ShowcaseSocialItem as SocialItem,
} from "@/lib/api/showcase"
import type { ShowcaseItem } from "@/lib/api/users"
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
 * kanonik baru `coverImageUrl`/`images[0]`, lalu alias lama `imageUrl`,
 * terakhir `fileKey`. SATU resolver agar grid manajemen, galeri publik,
 * dan normalisasi sosial tidak lagi memilih key yang berbeda (E-01).
 */
export function showcaseCoverOf(item: ShowcaseItem): string | undefined {
  const fromImages = Array.isArray(item.images) ? item.images[0]?.imageUrl : undefined
  return (
    resolveMediaUrl(item.coverImageUrl) ??
    resolveMediaUrl(fromImages) ??
    resolveMediaUrl(item.imageUrl) ??
    resolveMediaUrl(item.fileKey)
  )
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
  const images = Array.isArray(raw.images)
    ? raw.images
        .map((image, index) => {
          const url = resolveMediaUrl(image?.imageUrl)
          // SH-F-010: sortOrder asing → fallback indeks (selaras parseShowcaseItem).
          const sortOrder =
            typeof image?.sortOrder === "number" && Number.isFinite(image.sortOrder)
              ? image.sortOrder
              : index
          return url
            ? {
                id: image.id ?? `${item.id}-${index}`,
                imageUrl: url,
                sortOrder,
              }
            : null
        })
        .filter((image): image is { id: string; imageUrl: string; sortOrder: number } => image != null)
        // SH-F-010: urutkan by sortOrder seperti parseShowcaseItem — cover di
        // tab Etalase profil tidak boleh beda urutan dari feed/detail.
        .sort((a, b) => a.sortOrder - b.sortOrder)
    : []
  if (images.length === 0) {
    const cover = showcaseCoverOf(item)
    if (cover) images.push({ id: item.id, imageUrl: cover, sortOrder: 0 })
  }
  return {
    id: item.id,
    title: item.title ?? item.caption ?? untitledShowcaseTitle(),
    description: item.description ?? item.caption ?? null,
    category: raw.category ?? null,
    images,
    coverImageUrl: item.coverImageUrl ?? item.imageUrl ?? null,
    imageUrl: item.imageUrl ?? null,
    priceMin: item.priceMin ?? null,
    priceMax: item.priceMax ?? null,
    likeCount: clampShowcaseCount(raw.likeCount),
    commentCount: clampShowcaseCount(raw.commentCount),
    viewCount: clampShowcaseCount(raw.viewCount),
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
 * C-08 (audit 2026-09-23): item yang sudah dikenal memakai `item.shareUrl`
 * dari backend bila ada (fallback ke URL rakitan lokal), dan pesan share kini
 * menyertakan label harga — dulu payload backend diabaikan total.
 */
export async function shareShowcaseById(id: string, item?: ShowcaseSocialItem): Promise<ShowcaseShareResult> {
  // Known item: invoke OS/browser share within the original user gesture, no network await.
  const payload: ShowcaseSharePayload = item ? {
    showcaseId: id, title: item.title, description: item.description ?? "",
    priceLabel: showcasePriceLabel(item) ?? undefined,
    authorUsername: item.author.username, authorFullName: item.author.fullName,
    shareUrl: item.shareUrl || showcaseUrl(id),
  } : await getShowcaseSharePayload(id).catch(() => ({
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

/** Identical media fallback and ordering on feed, detail and gallery. */
export function showcaseImages(item: ShowcaseSocialItem): { id: string; url: string }[] {
  const images = item.images.flatMap((image) => {
    const url = resolveMediaUrl(image.imageUrl)
    return url ? [{ id: image.id, url }] : []
  })
  const cover = resolveMediaUrl(item.coverImageUrl) ?? resolveMediaUrl(item.imageUrl)
  return images.length ? images : cover ? [{ id: item.id, url: cover }] : []
}

/**
 * Satu slide galeri: gambar atau video.
 * `kind` sudah disaring parser (`parseShowcaseMedia`); di sini `spin360`
 * sengaja TIDAK dimasukkan — viewer 360° dirender terpisah di halaman detail
 * (<Spin360Viewer>), bukan sebagai slide karosel.
 */
export type GalleryMedia = { id: string; kind: "image" | "video"; url: string; posterUrl?: string }

/**
 * Daftar slide galeri karya (batch 19, item 11/12/16).
 *
 * Prioritas: `item.media` (backend baru) bila ada entri valid; fallback ke
 * `showcaseImages` (images[] lama + cover) bila `media` kosong/tak ada —
 * payload lama tetap tampil persis seperti sebelum batch 19.
 * Hasil di-cache per instance item (WeakMap) agar referensi stabil antar
 * render (memo galeri tidak re-render sia-sia).
 */
const mediaCache = new WeakMap<ShowcaseSocialItem, GalleryMedia[]>()
export function showcaseMedia(item: ShowcaseSocialItem): GalleryMedia[] {
  const cached = mediaCache.get(item)
  if (cached) return cached
  const rich = (item.media ?? []).flatMap((m): GalleryMedia[] => {
    if ((m.kind === "image" || m.kind === "video") && m.url) {
      const url = resolveMediaUrl(m.url)
      if (!url) return []
      const poster = m.posterUrl ? resolveMediaUrl(m.posterUrl) ?? undefined : undefined
      return poster ? [{ id: m.id, kind: m.kind, url, posterUrl: poster }] : [{ id: m.id, kind: m.kind, url }]
    }
    return []
  })
  const result: GalleryMedia[] = rich.length > 0
    ? rich
    : showcaseImages(item).map((g) => ({ id: g.id, kind: "image" as const, url: g.url }))
  mediaCache.set(item, result)
  return result
}
