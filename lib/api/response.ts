/**
 * Paksa field response menjadi array string, apa pun bentuk yang dikirim
 * backend.
 *
 * Kode cadangan 2FA adalah contoh yang paling merugikan: `BackupCodes` hanya
 * DI-CAST dari JSON, dan bila nilainya bukan array, `codes.filter(...)` /
 * `codes.map(...)` di <BackupCodesDisplay> melempar TypeError tepat setelah
 * pengguna mengaktifkan 2FA — saat kode itu BELUM sempat disalin. Layar
 * pecah di momen yang tidak bisa diulang (kode hanya ditampilkan sekali).
 * Dikosongkan supaya layar tetap merender langkah berikutnya.
 */

import { ApiError, DEFAULT_ERROR_MESSAGES, parseErrorBody } from "@/lib/api/errors"
import { logWarn } from "@/lib/telemetry"

export function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function invalidResponse(context: string): ApiError {
  return new ApiError({ code: "PARSE", message: DEFAULT_ERROR_MESSAGES.PARSE, path: context })
}

/** Confirmed against api.kahade.id on 2026-09-05. Do not unwrap ordinary paginated {data,meta}. */
export function unwrapResponse(value: unknown): unknown {
  const body = asRecord(value)
  if (!body || typeof body.success !== "boolean" || !("data" in body)) return value
  if (!body.success) {
    const parsed = parseErrorBody(body)
    throw new ApiError({
      code: "BAD_REQUEST",
      message: parsed.message ?? DEFAULT_ERROR_MESSAGES.BAD_REQUEST,
      backendCode: parsed.backendCode,
      validationMessages: parsed.validationMessages,
      raw: value,
    })
  }
  // Mutation endpoints can return only a human-readable acknowledgement.
  return body.data ?? (typeof body.message === "string" ? { message: body.message } : null)
}

/** Kunci yang bukan koleksi data, meski isinya array. */
const NON_COLLECTION_KEYS = new Set([
  "meta",
  "pagination",
  "paging",
  "errors",
  "validationMessages",
  "facets",
  "counts",
])

/**
 * Ambil array dari respons list.
 *
 * Urutan: kunci eksplisit domain → `items` → `data` → **array pertama** yang
 * bukan metadata.
 *
 * Fallback terakhir itu ditambahkan karena cacat nyata: spec tidak
 * mendokumentasikan bentuk respons list mana pun (lihat
 * docs/audit/API-ENDPOINT-AUDIT.md API-06), jadi tiap `keys` di `lib/api/*`
 * adalah tebakan. Begitu backend memakai nama lain — `{ blockedUsers: [...] }`
 * vs `{ users: [...] }` — versi lama melempar dan SELURUH layar list mati dengan
 * "Respons tidak dapat dibaca", padahal datanya ada di depan mata.
 *
 * Ini tetap bukan "kosong berarti sukses": bila tidak ada array sama sekali,
 * error tetap dilempar.
 */
export function readList<T>(value: unknown, keys: readonly string[] = []): T[] {
  if (Array.isArray(value)) return value as T[]
  const record = asRecord(value)
  for (const key of [...keys, "items", "data"]) {
    if (Array.isArray(record?.[key])) return record[key] as T[]
  }
  if (record) {
    for (const [key, item] of Object.entries(record)) {
      if (Array.isArray(item) && !NON_COLLECTION_KEYS.has(key)) {
        /**
         * C-06 (audit): fallback ini memilih "array pertama yang bukan
         * metadata" — pada respons seperti `{ users: [...], recommendations:
         * [...] }` hasilnya ditentukan URUTAN KUNCI, bukan domain. `keys`
         * eksplisit menghindarinya; jalur rapuh ini harus terlihat di
         * telemetri agar nama kunci yang salah ketik cepat ketahuan, bukan
         * diam-diam menampilkan koleksi yang salah.
         */
        logWarn("api:list-fallback", { keys: keys.join("|"), picked: key })
        return item as T[]
      }
    }
  }
  throw invalidResponse(`collection:${keys.join("|")}`)
}

export type Page<T> = {
  data: T[]
  meta: { page: number; limit: number; total?: number; totalPages: number }
}

/** Kunci paginasi yang boleh dibaca dari root respons (C-07). */
const PAGINATION_KEYS = [
  "page",
  "limit",
  "perPage",
  "per_page",
  "total",
  "totalPages",
  "total_pages",
  "hasNext",
  "has_next",
  "hasPrev",
  "has_prev",
] as const

function pickKeys(
  record: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  const picked: Record<string, unknown> = {}
  for (const key of keys) if (key in record) picked[key] = record[key]
  return picked
}

export function readPage<T>(
  value: unknown,
  query: { page?: number; limit?: number },
  keys: readonly string[] = [],
): Page<T> {
  const data = readList<T>(value, keys)
  const record = asRecord(value)
  // Sebagian endpoint (mis. GET /v1/orders) mengirim paginasi di TINGKAT ATAS
  // — {orders, total, page, limit} — bukan di `meta`. Tanpa fallback ini
  // `meta.total` selalu undefined dan penghitung di UI (Beranda dkk.) stuck 0.
  //
  // C-07 (audit): fallback tingkat-atas dulu menerima SELURUH record, padahal
  // field domain bernama `page`, `limit`, atau `total` cukup umum (invoice,
  // dokumen legal) — nilainya bisa terbaca sebagai metadata paginasi. Sekarang
  // hanya kunci paginasi yang dikenal yang diambil dari root.
  const root = asRecord(record)
  const meta =
    asRecord(record?.meta) ??
    asRecord(record?.pagination) ??
    (root && PAGINATION_KEYS.some((key) => key in root) ? pickKeys(root, PAGINATION_KEYS) : null)
  const page = numberOr(meta?.page, query.page ?? 1, 1)
  const limit = numberOr(meta?.limit, query.limit ?? (data.length || 1), 1)
  const total = numberOr(meta?.total, Number.NaN)
  // If the server supplies no pagination metadata, don't claim there are no
  // further records on a full page. The next empty page establishes the end.
  //
  // C-05 (audit): dua penajaman pada jalur tanpa metadata —
  //   - halaman KOSONG selalu berarti berhenti (sebelumnya, bila server
  //     memakai `limit` sendiri yang lebih kecil dari yang kita kirim, halaman
  //     terakhir bisa "penuh" menurut perhitungan kita dan `hasMore` terus
  //     true → request kosong tambahan tiap kali);
  //   - `limit` tidak lagi ditebak dari panjang data (`query.limit ?? (data.length
  //     || 1)`) untuk perhitungan halaman; bila pemanggil tidak mengirim limit,
  //     halaman penuh dianggap "mungkin masih ada" (aman: satu request kosong
  //     lalu berhenti) alih-alih "berhenti" (item tak terjangkau).
  const explicitLimit = typeof query.limit === "number" && query.limit > 0 ? query.limit : undefined
  const reportedTotalPages = meta?.totalPages ?? meta?.total_pages
  let totalPages: number
  if (typeof reportedTotalPages !== "undefined") {
    totalPages = numberOr(reportedTotalPages, 1, 1)
  } else if (Number.isFinite(total)) {
    totalPages = Math.ceil(total / (explicitLimit ?? limit))
  } else if (data.length === 0) {
    totalPages = page
  } else {
    totalPages = page + Number(explicitLimit ? data.length >= explicitLimit : true)
  }
  return {
    data,
    meta: { page, limit, total: Number.isFinite(total) ? total : undefined, totalPages },
  }
}

function numberOr(value: unknown, fallback: number, minimum = 0): number {
  const number = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value
  return typeof number === "number" && Number.isSafeInteger(number) && number >= minimum
    ? number
    : fallback
}

export function readEntity<T>(value: unknown, key: string): T {
  const record = asRecord(value)
  const entity = asRecord(record?.[key]) ?? record
  if (!entity) throw invalidResponse(key)
  return entity as T
}

/**
 * Baca flag boolean dari beberapa nama alias, dan kembalikan `undefined` bila
 * backend tidak mengirim field itu sama sekali.
 *
 * Kenapa `undefined` penting (bukan `false`): `kycVerified !== true` di
 * <TransferRecipientPicker> dulu membuat SEMUA penerima nonaktif setiap kali
 * backend tidak menyertakan field-nya — transfer tidak bisa dilakukan ke siapa
 * pun. "Tidak tahu" bukan "tidak". Pemanggil yang butuh keputusan biner harus
 * menuliskan fallback-nya sendiri secara eksplisit.
 */
export function pickBoolean(
  record: Record<string, unknown> | null | undefined,
  keys: readonly string[],
): boolean | undefined {
  if (!record) return undefined
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "boolean") return value
    if (value === "true") return true
    if (value === "false") return false
  }
  return undefined
}

/** String pertama yang bukan kosong dari beberapa nama field. */
export function pickString(
  record: Record<string, unknown> | null | undefined,
  keys: readonly string[],
): string | undefined {
  if (!record) return undefined
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return undefined
}

/**
 * Angka pertama yang masuk akal dari beberapa nama field (D-04 audit).
 *
 * Dipakai menggantikan pola `typed.camelCase ?? (x as any).snake_case` di
 * adapter: nilainya tetap diperiksa runtime, tetapi TIDAK ada lagi cast yang
 * mematikan pemeriksaan tipe di lapisan yang menyentuh uang.
 *
 * SENGAJA ketat `typeof === "number"` (tanpa koersi string): nilai yang
 * bentuknya salah harus terlihat sebagai `undefined` di pemanggil — bukan
 * diam-diam "diperbaiki" di sini. Koersi longgar di jalur uang pernah membuat
 * bug tidak terdeteksi; kalau suatu endpoint memang mengirim string numerik,
 * itu tempat yang tepat untuk menuliskannya eksplisit di adapter.
 */
export function pickNumber(
  record: Record<string, unknown> | null | undefined,
  keys: readonly string[],
): number | undefined {
  if (!record) return undefined
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
  }
  return undefined
}

/**
 * Nilai apa pun yang pertama ADA (bukan undefined/null) — pilihan terakhir
 * ketika bentuknya memang tak bisa dipastikan (mis. array kode cadangan yang
 * panjangnya bervariasi). Sengaja tidak melakukan cast: pemanggil yang
 * menaruh hasilnya ke tipe tertentu wajib memvalidasi sendiri (mis. lewat
 * `stringList`), sehingga lubang tipe tidak ikut berpindah tempat.
 */
export function pickUnknown(
  record: Record<string, unknown> | null | undefined,
  keys: readonly string[],
): unknown {
  if (!record) return undefined
  for (const key of keys) {
    const value = record[key]
    if (value !== undefined && value !== null) return value
  }
  return undefined
}

/**
 * Baca "verdict" boolean dari respons + kembalikan record-nya untuk field lain.
 *
 * Kelas cacat yang ditutup helper ini: beberapa endpoint menjawab dengan flag
 * (`{ valid }`, `{ favorited }`, `{ status }`) dan UI mengambil keputusan dari
 * flag itu. Bila nama fieldnya berbeda dari tebakan, nilainya `undefined` dan
 * UI menyimpulkan yang paling merugikan — voucher "tidak berlaku", PIN "salah",
 * favorit "tidak aktif". Karena spec tidak mendokumentasikan bentuk respons
 * mana pun, tiap adapter wajib menyebut aliasnya di sini, bukan me-*cast*.
 *
 * `fallback` dipakai HANYA bila tidak ada satu pun alias yang dikirim backend.
 */
export function readVerdict(
  value: unknown,
  keys: readonly string[],
  fallback: boolean,
): { value: boolean; record: Record<string, unknown> } {
  const record = asRecord(value) ?? {}
  const nested = asRecord(record.data) ?? asRecord(record.result)
  const flag = pickBoolean(record, keys) ?? pickBoolean(nested, keys)
  return { value: flag ?? fallback, record: nested ? { ...record, ...nested } : record }
}

/**
 * Ambil identifier user dari bentuk respons apa pun: `id`, `userId`, `_id`,
 * atau satu tingkat bersarang di bawah `user`/`data`/`profile`/`target`.
 *
 * Dipakai untuk aksi yang path-nya memakai `{userId}` (blokir, laporkan)
 * sementara layar profil publik hanya punya username. Mengembalikan `""` bila
 * tidak ditemukan — pemanggil WAJIB memeriksa, jangan mengirim `""` ke server.
 */
export function pickUserId(value: unknown): string {
  const record = asRecord(value)
  if (!record) return ""
  const direct = pickString(record, ["id", "userId", "user_id", "_id", "uid"])
  if (direct) return direct
  // `identity` = bagian bersarang respons `GET /v1/users/{username}` versi
  // baru (identity.userId = "USR-XXXX" — satu-satunya id publik yang dipakai
  // endpoint blokir/lapor modul users). Tanpa key ini `profile.id` kosong dan
  // Blokir/Laporkan jatuh ke fallback username yang pasti ditolak
  // (400 "Invalid ID format" / "targetId must be a valid ID").
  for (const key of ["user", "data", "profile", "target", "account", "identity"]) {
    const nested = pickString(asRecord(record[key]), ["id", "userId", "user_id", "_id", "uid"])
    if (nested) return nested
  }
  return ""
}
