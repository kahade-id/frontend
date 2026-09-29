/**
 * Kahade — status ketersediaan Bantuan Langsung (batch 139, item F05).
 *
 * CTA "Mulai percakapan" sebelumnya tampak selalu siap meski agen offline.
 * Sekarang layar menampilkan: jam layanan, status buka/tutup (dihitung dari
 * jam perangkat, zona Asia/Jakarta), dan alternatif "buat tiket" saat tutup.
 *
 * Keterbatasan jujur: backend BELUM punya endpoint status ketersediaan agen
 * (tidak ada informasi antrean real-time dari server), jadi status dihitung
 * dari JADWAL LAYANAN yang dipublikasikan — diberi label "jadwal", bukan
 * "agen online". Bila endpoint tersedia nanti, modul ini tempat yang tepat
 * untuk menggabungkannya (graceful: jadwal tetap jadi fallback).
 */

/** Jadwal layanan Bantuan Langsung (WIB / Asia_Jakarta). */
export const LIVE_SUPPORT_SCHEDULE = {
  /** Hari buka: 1=Senin … 6=Sabtu (0=Minggu tutup). */
  openDays: [1, 2, 3, 4, 5, 6] as const,
  /** Senin–Jumat. */
  weekdayOpenHour: 8,
  weekdayCloseHour: 20,
  /** Sabtu. */
  saturdayOpenHour: 9,
  saturdayCloseHour: 17,
} as const

export type LiveSupportAvailability =
  | { open: true; closesAt: string; queueHint: string }
  | { open: false; reason: "outside_hours" | "sunday"; opensAt: string; queueHint: string }

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"] as const

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

function hourLabel(h: number): string {
  return `${pad2(h)}:00`
}

/**
 * TIM 8 (perf, P2): instance `Intl.DateTimeFormat` di-cache lazy di module
 * scope — `getLiveSupportAvailability` dipanggil per render app/faq.tsx dan
 * tadinya membangun formatter baru tiap panggilan. `formatToParts` aman
 * dipakai ulang.
 */
let availabilityFormatter: Intl.DateTimeFormat | null = null

function getAvailabilityFormatter(): Intl.DateTimeFormat {
  if (!availabilityFormatter) {
    availabilityFormatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
  }
  return availabilityFormatter
}

/**
 * Hitung ketersediaan dari `now` (default: sekarang). Waktu dikonversi ke
 * Asia/Jakarta via Intl agar benar di perangkat berzona lain.
 */
export function getLiveSupportAvailability(now: Date = new Date()): LiveSupportAvailability {
  const parts = getAvailabilityFormatter().formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
  // weekday short en-GB: "Mon".."Sun"
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"))
  const hour = Number.parseInt(get("hour"), 10)

  const queueHint =
    "Antrean real-time belum tersedia — pesan Anda tetap tercatat dan dibalas Tim Kahade sesuai urutan."
  if (wd === 0) {
    return { open: false, reason: "sunday", opensAt: `Senin ${hourLabel(LIVE_SUPPORT_SCHEDULE.weekdayOpenHour)} WIB`, queueHint }
  }
  const isSaturday = wd === 6
  const openH = isSaturday ? LIVE_SUPPORT_SCHEDULE.saturdayOpenHour : LIVE_SUPPORT_SCHEDULE.weekdayOpenHour
  const closeH = isSaturday ? LIVE_SUPPORT_SCHEDULE.saturdayCloseHour : LIVE_SUPPORT_SCHEDULE.weekdayCloseHour
  if (hour >= openH && hour < closeH) {
    return { open: true, closesAt: `${hourLabel(closeH)} WIB`, queueHint }
  }
  if (hour < openH) {
    return {
      open: false,
      reason: "outside_hours",
      opensAt: `${DAY_NAMES[wd]} ${hourLabel(openH)} WIB`,
      queueHint,
    }
  }
  // Setelah jam tutup → buka berikutnya.
  const nextDay = wd === 6 ? "Senin" : "besok"
  const nextOpen = wd === 6 ? LIVE_SUPPORT_SCHEDULE.weekdayOpenHour : openH
  return {
    open: false,
    reason: "outside_hours",
    opensAt: `${nextDay} ${hourLabel(nextOpen)} WIB`,
    queueHint,
  }
}

/** Ringkasan jadwal untuk ditampilkan ("Senin–Jumat 08:00–20:00 WIB, Sabtu 09:00–17:00 WIB"). */
export function liveSupportScheduleSummary(): string {
  const s = LIVE_SUPPORT_SCHEDULE
  return `Senin–Jumat ${hourLabel(s.weekdayOpenHour)}–${hourLabel(s.weekdayCloseHour)} WIB · Sabtu ${hourLabel(s.saturdayOpenHour)}–${hourLabel(s.saturdayCloseHour)} WIB · Minggu tutup`
}
