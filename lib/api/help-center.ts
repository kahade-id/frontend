/**
 * Kahade — domain `help-center` (5 endpoint publik).
 * Halaman FAQ: kategori → artikel → search.
 *
 * Audit Pengaturan & Bantuan 2026-10-10: bentuk respons backend
 * (help-center.service.ts) adalah
 *   kategori: { id, slug, name, description, icon, items:[{id, question,
 *              answer, viewCount}] }
 *   search:   [{ id, question, answer, viewCount, category:{slug,name} }]
 * Semua dinormalisasi ke `HelpArticle`/`HelpCategoryDetail` di sini, dan
 * `lang` mengikuti bahasa aktif aplikasi (sebelumnya "id" hardcode — pengguna
 * English selalu menerima artikel Indonesia walau backend punya kolom EN).
 */

import { pickString, readEntity, readList } from "@/lib/api/response"

import { http, seg } from "@/lib/api/client"
import { getLanguage } from "@/lib/i18n/store"

export type HelpCategory = {
  slug: string
  name: string
  description?: string
  articleCount?: number
}

export type HelpArticle = {
  id: string
  slug: string
  title: string
  content?: string
  /** Slug kategori pemilik (string, bukan objek). */
  category?: string
  /** Nama kategori bila backend mengirimnya (hasil pencarian). */
  categoryName?: string
  views?: number
}

export type HelpCategoryDetail = HelpCategory & {
  articles?: HelpArticle[]
}

/**
 * Mega-batch FE-IMP-5 (item 120): normalisasi artikel — backend mengirim
 * berbagai bentuk payload. Field kanonis yang dibaca: id, slug, title,
 * content, category, views. Varian yang ditoleransi:
 * - `title` ← title | question | name
 * - `content` ← content | answer | body
 * - `slug` ← slug | id (fallback: string kosong)
 * - `id`   ← id | slug (fallback: string kosong)
 * - `category` ← string | { slug, name } (hasil pencarian backend)
 * Daftar artikel kategori detail memakai kunci `items` selain `articles`.
 * Tidak ada throw — rekor asing dilewati, rekor parsial mendapat fallback
 * string kosong (UI me-render judul kosong sebagai "Tanpa judul").
 */
export function normalizeHelpArticle(record: unknown, categorySlug?: string): HelpArticle | null {
  if (typeof record !== "object" || record === null) return null
  const rec = record as Record<string, unknown>
  const id = pickString(rec, ["id", "slug"])
  const slug = pickString(rec, ["slug", "id"])
  const title = pickString(rec, ["title", "question", "name"])
  if (!id && !slug && !title) return null
  const content = pickString(rec, ["content", "answer", "body"])
  let category = pickString(rec, ["category", "categorySlug"]) ?? categorySlug
  let categoryName = pickString(rec, ["categoryName"])
  if (rec.category && typeof rec.category === "object") {
    const cat = rec.category as Record<string, unknown>
    category = pickString(cat, ["slug"]) ?? category
    categoryName = pickString(cat, ["name"]) ?? categoryName
  }
  const views =
    typeof rec.views === "number" && Number.isFinite(rec.views)
      ? rec.views
      : typeof rec.viewCount === "number" && Number.isFinite(rec.viewCount)
        ? rec.viewCount
        : undefined
  return {
    id: id ?? "",
    slug: slug ?? "",
    title: title ?? "",
    ...(content != null ? { content } : {}),
    ...(category != null ? { category } : {}),
    ...(categoryName != null ? { categoryName } : {}),
    ...(views != null ? { views } : {}),
  }
}

/**
 * Item 120: daftar artikel dari kategori detail — kunci `articles` atau
 * `items`, tiap rekor dinormalisasi (backend help-center memakai `items`).
 */
export function normalizeHelpArticleList(record: unknown, categorySlug?: string): HelpArticle[] {
  if (Array.isArray(record)) {
    return record.flatMap((item) => {
      const normalized = normalizeHelpArticle(item, categorySlug)
      return normalized ? [normalized] : []
    })
  }
  if (typeof record !== "object" || record === null) return []
  const rec = record as Record<string, unknown>
  const list = rec.articles ?? rec.items
  if (!Array.isArray(list)) return []
  return list.flatMap((item) => {
    const normalized = normalizeHelpArticle(item, categorySlug)
    return normalized ? [normalized] : []
  })
}

/** Satu kategori backend → bentuk detail dengan artikel ternormalisasi. */
export function normalizeHelpCategory(record: unknown): HelpCategoryDetail | null {
  if (typeof record !== "object" || record === null) return null
  const rec = record as Record<string, unknown>
  const slug = pickString(rec, ["slug", "id"])
  const name = pickString(rec, ["name", "title"])
  if (!slug || !name) return null
  const articles = normalizeHelpArticleList(rec, slug)
  const description = pickString(rec, ["description"])
  return {
    slug,
    name,
    ...(description != null ? { description } : {}),
    articleCount:
      typeof rec.articleCount === "number" && Number.isFinite(rec.articleCount)
        ? rec.articleCount
        : articles.length,
    articles,
  }
}

function langQuery() {
  return { lang: getLanguage() }
}

/** GET /v1/help-center/categories — kategori beserta artikelnya. */
export function listHelpCategories(signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/help-center/categories", {
      query: langQuery(),
      auth: "none",
      retry: 1,
      signal,
    })
    .then((raw) =>
      readList<unknown>(raw, ["categories"]).flatMap((item) => {
        const normalized = normalizeHelpCategory(item)
        return normalized ? [normalized] : []
      }),
    )
}

export function getHelpCategory(slug: string, signal?: AbortSignal) {
  return http
    .get<unknown>(`/v1/help-center/categories/${seg(slug)}`, {
      query: langQuery(),
      auth: "none",
      retry: 1,
      signal,
    })
    .then((raw) => {
      const detail = readEntity<unknown>(raw, "category")
      const normalized = normalizeHelpCategory(detail) ?? normalizeHelpCategory(raw)
      if (normalized) return normalized
      // Respons tanpa slug/nama (backend lama): tetap kembalikan daftarnya.
      const articles = normalizeHelpArticleList(detail, slug)
      return {
        slug,
        name: "",
        articleCount: articles.length,
        articles: articles.length > 0 ? articles : normalizeHelpArticleList(raw, slug),
      } satisfies HelpCategoryDetail
    })
}

export function searchHelpArticles(query: string, signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/help-center/search", {
      query: { q: query, ...langQuery() },
      auth: "none",
      retry: 1,
      signal,
    })
    .then((raw) => {
      const list = readList<unknown>(raw, ["articles", "items"])
      // readList membaca kunci `articles` — tiap rekor dinormalisasi agar
      // varian question/answer tetap punya judul/konten kanonis.
      return list.flatMap((item) => {
        const normalized = normalizeHelpArticle(item)
        return normalized ? [normalized] : []
      })
    })
}

export function trackHelpArticleView(id: string) {
  return http.post<void>(`/v1/help-center/items/${seg(id)}/view`, undefined, { auth: "none" })
}

/**
 * POST /v1/help-center/items/{id}/feedback?helpful=true|false — umpan balik
 * artikel (14.2). Endpoint PUBLIK (`@Public()`) dan parameter lewat QUERY
 * (controller: `@Query('helpful')`), bukan body.
 */
export function submitHelpArticleFeedback(id: string, helpful: boolean) {
  return http.post<unknown>(`/v1/help-center/items/${seg(id)}/feedback`, undefined, {
    auth: "none",
    query: { helpful: String(helpful) },
  })
}
