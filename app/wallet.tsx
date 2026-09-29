/**
 * Tab #3 — Dompet (redesign 2026-09-27, TIM WALLET PAGE)
 *
 * Tampilan ala e-wallet premium (DANA/OVO/GoPay):
 *  - <WalletHeroCard> — kartu saldo hero gelap premium: "Saldo Tersedia"
 *    besar + caption "yang bisa dipakai sekarang" + toggle mata
 *    (balanceHidden dari useUiPref, dibagi dengan Beranda — J-05) +
 *    sub-baris "Ditahan di escrow: Rp X". Skeleton saat
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
import { useWalletGate } from "@/lib/use-wallet-enabled"
import { useApiQuery } from "@/lib/use-api-query"
import { byTimestampDesc, usePaginatedQuery } from "@/lib/use-paginated-query"
import { PaginatedList } from "@/components/ui/paginated-list"
import { WalletTransactionRow } from "@/components/ui/wallet-transaction-row"

type RecentTransactionRowProps = {
  item: WalletTransaction
  index: number
  last: boolean
}

/**
 * FE-057 (audit 2026-09-29): baris "Transaksi terakhir" di-memo —
 * `renderItem` inline menjebol memo internal PaginatedList.
 */
const RecentTransactionRow = memo(function RecentTransactionRow({
  item,
  index,
  last,
}: RecentTransactionRowProps) {
  // Kartu "Transaksi terakhir": baris pertama = sudut atas kartu,
  // baris terakhir = sudut bawah kartu, semua = border kiri-kanan.
  return (
    <View
      className={cn(
        "border-border bg-surface-elevated px-5",
        index === 0 && "mt-3 rounded-t-md border-x border-t pt-2",
        index > 0 && "border-x",
        last && "rounded-b-md border-b pb-2",
      )}
    >
      <WalletTransactionRow
        transaction={item}
        href={ROUTES.walletTransaction(item.id)}
        divider={!last}
        vivid
      />
    </View>
  )
})

/**
 * FE-057: empty state statis — identitas stabil agar memo internal
 * PaginatedList tidak jebol.
 */
function RecentEmptyState() {
  // FE-135 (audit frontend 2026-09-29): <EmptyState> langsung tanpa bungkus
  // kartu kustom — konsisten dengan empty state layar lain.
  return (
    <EmptyState
      icon={WalletIcon}
      title="Belum ada riwayat"
      description="Transaksi dompet Anda akan muncul di sini."
    />
  )
}
import { OnboardingChecklistCard } from "@/components/ui/onboarding-checklist"
import { memo, useCallback, useEffect, useMemo, useState } from "react"
import { View } from "react-native"
import { Wallet as WalletIcon } from "phosphor-react-native"

import { api, type WalletTransaction } from "@/lib/api"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { cn } from "@/lib/cn"
import { computeEscrowHolds, totalEscrowHeld } from "@/lib/wallet-escrow-holds"
import { ESCROW_HELD_EXPLANATION } from "@/lib/labels/escrow"
import { breakdownAddsUp } from "@/lib/wallet-batch139"
import { formatDate, formatTime } from "@/lib/format"
import { translate } from "@/lib/i18n"

import { EmptyState } from "@/components/ui/empty-state"
import { ScreenCaptureGuard } from "@/components/security/screen-capture-guard"
import { FadeIn } from "@/components/ui/fade-in"
import { Header } from "@/components/ui/header"
import { ModeShiftFade } from "@/components/ui/mode-switcher"
import { useSetUiPrefs, useUiPref } from "@/lib/ui-prefs"
import { RouteLink } from "@/components/ui/route-link"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Amount } from "@/components/ui/amount"
import { Alert } from "@/components/ui/alert"
import { ListLoading } from "@/components/ui/paginated-list"
import { ErrorState } from "@/components/ui/error-state"
import { GuestLoginPrompt } from "@/components/web-guest-gate"
import { WalletDisabledScreen } from "@/components/ui/wallet-disabled"
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
  // Mode Tanpa Wallet Internal (BI-safe): kill-switch terpusat — flag false =
  // SELURUH layar dompet diganti <WalletDisabledScreen/> (deep link ikut
  // tertutup). Kode dompet tetap ada, hanya digate.
  const walletGate = useWalletGate()
  // J-05 (audit): preferensi "sembunyikan saldo" dibagi dengan Beranda.
  // R1-002: selector per-key — tulis preferensi lain tidak me-render ulang layar ini.
  const balanceHidden = useUiPref("balanceHidden")
  const setPrefs = useSetUiPrefs()
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
  /**
   * D02 (batch 139): kapan saldo terakhir berhasil disinkronkan.
   * `balance.data` hanya berubah bila respons sukses — refresh yang gagal
   * tidak menggeser stempel ini, sehingga "Diperbarui …" selalu jujur.
   * Fail closed: refresh gagal + data lama ada → banner peringatan (bukan
   * angka diam yang terlihat mutakhir); refresh gagal + tanpa data → kartu
   * sudah menampilkan ErrorState (fail closed di WalletHeroCard).
   */
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  useEffect(() => {
    if (balance.data) setLastSyncedAt(Date.now())
  }, [balance.data])
  const syncFailed = balance.error != null && balance.data != null
  const handleRefresh = useCallback(async () => {
    await Promise.all([balance.refresh(), history.refresh()])
  }, [balance.refresh, history.refresh])

  const recent = history.data

  // FE-057 (audit 2026-09-29): renderItem + empty distabilkan — PaginatedList
  // mem-memo internalnya ber-deps pada identitas prop ini.
  const renderRecentItem = useCallback(
    ({ item, index }: { item: WalletTransaction; index: number }) => (
      <RecentTransactionRow item={item} index={index} last={index === recent.length - 1} />
    ),
    [recent.length],
  )
  const recentEmpty = useMemo(() => <RecentEmptyState />, [])

  // FE-IMP-4 item 1: rincian order penahan escrow (read-only). Dimuat malas
  // hanya saat sheet dibuka; dihitung dari mutasi ORDER_LOCK yang belum ada
  // pelepasannya (lihat lib/wallet-escrow-holds.ts).
  const [holdsOpen, setHoldsOpen] = useState(false)
  /** D03 (batch 139): sheet rincian saldo tersedia/tertahan/total. */
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const holdsQuery = useApiQuery<WalletTransaction[]>(
    "wallet-escrow-holds",
    (signal) =>
      // PERF-FIX (network P1): limit 100 → 30 — sheet rincian hanya butuh
      // mutasi TERBARU untuk menghitung penahan; total tertahan tetap dari
      // server (`wallet.holdBalance`), jadi angka utama tidak terpengaruh.
      api.wallet
        .getWalletTransactions({ page: 1, limit: 30 }, signal)
        .then((page) => page.data),
    hasSession && holdsOpen,
  )
  const holds = useMemo(
    () => computeEscrowHolds(holdsQuery.data ?? []),
    [holdsQuery.data],
  )
  const heldValue = wallet?.holdBalance ?? wallet?.escrowBalance ?? 0

  // FE-IMP-4 item 13: sisa limit tarik hari ini (server; display-only).
  const withdrawLimitLeft =
    wallet?.dailyWithdrawLimit != null && wallet?.todayWithdrawAmount != null
      ? Math.max(0, wallet.dailyWithdrawLimit - wallet.todayWithdrawAmount)
      : undefined

  // Tamu: kartu saldo kosong/"Rp 0" akan menyesatkan — tampilkan ajakan masuk
  // (komponen yang sama dengan gate root layout) alih-alih dompet palsu.
  if (!hasSession) {
    return (
      <Screen edges={["top"]} padded={false}>
        {/* T5-001 (audit UI/UX): tombol kembali TAMPIL (default Header) —
            fallback cerdas Header: replace("/showcase") bila tidak bisa back. */}
        <Header title="Dompet" />
        <GuestLoginPrompt bare next="/wallet" />
      </Screen>
    )
  }

  // Kill-switch dompet (BI-safe): tamu tetap melihat ajakan masuk di atas;
  // yang login melihat layar blokir, bukan konten dompet.
  if (walletGate === "off") {
    return <WalletDisabledScreen />
  }

  return (
    // SEC-404: proteksi screen-capture iOS di layar saldo.
    <ScreenCaptureGuard>
      <Screen edges={["top"]} padded={false}>
      {/* T5-001: tombol kembali tampil; fallback Header → replace("/showcase"). */}
      <Header title="Dompet" />

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
        renderItem={renderRecentItem}
        empty={recentEmpty}
        header={
          <FadeIn duration="base" distance={tokens.space[3]}>
            <View className="gap-6 pt-3">
              {/* Kartu "Lengkapi akun Anda" — hanya di halaman Dompet
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
                hidden={balanceHidden}
                onToggleHidden={() => setPrefs({ balanceHidden: !balanceHidden })}
                loading={walletLoading}
                error={walletError}
                onRetry={() => void fetchWallet()}
                // FE-IMP-4 item 1: sub-baris escrow bisa diketuk → sheet
                // rincian order penahan (read-only).
                onPressHeld={heldValue > 0 ? () => setHoldsOpen(true) : undefined}
                // FE-IMP-4 item 13: sisa limit tarik harian dari server.
                withdrawLimitLeft={withdrawLimitLeft}
                // D03 (batch 139): ikon info → sheet rincian saldo.
                onPressBreakdown={() => setBreakdownOpen(true)}
              />

              {/*
               * D02 (batch 139): stempel "Diperbarui …" + status sinkronisasi.
               * Diletakkan tepat di bawah kartu saldo — satu-satunya tempat
               * pengguna mempertanyakan kemutakhiran angka.
               * FE-094: tiga mekanisme status (stempel + "Menyinkronkan…" +
               * Alert panjang) digabung jadi SATU indikator kecil; alert
               * gagal cukup "Gagal memuat saldo terbaru."
               */}
              {syncFailed ? (
                <View className="px-1">
                  <Alert tone="warning" title={translate("Gagal memuat saldo terbaru.")} />
                </View>
              ) : (
                <View className="flex-row items-center px-1">
                  <Text variant="caption" tone="tertiary">
                    {balance.refreshing
                      ? "Menyinkronkan…"
                      : lastSyncedAt
                        ? `Diperbarui ${formatTime(lastSyncedAt)}`
                        : walletLoading
                          ? "Memuat saldo…"
                          : "Belum diperbarui"}
                  </Text>
                </View>
              )}

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

      {/* D03 (batch 139): rincian saldo — penjelasan + angka dari GET /v1/wallet. */}
      <BottomSheet
        visible={breakdownOpen}
        onRequestClose={() => setBreakdownOpen(false)}
        title="Rincian saldo"
        description="Angka-angka ini dibaca langsung dari catatan dompet Anda."
        footer={
          <Button onPress={() => setBreakdownOpen(false)} containerClassName="flex-1">
            Tutup
          </Button>
        }
      >
        <View className="gap-2 px-5 py-2">
          {wallet?.availableBalance != null ? (
            <View className="gap-1 rounded-md border border-border bg-surface px-4 py-3">
              <View className="flex-row items-baseline justify-between gap-3">
                <Text variant="body" weight={600}>
                  Saldo tersedia
                </Text>
                <Amount value={wallet.availableBalance} tone="primary" hidden={balanceHidden} />
              </View>
              <Text variant="caption" tone="secondary">
                Dana yang bisa dipakai untuk transfer, tarik dana, dan pembayaran.
              </Text>
            </View>
          ) : null}
          {heldValue > 0 ? (
            <View className="gap-1 rounded-md border border-border bg-surface px-4 py-3">
              <View className="flex-row items-baseline justify-between gap-3">
                <Text variant="body" weight={600}>
                  Ditahan di escrow
                </Text>
                <Amount value={heldValue} tone="primary" hidden={balanceHidden} />
              </View>
              <Text variant="caption" tone="secondary">
                {ESCROW_HELD_EXPLANATION}
              </Text>
            </View>
          ) : null}
          {wallet?.balance != null ? (
            <View className="gap-1 rounded-md border border-border bg-surface px-4 py-3">
              <View className="flex-row items-baseline justify-between gap-3">
                <Text variant="body" weight={600}>
                  Total saldo
                </Text>
                <Amount value={wallet.balance} tone="primary" hidden={balanceHidden} />
              </View>
              <Text variant="caption" tone="secondary">
                {breakdownAddsUp(wallet?.availableBalance, heldValue, wallet?.balance)
                  ? "Total saldo = saldo tersedia + dana ditahan di escrow."
                  : "Jumlah seluruh dana di dompet Anda."}
              </Text>
            </View>
          ) : null}
          <Text variant="caption" tone="tertiary" className="px-1 pt-1">
            Mutasi yang masih diproses tampil di riwayat dengan status "Pending".
          </Text>
        </View>
      </BottomSheet>

      {/* FE-IMP-4 item 1: rincian dana ditahan escrow — read-only. */}
      <BottomSheet
        visible={holdsOpen}
        onRequestClose={() => setHoldsOpen(false)}
        title="Dana ditahan di escrow"
        description={ESCROW_HELD_EXPLANATION}
        footer={
          <Button onPress={() => setHoldsOpen(false)} containerClassName="flex-1">
            Tutup
          </Button>
        }
      >
        {holdsQuery.loading ? (
          <ListLoading />
        ) : holdsQuery.error ? (
          <ErrorState
            compact
            title="Gagal memuat rincian"
            description={holdsQuery.error}
            onRetry={() => void holdsQuery.reload()}
          />
        ) : holds.length === 0 ? (
          <View className="px-5 py-6">
            <EmptyState
              icon={WalletIcon}
              title="Tidak ada pesanan penahan"
              description="Tidak ditemukan dana yang ditahan di escrow pada 100 mutasi terakhir."
            />
          </View>
        ) : (
          <View className="gap-2 px-5 py-2">
            <View className="flex-row items-baseline justify-between rounded-md bg-surface px-4 py-3">
              <Text variant="caption" tone="secondary">
                Total ditahan
              </Text>
              <Amount
                value={totalEscrowHeld(holds)}
                tone="primary"
                hidden={balanceHidden}
              />
            </View>
            {holds.map((hold) => (
              <View
                key={hold.orderId}
                className="flex-row items-center justify-between gap-3 rounded-md border border-border bg-surface px-4 py-3"
              >
                <View className="flex-1 gap-0.5">
                  <Text variant="body" weight={600} numberOfLines={1}>
                    {hold.orderId}
                  </Text>
                  <Text variant="caption" tone="secondary">
                    Ditahan sejak {formatDate(hold.lockedAt)}
                  </Text>
                </View>
                <Amount
                  value={hold.amount}
                  tone="primary"
                  hidden={balanceHidden}
                />
              </View>
            ))}
            <Text variant="caption" tone="tertiary" className="px-1 pt-1">
              Dihitung dari 100 mutasi terakhir. Daftar ini hanya untuk
              informasi — bukan untuk mengubah status order.
            </Text>
          </View>
        )}
      </BottomSheet>
    </ScreenCaptureGuard>
  )
}
