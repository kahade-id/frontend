import { useApiQuery } from "@/lib/use-api-query"
import { usePaginatedQuery } from "@/lib/use-paginated-query"
import { PaginatedList } from "@/components/ui/paginated-list"
import { WalletTransactionRow } from "@/components/ui/wallet-transaction-row"
/**
 * Tab #3 — Dompet
 *
 * Menampilkan:
 *  - <WalletBalanceCard> — saldo tersedia + saldo tertahan escrow + aksi
 *    cepat (isi saldo / tarik / transfer) — komponen sistem, bukan markup
 *    custom: jumlah, format Mono, sembunyikan saldo, skeleton & a11y
 *    sudah ditangani di satu tempat.
 *  - 10 mutasi TERBARU `GET /v1/wallet/transactions` + "Lihat semua" ke
 *    layar Riwayat Dompet (`/wallet-history`) yang memuat seluruh riwayat
 *    dengan filter jenis dan tombol unduh.
 *
 * Kontrak API:
 *  - GET /v1/wallet → saldo
 *  - GET /v1/wallet/transactions?page&limit&type&from&to → riwayat
 *    (spec menandai `type/from/to` required; helper lib/api/wallet.ts
 *    mengisi default yang terdokumentasi di sana)
 *
 * Keputusan non-obvious:
 *  - Tab ini sengaja TIDAK lagi memuat riwayat panjang: `limit` 10 dan
 *    `hasMore={false}` sehingga tidak ada "Muat lebih" di layar ringkasan.
 *    Riwayat lengkap (paginasi + filter jenis + unduh CSV/cetak) hidup di
 *    /wallet-history — satu daftar, bukan satu layar per kategori seperti
 *    chip "Riwayat Top-up"/"Riwayat Penarikan" sebelumnya.
 *  - Unduh riwayat memakai `useWalletExport()` (satu hook untuk Tab Dompet,
 *    Riwayat Dompet, dan Analitik) — perilaku web/native identik di ketiganya.
 *
 * Pull-to-refresh di layar ini dilayani <PaginatedList> melalui wrapper
 * <PullToRefreshFlatList> custom yang mengikuti tangan. Wrapper memakai
 * PullGestureSurface + Animated.View, BUKAN ScrollView kedua, lalu meneruskan
 * onScroll langsung ke FlatList. Virtualisasi tetap utuh dan hanya ada satu
 * scroller. Satu tarikan me-refresh saldo DAN riwayat bersamaan
 * (`Promise.all`) agar angka uang tidak terpisah dari daftar yang
 * menjelaskannya.
 */
import { useCallback } from "react"
import { StyleSheet, View } from "react-native"
import { router, type Href } from "expo-router"
import { FileCsv, FilePdf, Wallet as WalletIcon } from "phosphor-react-native"

import { api, type WalletTransaction } from "@/lib/api"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { useWalletExport } from "@/lib/use-wallet-export"

import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { FadeIn } from "@/components/ui/fade-in"
import { Header } from "@/components/ui/header"
import { IconButton } from "@/components/ui/icon-button"
import { RouteLink } from "@/components/ui/route-link"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { WalletBalanceCard, type WalletQuickAction } from "@/components/ui/wallet-balance-card"

// ------------------------------------------------------------------
// Konstanta layar
// ------------------------------------------------------------------

/**
 * Tab ringkasan hanya menampilkan 10 mutasi terbaru — riwayat lengkap (dengan
 * paginasi & filter) ada di /wallet-history. Angka ini bukan `limit` backend
 * minimum; ia dipilih agar daftar ringkas muat di satu layar bersama kartu
 * saldo tanpa menenggelamkan aksi utama.
 */
const RECENT_LIMIT = 10

/** Peta aksi cepat → route (semua screen sudah ada di lib/routes.ts). */
const ACTION_ROUTE: Record<WalletQuickAction["key"], Href> = {
  topup: ROUTES.topup,
  withdraw: ROUTES.withdraw,
  transfer: ROUTES.transfer,
}

// ------------------------------------------------------------------
// Screen
// ------------------------------------------------------------------

export default function WalletScreen() {
  // refreshOnFocus: tab Dompet tetap ter-mount, jadi tanpa ini saldo tidak
  // pernah diperbarui setelah top-up/withdraw/transfer di layar lain —
  // pengguna harus menebak kalau angkanya basi.
  const balance = useApiQuery("wallet-balance", (signal) => api.wallet.getWallet(signal), true, {
    refreshOnFocus: true,
  })
  const history = usePaginatedQuery<WalletTransaction>("wallet-recent", (page, signal) =>
    api.wallet.getWalletTransactions({ page, limit: RECENT_LIMIT }, signal),
  )
  const { exporting, exportWallet } = useWalletExport()

  const wallet = balance.data
  const walletLoading = balance.loading
  const walletError = balance.error
  const fetchWallet = balance.reload
  const handleRefresh = useCallback(async () => {
    await Promise.all([balance.refresh(), history.refresh()])
  }, [balance.refresh, history.refresh])
  const handleAction = useCallback((key: WalletQuickAction["key"]) => {
    router.push(ACTION_ROUTE[key])
  }, [])

  const recent = history.data

  return (
    <Screen edges={["top"]} padded={false}>
      <Header
        showBack={false}
        title="Dompet"
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
        {...history}
        // Layar ringkasan tidak memuat halaman berikutnya: riwayat lengkap
        // (paginasi + filter jenis) ada di /wallet-history.
        hasMore={false}
        onRefresh={handleRefresh}
        refreshing={balance.refreshing || history.refreshing}
        onRetry={history.reload}
        onLoadMore={history.loadMore}
        renderItem={({ item, index }) => (
          <WalletTransactionRow
            transaction={item}
            href={ROUTES.walletTransaction(item.id)}
            divider={index < recent.length - 1}
          />
        )}
        empty={
          <EmptyState
            icon={WalletIcon}
            title="Belum ada riwayat"
            description="Transaksi dompet Anda akan muncul di sini."
          />
        }
        header={
          <FadeIn duration="base" distance={tokens.space[3]}>
            {/*
             * v2: kartu saldo reveal naik 12px (duration base) — satu-satunya
             * kartu hero di layar ini, jadi geraknya boleh sedikit lebih
             * terasa daripada kontrol Transaksi. Aman di ListHeader (mount
             * sekali, bukan per-item); baris mutasi ikut Layout animation
             * dari <PaginatedList>.
             */}
            <View>
              {walletError ? (
                <ErrorState
                  compact
                  title="Gagal memuat saldo"
                  description={walletError}
                  onRetry={() => void fetchWallet()}
                />
              ) : (
                <WalletBalanceCard
                  available={wallet?.availableBalance}
                  held={wallet?.holdBalance}
                  loading={walletLoading}
                  onTopUp={() => handleAction("topup")}
                  onWithdraw={() => handleAction("withdraw")}
                  onTransfer={() => handleAction("transfer")}
                  style={styles.balanceCard}
                />
              )}

              <SectionHeader
                title="Riwayat"
                level="h3"
                action={
                  <RouteLink
                    href={ROUTES.walletHistory}
                    accessibilityLabel="Lihat semua riwayat dompet"
                    containerClassName="rounded-xs"
                  >
                    <Text variant="body" weight={600} tone="primary">
                      Lihat semua
                    </Text>
                  </RouteLink>
                }
              />
            </View>
          </FadeIn>
        }
      />
    </Screen>
  )
}

// ------------------------------------------------------------------
// StyleSheet
// ------------------------------------------------------------------

const styles = StyleSheet.create({
  balanceCard: {
    marginTop: tokens.space[3],
    marginBottom: tokens.space[2],
  },
})
