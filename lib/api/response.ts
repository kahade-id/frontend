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

/** Explicit per-domain collection keys; an unknown shape is NOT an empty success. */
export function readList<T>(value: unknown, keys: readonly string[] = []): T[] {
  if (Array.isArray(value)) return value as T[]
  const record = asRecord(value)
  for (const key of [...keys, "items", "data"]) {
    if (Array.isArray(record?.[key])) return record[key] as T[]
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
