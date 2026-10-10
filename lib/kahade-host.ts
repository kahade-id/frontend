/**
 * Kahade — pengenal host milik Kahade (audit Pesan 2026-10-10).
 *
 * Satu tempat untuk pertanyaan "apakah URL ini milik kami?" — dipakai gerbang
 * pratinjau berkas (WebView hanya untuk berkas dari host Kahade) dan gerbang
 * pratinjau tautan (kartu OG hanya untuk tautan Kahade pada pesan masuk).
 *
 * Aturan: `https:` saja, tanpa kredensial di URL, host = `kahade.id` atau
 * subdomainnya (`cdn.kahade.id`, `api.kahade.id`, …). `kahade.id.evil.com`
 * BUKAN milik kami (pencocokan sufiks dengan titik, bukan `includes`).
 */
import { PUBLIC_WEB_HOST } from "@/lib/deeplinks"

export function isKahadeHostname(hostname: string | null | undefined): boolean {
  if (typeof hostname !== "string") return false
  const host = hostname.trim().toLowerCase()
  return host === PUBLIC_WEB_HOST || host.endsWith(`.${PUBLIC_WEB_HOST}`)
}

/** True bila `value` adalah URL https milik Kahade (tanpa kredensial). */
export function isKahadeHttpsUrl(value: unknown): boolean {
  if (typeof value !== "string" || !value.trim()) return false
  try {
    const url = new URL(value)
    if (url.protocol !== "https:") return false
    if (url.username || url.password) return false
    return isKahadeHostname(url.hostname)
  } catch {
    return false
  }
}
