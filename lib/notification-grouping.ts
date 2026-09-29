/**
 * Kahade — pengelompokan notifikasi per hari kalender WIB (murni, tanpa render).
 *
 * Dipakai layar tab Notifikasi untuk header grup "Hari ini" / "Kemarin" /
 * tanggal. Zona WIB dipakai (bukan zona perangkat) supaya hari yang tampil
 * sama untuk semua user — pola yang sama dengan pengelompokan riwayat dompet
 * (WF-026) dan `WIB_TIME_ZONE` di lib/format: backend bekerja di Asia/Jakarta.
 *
 * Logika tanggal TIDAK diduplikasi dari lib/format — bagian WIB diambil dari
 * `WIB_TIME_ZONE`, pelabelan dari `formatDate`/`formatDateLong`.
 */
import { formatDate, formatDateLong, WIB_TIME_ZONE } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"

export type NotificationDayGroup = {
  /** Kunci stabil untuk perbandingan ("2026-9-27"); "invalid" bila createdAt tak valid. */
  key: string
  /** "Hari ini" / "Kemarin" / "Sabtu, 27 September 2026" / "Tanggal tidak tersedia". */
  label: string
  /** "27 Sep 2026" untuk Hari ini/Kemarin; null untuk tanggal penuh/invalid. */
  sub: string | null
}

const DAY_MS = 86_400_000

/**
 * TIM 8 (perf, P0): instance formatter di-cache lazy di module scope —
 * `wibCalendarDay` dipanggil 3× per `notificationDayGroup`, yang tadinya
 * membangun `Intl.DateTimeFormat` baru tiap panggilan (≈ 9× per baris
 * notifikasi per render). `formatToParts` aman dipakai ulang.
 */
let wibDayFormatter: Intl.DateTimeFormat | null = null

function getWibDayFormatter(): Intl.DateTimeFormat {
  if (!wibDayFormatter) {
    wibDayFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: WIB_TIME_ZONE,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    })
  }
  return wibDayFormatter
}

/**
 * Hari kalender WIB dari sebuah Date — kunci grup + Date "tengah malam lokal".
 * Date tengah-malam-lokal HANYA untuk pelabelan (formatDateLong/formatDate
 * membaca bagian kalender lokalnya, yang identik dengan bagian WIB yang
 * diekstrak di sini) — bukan cap waktu.
 */
function wibCalendarDay(d: Date): { key: string; date: Date } | null {
  try {
    const parts = getWibDayFormatter().formatToParts(d)
    const value = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? NaN)
    const year = value("year")
    const month = value("month")
    const day = value("day")
    if (![year, month, day].every(Number.isFinite)) return null
    return { key: `${year}-${month}-${day}`, date: new Date(year, month - 1, day) }
  } catch {
    return null
  }
}

/**
 * Grup hari untuk satu `createdAt` (ISO). `now` bisa disuntik test supaya
 * "Hari ini"/"Kemarin" deterministik.
 */
export function notificationDayGroup(
  createdAt: string | null | undefined,
  now: Date = new Date(),
): NotificationDayGroup {
  const parsed = createdAt ? new Date(createdAt) : null
  const wib = parsed != null && !Number.isNaN(parsed.getTime()) ? wibCalendarDay(parsed) : null
  if (wib == null) {
    return { key: "invalid", label: translate("Tanggal tidak tersedia"), sub: null }
  }
  const todayKey = wibCalendarDay(now)?.key ?? null
  const yesterdayKey = wibCalendarDay(new Date(now.getTime() - DAY_MS))?.key ?? null
  if (todayKey != null && wib.key === todayKey) {
    return { key: wib.key, label: translate("Hari ini"), sub: formatDate(wib.date) }
  }
  if (yesterdayKey != null && wib.key === yesterdayKey) {
    return { key: wib.key, label: translate("Kemarin"), sub: formatDate(wib.date) }
  }
  return { key: wib.key, label: formatDateLong(wib.date), sub: null }
}
