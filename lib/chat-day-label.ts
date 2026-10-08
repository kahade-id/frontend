/**
 * Kahade — kunci & label pemisah hari thread chat (audit chat G18, MURNI).
 *
 * "Hari ini" / "Kemarin" / "12 Sep 2026" — konvensi yang sama dengan riwayat
 * dompet. Dipindah dari komponen supaya (a) bisa diuji dengan `now` yang
 * disuntikkan (dulu tanpa satu pun test), dan (b) label bisa DIHITUNG ULANG
 * saat hari berganti: label dihitung sekali per perubahan pesan, jadi ruang
 * yang dibiarkan terbuka melewati tengah malam terus menulis "Hari ini" untuk
 * pesan kemarin. `msUntilNextLocalMidnight` memberi tahu layar kapan harus
 * menghitung ulang.
 *
 * Semua perhitungan memakai hari KALENDER LOKAL perangkat — bukan UTC
 * (`toISOString().slice(0, 10)` menganggap percakapan pukul 06.00 WIB
 * "kemarin") dan bukan selisih 24 jam (pukul 00.30 vs 23.30 hari sebelumnya
 * adalah "kemarin", bukan "hari ini").
 */
import { formatDate } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"

const DAY_MS = 86_400_000

/** Kunci hari lokal (tanpa jam); "" untuk tanggal tak valid. */
export function dayKey(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

const startOfLocalDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

/** Label manusia untuk satu hari: "Hari ini" / "Kemarin" / "12 Sep 2026". */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return formatDate(iso)
  // Math.round: pergantian DST (di zona yang memilikinya) membuat selisih
  // hari kalender 23/25 jam — tetap dihitung 1 hari.
  const diffDays = Math.round((startOfLocalDay(now) - startOfLocalDay(d)) / DAY_MS)
  if (diffDays === 0) return translate("Hari ini")
  if (diffDays === 1) return translate("Kemarin")
  return formatDate(d)
}

/**
 * Milidetik sampai tengah malam lokal berikutnya (+1 dtk toleransi) — dipakai
 * layar untuk menjadwalkan penghitungan ulang label. Selalu > 0.
 */
export function msUntilNextLocalMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
  return Math.max(1_000, next - now.getTime() + 1_000)
}
