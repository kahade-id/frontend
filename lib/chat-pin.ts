/**
 * Kahade — batas pin per ruang (audit chat E12, MURNI).
 *
 * Backend membatasi jumlah pesan terpin per ruang (`lib/api/chat.ts`: "maks per
 * room dibatasi backend"), tetapi kontraknya TIDAK menyebut angkanya maupun
 * kode galatnya (docs/api/openapi.json: respons 200 tanpa skema). Akibatnya
 * pin ke-N+1 dulu hanya berujung "Gagal mempin pesan" + pesan generik
 * ("Permintaan tidak valid") — pengguna tidak tahu BAHWA ada batas, apalagi
 * berapa.
 *
 * Tanpa mengubah kontrak, klien:
 *   1. mengenali penolakan "batas tercapai" dari kode/pesan/body galat
 *      (`classifyPinFailure`),
 *   2. menjelaskannya di UI ("Maksimal {x} pin per percakapan…"),
 *   3. MENGINGAT batas yang baru dipelajari selama sesi ruang itu, sehingga
 *      pin berikutnya yang pasti ditolak dijelaskan tanpa request dan tanpa
 *      kedipan optimistis.
 * Angka tidak pernah ditebak di muka: batas hanya dipakai setelah backend
 * benar-benar menolak. Rekomendasi kontrak yang menghapus tebakan ini ada di
 * docs/rekomendasi-backend-chat.md (bagian E).
 */

/**
 * Dipakai HANYA bila penolakan jelas soal batas tetapi angkanya tidak dapat
 * dibaca dari galat maupun dari jumlah pin saat ini (mis. daftar pin belum
 * termuat). Angka produk yang disepakati: 3.
 */
export const CHAT_PIN_LIMIT_FALLBACK = 3

export type PinFailure = { kind: "limit"; limit: number } | { kind: "other" }

/** Bentuk minimal galat API yang dibaca di sini (tanpa mengimpor kelas ApiError). */
type ErrorLike = {
  status?: number
  code?: string
  backendCode?: string
  message?: string
  validationMessages?: string[]
  raw?: unknown
}

/** Status/kode yang masuk akal untuk penolakan aturan bisnis. */
const BUSINESS_STATUSES = new Set([400, 409, 422])
const BUSINESS_CODES = new Set(["BAD_REQUEST", "VALIDATION", "CONFLICT", "UNPROCESSABLE"])

const LIMIT_WORDS =
  /(max|maks|limit|batas|penuh|too many|exceed|terlampaui|melebihi|lebih dari|cannot pin more|sudah \d+)/i

function bodyText(raw: unknown): string {
  if (typeof raw === "string") return raw
  if (raw && typeof raw === "object") {
    const rec = raw as Record<string, unknown>
    const parts: string[] = []
    for (const key of ["message", "error", "code", "errorCode", "detail"]) {
      const value = rec[key]
      if (typeof value === "string") parts.push(value)
      else if (Array.isArray(value)) parts.push(...value.filter((v): v is string => typeof v === "string"))
    }
    return parts.join(" ")
  }
  return ""
}

/**
 * Apakah galat ini penolakan "batas pin tercapai"? Mengembalikan batas bila
 * terbaca (angka dari kode/pesan/body), selain itu `null` di dalam `limit`.
 */
export function parsePinLimitError(err: unknown): { limit: number | null } | null {
  if (!err || typeof err !== "object") return null
  const e = err as ErrorLike
  if (e.code === "NETWORK" || e.code === "TIMEOUT" || e.code === "ABORTED") return null
  const businessStatus = e.status != null ? BUSINESS_STATUSES.has(e.status) : false
  const businessCode = e.code != null && BUSINESS_CODES.has(e.code)
  if (!businessStatus && !businessCode) return null

  const text = [
    e.backendCode ?? "",
    e.message ?? "",
    ...(e.validationMessages ?? []),
    bodyText(e.raw),
  ]
    .join(" ")
    .trim()
  if (!text) return null
  // Harus menyebut PIN (pin/pinned/disematkan/semat) dan sebuah kata batas.
  if (!/(pin|semat)/i.test(text) || !LIMIT_WORDS.test(text)) return null
  const limit = extractLimit(text)
  return { limit: limit != null && limit > 0 ? limit : null }
}

/**
 * Angka batas dari teks galat. Hanya angka yang BERKAITAN dengan batas yang
 * dibaca ("maksimal 3", "limit 3", "3 pesan terpin") — angka lain (kode status
 * "409", id) tidak boleh dianggap batas.
 */
function extractLimit(text: string): number | null {
  const nearWord =
    /(?:max(?:imum)?|maks(?:imal)?|limit|batas|hingga|up to|at most)\D{0,24}?(\d{1,3})(?!\d)/i.exec(
      text,
    )
  if (nearWord) return Number(nearWord[1])
  const beforeNoun =
    /(?:^|[^\d])(\d{1,3})\s*(?:pinned|pins?|pesan|messages?|disematkan|semat)/i.exec(text)
  if (beforeNoun) return Number(beforeNoun[1])
  return null
}

/**
 * Klasifikasikan kegagalan pin. `pinnedCount` = jumlah pin saat request
 * ditolak — bila galat tak memuat angka, itulah batasnya (penolakan terjadi
 * justru karena sudah penuh).
 */
export function classifyPinFailure(err: unknown, ctx: { pinnedCount: number }): PinFailure {
  const parsed = parsePinLimitError(err)
  if (!parsed) return { kind: "other" }
  const limit =
    parsed.limit ?? (ctx.pinnedCount > 0 ? ctx.pinnedCount : CHAT_PIN_LIMIT_FALLBACK)
  return { kind: "limit", limit }
}

/**
 * Perlu menolak pin SEBELUM request? Hanya bila batas sudah dipelajari dari
 * penolakan sebelumnya di ruang ini dan daftar pin sudah mencapainya.
 */
export function pinBlockedByKnownLimit(
  knownLimit: number | null,
  pinnedCount: number,
): boolean {
  return knownLimit != null && pinnedCount >= knownLimit
}
