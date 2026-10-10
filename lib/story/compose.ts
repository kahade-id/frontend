/**
 * Kahade — aturan draft story (murni). Dipakai layar buat story dan tes.
 *
 * Teks pesan galat & pesan prefill dikembalikan sebagai kunci `translate()`
 * (string Indonesia = kunci), jadi UI cukup menampilkannya.
 *
 * Audit 2026-10-10 (temuan #1, KRITIS): `validateStoryDraft` dulu menuntut
 * `mediaId` untuk kind image padahal `mediaId` baru ada SETELAH upload yang
 * berjalan di latar — tombol Bagikan foto selalu ditolak "Pilih foto dulu."
 * Kini validasi menerima `mediaPicked` (aset lokal sudah dipilih); `mediaId`
 * hanya wajib saat `buildCreateInput` (badan request).
 */
import {
  STORY_PRICE_MAX,
  STORY_PRODUCT_TAGS_MAX,
  STORY_TEXT_MAX,
  type CreateStoryInput,
  type StoryAudience,
  type StoryKind,
} from "@/lib/api/story"
import { translate } from "@/lib/i18n/translate"

/** Pilihan latar untuk story teks (hex, sudah lulus kontrak `#RRGGBB`). */
export const STORY_TEXT_BACKGROUNDS = [
  "#1F2937",
  "#0F766E",
  "#7C2D12",
  "#4C1D95",
  "#831843",
  "#1D4ED8",
] as const

export type ProductTagDraft = {
  productId: string
  title: string
  /** Posisi ternormalisasi 0..1 pada pratinjau. */
  x: number
  y: number
}

export type StoryDraft = {
  kind: StoryKind
  mediaId: string | null
  text: string
  backgroundColor: string
  productTags: ProductTagDraft[]
  /** Teks mentah dari input harga; kosong = tanpa stiker. */
  priceText: string
  askStock: boolean
  /** Produk untuk "Tanya Stok" (null = tanya umum). */
  askStockProductId: string | null
  audience: StoryAudience
}

export type DraftProblem =
  | "media-required"
  | "text-required"
  | "text-too-long"
  | "price-invalid"
  | "too-many-tags"

export type ValidateDraftOptions = {
  /**
   * Aset lokal (foto/video) sudah dipilih meski `mediaId` belum ada —
   * upload berjalan di latar setelah Bagikan ditekan.
   */
  mediaPicked?: boolean
}

/** Story bermedia (foto/video) — lawan dari story teks. */
export function isMediaStoryKind(kind: StoryKind): kind is "image" | "video" {
  return kind === "image" || kind === "video"
}

/** Angka dari input harga: hanya digit. "1.500.000" → 1500000. */
export function parsePriceInput(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, "")
  if (!digits) return null
  const n = Number(digits)
  if (!Number.isSafeInteger(n) || n <= 0 || n > STORY_PRICE_MAX) return null
  return n
}

export function validateStoryDraft(draft: StoryDraft, opts: ValidateDraftOptions = {}): DraftProblem | null {
  if (draft.productTags.length > STORY_PRODUCT_TAGS_MAX) return "too-many-tags"
  if (isMediaStoryKind(draft.kind)) {
    if (!draft.mediaId && !opts.mediaPicked) return "media-required"
    // Caption opsional, tetapi tetap dibatasi 200 karakter (server: STORY_TEXT_TOO_LONG).
    if (draft.text.trim().length > STORY_TEXT_MAX) return "text-too-long"
  } else {
    const text = draft.text.trim()
    if (!text) return "text-required"
    if (text.length > STORY_TEXT_MAX) return "text-too-long"
  }
  if (draft.priceText.trim() && parsePriceInput(draft.priceText) === null) return "price-invalid"
  return null
}

/** Ubah draft yang sudah lulus validasi menjadi body `createStory`. */
export function buildCreateInput(draft: StoryDraft): CreateStoryInput {
  const problem = validateStoryDraft(draft)
  if (problem) throw new Error(`draft tidak valid: ${problem}`)
  const price = draft.priceText.trim() ? parsePriceInput(draft.priceText) : null
  const media = isMediaStoryKind(draft.kind)
  return {
    kind: draft.kind,
    mediaId: media ? (draft.mediaId ?? undefined) : undefined,
    text: media ? draft.text.trim() || undefined : draft.text.trim(),
    backgroundColor: draft.kind === "text" ? draft.backgroundColor : undefined,
    productTags: draft.productTags.map((t) => ({
      productId: t.productId,
      x: clamp01(t.x),
      y: clamp01(t.y),
    })),
    priceSticker: price !== null ? { amount: price } : null,
    askStock: draft.askStock ? { productId: draft.askStockProductId ?? null } : null,
    audience: draft.audience,
  }
}

export function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0.5
  return Math.min(1, Math.max(0, v))
}

/** Format rupiah untuk stiker harga, mis. "Rp 350.000". */
export function formatPriceSticker(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`
}

/** Teks prefill "Tanya Stok" — dikirim ke draft chat pemilik, bukan otomatis terkirim. */
export function askStockPrefill(productTitle: string | null | undefined): string {
  const title = productTitle?.trim()
  if (title) return translate("Halo, apakah stok {produk} masih tersedia?", { produk: title })
  return translate("Halo, apakah stok produk di story kamu masih tersedia?")
}

/** Audiens default: semua penyimpan profil. */
export const DEFAULT_AUDIENCE: StoryAudience = { mode: "all_savers" }

export function emptyStoryDraft(kind: StoryKind): StoryDraft {
  return {
    kind,
    mediaId: null,
    text: "",
    backgroundColor: STORY_TEXT_BACKGROUNDS[0],
    productTags: [],
    priceText: "",
    askStock: false,
    askStockProductId: null,
    audience: DEFAULT_AUDIENCE,
  }
}
