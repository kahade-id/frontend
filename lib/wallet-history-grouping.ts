/**
 * Kahade — logika MURNI layar Riwayat Dompet (tanpa render).
 *
 * Diekstrak dari app/wallet-history.tsx agar bisa dikunci regresi lewat unit
 * test: pengelompokan tanggal WIB, filter client-side (arah/status/cari),
 * dan pembangunan rentang tanggal untuk query server.
 *
 * TIDAK menyentuh nominal selain Math.abs untuk agregat (WF-029) — angka
 * tampil persis dari API.
 */
import type { WalletTransaction } from "@/lib/api/wallet"
import { formatDate, formatDateLong, WIB_TIME_ZONE } from "@/lib/format"
import { mapValue } from "@/lib/has-own"
import { translate } from "@/lib/i18n/translate"
import {
  WALLET_TXN_LABELS,
  walletTransactionStatus,
  walletTransactionType,
  type WalletTxnType,
} from "@/lib/wallet-labels"

// ------------------------------------------------------------------
// Pengelompokan per hari (tanggal WIB — zona kerja backend, WF-026)
// ------------------------------------------------------------------

export type DayGroup = {
  /** Key stabil untuk FlatList (`day:2026-9-8`). */
  id: string
  /** "Hari ini" / "Kemarin" / "Senin, 8 September 2026". */
  label: string
  /** Sub-label tanggal pendek untuk "Hari ini"/"Kemarin" ("8 Sep 2026"). */
  sub: string | null
  txns: WalletTransaction[]
  in: number
  out: number
}

/**
 * WF-026 (Batch 1-money): tanggal kalender di Asia/Jakarta.
 * Mengembalikan kunci grup + Date "tengah malam WIB sebagai lokal" — HANYA
 * untuk pelabelan kalender (formatDateLong/formatDate), bukan cap waktu.
 * Sebelumnya memakai getFullYear()/getMonth()/getDate() perangkat sehingga
 * user WITA/WIT melihat mutasi 00:30 WIB di hari yang berbeda dari backend.
 */
/**
 * TIM 8 (perf, P0): instance formatter di-cache lazy di module scope —
 * `wibCalendarDay` dipanggil per transaksi di `groupByDay` (N=200 mutasi →
 * 202 konstruksi per pass). Dipakai ulang juga oleh
 * lib/transaction-grouping.ts lewat fungsi yang sama ini.
 */
let wibDayFormatter: Intl.DateTimeFormat | null = null

function getWibDayFormatter(): Intl.DateTimeFormat {
  if (!wibDayFormatter) {
    wibDayFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: WIB_TIME_ZONE,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    })
  }
  return wibDayFormatter
}

export function wibCalendarDay(d: Date): { key: string; date: Date } | null {
  try {
    const parts = getWibDayFormatter().formatToParts(d)
    const value = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? NaN)
    const year = value("year")
    const month = value("month")
    const day = value("day")
    if (![year, month, day].every(Number.isFinite)) return null
    return { key: `${year}-${month}-${day}`, date: new Date(year, month - 1, day) }
  } catch {
    return null
  }
}

export function groupByDay(items: WalletTransaction[]): DayGroup[] {
  const todayKey = wibCalendarDay(new Date())?.key ?? null
  const yesterdayKey = wibCalendarDay(new Date(Date.now() - 86_400_000))?.key ?? null
  const byKey = new Map<string, DayGroup>()
  for (const tx of items) {
    const date = new Date(tx.createdAt)
    const valid = !Number.isNaN(date.getTime())
    const wib = valid ? wibCalendarDay(date) : null
    const key = wib?.key ?? "invalid"
    let group = byKey.get(key)
    if (!group) {
      group = {
        id: `day:${key}`,
        label:
          todayKey != null && key === todayKey
            ? translate("Hari ini")
            : yesterdayKey != null && key === yesterdayKey
              ? translate("Kemarin")
              : wib
                ? formatDateLong(wib.date)
                : translate("Tanggal tidak tersedia"),
        sub:
          (todayKey != null && key === todayKey) ||
          (yesterdayKey != null && key === yesterdayKey)
            ? wib
              ? formatDate(wib.date)
              : null
            : null,
        txns: [],
        in: 0,
        out: 0,
      }
      byKey.set(key, group)
    }
    group.txns.push(tx)
    // WF-029: Math.abs — satu nilai negatif dari backend tidak boleh
    // mengkontaminasi total "Masuk"/"Keluar" secara diam-diam.
    if (walletTransactionType(tx) === "CREDIT") group.in += Math.abs(tx.amount || 0)
    else if (walletTransactionType(tx) === "DEBIT") group.out += Math.abs(tx.amount || 0)
  }
  return [...byKey.values()]
}

// ------------------------------------------------------------------
// Filter (server-side vs client-side)
// ------------------------------------------------------------------

/**
 * Kontrak API: GET /v1/wallet/transactions hanya mendukung query
 * page/limit/type/from/to. Maka:
 *   - SERVER-SIDE (query key baru → refetch): `type`, rentang tanggal.
 *   - CLIENT-SIDE (atas item yang sudah dimuat): arah dana, status, pencarian.
 */
export type DirectionFilter = "ALL" | "CREDIT" | "DEBIT"
/**
 * Status client-side memakai keluaran `walletTransactionStatus`
 * (SUCCESS/PENDING/FAILED/CANCELLED) — hanya status yang dipetakan backend;
 * status tak dikenal ("UNKNOWN") hanya tampil di "Semua status" (jujur, bukan
 * disamarkan ke kategori yang salah).
 * T3-007: CANCELLED/EXPIRED punya grup sendiri "Dibatalkan" — pembatalan
 * oleh user bukan kegagalan.
 */
export type StatusFilter = "ALL" | "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED"

export type WalletHistoryFilters = {
  /** Client-side. */
  direction: DirectionFilter
  /** Server-side — HARUS enum persis backend ("ALL" = tidak dikirim). */
  type: "ALL" | WalletTxnType
  /** Server-side — preset hari. */
  rangeDays: number
  /** Client-side. */
  status: StatusFilter
}

/** Preset rentang tanggal — backend membatasi rentang 90 hari. */
export const HISTORY_RANGE_PRESETS = [7, 30, 90] as const
/** Preset default = rentang terlebar yang benar-benar dilayani backend. */
export const DEFAULT_RANGE_DAYS = 90
/**
 * Backend menolak rentang lebih dari 90 hari. Preset "90 hari" ditarik mundur
 * 1 jam agar tidak jatuh tepat di batas (helper lib/api/wallet.ts memakai
 * margin yang sama: 89 hari untuk default-nya).
 */
export const RANGE_MARGIN_MS = 60 * 60 * 1000

export const DEFAULT_HISTORY_FILTERS: WalletHistoryFilters = {
  direction: "ALL",
  type: "ALL",
  rangeDays: DEFAULT_RANGE_DAYS,
  status: "ALL",
}

export const HISTORY_DIRECTION_FILTERS: ReadonlyArray<{
  value: DirectionFilter
  label: string
}> = [
  { value: "ALL", label: "Semua" },
  { value: "CREDIT", label: "Dana masuk" },
  { value: "DEBIT", label: "Dana keluar" },
]

/** Label konsisten dengan `walletStatusLabel` di lib/wallet-ui.ts. */
export const HISTORY_STATUS_FILTERS: ReadonlyArray<{
  value: StatusFilter
  label: string
}> = [
  { value: "ALL", label: "Semua status" },
  { value: "SUCCESS", label: "Berhasil" },
  { value: "PENDING", label: "Menunggu" },
  { value: "FAILED", label: "Gagal" },
  // T3-007: chip ke-5 — penarikan/top-up yang dibatalkan user sendiri.
  { value: "CANCELLED", label: "Dibatalkan" },
]

/** Rentang ISO untuk query server — dihitung saat query dimulai (bukan per render). */
export function buildHistoryRange(rangeDays: number): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to.getTime() - rangeDays * 24 * 60 * 60 * 1000 + RANGE_MARGIN_MS)
  return { from: from.toISOString(), to: to.toISOString() }
}

/** True bila tidak ada filter/pencarian client-side maupun server-side yang aktif. */
export function isDefaultHistoryView(
  filters: WalletHistoryFilters,
  query: string,
): boolean {
  return (
    filters.direction === "ALL" &&
    filters.type === "ALL" &&
    filters.rangeDays === DEFAULT_RANGE_DAYS &&
    filters.status === "ALL" &&
    query.trim() === ""
  )
}

/**
 * Filter client-side atas item yang SUDAH dimuat: arah dana, status, dan
 * pencarian (label jenis, referenceId, string nominal).
 */
export function filterWalletTransactions(
  items: WalletTransaction[],
  opts: { direction: DirectionFilter; status: StatusFilter; query: string },
): WalletTransaction[] {
  const q = opts.query.trim().toLowerCase()
  return items.filter((tx) => {
    if (opts.direction !== "ALL" && walletTransactionType(tx) !== opts.direction) return false
    if (opts.status !== "ALL" && walletTransactionStatus(tx.status) !== opts.status) return false
    if (q.length > 0) {
      const haystack = [
        mapValue(WALLET_TXN_LABELS, tx.type, tx.type),
        tx.referenceId ?? "",
        String(tx.amount ?? ""),
      ]
        .join(" ")
        .toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
}
