/**
 * Tab #3 — Dompet (redesign 2026-09-27, TIM WALLET PAGE)
 *
 * Tampilan ala e-wallet premium (DANA/OVO/GoPay):
 *  - <WalletHeroCard> — kartu saldo hero gelap premium: "Saldo Dompet" besar
 *    + toggle mata (prefs.balanceHidden dari useUiPrefs, dibagi dengan
 *    Beranda — J-05) + sub-baris "Rp X ditahan di escrow". Skeleton saat
 *    loading; ErrorState + retry saat error (fail closed: tidak pernah
 *    menampilkan Rp 0 palsu).
 *  - <WalletPrimaryActions> — tiga tombol besar: Isi Saldo / Transfer /
 *    Tarik Dana.
 *  - <WalletQuickMenu> — lima menu cepat ikon-bertumpuk-label: Terima/QR,
 *    Riwayat, Voucher, Bank, Bantuan. Semua memetakan ke route yang ada di
 *    lib/routes.ts — tidak ada tombol mati/mock.
 *  - "Transaksi terakhir" — 10 mutasi terbaru dalam satu kartu rounded
 *    premium (<WalletTransactionRow vivid> + divider) + "Lihat semua" ke
 *    /wallet-history.
 *
 * Kontrak API (TIDAK berubah):
 *  - GET /v1/wallet → saldo (exact, via <Amount>, tanpa pembulatan tampilan)
 *  - GET /v1/wallet/transactions?page&limit&type&from&to → riwayat
 *    (spec menandai `type/from/to` required; helper lib/api/wallet.ts
 *    mengisi default yang terdokumentasi di sana).
 *
 * Keputusan non-obvious:
 *  - Tab ini sengaja TIDAK memuat riwayat panjang: `limit` 10 dan
 *    `hasMore={false}` — riwayat lengkap (paginasi + filter jenis + unduh
 *    CSV/PDF) hidup di /wallet-history, satu daftar.
 *  - ModeSwitcher TIDAK ada di header ini (2026-09-23): satu-satunya switch
 *    mode kini halaman profil sendiri. Slot navbar bawah tetap mengikuti mode.
 *  - Kartu "Transaksi terakhir" dibentuk dari baris-baris FlatList
 *    (rounded-t di baris pertama, rounded-b di baris terakhir, border-x di
 *    semua) — bukan satu <Card> pembungkus — supaya pull-to-refresh,
 *    loading, error, dan empty state PaginatedList tetap bekerja apa adanya.
 *  - Tidak ada seksi promo/banner: tidak ada sumber data promo nyata di
 *    repo — mock dilarang.
 *  - Pull-to-refresh me-refresh saldo DAN riwayat bersamaan (`Promise.all`).
 */

import { queryKeys } from "@/lib/query-keys"
import { useHasSession } from "@/lib/guest-gate"
import { useApiQuery } from "@/lib/use-api-query"
import { byTimestampDesc, usePaginatedQuery } from "@/lib/use-paginated-query"
import { PaginatedList } from "@/components/ui/paginated-list"
import { WalletTransactionRow } from "@/components/ui/wallet-transaction-row"
import { OnboardingChecklistCard } from "@/components/ui/onboarding-checklist"
import { useCallback } from "react"
import { View } from "react-native"
import { Wallet as WalletIcon } from "phosphor-react-native"

import { api, type WalletTransaction } from "@/lib/api"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { cn } from "@/lib/cn"

import { EmptyState } from "@/components/ui/empty-state"
import { ScreenCaptureGuard } from "@/components/security/screen-capture-guard"
import { FadeIn } from "@/components/ui/fade-in"
import { Header } from "@/components/ui/header"
import { ModeShiftFade } from "@/components/ui/mode-switcher"
import { useUiPrefs } from "@/lib/ui-prefs"
import { RouteLink } from "@/components/ui/route-link"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { GuestLoginPrompt } from "@/components/web-guest-gate"
import { WalletHeroCard } from "@/components/wallet/wallet-hero-card"
import { WalletPrimaryActions, WalletQuickMenu } from "@/components/wallet/wallet-menu"

// ------------------------------------------------------------------
// Konstanta layar
// ------------------------------------------------------------------

/**
 * Tab ringkasan hanya menampilkan 10 mutasi terbaru — riwayat lengkap
 * (dengan paginasi & filter) ada di /wallet-history.
 */
const RECENT_LIMIT = 10

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
    // SEC-404: proteksi screen-capture iOS di layar saldo.
    <ScreenCaptureGuard>
      <Screen edges={["top"]} padded={false}>
      <Header showBack={false} title="Dompet" />

      <ModeShiftFade>
      <PaginatedList
        {...history}
        // Layar ringkasan tidak memuat halaman berikutnya: riwayat lengkap
        // (paginasi + filter jenis) ada di /wallet-history.
        hasMore={false}
        // Baris-baris riwayat membentuk SATU kartu: tanpa gap antar-baris
        // (kartu dirakit di renderItem).
        gap={0}
        onRefresh={handleRefresh}
        refreshing={balance.refreshing || history.refreshing}
        onRetry={history.reload}
        onLoadMore={history.loadMore}
        renderItem={({ item, index }) => (
          // Kartu "Transaksi terakhir": baris pertama = sudut atas kartu,
          // baris terakhir = sudut bawah kartu, semua = border kiri-kanan.
          <View
            className={cn(
              "border-border bg-surface-elevated px-5",
              index === 0 && "mt-3 rounded-t-md border-x border-t pt-2",
              index > 0 && "border-x",
              index === recent.length - 1 && "rounded-b-md border-b pb-2",
            )}
          >
            <WalletTransactionRow
              transaction={item}
              href={ROUTES.walletTransaction(item.id)}
              divider={index < recent.length - 1}
              vivid
            />
          </View>
        )}
        empty={
          <View className="mt-3 rounded-md border border-border bg-surface-elevated px-5 py-4">
            <EmptyState
              icon={WalletIcon}
              title="Belum ada riwayat"
              description="Transaksi dompet Anda akan muncul di sini."
            />
          </View>
        }
        header={
          <FadeIn duration="base" distance={tokens.space[3]}>
            <View className="gap-6 pt-3">
              {/* Kartu "Lengkapi akunmu" — hanya di halaman Dompet
                  (keputusan 2026-09-28): etalase/feed tampil bersih. */}
              <OnboardingChecklistCard />
              {/*
               * Kartu saldo hero — fill gelap premium + toggle mata
               * (preferensi dibagi Beranda) + dana tertahan escrow.
               */}
              <WalletHeroCard
                available={wallet?.availableBalance}
                // Backend mengirim `escrowBalance` (bukan `holdBalance`);
                // fallback agar dana tertahan di escrow tetap tampil.
                held={wallet?.holdBalance ?? wallet?.escrowBalance}
                // J-05 (audit): "sembunyikan saldo" = preferensi persisten
                // yang dibagi dengan Beranda (privasi bahu-penumpang
                // konsisten antar layar).
                hidden={prefs.balanceHidden}
                onToggleHidden={() => setPrefs({ balanceHidden: !prefs.balanceHidden })}
                loading={walletLoading}
                error={walletError}
                onRetry={() => void fetchWallet()}
              />

              {/* Tiga CTA primer: Isi Saldo / Transfer / Tarik Dana. */}
              <WalletPrimaryActions />

              {/* Menu cepat: Terima/QR, Riwayat, Voucher, Bank, Bantuan. */}
              <WalletQuickMenu />

              <View>
                <SectionHeader
                  title="Transaksi terakhir"
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
            </View>
          </FadeIn>
        }
      />
      </ModeShiftFade>
      </Screen>
    </ScreenCaptureGuard>
  )
}
