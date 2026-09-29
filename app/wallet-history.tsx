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
 * ini.
 *
 * Anatomi (desain):
 *   1. Kolom pencarian (client-side, atas item yang sudah dimuat).
 *   2. Chip ringkasan filter aktif + "Atur ulang".
 *   3. Kartu ringkasan — total masuk vs keluar dari mutasi yang tampil
 *      + bar proporsi keduanya. Bukan total akun (lihat catatan di bawah).
 *   4. Ikon funnel di header membuka <WalletHistoryFilterSheet>:
 *      arah dana, jenis transaksi, rentang tanggal, status.
 *   5. Mutasi dikelompokkan per hari ("Hari ini", "Kemarin", tanggal) dalam
 *      kartu rounded — tiap kelompok menampilkan net hariannya.
 *
 * Keputusan non-obvious:
 *   - Filter jenis memakai nilai enum API PERSIS (`WALLET_TXN_FILTERS` di
 *     lib/wallet-labels.ts) dan dikirim sebagai query `type`; "Semua jenis"
 *     TIDAK mengirim `type` sama sekali — helper lib/api/wallet.ts membuang
 *     nilai "ALL" karena backend tidak mengenalnya.
 *     BUG yang diperbaiki: chip dulu diturunkan dari kunci peta LABEL, yang
 *     berisi tebakan lama (TOPUP, WITHDRAWAL, TRANSFER_IN, ORDER_ESCROW, …).
 *     Backend memvalidasi `type` terhadap enum-nya dan menolak semuanya dengan
 *     `Invalid transaction type: "TOPUP"` → tiap chip jenis menghasilkan layar
 *     error, bukan daftar. Peta label boleh berisi alias untuk MENAMPILKAN
 *     data lama; nilai yang DIKIRIM ke API tidak boleh.
 *   - Kontrak API hanya mendukung page/limit/type/from/to — TIDAK ada search
 *     atau filter status/arahan di server. Maka jenis + rentang tanggal =
 *     server-side (query key baru → `usePaginatedQuery` meng-abort request
 *     lama dan mulai dari halaman 1); arah dana + status + pencarian =
 *     client-side atas item yang sudah dimuat, dan UI jujur soal itu
 *     ("Mencari di N mutasi yang dimuat").
 *   - Mengganti filter server-side = key query baru
 *     (`wallet-history:${type}:${rangeDays}d`). Tanpa itu, hasil filter lama
 *     bisa masuk setelah filter baru.
 *   - Rentang tanggal dinyatakan ke pengguna lewat teks bantuan, bukan
 *     disembunyikan: tanpa keterangan itu mutasi lama terlihat "hilang".
 *     Preset "Semua waktu" DIHAPUS — backend membatasi rentang 90 hari, jadi
 *     chip itu menjanjikan hal yang tidak bisa dipenuhi server dan hasilnya
 *     identik dengan chip "90 hari" di sebelahnya. Dua chip yang melakukan hal
 *     sama, salah satunya berbohong, lebih buruk daripada tiga chip jujur.
 *   - Baris memakai `href` ke detail mutasi agar di web menjadi tautan nyata.
 *   - Pengelompokan memakai TANGGAL WIB (Asia/Jakarta — zona kerja backend,
 *     WF-026), bukan tanggal lokal perangkat: mutasi jam 00:30 WIB tidak
 *     boleh masuk "kemarin" di perangkat WITA/WIT. Logika grouping tinggal di
 *     lib/wallet-history-grouping.ts (murni, bisa di-test tanpa render).
 *   - Ringkasan dihitung dari item yang TAMPIL (setelah filter client-side),
 *     dan DITULIS begitu: tanpa filter aktif "{N} mutasi dimuat"; dengan
 *     filter/pencarian aktif "{M} dari {N} mutasi". Menampilkannya sebagai
 *     total akun adalah angka yang salah secara harfiah.
 *   - Sheet filter bekerja dengan DRAF: pilihan di dalam sheet belum mengubah
 *     apa pun sampai "Terapkan" ditekan — mengetuk chip jenis tidak boleh
 *     memicu refetch beruntun.
 */
import { memo, useCallback, useMemo, useState } from "react"
import { View } from "react-native"
import { router } from "expo-router"
import { translate } from "@/lib/i18n/translate"
import {
  ArrowCircleDown,
  ArrowCircleUp,
  FileCsv,
  Funnel,
  Printer,
  Wallet as WalletIcon,
} from "phosphor-react-native"

import { api, type WalletTransaction } from "@/lib/api"
import { formatNumber } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { byTimestampDesc, usePaginatedQuery } from "@/lib/use-paginated-query"
import { useWalletGate } from "@/lib/use-wallet-enabled"
import { WALLET_TXN_FILTERS, walletTransactionType } from "@/lib/wallet-labels"
import { useWalletExport } from "@/lib/use-wallet-export"
import {
  buildHistoryRange,
  DEFAULT_HISTORY_FILTERS,
  DEFAULT_RANGE_DAYS,
  filterWalletTransactions,
  groupByDay,
  HISTORY_STATUS_FILTERS,
  type DayGroup,
  type WalletHistoryFilters,
} from "@/lib/wallet-history-grouping"
import { tokens } from "@/lib/tokens"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { TAB_BAR_HEIGHT } from "@/components/ui/bottom-tab-bar"

import { Amount } from "@/components/ui/amount"
import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { DebouncedSearchField } from "@/components/ui/debounced-search-field"
import { EmptyState } from "@/components/ui/empty-state"
import { FadeIn } from "@/components/ui/fade-in"
import { Header } from "@/components/ui/header"
import { ModeShiftFade } from "@/components/ui/mode-switcher"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { PaginatedList } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"
import { WalletDisabledScreen } from "@/components/ui/wallet-disabled"
import { ScrollRow } from "@/components/ui/scroll-row"
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { WalletHistoryFilterSheet } from "@/components/ui/wallet-history-filter-sheet"
import { WalletTransactionRow } from "@/components/ui/wallet-transaction-row"
import { ScreenCaptureGuard } from "@/components/security/screen-capture-guard"

const PAGE_SIZE = 20

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

/**
 * LR-010 (perf-fix): satu kelompok hari riwayat wallet yang di-memo.
 * Nominal, grouping WIB, dan perilaku tidak berubah — hanya mencegah re-render
 * kelompok saat daftar re-render.
 */
const WalletHistoryDayGroup = memo(function WalletHistoryDayGroup({
  item,
}: {
  item: { label: string; sub: string | null; in: number; out: number; txns: WalletTransaction[] }
}) {
  const net = item.in - item.out
  return (
    <View className="overflow-hidden rounded-md bg-surface">
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
          <Amount value={net} sign="always" tone={net >= 0 ? "success" : "primary"} />
        ) : null}
      </View>
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
})

export default function WalletHistoryScreen() {
  // Mode Tanpa Wallet Internal (BI-safe): flag false = layar blokir
  // (deep link ikut tertutup).
  const walletGate = useWalletGate()
  const insets = useSafeAreaInsets()
  const [filters, setFilters] = useState<WalletHistoryFilters>(DEFAULT_HISTORY_FILTERS)
  const [sheetOpen, setSheetOpen] = useState(false)
  /** Teks pencarian yang sudah di-debounce (milik layar; kolomnya di bawah). */
  const [search, setSearch] = useState("")
  const { exporting, exportWallet } = useWalletExport()

  // Rentang dihitung saat query dimulai (bukan per render) supaya key stabil.
  const range = useMemo(() => buildHistoryRange(filters.rangeDays), [filters.rangeDays])

  const query = usePaginatedQuery<WalletTransaction>(
    `wallet-history:${filters.type}:${filters.rangeDays}d`,
    (page, signal) =>
      api.wallet.getWalletTransactions(
        { page, limit: PAGE_SIZE, type: filters.type, from: range.from, to: range.to },
        signal,
      ),
    // F-01 (audit): top-up/withdraw diselesaikan di layar lain — mutasi baru
    // harus terlihat saat kembali ke riwayat tanpa pull-to-refresh.
    // C-08 (audit): urutan kronologis harus mengikuti server setelah data
    // berubah, bukan posisi baris saat pertama dimuat.
    {
      refreshOnFocus: true,
      compare: byTimestampDesc<WalletTransaction>((tx) => tx.createdAt),
    },
  )
  const items = query.data

  // Filter client-side (arah, status, pencarian) atas item yang SUDAH dimuat —
  // server tidak mendukungnya sebagai query.
  const visibleItems = useMemo(
    () =>
      filterWalletTransactions(items, {
        direction: filters.direction,
        status: filters.status,
        query: search,
      }),
    [items, filters.direction, filters.status, search],
  )
  const groups = useMemo(() => groupByDay(visibleItems), [visibleItems])
  /**
   * LR-010 (perf-fix): renderItem stabil via useCallback — identitas tidak
   * berubah tiap render; setiap kelompok hari di-memo.
   */
  const renderDayGroup = useCallback(
    ({ item }: { item: DayGroup }) => <WalletHistoryDayGroup item={item} />,
    [],
  )

  const searching = search.trim() !== ""
  const clientFiltered = filters.direction !== "ALL" || filters.status !== "ALL"
  /** Tampilan menyempit oleh filter client-side/pencarian (bukan sekadar jenis/rentang). */
  const narrowed = searching || clientFiltered

  /** Chip ringkasan filter aktif — mengetuknya membuka sheet untuk mengubah. */
  const activeChips: Array<{ key: string; label: string }> = []
  if (filters.direction === "CREDIT")
    activeChips.push({ key: "direction", label: translate("Dana masuk") })
  else if (filters.direction === "DEBIT")
    activeChips.push({ key: "direction", label: translate("Dana keluar") })
  if (filters.type !== "ALL")
    activeChips.push({
      key: "type",
      label: WALLET_TXN_FILTERS.find((f) => f.value === filters.type)?.label ?? filters.type,
    })
  if (filters.rangeDays !== DEFAULT_RANGE_DAYS)
    activeChips.push({ key: "range", label: `${filters.rangeDays} hari` })
  if (filters.status !== "ALL")
    activeChips.push({
      key: "status",
      label: HISTORY_STATUS_FILTERS.find((f) => f.value === filters.status)?.label ?? filters.status,
    })
  const hasActiveFilters = activeChips.length > 0

  const resetAll = () => {
    setFilters(DEFAULT_HISTORY_FILTERS)
    setSearch("")
  }

  /** Ringkasan mutasi yang TAMPIL — bukan total akun (lihat catatan file). */
  // WF-029: Math.abs — tahan terhadap amount negatif dari backend.
  const loadedIn = visibleItems
    .filter((tx) => walletTransactionType(tx) === "CREDIT")
    .reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0)
  const loadedOut = visibleItems
    .filter((tx) => walletTransactionType(tx) === "DEBIT")
    .reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0)
  const inShare = loadedIn + loadedOut > 0 ? loadedIn / (loadedIn + loadedOut) : 0.5
  /**
   * Selisih masuk-keluar adalah angka yang sebenarnya dicari orang di riwayat
   * uang ("bulan ini saya untung atau bocor?"). Versi lama hanya menampilkan
   * dua totalnya dan membiarkan pengguna menghitung sendiri.
   */
  const net = loadedIn - loadedOut
  const summaryCaption = narrowed
    ? translate("{m} dari {n} mutasi", {
        m: formatNumber(visibleItems.length),
        n: formatNumber(items.length),
      })
    : translate("{n} mutasi dimuat", { n: formatNumber(items.length) })

  // Mode Tanpa Wallet Internal (BI-safe): flag false = layar blokir.
  if (walletGate === "off") {
    return <WalletDisabledScreen />
  }

  return (
    // SEC-404 (selective): riwayat mutasi menampilkan nominal dana —
    // blokir screenshot/recording per-layar, bukan app-wide.
    <ScreenCaptureGuard>
      <Screen edges={["top"]} padded={false}>
      <Header
        title="Riwayat Dompet"
        right={
          <>
            <View>
              <IconButton
                icon={Funnel}
                size="md"
                variant="ghost"
                accessibilityLabel={translate("Buka filter riwayat")}
                onPress={() => setSheetOpen(true)}
              />
              {hasActiveFilters ? (
                <View
                  className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary"
                  pointerEvents="none"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                />
              ) : null}
            </View>
            <IconButton
              icon={FileCsv}
              size="md"
              variant="ghost"
              accessibilityLabel="Unduh riwayat dompet CSV"
              disabled={exporting !== null}
              onPress={() => void exportWallet("csv")}
            />
            <IconButton
              icon={Printer}
              size="md"
              variant="ghost"
              accessibilityLabel="Unduh riwayat dompet untuk dicetak"
              disabled={exporting !== null}
              onPress={() => void exportWallet("pdf")}
            />
          </>
        }
      />

      <ModeShiftFade>
      <PaginatedList
        {...query}
        data={groups}
        onRefresh={query.refresh}
        onRetry={query.reload}
        onLoadMore={query.loadMore}
        gap={tokens.space[3]}
        bottomPadding={insets.bottom + TAB_BAR_HEIGHT + tokens.space[4]}
        loadingPlaceholder={<HistorySkeleton />}
        header={
          // v2: filter + ringkasan reveal naik 8px (fast) — konteks "laporan":
          // angka ringkasan adalah bintangnya, jadi ia masuk dengan gerak.
          <FadeIn duration="fast">
            <View className="gap-3 pb-1">
              {/* Pencarian client-side — teks tidak pernah keluar kolom
                  sampai debounce (lihat <DebouncedSearchField>). */}
              <DebouncedSearchField
                initialQuery={search}
                onQueryChange={setSearch}
                placeholder={translate("Cari mutasi…")}
                accessibilityLabel={translate("Cari mutasi dompet")}
              />
              {searching ? (
                <Text variant="caption" tone="tertiary">
                  {translate("Mencari di {n} mutasi yang dimuat", {
                    n: formatNumber(items.length),
                  })}
                </Text>
              ) : null}

              {/* FE-IMP-4 item 15: chip cepat "Dalam proses" — menyaring
                  mutasi yang masih pending tanpa membuka sheet filter. */}
              <ScrollRow bleed gap={2} accessibilityLabel="Filter cepat status mutasi">
                <Chip
                  selected={filters.status === "PENDING"}
                  accessibilityState={{ selected: filters.status === "PENDING" }}
                  onPress={() =>
                    setFilters((f) => ({
                      ...f,
                      status: f.status === "PENDING" ? "ALL" : "PENDING",
                    }))
                  }
                >
                  {translate("Dalam proses")}
                </Chip>
              </ScrollRow>

              {/* Chip ringkasan filter aktif + atur ulang */}
              {hasActiveFilters ? (
                <ScrollRow bleed gap={2} accessibilityLabel="Filter riwayat yang aktif">
                  {activeChips.map((chip) => (
                    <Chip
                      key={chip.key}
                      selected
                      accessibilityState={{ selected: true }}
                      onPress={() => setSheetOpen(true)}
                    >
                      {chip.label}
                    </Chip>
                  ))}
                  <Chip onPress={resetAll} accessibilityLabel="Atur ulang semua filter riwayat">
                    {translate("Atur ulang")}
                  </Chip>
                </ScrollRow>
              ) : null}

              {/* ── Kartu ringkasan masuk vs keluar ─────────────── */}
              {visibleItems.length > 0 ? (
                <View
                  className="gap-3 rounded-md bg-surface p-4"
                  accessible
                  accessibilityLabel={translate("Ringkasan {x} hari terakhir, {y}", {
                    x: filters.rangeDays,
                    y: summaryCaption,
                  })}
                >
                  <View className="flex-row items-baseline justify-between gap-3">
                    <Text variant="caption" tone="secondary">
                      {translate("Ringkasan mutasi")}
                    </Text>
                    <Text variant="caption" tone="tertiary">
                      {summaryCaption}
                    </Text>
                  </View>
                  <View className="flex-row gap-4">
                    <View className="flex-1 gap-1">
                      <View className="flex-row items-center gap-1.5">
                        <Icon icon={ArrowCircleDown} size="xs" tone="success" />
                        <Text variant="caption" tone="secondary">
                          {/* WF-027: "Masuk" mentah bertabrakan dengan entri
                              katalog "Masuk"→"Sign in" — pakai frasa tak-ambigu. */}
                          {translate("Dana masuk")}
                        </Text>
                      </View>
                      <Amount value={loadedIn} sign="always" tone="success" />
                    </View>
                    <View className="flex-1 items-end gap-1">
                      <View className="flex-row items-center gap-1.5">
                        <Text variant="caption" tone="secondary">
                          {translate("Dana keluar")}
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
                  <View className="flex-row items-baseline justify-between gap-3 border-t border-border pt-3">
                    <Text variant="caption" tone="secondary">
                      {translate("Selisih")}
                    </Text>
                    <Amount value={net} sign="always" tone={net >= 0 ? "success" : "primary"} />
                  </View>
                </View>
              ) : null}
            </View>
          </FadeIn>
        }
        footer={
          // FE-104: dua footnote teknis digabung jadi satu — tanpa jargon
          // "server" (§9 aturan 3).
          <View className="gap-2 pt-4">
            <Text variant="caption" tone="tertiary">
              {translate("Menampilkan 90 hari terakhir · filter berlaku untuk data yang dimuat.")}
            </Text>
          </View>
        }
        empty={
          hasActiveFilters || searching ? (
            <EmptyState
              icon={Funnel}
              // TRX-016 (audit UI/UX 2026-09-28): filter bersifat client-side
              // di atas item yang SUDAH dimuat — judul/deskripsi tidak boleh
              // dibaca sebagai kesimpulan final atas seluruh riwayat.
              title={translate("Tidak ada yang cocok di mutasi yang dimuat")}
              // FE-104: description filter dihapus — sudah tercakup footnote
              // "filter berlaku untuk data yang dimuat"; judul + CTA cukup.
              description={
                searching
                  ? translate(
                      'Tidak ada mutasi yang cocok dengan "{q}" di {n} mutasi yang dimuat.',
                      { q: search.trim(), n: formatNumber(items.length) },
                    )
                  : undefined
              }
              action={
                <Button fullWidth={false} variant="secondary" onPress={resetAll}>
                  {translate("Atur ulang filter")}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={WalletIcon}
              title={translate("Belum ada riwayat")}
              description={translate(
                "Semua pergerakan dana Anda (top-up, penarikan, transfer, escrow) akan muncul di sini.",
              )}
              action={
                <Button fullWidth={false} onPress={() => router.push(ROUTES.topup)}>
                  {translate("Isi saldo")}
                </Button>
              }
            />
          )
        }
        renderItem={renderDayGroup}      />
      </ModeShiftFade>

      <WalletHistoryFilterSheet
        visible={sheetOpen}
        onRequestClose={() => setSheetOpen(false)}
        initial={filters}
        onApply={setFilters}
      />
      </Screen>
    </ScreenCaptureGuard>
  )
}
