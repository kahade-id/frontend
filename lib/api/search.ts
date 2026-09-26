/**
 * Kahade — domain `search` (pencarian global + saran).
 */

import { asRecord, readEntity, invalidResponse, readList } from "@/lib/api/response"

import { http } from "@/lib/api/client"
import { normalizeOrder, type Order } from "@/lib/api/orders"
import type { UserProfile } from "@/lib/api/users"
import type { WalletTransaction } from "@/lib/api/wallet"

/**
 * Artikel bantuan dari pencarian global.
 *
 * DC-002 (audit Discovery 2026-09-26): backend mengirim kunci `helpCenter`
 * (bukan `articles`) dengan item `{id, question, answer, categoryId,
 * createdAt}` dari tabel faq_items — BUKAN {id, slug, title, snippet}.
 * Normalizer ini memetakan ke bentuk tampilan; `slug` = id karena tidak ada
 * endpoint GET item-by-id (detail memakai pola ROUTES.helpArticle yang sudah
 * ada: /help/[slug] + article=id + q=question).
 */
export type SearchHelpArticle = {
  id: string
  slug: string
  title: string
  snippet?: string
}

export function parseSearchHelpArticle(raw: unknown): SearchHelpArticle | null {
  const record = asRecord(raw)
  if (!record || typeof record.id !== "string" || !record.id) return null
  const title =
    typeof record.question === "string" && record.question.trim()
      ? record.question.trim()
      : typeof record.title === "string" && record.title.trim()
        ? record.title.trim()
        : ""
  if (!title) return null
  return {
    id: record.id,
    slug: typeof record.slug === "string" && record.slug ? record.slug : record.id,
    title,
    snippet:
      typeof record.answer === "string" && record.answer.trim()
        ? record.answer.trim().slice(0, 200)
        : typeof record.snippet === "string" && record.snippet.trim()
          ? record.snippet.trim().slice(0, 200)
          : undefined,
  }
}

/**
 * Postingan etalase dari GET /v1/search?types=showcase.
 *
 * DC-019 (audit Discovery 2026-09-26): backend `searchShowcase` mengembalikan
 * bentuk MINIMAL {id, title, description, userId, createdAt} — tanpa images,
 * author lengkap, likeCount, dsb. — sehingga tidak kompatibel langsung dengan
 * `ShowcaseSocialItem`. Normalizer ini memetakan ke bentuk yang kompatibel
 * dengan default aman untuk field yang tidak dikirim.
 */
export function parseSearchShowcaseItem(raw: unknown): import("@/lib/api/showcase").ShowcaseSocialItem | null {
  const record = asRecord(raw)
  if (!record || typeof record.id !== "string" || !record.id) return null
  const userId = typeof record.userId === "string" ? record.userId : ""
  return {
    id: record.id,
    title:
      typeof record.title === "string" && record.title.trim() ? record.title.trim() : "Tanpa judul",
    description: typeof record.description === "string" ? record.description : null,
    images: [],
    likeCount: 0,
    commentCount: 0,
    viewCount: 0,
    shareCount: 0,
    descriptionHtml: null,
    createdAt: typeof record.createdAt === "string" ? record.createdAt : "",
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
    author: {
      userId,
      username: userId,
      fullName: null,
      avatarUrl: null,
      membershipRank: null,
      isKycVerified: false,
      isVip: false,
      badges: [],
      sealTier: null,
    },
  }
}

export type GlobalSearchResults = {
  users?: UserProfile[]
  orders?: Array<Order>
  transactions?: WalletTransaction[]
  /** DC-002: kunci backend `helpCenter` (dulu salah dibaca `articles`). */
  helpCenter?: SearchHelpArticle[]
  /** DC-019: bentuk minimal backend, dinormalisasi ke ShowcaseSocialItem. */
  showcase?: Array<import("@/lib/api/showcase").ShowcaseSocialItem>
  /** DC-014: total per jenis dari server (bukan hitungan rows lokal). */
  totals?: { users: number; orders: number; transactions: number; showcase: number; helpCenter: number }
  /** DC-011: hint berbahasa Indonesia dari backend (2 kasus, tampil apa adanya). */
  hint?: string
  total?: number
}

export function globalSearch(
  query: { q: string; types?: string; limit?: number; location?: string },
  signal?: AbortSignal,
) {
  return http
    .get<unknown>("/v1/search", {
      // DC-016 (audit Discovery 2026-09-26): komentar lama ("hanya users,
      // orders, transactions") kedaluwarsa — ALLOWED_SEARCH_TYPES backend =
      // {users,orders,transactions,showcase,help-center}. Cakupan "all" kini
      // meminta help-center juga (DC-002); showcase TIDAK diminta di sini
      // (postingan dilayani feed etalase — paritas app/search.tsx).
      // `types` kosong ditolak backend (SEARCH_INVALID_TYPES).
      query: { types: "users,orders,transactions,help-center", limit: 20, ...query },
      auth: "required",
      retry: 1,
      signal,
    })
    .then((raw) => {
      const result = readEntity<Record<string, unknown>>(raw, "results")
      // DC-002: kunci backend `helpCenter`, bukan `articles`.
      if (
        ![result.users, result.orders, result.transactions, result.helpCenter, result.showcase].some(
          Array.isArray,
        )
      )
        throw invalidResponse("search.results")
      // DC-014: totals dari server (angka judul kelompok yang benar saat
      // limit memotong). Fallback ke hitungan lokal bila backend tak kirim.
      const totalsRaw = asRecord(result.totals)
      const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0)
      const transactions = (Array.isArray(result.transactions) ? result.transactions : []).map((item) => {
        const transaction = item as Record<string, unknown>
        return {
          ...transaction,
          // DC-004 (audit Discovery 2026-09-26): preseden DIBALIK agar sama
          // dengan normalizeWalletTransaction (txId ?? id). `id` dari search
          // adalah cuid internal yang TIDAK valid untuk endpoint detail
          // (where: {txId}); txId publik-lah namespace navigasi yang benar.
          id: String(transaction.txId ?? transaction.id ?? ""),
          referenceId: transaction.referenceId ?? transaction.reference_id,
        } as WalletTransaction
      })
      const helpCenter = (Array.isArray(result.helpCenter) ? result.helpCenter : []).flatMap((item) => {
        const parsed = parseSearchHelpArticle(item)
        return parsed ? [parsed] : []
      })
      const showcase = (Array.isArray(result.showcase) ? result.showcase : []).flatMap((item) => {
        const parsed = parseSearchShowcaseItem(item)
        return parsed ? [parsed] : []
      })
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
        transactions,
        helpCenter,
        showcase,
        totals: {
          users: num(totalsRaw?.users),
          orders: num(totalsRaw?.orders),
          transactions: num(totalsRaw?.transactions),
          showcase: num(totalsRaw?.showcase),
          helpCenter: num(totalsRaw?.helpCenter),
        },
        // DC-011: hint backend ditampilkan apa adanya (komentar S2 backend).
        hint: typeof result.hint === "string" && result.hint.trim() ? result.hint.trim() : undefined,
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
    // DC-001 (audit Discovery 2026-09-26): backend mengirim {label, type}
    // (search.service.ts: label = fullName/title). `label` ditaruh TERAKHIR
    // agar tebakan lama (query/suggestion/...) tidak berubah perilaku bila
    // backend mengirim keduanya.
    const text = [
      record.query,
      record.suggestion,
      record.text,
      record.value,
      record.keyword,
      record.title,
      record.label,
      record.name,
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
