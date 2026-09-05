import { readEntity, readList } from "@/lib/api/response"
/**
 * Kahade — domain `help-center` (4 endpoint publik-otentikasi).
 * Halaman FAQ: kategori → artikel → search.
 */
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
    .then((raw) => readEntity<HelpCategoryDetail>(raw, "category"))
}

export function searchHelpArticles(query: string, signal?: AbortSignal) {
  return http
    .get<
      HelpArticle[] | { data: HelpArticle[]; meta?: unknown }
    >("/v1/help-center/search", { query: { q: query, lang: "id" }, auth: "none", retry: 1, signal })
    .then((raw) => readList<HelpArticle>(raw, ["articles"]))
}

export function trackHelpArticleView(id: string) {
  return http.post<void>(`/v1/help-center/items/${seg(id)}/view`, undefined, { auth: "none" })
}
