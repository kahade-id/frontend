/**
 * Tab #3 — Dompet
 *
 * Menampilkan:
 *  - <HomeOverviewCard> — kartu saldo hero (saldo tersedia + tertahan
 *    escrow) dengan EMPAT aksi cepat gaya quick-menu Beranda: Isi saldo /
 *    Kirim / Terima / Tarik saldo. Kartu saldo lama (WalletBalanceCard) dan
 *    tombol unduh CSV/PDF di header dihapus: unduh sejarah sudah tersedia di
 *    layar Riwayat Dompet — tidak perlu diduplikasi di tab ringkasan.
 *  - 10 mutasi TERBARU `GET /v1/wallet/transactions` + "Lihat semua" ke
 *    layar Riwayat Dompet (`/wallet-history`) yang memuat seluruh riwayat
 *    dengan filter jenis dan tombol unduh.
 *
 * Kontrak API:
 *  - GET /v1/wallet → saldo
 *  - GET /v1/wallet/transactions?page&limit&type&from&to → riwayat
 *    (spec menandai `type/from/to` required; helper lib/api/wallet.ts
 *    mengisi default yang terdokumentasi di sana).
 *
 * Keputusan non-obvious:
 *  - Tab ini sengaja TIDAK memuat riwayat panjang: `limit` 10 dan
 *    `hasMore={false}` — riwayat lengkap (paginasi + filter jenis + unduh
 *    CSV/PDF) hidup di /wallet-history, satu daftar.
 *  - ModeSwitcher TIDAK ada di header ini lagi (2026-09-23): satu-satunya
 *    switch mode kini halaman profil sendiri, supaya satu kontrol punya satu
 *    rumah. Slot navbar bawah tetap mengikuti mode.
 *  - Pull-to-refresh me-refresh saldo DAN riwayat bersamaan (`Promise.all`).
 */

import { queryKeys } from "@/lib/query-keys"
import { useHasSession } from "@/lib/guest-gate"
import { useApiQuery } from "@/lib/use-api-query"
import { byTimestampDesc, usePaginatedQuery } from "@/lib/use-paginated-query"
import { PaginatedList } from "@/components/ui/paginated-list"
import { WalletTransactionRow } from "@/components/ui/wallet-transaction-row"
import { useCallback } from "react"
import { View } from "react-native"
import { router, type Href } from "expo-router"
import {
  ArrowCircleDown,
  ArrowCircleUp,
  PaperPlaneTilt,
  QrCode,
  Wallet as WalletIcon,
} from "phosphor-react-native"

import { api, type WalletTransaction } from "@/lib/api"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { FadeIn } from "@/components/ui/fade-in"
import { Header } from "@/components/ui/header"
import { ModeShiftFade } from "@/components/ui/mode-switcher"
import { useUiPrefs } from "@/lib/ui-prefs"
import { HomeOverviewCard } from "@/components/ui/home-overview-card"
import { RouteLink } from "@/components/ui/route-link"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { GuestLoginPrompt } from "@/components/web-guest-gate"

// ------------------------------------------------------------------
// Konstanta layar
// ------------------------------------------------------------------

/**
 * Tab ringkasan hanya menampilkan 10 mutasi terbaru — riwayat lengkap
 * (dengan paginasi & filter) ada di /wallet-history.
 */
const RECENT_LIMIT = 10

/** Peta aksi cepat → route (semua screen sudah ada di lib/routes.ts). */
const ACTION_ROUTE: Record<"topup" | "send" | "receive" | "withdraw", Href> = {
  topup: ROUTES.topup,
  send: ROUTES.transfer,
  receive: ROUTES.receive,
  withdraw: ROUTES.withdraw,
}

// ------------------------------------------------------------------
// Screen
// ------------------------------------------------------------------

export default function WalletScreen() {
  // J-05 (audit): preferensi "sembunyikan saldo" dibagi dengan Beranda.
  const { prefs, setPrefs } = useUiPrefs()
  // refreshOnFocus: tab Dompet tetap ter-mount, jadi tanpa ini saldo tidak
  // pernah diperbarui setelah top-up/withdraw/transfer di layar lain.
  /**
   * B-02 (audit): tamu web BOLEH membuka tab Dompet (route-nya di allowlist
   * WEB_GUEST_TAB_SCREENS), tetapi `GET /v1/wallet` + `/v1/wallet/transactions`
   * keduanya `auth:"required"`. Sebelum ini tab Dompet adalah satu-satunya tab
   * tanpa gate token: tiap fokus tab menembak 401 → refresh → potensi
   * `expireSession`. Pola yang sama sudah dipakai Beranda (`isGuest`) dan tab
   * Transaksi/Pengguna.
   */
  const hasSession = useHasSession()
  const balance = useApiQuery(queryKeys.wallet(), (signal) => api.wallet.getWallet(signal), hasSession, {
    refreshOnFocus: true,
  })
  const history = usePaginatedQuery<WalletTransaction>(
    "wallet-recent",
    (page, signal) => api.wallet.getWalletTransactions({ page, limit: RECENT_LIMIT }, signal),
    // C-08 (audit): mutasi terbaru harus naik ke atas walau baris lama sudah
    // terlanjur ada di daftar (mergeById mempertahankan posisi lama).
    { enabled: hasSession, compare: byTimestampDesc<WalletTransaction>((tx) => tx.createdAt) },
  )

  const wallet = balance.data
  const walletLoading = balance.loading
  const walletError = balance.error
  const fetchWallet = balance.reload
  const handleRefresh = useCallback(async () => {
    await Promise.all([balance.refresh(), history.refresh()])
  }, [balance.refresh, history.refresh])
  const handleAction = useCallback((key: keyof typeof ACTION_ROUTE) => {
    router.push(ACTION_ROUTE[key])
  }, [])

  const recent = history.data

  // Tamu: kartu saldo kosong/"Rp 0" akan menyesatkan — tampilkan ajakan masuk
  // (komponen yang sama dengan gate root layout) alih-alih dompet palsu.
  if (!hasSession) {
    return (
      <Screen edges={["top"]} padded={false}>
        <Header showBack={false} title="Dompet" />
        <GuestLoginPrompt bare next="/wallet" />
      </Screen>
    )
  }

  return (
    <Screen edges={["top"]} padded={false}>
      <Header showBack={false} title="Dompet" />

      <ModeShiftFade>
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
             * Kartu saldo hero — gaya quick-menu Beranda: empat aksi (Isi
             * saldo / Kirim / Terima / Tarik saldo) sebagai ikon bertumpuk
             * label, bukan baris tombol teks.
             */}
            {walletError ? (
              <View className="pt-3">
                <ErrorState
                  compact
                  title="Gagal memuat saldo"
                  description={walletError}
                  onRetry={() => void fetchWallet()}
                />
              </View>
            ) : (
              <View className="pt-3 gap-3">
                <HomeOverviewCard
                  available={wallet?.availableBalance}
                  held={wallet?.holdBalance}
                  // J-05 (audit): "sembunyikan saldo" = preferensi persisten
                  // yang dibagi dengan Beranda (privasi bahu-penumpang
                  // konsisten antar layar).
                  hidden={prefs.balanceHidden}
                  onToggleHidden={() => setPrefs({ balanceHidden: !prefs.balanceHidden })}
                  elevation="low"
                  walletLoading={walletLoading}
                  onRetryWallet={() => void fetchWallet()}
                  walletActions={[
                    {
                      key: "topup",
                      label: "Isi saldo",
                      icon: ArrowCircleDown,
                      onPress: () => handleAction("topup"),
                    },
                    {
                      key: "send",
                      label: "Kirim",
                      icon: PaperPlaneTilt,
                      onPress: () => handleAction("send"),
                    },
                    {
                      key: "receive",
                      label: "Terima",
                      icon: QrCode,
                      onPress: () => handleAction("receive"),
                    },
                    {
                      key: "withdraw",
                      label: "Tarik saldo",
                      icon: ArrowCircleUp,
                      onPress: () => handleAction("withdraw"),
                    },
                  ]}
                />
              </View>
            )}

            <View className="pt-4">
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
      </ModeShiftFade>
    </Screen>
  )
}
