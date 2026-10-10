/**
 * Kahade — helper UI pencarian (dipakai app/search.tsx).
 *
 * `buildResultMessage` membangun kalimat status hasil untuk <LiveRegion>
 * pengumuman screen reader. Props yang tidak dirender lewat <Text> (LiveRegion
 * meneruskan `message` sebagai string) harus diterjemahkan eksplisit lewat
 * `translate()` — lihat temuan UI-M005.
 */
import { formatNumber } from "@/lib/format"
import { translate } from "@/lib/i18n"

export interface SearchResultMessageInput {
  /** Apakah query pencarian aktif (scope dipilih & kata kunci valid). */
  enabled: boolean
  /** Pesan error pencarian (sudah dalam bahasa aktif), bila ada. */
  error?: string | null
  /** Apakah sedang memuat. */
  loading: boolean
  /** Jumlah baris hasil yang sedang ditampilkan. */
  count: number
  /** AP-01: offline tanpa cache — bukan "tidak ada hasil". */
  offline?: boolean
}

/**
 * Bangun pesan pengumuman status hasil pencarian.
 * Urutan prioritas mengikuti render app/search.tsx: error > loading >
 * kosong > jumlah hasil.
 */
export function buildResultMessage({ enabled, error, loading, count, offline }: SearchResultMessageInput): string {
  if (!enabled || loading) return ""
  if (offline) return translate("Tidak ada koneksi internet")
  if (error) return error
  if (count === 0) return translate("Tidak ada hasil")
  return translate("{x} hasil ditemukan", { x: formatNumber(count) })
}

/**
 * Batch 139 E08 — "Mungkin maksud Anda" yang tidak memaksa.
 *
 * Dari daftar saran backend, pilih kandidat ejaan terdekat sebagai PILIHAN
 * (chip yang diketuk), bukan pengganti otomatis. Aturan:
 *   - kandidat yang sama persis dengan keyword (case-insensitive) dibuang —
 *     menawarkan kata yang sama bukan koreksi;
 *   - urutan backend dipertahankan (peringkat relevansi);
 *   - dibatasi `max` agar tidak menjadi daftar saran kedua.
 */
export function pickDidYouMean(
  keyword: string,
  suggestions: readonly string[],
  max = 3,
): string[] {
  const base = keyword.trim().toLowerCase()
  if (!base) return []
  const out: string[] = []
  for (const s of suggestions) {
    const candidate = s.trim()
    if (!candidate || candidate.toLowerCase() === base) continue
    if (out.some((o) => o.toLowerCase() === candidate.toLowerCase())) continue
    out.push(candidate)
    if (out.length >= max) break
  }
  return out
}

/**
 * Batch 139 E09 — empty state berbeda per cakupan pencarian.
 *
 * Pesan kosong generik tidak menjelaskan JENIS apa yang tidak ditemukan;
 * tiap tab mendapat judul + saran tindak lanjut yang sesuai dengan
 * sumber datanya.
 */
export type SearchScopeKey = "all" | "users" | "posts" | "orders" | "transactions" | "chats"

export function getSearchEmptyStateCopy(scope: SearchScopeKey): {
  title: string
  description: string
} {
  switch (scope) {
    case "users":
      return {
        title: translate("Tidak ada pengguna ditemukan"),
        description: translate(
          "Periksa ejaan nama pengguna, atau coba nama lengkapnya.",
        ),
      }
    case "posts":
      return {
        title: translate("Tidak ada postingan ditemukan"),
        description: translate(
          "Coba kata kunci yang lebih umum, atau hapus filter lokasi.",
        ),
      }
    case "orders":
      return {
        title: translate("Tidak ada pesanan ditemukan"),
        description: translate(
          "Pencarian pesanan mencocokkan judul dan ID — coba potongan kata yang lebih pendek.",
        ),
      }
    case "transactions":
      return {
        title: translate("Tidak ada mutasi ditemukan"),
        // S-59 (audit Search 2026-10-10, batch 2): backend hanya mencocokkan
        // keterangan & ID transaksi — "nominal" dijanjikan padahal tidak dicari.
        description: translate("Coba keterangan atau ID transaksi yang berbeda."),
      }
    case "chats":
      return {
        title: translate("Tidak ada pesan ditemukan"),
        description: translate(
          "Pencarian pesan hanya mencakup percakapan Anda — coba kata yang pernah dikirim.",
        ),
      }
    case "all":
    default:
      return {
        title: translate("Tidak ada hasil"),
        description: translate(
          "Coba kata kunci yang lebih spesifik, atau persempit ke satu cakupan.",
        ),
      }
  }
}
