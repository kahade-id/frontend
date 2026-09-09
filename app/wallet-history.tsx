/**
 * Screen — Riwayat Dompet (SEMUA mutasi dalam satu daftar).
 *
 * Endpoint: GET /v1/wallet/transactions?page&limit&type&from&to
 *           GET /v1/wallet/export/csv · /export/pdf (tombol di header)
 *
 * Kenapa layar ini ada: Tab Dompet dulu hanya menawarkan riwayat PER KATEGORI
 * (chip "Riwayat Top-up", "Riwayat Penarikan", "Jadwal Penarikan") sehingga
 * tidak ada satu tempat untuk melihat seluruh pergerakan dana berurutan.
 * Sekarang Tab Dompet menampilkan 10 mutasi terbaru + "Lihat semua" ke layar
 * ini, dan filter jenis menjadi chip di dalam SATU daftar (bukan layar
 * terpisah per kategori).
 *
 * Anatomi (desain):
 *   1. Kartu ringkasan — total masuk vs keluar dari mutasi yang SUDAH dimuat
 *      + bar proporsi keduanya. Bukan total akun (lihat catatan di bawah).
 *   2. Chip filter jenis (satu daftar, bukan layar per kategori).
 *   3. Mutasi dikelompokkan per hari ("Hari ini", "Kemarin", tanggal) dalam
 *      kartu rounded — tiap kelompok menampilkan net hariannya.
 *
 * Keputusan non-obvious:
 *   - Filter jenis memakai nilai enum API PERSIS (kunci `WALLET_TXN_LABELS`)
 *     dan dikirim sebagai query `type`; "Semua" TIDAK mengirim `type` sama
 *     sekali — helper lib/api/wallet.ts sudah menolak nilai "ALL" karena
 *     backend tidak mengenalnya.
 *   - Mengganti filter = key query baru (`wallet-history:${type}`) sehingga
 *     `usePaginatedQuery` meng-abort request filter lama dan memulai dari
 *     halaman 1. Tanpa itu, hasil filter lama bisa masuk setelah filter baru.
 *   - Rentang tanggal mengikuti default helper (≤ 90 hari, batas backend) dan
 *     dinyatakan ke pengguna lewat teks bantuan, bukan disembunyikan: tanpa
 *     keterangan itu mutasi lama terlihat "hilang".
 *   - Baris memakai `href` ke detail mutasi agar di web menjadi tautan nyata.
 *   - Pengelompokan memakai TANGGAL LOKAL perangkat (bukan UTC): mutasi jam
 *     00:30 WIB tidak boleh masuk "kemarin" hanya karena UTC-nya masih H-1.
 *   - Ringkasan dihitung dari item yang sudah dimuat (halaman 1..N), dan
 *     DITULIS begitu ("N mutasi dimuat") — bukan total akun. Menampilkannya
 *     sebagai total akun adalah angka yang salah secara harfiah.
 */
import { useMemo, useState } from "react"
import { View } from "react-native"
import {
  ArrowCircleDown,
  ArrowCircleUp,
  FileCsv,
  FilePdf,
  Wallet as WalletIcon,
} from "phosphor-react-native"

import { api, type WalletTransaction } from "@/lib/api"
import { formatDate, formatDateLong } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { usePaginatedQuery } from "@/lib/use-paginated-query"
import { WALLET_TXN_LABELS, walletTransactionType } from "@/lib/wallet-labels"
import { useWalletExport } from "@/lib/use-wallet-export"
import { tokens } from "@/lib/tokens"

import { Amount } from "@/components/ui/amount"
import { Chip } from "@/components/ui/chip"
import { EmptyState } from "@/components/ui/empty-state"
import { Header } from "@/components/ui/header"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { PaginatedList } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"
import { ScrollRow } from "@/components/ui/scroll-row"
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { WalletTransactionRow } from "@/components/ui/wallet-transaction-row"

const PAGE_SIZE = 20
const ALL = "ALL"

/** Chip filter: "Semua" + satu chip per jenis mutasi yang dikenal UI. */
const TYPE_FILTERS: Array<{ label: string; value: string }> = [
  { label: "Semua", value: ALL },
  ...Object.entries(WALLET_TXN_LABELS).map(([value, label]) => ({ label, value })),
]

// ------------------------------------------------------------------
// Pengelompokan per hari (tanggal lokal perangkat)
// ------------------------------------------------------------------

type DayGroup = {
  /** Key stabil untuk FlatList (`day:2026-09-08`). */
  id: string
  /** "Hari ini" / "Kemarin" / "Senin, 8 September 2026". */
  label: string
  /** Sub-label tanggal pendek untuk "Hari ini"/"Kemarin" ("8 Sep 2026"). */
  sub: string | null
  txns: WalletTransaction[]
  in: number
  out: number
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function groupByDay(items: WalletTransaction[]): DayGroup[] {
  const today = startOfDay(new Date()).getTime()
  const byKey = new Map<string, DayGroup>()
  for (const tx of items) {
    const date = new Date(tx.createdAt)
    const valid = !Number.isNaN(date.getTime())
    const day = valid ? startOfDay(date) : startOfDay(new Date(0))
    const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`
    let group = byKey.get(key)
    if (!group) {
      const diffDays = Math.round((today - day.getTime()) / 86_400_000)
      group = {
        id: `day:${key}`,
        label:
          diffDays === 0
            ? "Hari ini"
            : diffDays === 1
              ? "Kemarin"
              : valid
                ? formatDateLong(date)
                : "Tanggal tidak tersedia",
        sub: diffDays === 0 || diffDays === 1 ? (valid ? formatDate(date) : null) : null,
        txns: [],
        in: 0,
        out: 0,
      }
      byKey.set(key, group)
    }
    group.txns.push(tx)
    if (walletTransactionType(tx) === "CREDIT") group.in += tx.amount || 0
    else if (walletTransactionType(tx) === "DEBIT") group.out += tx.amount || 0
  }
  return [...byKey.values()]
}

// ------------------------------------------------------------------
// Skeleton sebentuk konten (kartu ringkasan + baris mutasi)
// ------------------------------------------------------------------

function HistorySkeleton() {
  return (
    <SkeletonGroup>
      <Skeleton shape="card" className="h-[132px] w-full" />
      <View className="flex-row gap-3 py-1">
        <Skeleton shape="circle" width={40} height={40} />
        <View className="flex-1 gap-1.5">
          <Skeleton height={14} style={{ width: "55%" }} />
          <Skeleton height={12} style={{ width: "80%" }} />
        </View>
      </View>
      <View className="flex-row gap-3 py-1">
        <Skeleton shape="circle" width={40} height={40} />
        <View className="flex-1 gap-1.5">
          <Skeleton height={14} style={{ width: "45%" }} />
          <Skeleton height={12} style={{ width: "70%" }} />
        </View>
      </View>
      <View className="flex-row gap-3 py-1">
        <Skeleton shape="circle" width={40} height={40} />
        <View className="flex-1 gap-1.5">
          <Skeleton height={14} style={{ width: "60%" }} />
          <Skeleton height={12} style={{ width: "50%" }} />
        </View>
      </View>
    </SkeletonGroup>
  )
}

// ------------------------------------------------------------------
// Screen
// ------------------------------------------------------------------

export default function WalletHistoryScreen() {
  const [type, setType] = useState(ALL)
  const { exporting, exportWallet } = useWalletExport()

  const query = usePaginatedQuery<WalletTransaction>(`wallet-history:${type}`, (page, signal) =>
    api.wallet.getWalletTransactions({ page, limit: PAGE_SIZE, type }, signal),
  )
  const items = query.data
  const groups = useMemo(() => groupByDay(items), [items])

  /** Ringkasan mutasi yang SUDAH dimuat — bukan total akun (lihat catatan file). */
  const loadedIn = items
    .filter((tx) => walletTransactionType(tx) === "CREDIT")
    .reduce((sum, tx) => sum + (tx.amount || 0), 0)
  const loadedOut = items
    .filter((tx) => walletTransactionType(tx) === "DEBIT")
    .reduce((sum, tx) => sum + (tx.amount || 0), 0)
  const inShare = loadedIn + loadedOut > 0 ? loadedIn / (loadedIn + loadedOut) : 0.5

  return (
    <Screen edges={["top"]} padded={false}>
      <Header
        title="Riwayat Dompet"
        right={
          <>
            <IconButton
              icon={FileCsv}
              size="md"
              variant="ghost"
              accessibilityLabel="Unduh riwayat dompet CSV"
              disabled={exporting !== null}
              onPress={() => void exportWallet("csv")}
            />
            <IconButton
              icon={FilePdf}
              size="md"
              variant="ghost"
              accessibilityLabel="Unduh riwayat dompet untuk dicetak"
              disabled={exporting !== null}
              onPress={() => void exportWallet("pdf")}
            />
          </>
        }
      />

      <PaginatedList
        {...query}
        data={groups}
        onRefresh={query.refresh}
        onRetry={query.reload}
        onLoadMore={query.loadMore}
        gap={tokens.space[3]}
        loadingPlaceholder={<HistorySkeleton />}
        header={
          <View className="gap-3 pb-1">
            <ScrollRow bleed gap={2} accessibilityLabel="Saring riwayat berdasarkan jenis">
              {TYPE_FILTERS.map((filter) => (
                <Chip
                  key={filter.value}
                  selected={type === filter.value}
                  accessibilityState={{ selected: type === filter.value }}
                  onPress={() => setType(filter.value)}
                >
                  {filter.label}
                </Chip>
              ))}
            </ScrollRow>

            {/* ── Kartu ringkasan masuk vs keluar ─────────────── */}
            {items.length > 0 ? (
              <View
                className="gap-3 rounded-md bg-surface p-4"
                accessible
                accessibilityLabel={`Ringkasan ${items.length} mutasi yang dimuat`}
              >
                <Text variant="caption" tone="secondary">
                  {items.length} mutasi dimuat
                </Text>
                <View className="flex-row gap-4">
                  <View className="flex-1 gap-1">
                    <View className="flex-row items-center gap-1.5">
                      <Icon icon={ArrowCircleDown} size="xs" tone="success" />
                      <Text variant="caption" tone="secondary">
                        Masuk
                      </Text>
                    </View>
                    <Amount value={loadedIn} sign="always" tone="success" />
                  </View>
                  <View className="flex-1 items-end gap-1">
                    <View className="flex-row items-center gap-1.5">
                      <Text variant="caption" tone="secondary">
                        Keluar
                      </Text>
                      <Icon icon={ArrowCircleUp} size="xs" tone="default" />
                    </View>
                    <Amount value={-loadedOut} sign="always" tone="primary" />
                  </View>
                </View>
                {/* Bar proporsi masuk : keluar */}
                <View
                  className="h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated"
                  accessibilityRole="none"
                >
                  <View className="h-full bg-success" style={{ width: `${inShare * 100}%` }} />
                </View>
              </View>
            ) : null}
          </View>
        }
        footer={
          <View className="gap-2 pt-4">
            <Text variant="caption" tone="tertiary">
              Riwayat ditampilkan maksimal 90 hari terakhir. Unduh CSV untuk rentang lengkap yang
              disediakan server.
            </Text>
          </View>
        }
        empty={
          <EmptyState
            icon={WalletIcon}
            title={type === ALL ? "Belum ada riwayat" : "Tidak ada mutasi jenis ini"}
            description={
              type === ALL
                ? "Semua pergerakan dana Anda (top-up, penarikan, transfer, escrow) akan muncul di sini."
                : "Coba jenis lain atau hapus filter untuk melihat seluruh mutasi."
            }
          />
        }
        renderItem={({ item }) => {
          const net = item.in - item.out
          return (
            <View className="overflow-hidden rounded-md bg-surface">
              {/* Kepala kelompok: hari + net harian */}
              <View className="flex-row items-baseline justify-between gap-3 px-4 pt-3">
                <View className="flex-1 flex-row items-baseline gap-2">
                  <Text variant="body" weight={600} tone="primary" numberOfLines={1}>
                    {item.label}
                  </Text>
                  {item.sub ? (
                    <Text variant="caption" tone="secondary" numberOfLines={1}>
                      {item.sub}
                    </Text>
                  ) : null}
                </View>
                {item.in + item.out > 0 ? (
                  <Amount
                    value={net}
                    sign="always"
                    tone={net >= 0 ? "success" : "primary"}
                  />
                ) : null}
              </View>
              {/* Baris-baris mutasi hari itu (tanpa separator — kartu yang memisah) */}
              <View className="px-2 pb-1 pt-1">
                {item.txns.map((tx) => (
                  <WalletTransactionRow
                    key={tx.id}
                    transaction={tx}
                    href={ROUTES.walletTransaction(tx.id)}
                    divider={false}
                  />
                ))}
              </View>
            </View>
          )
        }}
      />
    </Screen>
  )
}
