/**
 * Kahade — agregasi TAMPILAN notifikasi sosial (like/follow) di klien.
 *
 * Notifikasi sejenis yang berurutan & dekat waktunya digabung menjadi satu
 * baris, mis. "Budi dan 12 lainnya menyukai karya Anda" alih-alih 13 baris
 * like terpisah. MURNI agregasi tampilan: tidak mengubah API contract,
 * struktur data server, atau status baca per item (tap grup menandai semua
 * anggotanya dibaca lewat endpoint batch yang sudah ada).
 *
 * ATURAN KEAMANAN (zero tolerance, produk keuangan):
 *  - Allowlist tipe EKSPLISIT: hanya "SHOWCASE_LIKE" dan "USER_FOLLOW".
 *    Tipe transaksi/keuangan (ORDER_*, WALLET_*, MILESTONE_*, DISPUTE_*,
 *    TOPUP_*, WITHDRAW_*, VOUCHER_*, CAMPAIGN_*, SECURITY_*, KYC_*, …)
 *    TIDAK PERNAH digabung — tiap transaksi tetap baris sendiri.
 *  - Hanya notifikasi BELUM DIBACA yang digabung ("N baru"). Yang sudah
 *    dibaca tetap baris sendiri supaya status baca tidak ambigu.
 *
 * Syarat gabung (daftar diasumsikan terurut terbaru-di-atas):
 *  - berurutan langsung, tipe sama, target referensi sama
 *    (referenceType + referenceId — mis. karya yang sama),
 *  - selisih waktu antar item berurutan ≤ 24 jam ("dekat waktunya"),
 *  - minimal 2 item (1 item = baris tunggal biasa).
 *
 * CATATAN BACKEND (2026-09-28): enum `NotificationType` di backend (prisma)
 * saat ini BELUM memiliki tipe like/follow — tidak ada notifikasi
 * "menyukai"/"mengikuti" yang dikirim server. Modul ini DORMANT sampai
 * backend menambahkannya; saat tipe itu muncul, daftar otomatis teragregasi
 * tanpa perubahan kode. Test memakai data sintetis.
 */
import { translate } from "@/lib/i18n/translate"
import type { AppNotification } from "@/lib/api/notifications"

/**
 * Satu-satunya tipe yang boleh digabung. Daftar eksplisit (bukan pola
 * sufiks/awalan) supaya tipe baru yang tidak dikenal tidak pernah ikut
 * tergabung secara diam-diam.
 */
export const GROUPABLE_NOTIFICATION_TYPES: ReadonlySet<string> = new Set([
  "SHOWCASE_LIKE",
  "USER_FOLLOW",
])

/** Jendela "dekat waktunya" antar item berurutan dalam satu grup. */
export const SOCIAL_GROUP_WINDOW_MS = 24 * 3600_000

export type NotificationRow =
  | { kind: "single"; /** = item.id — untuk keyExtractor PaginatedList. */ id: string; item: AppNotification }
  | { kind: "group"; /** "group:<id item terbaru>" — stabil & unik. */ id: string; items: AppNotification[] }

/** Id stabil untuk keyExtractor — tinggal `row.id`. */
export function notificationRowId(row: NotificationRow): string {
  return row.id
}

/** Baris pertama (terbaru) tiap baris — untuk header hari & divider. */
export function notificationRowHead(row: NotificationRow): AppNotification {
  return row.kind === "single" ? row.item : row.items[0]
}

export function isGroupableNotification(n: AppNotification): boolean {
  return (
    n.type != null &&
    GROUPABLE_NOTIFICATION_TYPES.has(n.type) &&
    !n.isRead
  )
}

function sameTarget(a: AppNotification, b: AppNotification): boolean {
  return (
    (a.referenceType ?? "") === (b.referenceType ?? "") &&
    (a.referenceId ?? "") === (b.referenceId ?? "")
  )
}

function withinWindowEpoch(ta: number, tb: number): boolean {
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return false
  return Math.abs(ta - tb) <= SOCIAL_GROUP_WINDOW_MS
}

/**
 * Daftar (terbaru-di-atas) → baris tampilan. Murni & sinkron — aman dipakai
 * di `useMemo` layar.
 */
export function groupSocialNotifications(items: AppNotification[]): NotificationRow[] {
  const rows: NotificationRow[] = []
  let pending: AppNotification[] = []

  // TIM 8 (perf, P2): epoch-ms dihitung SEKALI per item di awal —
  // versi lama mem-parse `createdAt` ulang (`new Date(...).getTime()`)
  // untuk tiap pasangan yang dibandingkan di `withinWindow`.
  const epochMs = new Map<AppNotification, number>()
  const epochOf = (n: AppNotification): number => {
    let ms = epochMs.get(n)
    if (ms === undefined) {
      ms = new Date(n.createdAt).getTime()
      epochMs.set(n, ms)
    }
    return ms
  }

  const flush = () => {
    if (pending.length >= 2) {
      rows.push({ kind: "group", id: `group:${pending[0].id}`, items: pending })
    } else {
      for (const item of pending) rows.push({ kind: "single", id: item.id, item })
    }
    pending = []
  }

  for (const item of items) {
    const last = pending[pending.length - 1]
    if (
      last != null &&
      isGroupableNotification(item) &&
      isGroupableNotification(last) &&
      item.type === last.type &&
      sameTarget(item, last) &&
      withinWindowEpoch(epochOf(item), epochOf(last))
    ) {
      pending.push(item)
    } else {
      flush()
      pending = [item]
    }
  }
  flush()
  return rows
}

// ------------------------------------------------------------------
// Label grup
// ------------------------------------------------------------------

/** Sufiks judul versi server → dipisah jadi {aktor} + {sufiks}. */
const LIKE_SUFFIXES = [
  " menyukai karya Anda",
  " menyukai etalase Anda",
  " menyukai postingan Anda",
]
const FOLLOW_SUFFIXES = [" mulai mengikuti Anda", " mengikuti Anda"]

function splitActor(
  title: string,
  suffixes: readonly string[],
): { actor: string; suffix: string } | null {
  for (const suffix of suffixes) {
    if (title.endsWith(suffix)) {
      const actor = title.slice(0, title.length - suffix.length).trim()
      if (actor) return { actor, suffix }
    }
  }
  return null
}

/**
 * "Budi dan 12 lainnya menyukai karya Anda". Bila nama aktor tidak bisa
 * dipisah dari judul server (template tak dikenal), jatuh ke label generik
 * "{n} suka baru di karya Anda" — tidak pernah mengarang nama.
 */
export function describeSocialGroup(type: string, items: AppNotification[]): string {
  const n = items.length
  const first = items[0]
  if (type === "SHOWCASE_LIKE") {
    const split = splitActor(first.title, LIKE_SUFFIXES)
    if (split) {
      return n === 1
        ? first.title
        : translate("{name} dan {count} lainnya{suffix}", {
            name: split.actor,
            count: n - 1,
            suffix: split.suffix,
          })
    }
    return translate("{n} suka baru di karya Anda", { n })
  }
  if (type === "USER_FOLLOW") {
    const split = splitActor(first.title, FOLLOW_SUFFIXES)
    if (split) {
      return n === 1
        ? first.title
        : translate("{name} dan {count} lainnya{suffix}", {
            name: split.actor,
            count: n - 1,
            suffix: split.suffix,
          })
    }
    return translate("{n} pengikut baru", { n })
  }
  return first.title
}
