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
}

/**
 * Bangun pesan pengumuman status hasil pencarian.
 * Urutan prioritas mengikuti render app/search.tsx: error > loading >
 * kosong > jumlah hasil.
 */
export function buildResultMessage({ enabled, error, loading, count }: SearchResultMessageInput): string {
  if (!enabled || loading) return ""
  if (error) return error
  if (count === 0) return translate("Tidak ada hasil")
  return translate("{x} hasil ditemukan", { x: formatNumber(count) })
}
