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

export function listHelpCategories() {
  return http.get<HelpCategory[]>("/v1/help-center/categories", { auth: "required", retry: 1 })
}

export function getHelpCategory(slug: string) {
  return http.get<HelpCategoryDetail>(`/v1/help-center/categories/${seg(slug)}`, {
    auth: "required",
    retry: 1,
  })
}

export function searchHelpArticles(query: string) {
  return http.get<HelpArticle[] | { data: HelpArticle[]; meta?: unknown }>(
    "/v1/help-center/search",
    { query: { q: query }, auth: "required", retry: 1 },
  )
}

export function trackHelpArticleView(id: string) {
  return http.post<void>(`/v1/help-center/items/${seg(id)}/view`, undefined, { auth: "required" })
}
