/**
 * Kahade — pratinjau tautan (link preview) untuk bubble teks chat.
 *
 * Bila pesan berisi URL, bubble menampilkan kartu: judul, deskripsi, dan
 * thumbnail situs. Metadata dibaca sisi klien dari tag Open Graph
 * (`og:title`/`og:description`/`og:image`, fallback `<title>` + meta
 * description + ikon situs). Fetch hanya terjadi untuk pesan yang tampil
 * (komponen kartu me-mount saat bubble terlihat) dan hasilnya di-cache
 * per sesi supaya scroll naik-turun tidak mem-fetch ulang.
 *
 * Keputusan non-obvious:
 *   - RN `fetch` tidak kena CORS (aturan browser) — fetch HTML langsung bisa
 *     di native. Di web, situs tanpa header CORS akan gagal → kartu disembunyikan
 *     diam-diam (fallback = teks tautan biasa, bukan error).
 *   - HTML dibaca MAKSIMAL 300 KB (reader + abort) — halaman besar tidak boleh
 *     memakan memori hanya untuk 3 tag meta.
 *   - Parsing REGEX, bukan DOMParser: cukup untuk meta tag di `<head>` dan
 *     jalan identik di native + web tanpa dependensi baru.
 *   - Hanya `https:` yang di-fetch (URL http/malformed → null, tanpa fetch).
 *   - Kegagalan apa pun → null (kartu tidak tampil). Link preview adalah
 *     PELENGKAP — tidak boleh menampilkan error di bubble chat.
 */
import { safeHttpsLink } from "@/lib/external-url"

export type LinkPreviewData = {
  url: string
  siteName?: string
  title?: string
  description?: string
  image?: string
}

/** Maksimum body HTML yang dibaca untuk mencari meta tag (300 KB). */
export const LINK_PREVIEW_MAX_BYTES = 300 * 1024
/** Batas waktu fetch metadata (10 detik). */
export const LINK_PREVIEW_TIMEOUT_MS = 10_000
/** Batas entri cache sesi (evict oldest). */
const PREVIEW_CACHE_MAX = 100

/**
 * Ambil URL http(s) PERTAMA dari teks. Tanda baca penutup (`).,;:!?"'`) yang
 * menempel di ujung dipangkas — pola umum saat URL diketik di akhir kalimat.
 */
export function extractFirstUrl(text: string | null | undefined): string | null {
  if (typeof text !== "string" || !text.includes("http")) return null
  const match = /https?:\/\/[^\s<>"']+/i.exec(text)
  if (!match) return null
  // Pangkas tanda baca penutup yang menempel (tapi pertahankan `)` bila
  // seimbang — mis. URL Wikipedia `...(disambiguasi)`).
  let url = match[0]
  while (/[.,;:!?"'\]}>]+$/.test(url)) url = url.slice(0, -1)
  let depth = 0
  for (const ch of url) {
    if (ch === "(") depth += 1
    if (ch === ")") depth -= 1
  }
  while (url.endsWith(")") && depth < 0) {
    url = url.slice(0, -1)
    depth += 1
  }
  return url || null
}

function metaContent(html: string, attr: "property" | "name", key: string): string | undefined {
  // Dua urutan atribut umum: <meta property="og:title" content="…"> dan
  // <meta content="…" property="og:title">.
  const patterns = [
    new RegExp(`<meta[^>]*${attr}=["']${key}["'][^>]*content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*${attr}=["']${key}["']`, "i"),
  ]
  for (const re of patterns) {
    const m = re.exec(html)
    if (m?.[1]?.trim()) return decodeEntities(m[1].trim())
  }
  return undefined
}

function titleTag(html: string): string | undefined {
  const m = /<title[^>]*>([^<]{1,200})<\/title>/i.exec(html)
  return m?.[1] ? decodeEntities(m[1].trim()) : undefined
}

/** Decode entity HTML umum di nilai meta (tanpa DOMParser). */
export function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Parse metadata Open Graph dari HTML (murni, di-unit-test).
 * `baseUrl` dipakai menyelesaikan `og:image` relatif → absolut.
 */
export function parseOpenGraph(html: string, baseUrl: string): Omit<LinkPreviewData, "url"> {
  const head = html.slice(0, LINK_PREVIEW_MAX_BYTES)
  const title =
    metaContent(head, "property", "og:title") ??
    metaContent(head, "name", "twitter:title") ??
    titleTag(head)
  const description =
    metaContent(head, "property", "og:description") ??
    metaContent(head, "name", "twitter:description") ??
    metaContent(head, "name", "description")
  const siteName = metaContent(head, "property", "og:site_name")
  const rawImage =
    metaContent(head, "property", "og:image") ?? metaContent(head, "name", "twitter:image")
  let image: string | undefined
  if (rawImage) {
    try {
      const resolved = new URL(rawImage, baseUrl).toString()
      if (resolved.startsWith("https://")) image = resolved
    } catch {
      // URL gambar rusak → abaikan (kartu tanpa thumbnail).
    }
  }
  const out: Omit<LinkPreviewData, "url"> = {}
  if (title) out.title = title.slice(0, 140)
  if (description) out.description = description.slice(0, 220)
  if (siteName) out.siteName = siteName.slice(0, 60)
  if (image) out.image = image
  return out
}

/** Cache sesi: URL → hasil (null = gagal/tidak ada metadata). */
const previewCache = new Map<string, LinkPreviewData | null>()
/** Fetch yang sedang berjalan — URL sama tidak di-fetch ganda. */
const previewInflight = new Map<string, Promise<LinkPreviewData | null>>()

/** Kosongkan cache (dipakai tes). */
export function clearLinkPreviewCache(): void {
  previewCache.clear()
  previewInflight.clear()
}

function cacheSet(url: string, value: LinkPreviewData | null): void {
  if (previewCache.size >= PREVIEW_CACHE_MAX) {
    const oldest = previewCache.keys().next().value
    if (oldest !== undefined) previewCache.delete(oldest)
  }
  previewCache.set(url, value)
}

/**
 * Fetch + parse metadata tautan. TIDAK PERNAH melempar — gagal = null
 * (kartu preview tidak tampil, teks tautan tetap bisa diketuk).
 */
export function fetchLinkPreview(rawUrl: string): Promise<LinkPreviewData | null> {
  const url = safeHttpsLink(rawUrl)
  if (!url) return Promise.resolve(null)
  const cached = previewCache.get(url)
  if (cached !== undefined) return Promise.resolve(cached)
  const inflight = previewInflight.get(url)
  if (inflight) return inflight

  const job = (async (): Promise<LinkPreviewData | null> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), LINK_PREVIEW_TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "text/html" },
        // Redirect diikuti default; batasi manual tidak didukung RN fetch.
      })
      const contentType = res.headers.get("content-type") ?? ""
      if (!res.ok || !/text\/html/i.test(contentType)) return null
      // Baca maksimal 300 KB via reader (jangan `res.text()` utuh).
      const reader = res.body?.getReader?.()
      let html: string
      if (reader) {
        const chunks: Uint8Array[] = []
        let received = 0
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          if (value) {
            chunks.push(value)
            received += value.length
            if (received >= LINK_PREVIEW_MAX_BYTES) {
              try {
                await reader.cancel()
              } catch {
                // Abaikan — body sudah cukup.
              }
              break
            }
          }
        }
        const merged = new Uint8Array(received)
        let offset = 0
        for (const c of chunks) {
          merged.set(c, offset)
          offset += c.length
        }
        html = new TextDecoder("utf-8", { fatal: false }).decode(merged)
      } else {
        // Fallback runtime tanpa reader (respons kecil saja yang aman).
        const text = await res.text()
        html = text.slice(0, LINK_PREVIEW_MAX_BYTES)
      }
      const meta = parseOpenGraph(html, url)
      if (!meta.title && !meta.description && !meta.image) return null
      let siteName = meta.siteName
      if (!siteName) {
        try {
          siteName = new URL(url).hostname.replace(/^www\./, "")
        } catch {
          siteName = undefined
        }
      }
      return { url, ...meta, siteName }
    } catch {
      return null
    } finally {
      clearTimeout(timer)
      previewInflight.delete(url)
    }
  })()

  previewInflight.set(url, job)
  void job.then((result) => cacheSet(url, result))
  return job
}
