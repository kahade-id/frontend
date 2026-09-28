/**
 * Kahade — domain `help-center` (4 endpoint publik-otentikasi).
 * Halaman FAQ: kategori → artikel → search.
 */

import { pickString, readEntity, readList } from "@/lib/api/response"

import { http, seg } from "@/lib/api/client"

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
  category?: string
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
 * Daftar artikel kategori detail memakai kunci `items` selain `articles`.
 * Tidak ada throw — rekor asing dilewati, rekor parsial mendapat fallback
 * string kosong (UI me-render judul kosong sebagai "Tanpa judul").
 */
export function normalizeHelpArticle(record: unknown): HelpArticle | null {
  if (typeof record !== "object" || record === null) return null
  const rec = record as Record<string, unknown>
  const id = pickString(rec, ["id", "slug"])
  const slug = pickString(rec, ["slug", "id"])
  const title = pickString(rec, ["title", "question", "name"])
  if (!id && !slug && !title) return null
  const content = pickString(rec, ["content", "answer", "body"])
  const category = pickString(rec, ["category", "categorySlug", "categoryName"])
  const views =
    typeof rec.views === "number" && Number.isFinite(rec.views) ? rec.views : undefined
  return {
    id: id ?? "",
    slug: slug ?? "",
    title: title ?? "",
    ...(content != null ? { content } : {}),
    ...(category != null ? { category } : {}),
    ...(views != null ? { views } : {}),
  }
}

/**
 * Item 120: daftar artikel dari kategori detail — kunci `articles` atau
 * `items`, tiap rekor dinormalisasi (backend help-center memakai `items`).
 */
export function normalizeHelpArticleList(record: unknown): HelpArticle[] {
  if (Array.isArray(record)) {
    return record.flatMap((item) => {
      const normalized = normalizeHelpArticle(item)
      return normalized ? [normalized] : []
    })
  }
  if (typeof record !== "object" || record === null) return []
  const rec = record as Record<string, unknown>
  const list = rec.articles ?? rec.items
  if (!Array.isArray(list)) return []
  return list.flatMap((item) => {
    const normalized = normalizeHelpArticle(item)
    return normalized ? [normalized] : []
  })
}

export function listHelpCategories(signal?: AbortSignal) {
  return http
    .get<
      HelpCategory[]
    >("/v1/help-center/categories", { query: { lang: "id" }, auth: "none", retry: 1, signal })
    .then((raw) => readList<HelpCategory>(raw, ["categories"]))
}

export function getHelpCategory(slug: string, signal?: AbortSignal) {
  return http
    .get<HelpCategoryDetail>(`/v1/help-center/categories/${seg(slug)}`, {
      query: { lang: "id" },
      auth: "none",
      retry: 1,
      signal,
    })
    .then((raw) => {
      const detail = readEntity<HelpCategoryDetail>(raw, "category")
      // Item 120: kunci `items` selain `articles` — normalisasi dari detail;
      // fallback ke raw mentah bila detail tidak membawa daftarnya.
      const articles = normalizeHelpArticleList(detail)
      return {
        ...detail,
        articles: articles.length > 0 ? articles : normalizeHelpArticleList(raw),
      }
    })
}

export function searchHelpArticles(query: string, signal?: AbortSignal) {
  return http
    .get<
      HelpArticle[] | { data: HelpArticle[]; meta?: unknown }
    >("/v1/help-center/search", { query: { q: query, lang: "id" }, auth: "none", retry: 1, signal })
    .then((raw) => {
      const list = readList<HelpArticle>(raw, ["articles"])
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
