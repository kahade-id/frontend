/**
 * Kahade — helper tautan di bio profil publik (Batch 139, E04).
 *
 * Murni (tanpa React): pecah teks bio menjadi segmen teks/tautan, dan ambil
 * domain dari URL untuk pratinjau. Layar memakai ini untuk me-render URL di
 * bio sebagai tautan yang menampilkan DOMAIN tujuan (bukan URL mentah yang
 * panjang/menyesatkan), lalu meminta konfirmasi eksplisit sebelum membuka
 * tautan eksternal.
 *
 * Keputusan non-obvious:
 *   - Hanya skema http/https yang dianggap tautan — skema lain (javascript:,
 *     data:, dsb.) diperlakukan sebagai teks biasa (anti-XSS/phishing).
 *   - URL tanpa skema ("kahade.id/x") TIDAK di-linkify: menebak skema bisa
 *     salah arah; pengguna harus menulis http(s):// agar menjadi tautan.
 *   - Domain dinormalisasi: huruf kecil, tanpa "www.", tanpa port, tanpa
 *     kredensial userinfo — yang tampil adalah identitas situs sebenarnya.
 */

export type BioSegment =
  | { kind: "text"; text: string }
  | { kind: "link"; url: string; domain: string }

const URL_RE = /https?:\/\/[^\s<>"'()[\]{}|\\^`]+/gi

/** Karakter trailing yang hampir pasti bukan bagian URL (tanda baca kalimat). */
const TRAILING_PUNCT_RE = /[.,;:!?)"'\]}>]+$/

/**
 * Ambil domain tampilan dari URL. Gagal parse / skema asing → null (segmen
 * tetap teks biasa).
 */
export function getUrlDomain(rawUrl: string): string | null {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null
  let host = url.hostname.toLowerCase()
  if (!host) return null
  if (host.startsWith("www.")) host = host.slice(4)
  return host
}

/**
 * Pecah teks bio menjadi segmen. URL yang valid → segmen `link` (dengan
 * domain pratinjau); sisanya → segmen `text`.
 */
export function extractBioSegments(text: string): BioSegment[] {
  const segments: BioSegment[] = []
  let cursor = 0
  URL_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = URL_RE.exec(text)) !== null) {
    const raw = match[0]
    // Pangkas tanda baca kalimat di ujung ("Kunjungi https://x.id.") agar
    // tidak ikut menjadi bagian tautan; ia kembali sebagai teks biasa.
    const url = raw.replace(TRAILING_PUNCT_RE, "")
    const start = match.index
    if (start > cursor) {
      segments.push({ kind: "text", text: text.slice(cursor, start) })
    }
    const domain = getUrlDomain(url)
    if (domain) {
      segments.push({ kind: "link", url, domain })
    } else {
      // Bukan URL yang aman di-linkify — kembalikan sebagai teks biasa.
      segments.push({ kind: "text", text: url })
    }
    cursor = start + url.length
  }
  if (cursor < text.length) {
    segments.push({ kind: "text", text: text.slice(cursor) })
  }
  return segments.filter((s) => (s.kind === "text" ? s.text.length > 0 : true))
}

/** true bila bio mengandung setidaknya satu tautan yang bisa di-linkify. */
export function bioHasLinks(text: string): boolean {
  return extractBioSegments(text).some((s) => s.kind === "link")
}
