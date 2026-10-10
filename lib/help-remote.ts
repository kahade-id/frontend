/**
 * Kahade — penggabungan konten Pusat Bantuan: bundel (offline-first) +
 * backend (`/v1/help-center/*`).
 *
 * Audit Pengaturan & Bantuan 2026-10-10: layar FAQ dan detail artikel HANYA
 * membaca `lib/help-content.ts` (13 artikel statis). Artikel yang dikelola
 * tim lewat backend tidak pernah tampil, dan hasil pencarian global
 * (`GET /v1/search?types=help-center`) membuka `/help/[slug]` dengan id
 * backend → "Artikel tidak ditemukan". Modul murni ini (tanpa React/RN —
 * bisa diuji di vitest node) menyatukan kedua sumber:
 *
 *   - kategori: urutan bundel dipertahankan; kategori backend dengan slug
 *     sama DIGABUNG (artikel backend didahulukan, artikel bundel yang belum
 *     ada ditambahkan); kategori backend lain ditambahkan setelahnya.
 *   - artikel: dedup by id, lalu by slug.
 *   - pencarian: hasil bundel (instan) + hasil backend (saat online).
 *
 * Konten bundel tetap tampil saat offline/gagal — penggabungan hanya
 * MENAMBAH, tidak pernah menghilangkan panduan bawaan.
 */
import type { HelpArticle, HelpCategoryDetail } from "@/lib/api/help-center"

function articleKey(article: Pick<HelpArticle, "id" | "slug">): string {
  return article.id || article.slug
}

/** Gabungkan dua daftar artikel: `primary` menang; `secondary` hanya menambah. */
export function mergeHelpArticles(
  primary: readonly HelpArticle[],
  secondary: readonly HelpArticle[],
): HelpArticle[] {
  const seen = new Set<string>()
  const out: HelpArticle[] = []
  for (const article of [...primary, ...secondary]) {
    const key = articleKey(article)
    if (!key || seen.has(key)) continue
    const slugKey = article.slug && article.slug !== key ? article.slug : null
    if (slugKey && seen.has(slugKey)) continue
    seen.add(key)
    if (slugKey) seen.add(slugKey)
    out.push(article)
  }
  return out
}

/**
 * Gabungkan kategori bundel dengan kategori backend. `remote` boleh kosong /
 * undefined (offline) → hasil = bundel apa adanya.
 */
export function mergeHelpCategories(
  bundled: readonly HelpCategoryDetail[],
  remote: readonly HelpCategoryDetail[] | null | undefined,
): HelpCategoryDetail[] {
  if (!remote || remote.length === 0) return [...bundled]
  const remoteBySlug = new Map(remote.map((category) => [category.slug, category]))
  const merged: HelpCategoryDetail[] = bundled.map((category) => {
    const match = remoteBySlug.get(category.slug)
    if (!match) return category
    remoteBySlug.delete(category.slug)
    const articles = mergeHelpArticles(match.articles ?? [], category.articles ?? [])
    return {
      ...category,
      ...match,
      // Deskripsi backend boleh kosong — jangan menimpa teks bundel dengan "".
      description: match.description || category.description,
      articles,
      articleCount: articles.length,
    }
  })
  for (const category of remoteBySlug.values()) {
    const articles = category.articles ?? []
    merged.push({ ...category, articles, articleCount: articles.length })
  }
  return merged
}

/** Cari satu artikel (id atau slug) di daftar kategori gabungan. */
export function findHelpArticleIn(
  categories: readonly HelpCategoryDetail[],
  idOrSlug: string | undefined,
  categorySlug?: string,
): { article: HelpArticle; category: HelpCategoryDetail } | null {
  if (!idOrSlug) return null
  const scope = categorySlug
    ? categories.filter((category) => category.slug === categorySlug)
    : categories
  for (const category of scope) {
    const article = (category.articles ?? []).find(
      (item) => item.id === idOrSlug || item.slug === idOrSlug,
    )
    if (article) return { article, category }
  }
  return null
}
