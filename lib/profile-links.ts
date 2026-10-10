/**
 * Kahade — tautan profil (helper murni, unit-testable).
 *
 * Satu tempat untuk tiga hal yang sebelumnya tersebar / tidak ada:
 *
 *  1. `normalizeProfileLinks` — membaca `links` dari payload
 *     GET /v1/users/{username} (bentuk backend: array `{id, platform, url,
 *     label, displayOrder}` di bagian `links`). Bug yang dilaporkan pengguna
 *     ("link di profil tidak muncul padahal punya link"): backend SUDAH
 *     mengirim field ini, tetapi frontend tidak pernah membaca maupun
 *     merendernya. Normalizer ini fail-closed: hanya URL https yang valid
 *     yang lolos (sama dengan aturan `safeHttpsLink`), duplikat platform
 *     dibuang, urutan mengikuti `displayOrder`.
 *
 *  2. `normalizeSocialLinkInput` — menyamakan input editor dengan KONTRAK
 *     backend `PUT /v1/users/me/links` (update-links.dto.ts: `@IsUrl({
 *     protocols: ['https'] })`, service menolak non-https dengan
 *     INVALID_SOCIAL_LINK_URL). Editor lama menerima `http://` dan nomor
 *     telepon untuk WhatsApp, lalu backend menolak 400 saat simpan —
 *     pengguna melihat "Profil tersimpan, tautan sosial gagal disimpan"
 *     tanpa tahu sebabnya. Kini: nomor WhatsApp → `https://wa.me/<digit>`,
 *     tautan tanpa skema → diberi `https://`, `http://` tetap ditolak.
 *
 *  3. `isValidSocialLinkInput` — validasi klien yang HASILNYA sama dengan
 *     yang akan diterima backend setelah normalisasi (bukan heuristik yang
 *     lebih longgar dari server).
 */
import { getUrlDomain } from "@/lib/bio-links"
import { safeHttpsLink } from "@/lib/external-url"

export type ProfileLink = {
  id?: string
  platform: string
  url: string
  label?: string | null
  displayOrder?: number
}

/** Jumlah tautan yang tampil di baris ringkas bawah bio (sisanya "+N"). */
export const PROFILE_LINKS_COMPACT_LIMIT = 3

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/**
 * Baca daftar tautan dari payload profil publik. Menerima array langsung
 * atau amplop `{ links: [...] }` (bentuk GET /v1/users/me/links).
 */
export function normalizeProfileLinks(raw: unknown): ProfileLink[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(asRecord(raw)?.links)
      ? (asRecord(raw)!.links as unknown[])
      : []
  const seen = new Set<string>()
  const out: ProfileLink[] = []
  for (const entry of list) {
    const row = asRecord(entry)
    if (!row) continue
    const platform = typeof row.platform === "string" ? row.platform.trim().toLowerCase() : ""
    const url = typeof row.url === "string" ? safeHttpsLink(row.url.trim()) : undefined
    if (!platform || !url || seen.has(platform)) continue
    seen.add(platform)
    const label = typeof row.label === "string" && row.label.trim() ? row.label.trim() : null
    const order =
      typeof row.displayOrder === "number" && Number.isFinite(row.displayOrder)
        ? row.displayOrder
        : out.length
    out.push({
      ...(typeof row.id === "string" ? { id: row.id } : {}),
      platform,
      url,
      label,
      displayOrder: order,
    })
  }
  return out.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
}

/** Domain tujuan untuk ditampilkan (tanpa `www.`), atau null bila bukan http(s). */
export function profileLinkDomain(link: Pick<ProfileLink, "url">): string | null {
  return getUrlDomain(link.url)
}

/**
 * Teks yang tampil untuk satu tautan: label pemilik bila ada, selain itu
 * domain tujuan (jujur — bukan URL mentah panjang, bukan nama platform
 * generik yang menyembunyikan tujuan sebenarnya).
 */
export function profileLinkText(link: Pick<ProfileLink, "url" | "label" | "platform">): string {
  if (link.label && link.label.trim()) return link.label.trim()
  return profileLinkDomain(link) ?? link.platform
}

const WA_NUMBER_RE = /^\+?\d[\d\s().-]{6,20}$/

/**
 * Normalisasi input editor → URL yang DITERIMA backend (https wajib).
 * Mengembalikan string apa adanya (sudah di-trim) bila tidak bisa
 * dinormalisasi — validasi di bawah yang akan menandainya salah.
 */
export function normalizeSocialLinkInput(platform: string, rawUrl: string): string {
  const value = rawUrl.trim()
  if (!value) return value
  if (platform === "whatsapp" && WA_NUMBER_RE.test(value)) {
    let digits = value.replace(/\D/g, "")
    // Nomor lokal Indonesia `08xx` → format internasional `628xx` (wa.me
    // hanya menerima nomor internasional tanpa `+`).
    if (digits.startsWith("0")) digits = `62${digits.slice(1)}`
    return `https://wa.me/${digits}`
  }
  if (/^https:\/\//i.test(value)) return value
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return value // skema lain (http, ftp) → biarkan, ditolak validasi
  return `https://${value}`
}

/** Valid = setelah normalisasi menjadi URL https ber-host (aturan backend). */
export function isValidSocialLinkInput(platform: string, rawUrl: string): boolean {
  const normalized = normalizeSocialLinkInput(platform, rawUrl)
  const safe = safeHttpsLink(normalized)
  if (!safe) return false
  // Host harus mengandung titik (mis. `instagram.com`), kecuali wa.me yang
  // sudah pasti punya titik — menolak `https://budi` yang jelas salah ketik.
  const host = getUrlDomain(safe)
  return host != null && host.includes(".")
}
