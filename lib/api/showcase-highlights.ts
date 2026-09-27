/**
 * Kahade — highlight etalase profil (item 20).
 *
 * KONTRAK FINAL TIM A (2026-09-28):
 *   - POST   /v1/highlights            {title, coverFileKey?, productIds[]} → highlight
 *   - GET    /v1/highlights            → { data: Highlight[] } (milik sendiri)
 *   - GET    /v1/highlights/:id        → highlight
 *   - PATCH  /v1/highlights/:id        {title?, coverFileKey?, productIds?} → highlight
 *   - DELETE /v1/highlights/:id        → 204
 *   - GET    /v1/users/:username/highlights → { data: HighlightPreview[] } (publik)
 *
 * Highlight = { id, title, coverUrl, productIds, productCount, createdAt, updatedAt }
 * Preview publik = { id, title, coverUrl, productCount, previewImageUrls[] }
 *
 * Validasi server: title maks 30 karakter; productIds 1..50 unik & milik
 * sendiri; maks 20 highlight per pengguna.
 * Error: 404 HIGHLIGHT_NOT_FOUND · 409 HIGHLIGHT_LIMIT_REACHED.
 */
import { http, seg } from "./client"
import { asRecord, invalidResponse, readList } from "./response"
import type { ShowcaseItem } from "@/lib/api/users"

/** Batas judul highlight (kontrak server). */
export const HIGHLIGHT_TITLE_MAX = 30
/** Batas produk per highlight (kontrak server). */
export const HIGHLIGHT_PRODUCT_IDS_MAX = 50
/** Batas highlight per pengguna (kontrak server). */
export const HIGHLIGHTS_MAX = 20

/** Satu highlight — bentuk penuh (milik sendiri). */
export type ProfileHighlight = {
  id: string
  title: string
  coverUrl?: string | null
  productIds: string[]
  productCount: number
  createdAt: string
  updatedAt: string
}

/** Preview highlight untuk profil publik. */
export type ProfileHighlightPreview = {
  id: string
  title: string
  coverUrl?: string | null
  productCount: number
  previewImageUrls: string[]
}

export type CreateHighlightInput = {
  title: string
  coverFileKey?: string
  productIds: string[]
}

export type UpdateHighlightInput = {
  title?: string
  coverFileKey?: string | null
  productIds?: string[]
}

function parseHighlight(raw: unknown): ProfileHighlight {
  const r = asRecord(raw)
  if (!r) throw invalidResponse("highlight")
  const id = typeof r.id === "string" ? r.id : ""
  const title = typeof r.title === "string" ? r.title : ""
  const productIds = Array.isArray(r.productIds)
    ? r.productIds.filter((v): v is string => typeof v === "string")
    : []
  if (!id || !title) throw invalidResponse("highlight")
  return {
    id,
    title,
    coverUrl: typeof r.coverUrl === "string" ? r.coverUrl : null,
    productIds,
    productCount:
      typeof r.productCount === "number" && Number.isFinite(r.productCount)
        ? r.productCount
        : productIds.length,
    createdAt: typeof r.createdAt === "string" ? r.createdAt : "",
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : "",
  }
}

function parseHighlightPreview(raw: unknown): ProfileHighlightPreview {
  const r = asRecord(raw)
  if (!r) throw invalidResponse("highlight")
  const id = typeof r.id === "string" ? r.id : ""
  const title = typeof r.title === "string" ? r.title : ""
  if (!id || !title) throw invalidResponse("highlight")
  return {
    id,
    title,
    coverUrl: typeof r.coverUrl === "string" ? r.coverUrl : null,
    productCount:
      typeof r.productCount === "number" && Number.isFinite(r.productCount)
        ? r.productCount
        : 0,
    previewImageUrls: Array.isArray(r.previewImageUrls)
      ? r.previewImageUrls.filter((v): v is string => typeof v === "string")
      : [],
  }
}

/**
 * Validasi sisi klien sebelum request — gagal-cepat dengan pesan Indonesia,
 * bukan menunggu 400 server.
 */
function validateHighlightInput(title: string | undefined, productIds: string[] | undefined) {
  if (title !== undefined) {
    const t = title.trim()
    if (t.length === 0) throw new Error("Judul highlight tidak boleh kosong.")
    if (t.length > HIGHLIGHT_TITLE_MAX) {
      throw new Error(`Judul highlight maksimal ${HIGHLIGHT_TITLE_MAX} karakter.`)
    }
  }
  if (productIds !== undefined) {
    if (productIds.length === 0) throw new Error("Pilih minimal 1 produk untuk highlight.")
    if (productIds.length > HIGHLIGHT_PRODUCT_IDS_MAX) {
      throw new Error(`Maksimal ${HIGHLIGHT_PRODUCT_IDS_MAX} produk per highlight.`)
    }
    if (new Set(productIds).size !== productIds.length) {
      throw new Error("Produk tidak boleh duplikat dalam satu highlight.")
    }
  }
}

/** GET /v1/users/:username/highlights — daftar publik untuk strip profil. */
export function readProfileHighlights(username: string): Promise<ProfileHighlightPreview[]> {
  return http
    .get<unknown>(`/v1/users/${seg(username)}/highlights`, { auth: "optional" })
    .then((raw) => readList(raw).map(parseHighlightPreview))
}

/** GET /v1/highlights — highlight milik sendiri (untuk editor). */
export function listMyHighlights(): Promise<ProfileHighlight[]> {
  return http
    .get<unknown>("/v1/highlights", { auth: "required" })
    .then((raw) => readList(raw).map(parseHighlight))
}

/** GET /v1/highlights/:id — satu highlight milik sendiri. */
export function readHighlight(id: string): Promise<ProfileHighlight> {
  return http
    .get<unknown>(`/v1/highlights/${seg(id)}`, { auth: "required" })
    .then(parseHighlight)
}

/**
 * POST /v1/highlights — buat highlight baru.
 * 409 HIGHLIGHT_LIMIT_REACHED = sudah 20 highlight (diteruskan ke pemanggil).
 */
export function createHighlight(input: CreateHighlightInput): Promise<ProfileHighlight> {
  try {
    validateHighlightInput(input.title, input.productIds)
  } catch (err) {
    // API selalu async — validasi gagal = rejected promise, bukan throw sinkron.
    return Promise.reject(err)
  }
  return http
    .post(
      "/v1/highlights",
      {
        title: input.title.trim(),
        ...(input.coverFileKey ? { coverFileKey: input.coverFileKey } : {}),
        productIds: input.productIds,
      },
      { auth: "required" },
    )
    .then(parseHighlight)
}

/** PATCH /v1/highlights/:id — ubah judul/cover/produk. */
export function updateHighlight(id: string, patch: UpdateHighlightInput): Promise<ProfileHighlight> {
  try {
    validateHighlightInput(patch.title, patch.productIds)
  } catch (err) {
    return Promise.reject(err)
  }
  return http
    .patch(
      `/v1/highlights/${seg(id)}`,
      {
        ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
        ...(patch.coverFileKey !== undefined ? { coverFileKey: patch.coverFileKey } : {}),
        ...(patch.productIds !== undefined ? { productIds: patch.productIds } : {}),
      },
      { auth: "required" },
    )
    .then(parseHighlight)
}

/** DELETE /v1/highlights/:id → 204. 404 HIGHLIGHT_NOT_FOUND diteruskan. */
export function deleteHighlight(id: string): Promise<void> {
  return http
    .delete<void>(`/v1/highlights/${seg(id)}`, { auth: "required" })
    .then(() => undefined)
}

/**
 * Cover highlight dari item etalase: coverImageUrl → images[0] → imageUrl.
 * Kontrak final Tim A (2026-09-28): entri video memakai thumbnailUrl sebagai
 * cover. Murni tampilan — dipakai strip & editor.
 */
export function highlightCoverOf(item: ShowcaseItem | undefined): string | null {
  if (!item) return null
  const first = item.images?.[0]
  const firstUrl =
    first?.kind === "video" ? (first.thumbnailUrl ?? first.imageUrl) : first?.imageUrl
  return (
    item.coverImageUrl ??
    firstUrl ??
    item.imageUrl ??
    null
  )
}
