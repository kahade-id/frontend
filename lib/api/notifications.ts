/**
 * Kahade — domain `notifications` (tag "notifications" di kahade-api-mobile.json).
 *
 * Saat ini HANYA endpoint yang dipakai kerangka navigasi (badge unread di
 * Bottom Tab Bar). List, read, read-all, preferences, dst ditambahkan saat
 * screen Notifikasi (antrian #5) dibangun — mengikuti aturan "jangan
 * implementasi yang belum dipakai" (lihat users.ts).
 *
 * Semua endpoint `security: access-token` → `auth: "required"`.
 *
 * Kontrak dari spec:
 *   GET /v1/notifications/unread-count
 *     query `category` — di spec ditandai `required: true`, `type: string`,
 *     TANPA enum dan TANPA nilai "semua". Enum kategori yang ada di spec
 *     hanya muncul di `GET /v1/notifications` (`TRANSAKSI|PROMOSI|INFORMASI`).
 *     Response 200 tanpa schema.
 *
 * Keputusan non-obvious (ASUMSI — cocokkan dengan backend):
 *   1. `category` dibuat OPSIONAL di sini. Bentuk spec ini adalah pola khas
 *      NestJS `@Query('category') category?: string` tanpa `@ApiQuery({
 *      required: false })` — Swagger menandainya required padahal controller
 *      menerima undefined. Badge tab butuh TOTAL semua kategori, dan tidak
 *      ada nilai enum untuk "semua"; mengirim 3 request per kategori lalu
 *      menjumlahkan = 3× beban per poll. Bila backend ternyata menolak (400),
 *      tambahkan nilai "ALL" atau fallback penjumlahan di SATU tempat:
 *      `readUnreadCount()` + `getUnreadCount()`.
 *   2. Bentuk response tidak ada di spec → `readUnreadCount()` toleran
 *      terhadap beberapa penamaan umum (`{count}`, `{unreadCount}`,
 *      `{unread}`, `{data:{…}}`, atau angka polos). Mengembalikan `null`
 *      bila tidak ada yang cocok — pemanggil memperlakukannya sebagai
 *      "tidak diketahui", BUKAN 0, supaya badge tidak salah hilang.
 */
import { http } from "@/lib/api/client"

/** Enum kategori — persis `GET /v1/notifications` query `category`. */
export type NotificationCategory = "TRANSAKSI" | "PROMOSI" | "INFORMASI"

/** Response `GET /v1/notifications/unread-count` — UNVERIFIED (spec tanpa schema). */
export type UnreadCountResult =
  | number
  | {
      count?: number
      unreadCount?: number
      unread?: number
      data?: { count?: number; unreadCount?: number; unread?: number }
    }

/**
 * GET /v1/notifications/unread-count — jumlah notifikasi belum dibaca.
 * Tanpa `category` = total (asumsi #1 di header file). `retry: 1` karena GET
 * idempoten dan dipanggil berulang di latar (poll) — toleran jaringan seluler.
 */
export function getUnreadCount(category?: NotificationCategory) {
  return http.get<UnreadCountResult>("/v1/notifications/unread-count", {
    query: { category },
    auth: "required",
    retry: 1,
  })
}

/** Normalisasi body unread-count → angka ≥ 0, atau `null` bila bentuknya tak dikenal. */
export function readUnreadCount(body: UnreadCountResult | undefined | null): number | null {
  if (typeof body === "number") return clamp(body)
  if (typeof body !== "object" || body === null) return null
  const candidates = [body.count, body.unreadCount, body.unread, body.data?.count, body.data?.unreadCount, body.data?.unread]
  const found = candidates.find((v): v is number => typeof v === "number" && Number.isFinite(v))
  return found === undefined ? null : clamp(found)
}

function clamp(n: number): number {
  return Math.max(0, Math.trunc(n))
}
