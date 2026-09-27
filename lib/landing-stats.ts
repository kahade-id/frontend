/**
 * Kahade landing — statistik publik.
 *
 * KONTRAK BACKEND — **BELUM ADA, PERLU DIBUAT** (tim backend):
 *   GET {API_BASE_URL}/v1/public/stats
 *   - Publik, TANPA auth
 *   - Rate-limited (disarankan per-IP, mis. 60 req/menit)
 *   - Response 200 JSON, semua field opsional, angka finite >= 0:
 *     { "transactionsCount": 12840, "usersCount": 5320,
 *       "citiesCount": 27, "ratingAvg": 4.8 }
 *
 * `fetchPublicStats()` tidak pernah throw: semua kegagalan (network, non-2xx,
 * timeout ~8 dtk, JSON invalid, tidak ada angka valid) → `null`. UI wajib
 * menampilkan placeholder jujur saat hasilnya null — jangan pernah
 * menampilkan angka palsu.
 */
// Import langsung dari modul config (bukan barrel @/lib/api) agar tidak
// menarik seluruh lapisan API beserta dependensi native-nya.
import { API_BASE_URL } from "@/lib/api/config"

export type PublicStats = {
  transactionsCount?: number
  usersCount?: number
  citiesCount?: number
  ratingAvg?: number
}

const STATS_TIMEOUT_MS = 8000

/** Angka valid: finite dan >= 0. Field tak valid diabaikan (bukan error). */
function validStatNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined
  return value
}

/**
 * Parser murni dari body JSON — bisa di-unit-test tanpa network.
 * Return null bila tidak ada satu pun angka valid.
 */
export function parsePublicStats(json: unknown): PublicStats | null {
  if (json == null || typeof json !== "object" || Array.isArray(json)) return null
  const data = json as Record<string, unknown>
  const stats: PublicStats = {
    transactionsCount: validStatNumber(data.transactionsCount),
    usersCount: validStatNumber(data.usersCount),
    citiesCount: validStatNumber(data.citiesCount),
    ratingAvg: validStatNumber(data.ratingAvg),
  }
  const hasAnyValid = Object.values(stats).some((v) => v !== undefined)
  return hasAnyValid ? stats : null
}

/**
 * Ambil statistik publik. Hanya dipanggil di web (lihat stats.tsx).
 * Tidak pernah throw — gagal dalam bentuk apa pun → null.
 */
export async function fetchPublicStats(): Promise<PublicStats | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), STATS_TIMEOUT_MS)
  try {
    const response = await fetch(`${API_BASE_URL}/v1/public/stats`, {
      signal: controller.signal,
    })
    if (!response.ok) return null
    return parsePublicStats(await response.json())
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
