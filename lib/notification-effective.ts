/**
 * Kahade — ringkasan & status efektif preferensi notifikasi (FE-IMP-3).
 *
 * Fungsi murni (tanpa react-native) untuk dua improvement pengaturan:
 *  - #91: status kanan baris "Notifikasi" di Pengaturan — "N dari 7 jenis
 *    aktif", atau "Senyap 22:00–07:00" bila quiet hours menyala.
 *  - #94: status efektif gabungan per jenis notifikasi (perangkat + server)
 *    di layar Preferensi Notifikasi — kanal Push yang ON di server tidak
 *    "efektif" bila izin notifikasi perangkat mati.
 *
 * Struktur kategori × kanal mengikuti CATEGORY_CHANNELS di
 * components/ui/notification-preferences-matrix.tsx (sumber kebenaran bentuk
 * DTO); disalin di sini agar layer lib tidak mengimpor komponen UI.
 */
import { translate } from "@/lib/i18n/translate"

export const NOTIFICATION_CATEGORY_CHANNELS = {
  order: ["InApp", "Push", "Email"],
  wallet: ["InApp", "Push", "Email"],
  security: ["InApp", "Push", "Email"],
  dispute: ["InApp", "Push", "Email"],
  chat: ["InApp", "Push"],
  ranking: ["InApp", "Push"],
  marketing: ["InApp", "Push", "Email"],
} as const

export type NotificationCategory = keyof typeof NOTIFICATION_CATEGORY_CHANNELS
export type NotificationChannel = "InApp" | "Push" | "Email"
export type NotificationPreferenceKey = `${NotificationCategory}${NotificationChannel}`

export type NotificationPrefsLike = Partial<Record<NotificationPreferenceKey, boolean>> & {
  quietHoursEnabled?: boolean
  quietHoursStart?: string
  quietHoursEnd?: string
}

export const NOTIFICATION_CATEGORY_COUNT = Object.keys(
  NOTIFICATION_CATEGORY_CHANNELS,
).length

/**
 * #91 — ringkasan satu baris untuk status kanan baris "Notifikasi".
 *  - Quiet hours aktif → "Senyap 22:00–07:00" (mendapat prioritas: itulah
 *    status yang paling menjelaskan kenapa notifikasi "sepi").
 *  - Selain itu → "N dari 7 jenis aktif" (jenis = kategori dengan ≥1 kanal ON).
 *  - `null` bila preferensi belum dimuat / tidak ada kunci yang dikenal —
 *    pemanggil tidak menampilkan trailing sama sekali, bukan "0 dari 7"
 *    yang menyesatkan.
 */
export function summarizeNotificationPreferences(
  prefs: NotificationPrefsLike | null | undefined,
): string | null {
  if (!prefs) return null
  if (prefs.quietHoursEnabled) {
    const start =
      typeof prefs.quietHoursStart === "string" && prefs.quietHoursStart
        ? prefs.quietHoursStart
        : "22:00"
    // Audit 2026-10-10: bawaan backend (schema.prisma `quietHoursEnd
    // @default("07:00")` & computeQuietHoursActive) adalah 07:00, bukan 06:00.
    const end =
      typeof prefs.quietHoursEnd === "string" && prefs.quietHoursEnd
        ? prefs.quietHoursEnd
        : "07:00"
    return `Senyap ${start}–${end}`
  }
  const categories = Object.keys(NOTIFICATION_CATEGORY_CHANNELS) as NotificationCategory[]
  let known = false
  let active = 0
  for (const cat of categories) {
    let catActive = false
    for (const ch of NOTIFICATION_CATEGORY_CHANNELS[cat]) {
      const v = prefs[`${cat}${ch}`]
      if (typeof v !== "boolean") continue
      known = true
      if (v) catActive = true
    }
    if (catActive) active += 1
  }
  if (!known) return null
  return `${active} dari ${NOTIFICATION_CATEGORY_COUNT} jenis aktif`
}

export const EFFECTIVE_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  InApp: "di aplikasi",
  Push: "push",
  Email: "email",
}

export type EffectiveStatus = {
  /** Kanal yang benar-benar akan mengantar (server ON + tidak terhalang perangkat). */
  effective: NotificationChannel[]
  /** true bila Push ON di server tapi izin notifikasi perangkat mati. */
  pushBlockedByDevice: boolean
}

/**
 * #94 — status efektif gabungan per jenis notifikasi (perangkat + server).
 *
 * `devicePushGranted`: hasil baca izin notifikasi perangkat saat ini
 * (true/false), atau `null` bila tidak diketahui / platform tidak mendukung —
 * `null` TIDAK memblokir (hanya `false` eksplisit yang menandai tertahan),
 * supaya status tidak menuduh perangkat yang belum sempat dicek.
 */
export function effectiveNotificationStatus(
  category: NotificationCategory,
  prefs: Partial<Record<NotificationPreferenceKey, boolean>>,
  devicePushGranted: boolean | null,
): EffectiveStatus {
  const effective: NotificationChannel[] = []
  let pushBlockedByDevice = false
  for (const ch of NOTIFICATION_CATEGORY_CHANNELS[category]) {
    const serverOn = prefs[`${category}${ch}`] === true
    if (!serverOn) continue
    if (ch === "Push" && devicePushGranted === false) {
      pushBlockedByDevice = true
      continue
    }
    effective.push(ch)
  }
  return { effective, pushBlockedByDevice }
}

/**
 * Caption satu baris dari {@link EffectiveStatus} untuk tiap kategori.
 *
 * Audit 2026-10-10: dirangkai lewat `translate` — template literal dengan
 * potongan non-angka ("Efektif: di aplikasi, push") tidak pernah cocok
 * dengan bentuk katalog, jadi caption ini selalu Indonesia untuk pengguna
 * English. Nama kanal diterjemahkan satu per satu.
 */
export function formatEffectiveStatus(status: EffectiveStatus): string {
  const parts = status.effective.map((ch) => translate(EFFECTIVE_CHANNEL_LABELS[ch]))
  const base =
    parts.length > 0
      ? translate("Efektif: {x}", { x: parts.join(", ") })
      : translate("Tidak ada kanal aktif")
  return status.pushBlockedByDevice
    ? translate("{x} · Push tertahan: izin perangkat mati", { x: base })
    : base
}
