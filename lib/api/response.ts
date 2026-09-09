import { ApiError, DEFAULT_ERROR_MESSAGES, parseErrorBody } from "@/lib/api/errors"

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
      if (Array.isArray(item) && !NON_COLLECTION_KEYS.has(key)) return item as T[]
    }
  }
  throw invalidResponse(`collection:${keys.join("|")}`)
}

export type Page<T> = {
  data: T[]
  meta: { page: number; limit: number; total?: number; totalPages: number }
}

export function readPage<T>(
  value: unknown,
  query: { page?: number; limit?: number },
  keys: readonly string[] = [],
): Page<T> {
  const data = readList<T>(value, keys)
  const record = asRecord(value)
  const meta = asRecord(record?.meta) ?? asRecord(record?.pagination)
  const page = numberOr(meta?.page, query.page ?? 1, 1)
  const limit = numberOr(meta?.limit, query.limit ?? (data.length || 1), 1)
  const total = numberOr(meta?.total, Number.NaN)
  // If the server supplies no pagination metadata, don't claim there are no
  // further records on a full page. The next empty page establishes the end.
  const totalPages = numberOr(
    meta?.totalPages ?? meta?.total_pages,
    Number.isFinite(total) ? Math.ceil(total / limit) : page + Number(data.length >= limit),
  )
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
  for (const key of ["user", "data", "profile", "target", "account"]) {
    const nested = pickString(asRecord(record[key]), ["id", "userId", "user_id", "_id", "uid"])
    if (nested) return nested
  }
  return ""
}
