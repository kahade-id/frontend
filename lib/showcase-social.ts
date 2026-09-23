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
import { shareContent, type ShareOutcome } from "@/lib/share"

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
          return url
            ? {
                id: image.id ?? `${item.id}-${index}`,
                imageUrl: url,
                sortOrder: image.sortOrder ?? index,
              }
            : null
        })
        .filter((image): image is { id: string; imageUrl: string; sortOrder: number } => image != null)
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
    likeCount: typeof raw.likeCount === "number" ? raw.likeCount : 0,
    commentCount: typeof raw.commentCount === "number" ? raw.commentCount : 0,
    viewCount: typeof raw.viewCount === "number" ? raw.viewCount : 0,
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
  return {
    userId: a?.userId ?? owner.id,
    username: a?.username ?? owner.username,
    fullName: a?.fullName ?? owner.fullName ?? null,
    avatarUrl: a?.avatarUrl ?? owner.avatarUrl ?? null,
    membershipRank: a?.membershipRank ?? null,
    isKycVerified: a?.isKycVerified ?? owner.verified === true,
    isVip: a?.isVip ?? false,
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
 */
export async function shareShowcaseById(id: string, item?: ShowcaseSocialItem): Promise<ShowcaseShareResult> {
  // Known item: invoke OS/browser share within the original user gesture, no network await.
  const payload: ShowcaseSharePayload = item ? {
    showcaseId: id, title: item.title, description: item.description ?? "",
    authorUsername: item.author.username, authorFullName: item.author.fullName,
    shareUrl: showcaseUrl(id),
  } : await getShowcaseSharePayload(id).catch(() => ({
    showcaseId: id, title: translate("Etalase"), description: "", authorUsername: "", shareUrl: showcaseUrl(id),
  }))
  const outcome = await shareContent({
    message: `${payload.title} — ${payload.authorFullName ?? "@" + payload.authorUsername}`,
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
