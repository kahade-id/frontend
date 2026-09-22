/**
 * Kahade — domain `search` (pencarian global + saran).
 */

import { asRecord, readEntity, invalidResponse, readList } from "@/lib/api/response"

import { http } from "@/lib/api/client"
import { normalizeOrder, type Order } from "@/lib/api/orders"
import type { UserProfile } from "@/lib/api/users"
import type { WalletTransaction } from "@/lib/api/wallet"

export type GlobalSearchResults = {
  users?: UserProfile[]
  orders?: Array<Order>
  transactions?: WalletTransaction[]
  articles?: Array<{ id: string; slug: string; title: string; snippet?: string }>
  total?: number
}

export function globalSearch(
  query: { q: string; types?: string; limit?: number },
  signal?: AbortSignal,
) {
  return http
    .get<unknown>("/v1/search", {
      // Production accepts only users, orders, and transactions. An empty
      // `types` query is rejected with SEARCH_INVALID_TYPES.
      query: { types: "users,orders,transactions", limit: 20, ...query },
      auth: "required",
      retry: 1,
      signal,
    })
    .then((raw) => {
      const result = readEntity<Record<string, unknown>>(raw, "results")
      if (![result.users, result.orders, result.transactions, result.articles].some(Array.isArray))
        throw invalidResponse("search.results")
      return {
        ...result,
        users: (Array.isArray(result.users) ? result.users : []).map((item) => {
          const user = item as Record<string, unknown>
          return {
            ...user,
            id: String(user.id ?? user.userId ?? ""),
            verified: user.verified ?? user.isKycVerified,
          }
        }),
        orders: (Array.isArray(result.orders) ? result.orders : []).map((item) =>
          normalizeOrder(item as Order & Record<string, unknown>),
        ),
        transactions: (Array.isArray(result.transactions) ? result.transactions : []).map((item) => {
          const transaction = item as Record<string, unknown>
          return {
            ...transaction,
            id: String(transaction.id ?? transaction.txId ?? ""),
            referenceId: transaction.referenceId ?? transaction.reference_id,
          } as WalletTransaction
        }),
      } as GlobalSearchResults
    })
}

/**
 * GET /v1/search/suggestions — saran kata kunci (spec menandai `q` dan `limit`
 * sebagai REQUIRED).
 *
 * Audit: sebelumnya hanya `q` yang dikirim. Saudaranya di berkas ini
 * (`globalSearch`) sudah mengirim `limit: 20` untuk endpoint sejenis, jadi
 * ketidakhadiran `limit` di sini adalah selisih yang tidak disengaja. Disamakan
 * agar keduanya konsisten terhadap kontrak spec.
 */
export function getSearchSuggestions(
  query: { q: string; limit?: number },
  signal?: AbortSignal,
) {
  return http
    .get<unknown>("/v1/search/suggestions", {
      query: { limit: 20, ...query },
      auth: "required",
      retry: 1,
      signal,
    })
    .then((raw) => readSuggestionList(readList<unknown>(raw, ["suggestions"])))
}

/**
 * Paksa tiap item saran menjadi string biasa.
 *
 * BUG NYATA (bukan hardening spekulatif): versi lama memakai
 * `readList<string>()` yang hanya MENG-CAST — tidak ada pemeriksaan runtime.
 * Bila backend mengirim objek (`[{ "query": "bpjs" }]`, bentuk yang sama
 * dipakai endpoint riwayat di berkas ini) alih-alih string polos, objek itu
 * lolos sampai ke `<Chip key={s}>{s}</Chip>` di layar Pencarian. React lalu
 * melempar "Objects are not valid as a React child" dan SELURUH layar jatuh
 * ke ErrorBoundary ("Halaman tidak dapat ditampilkan") begitu saran pertama
 * tiba — persis setelah pengguna menekan Enter.
 *
 * `stringList()` di `lib/api/response.ts` diciptakan untuk kelas bug ini
 * (kasus `BackupCodes`), tetapi hanya menerima string polos; di sini bentuk
 * objek ikut dinormalkan seperti `getSearchHistory()` sudah lakukan, supaya
 * saran tetap tampil alih-alih dibuang diam-diam.
 */
export function readSuggestionList(rows: readonly unknown[]): string[] {
  const out: string[] = []
  for (const row of rows) {
    if (typeof row === "string") {
      const text = row.trim()
      if (text) out.push(text)
      continue
    }
    const record = asRecord(row)
    if (!record) continue
    const text = [
      record.query,
      record.suggestion,
      record.text,
      record.value,
      record.keyword,
      record.title,
    ].find((candidate): candidate is string => typeof candidate === "string" && !!candidate.trim())
    if (text) out.push(text.trim())
  }
  // Dedupe case-insensitive: backend bisa mengirim "BPJS" dan "bpjs"
  // berdampingan, dan chip ganda untuk kata yang sama hanya menambah
  // kebisingan. Kemunculan PERTAMA yang dipertahankan — urutan saran dari
  // backend adalah peringkat relevansi, jadi entri belakangan tidak boleh
  // menimpanya (Map.set naif justru menyimpan nilai terakhir).
  const unique = new Map<string, string>()
  for (const text of out) {
    const key = text.toLowerCase()
    if (!unique.has(key)) unique.set(key, text)
  }
  return [...unique.values()]
}

// ------------------------------------------------------------------
// Riwayat pencarian (audit P2 "Lainnya") —
// GET /v1/search/history + GET /v1/search/history/clear.
// Endpoint clear memakai GET (bentuk backend apa adanya; cek:retry hanya
// melarang `retry` pada mutasi, dan di sini tidak ada retry).
// ------------------------------------------------------------------

export type SearchHistoryEntry = {
  query: string
  searchedAt?: string | null
}

/**
 * GET /v1/search/history — riwayat pencarian user (13.2).
 * Respons tanpa schema; item bisa string polos atau objek {query, searchedAt}.
 */
export function getSearchHistory(signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/search/history", { auth: "required", retry: 1, signal })
    .then((raw) => {
      const rows = readList<unknown>(raw, ["history", "queries", "data"])
      return rows
        .map((row): SearchHistoryEntry | null => {
          if (typeof row === "string" && row.trim()) return { query: row.trim() }
          if (row && typeof row === "object") {
            const record = row as Record<string, unknown>
            const query =
              typeof record.query === "string"
                ? record.query.trim()
                : typeof record.term === "string"
                  ? record.term.trim()
                  : typeof record.keyword === "string"
                    ? record.keyword.trim()
                    : ""
            if (!query) return null
            return {
              query,
              searchedAt:
                typeof record.searchedAt === "string"
                  ? record.searchedAt
                  : typeof record.createdAt === "string"
                    ? record.createdAt
                    : null,
            }
          }
          return null
        })
        .filter((entry): entry is SearchHistoryEntry => entry !== null)
    })
}

/** GET /v1/search/history/clear — hapus riwayat pencarian user. */
export function clearSearchHistory(signal?: AbortSignal) {
  return http.get<unknown>("/v1/search/history/clear", { auth: "required", signal })
}
