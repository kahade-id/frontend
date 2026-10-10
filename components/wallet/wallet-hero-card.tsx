/**
 * Kahade — <WalletHeroCard> kartu saldo hero tab Dompet (redesign 2026-09-27).
 *
 * Kartu "premium" monokrom ala e-wallet: fill gelap (`Card variant="inverted"`,
 * pola Stat/Highlight card design system) + lingkaran dekoratif bertumpuk
 * sebagai pengganti gradient (expo-linear-gradient TIDAK ada di repo; brand
 * monokrom §2.1 tidak punya warna jenuh untuk gradient).
 *
 * Isi:
 *  - Label "Saldo Tersedia" + nominal besar (<Amount> exact dari API, tanpa
 *    pembulatan tampilan) + caption "yang bisa dipakai sekarang".
 *  - Toggle mata (Eye/EyeSlash) terhubung ke `prefs.balanceHidden` dari
 *    useUiPrefs — preferensi yang SAMA dengan Beranda (J-05), bukan state
 *    lokal. Pemanggil yang me-wire `hidden`/`onToggleHidden`.
 *  - Sub-baris "Ditahan di escrow: Rp X" bila ada dana tertahan.
 *  - Loading = skeleton pada angka (label & kontrol tetap tampil, layout
 *    stabil — pola HomeOverviewCard).
 *  - Error = <ErrorState compact> + retry DI LUAR kartu gelap (bukan di
 *    dalamnya): ErrorState memakai tone teks standar yang tidak terbaca di
 *    atas fill gelap. Fail closed: tidak pernah menampilkan Rp 0 palsu.
 *
 * Aksesibilitas (pola HomeOverviewCard, audit #4): blok saldo dibungkus
 * <CardSummary> — satu elemen ringkasan ("Saldo dompet, Rp1.250.000,
 * Rp350.000 dalam transaksi") — sedangkan toggle mata kontrol fokusable
 * terpisah. Root kartu TIDAK berlabel.
 */
import { Bank, CaretRight, Eye, EyeSlash, Info, LockSimple, Wallet } from "phosphor-react-native"
import { Pressable, View } from "react-native"

import { Amount } from "@/components/ui/amount"
import { Card, CardSummary } from "@/components/ui/card"
import { ErrorState } from "@/components/ui/error-state"
import { Icon } from "@/components/ui/icon"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { summarize } from "@/lib/a11y"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"
import { formatRupiah } from "@/lib/format"
import { ESCROW_HELD_EXPLANATION } from "@/lib/labels/escrow"
import { tokens } from "@/lib/tokens"

export type WalletHeroCardProps = {
  /** Saldo tersedia — exact dari `GET /v1/wallet`. */
  available?: number
  /**
   * Dana dalam transaksi — pemanggil memetakan
   * `wallet.holdBalance ?? wallet.escrowBalance` (backend mengirim
   * `escrowBalance`; `holdBalance` fallback lama).
   */
  held?: number
  /** Sembunyikan nominal — dari `prefs.balanceHidden` (useUiPrefs). */
  hidden?: boolean
  /** Toggle preferensi — `() => setPrefs({ balanceHidden: !prefs.balanceHidden })`. */
  onToggleHidden?: () => void
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  /**
   * FE-IMP-4 item 1: bila diisi, sub-baris "dalam transaksi" menjadi tombol
   * yang membuka rincian order penahan (read-only).
   */
  onPressHeld?: () => void
  /**
   * FE-IMP-4 item 13: sisa limit tarik hari ini dari server
   * (`dailyWithdrawLimit - todayWithdrawAmount`). `undefined` = data tidak
   * tersedia → baris disembunyikan (bukan Rp 0 palsu).
   */
  withdrawLimitLeft?: number
  /**
   * D03 (batch 139): bila diisi, ikon info di samping label "Saldo Tersedia"
   * membuka rincian tersedia/tertahan/total (read-only).
   */
  onPressBreakdown?: () => void
  className?: string
}

export function WalletHeroCard({
  available,
  held,
  hidden = false,
  onToggleHidden,
  loading = false,
  error,
  onRetry,
  onPressHeld,
  withdrawLimitLeft,
  onPressBreakdown,
  className,
}: WalletHeroCardProps) {
  // Fail closed: error menggantikan kartu (bukan Rp 0 di dalam kartu).
  if (error) {
    return (
      <ErrorState
        compact
        title="Gagal memuat saldo"
        description={error}
        onRetry={onRetry}
        className={className}
      />
    )
  }

  const heldValue = held ?? 0
  const showHeld = heldValue > 0

  const summary = loading
    ? "Memuat saldo dompet"
    : hidden
      ? "Saldo dompet disembunyikan"
      : summarize([
          "Saldo tersedia",
          formatRupiah(available ?? Number.NaN),
          showHeld ? `Dalam transaksi: ${formatRupiah(heldValue)}` : undefined,
        ])

  return (
    <Card
      variant="inverted"
      elevation="medium"
      padded={false}
      className={cn("overflow-hidden rounded-lg", className)}
    >
      <View>
        {/*
         * Dekorasi premium: lingkaran bertumpuk di sudut kartu. Tanpa
         * expo-linear-gradient; warna = primary-foreground (mode-aware:
         * putih di kartu hitam light-mode, hitam di kartu putih dark-mode)
         * dengan opacity inline — view dekoratif TANPA anak sehingga
         * opacity tidak meredupkan konten.
         */}
        <View
          className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-primary-foreground"
          style={{ opacity: 0.07, pointerEvents: "none" }}
        />
        <View
          className="absolute -bottom-20 -left-12 h-44 w-44 rounded-full bg-primary-foreground"
          style={{ opacity: 0.05, pointerEvents: "none" }}
        />
        <View
          className="absolute -bottom-14 -left-6 h-32 w-32 rounded-full border-[20px] border-primary-foreground"
          style={{ opacity: 0.06, pointerEvents: "none" }}
        />

        <View className="gap-5 p-5">
          <View className="flex-row items-start justify-between gap-3">
            {/* Audit #4 (rule B): grup ringkasan hanya ikon + label "Saldo Tersedia"
                (dibacakan sebagai `summary`); tombol rincian & dalam transaksi di luar
                grup supaya tetap fokusable. */}
            <View className="flex-1 gap-2">
              <View className="flex-row items-center gap-2">
                <CardSummary label={summary} className="flex-row items-center gap-2">
                  <Icon icon={Wallet} size="xs" tone="inverse" />
                  <Text variant="caption" weight={600} tone="inverse">
                    Saldo Tersedia
                  </Text>
                </CardSummary>
                {onPressBreakdown && !loading ? (
                  // D03 (batch 139): rincian saldo tersedia/tertahan/total.
                  // Kotak 44x44 pola toggle mata — tidak menambah tinggi baris.
                  <Pressable
                    onPress={onPressBreakdown}
                    accessibilityRole="button"
                    accessibilityLabel="Lihat rincian saldo"
                    accessibilityHint="Menampilkan penjelasan saldo tersedia, dana dalam transaksi, dan total"
                    className={cn(
                      "-my-2 -mr-2 min-h-11 min-w-11 items-center justify-center rounded-full",
                      focusRing,
                    )}
                  >
                    <Icon icon={Info} size="xs" tone="inverse" />
                  </Pressable>
                ) : null}
              </View>
              {loading ? (
                <Skeleton height={tokens.typography.monoLarge.lineHeight} className="w-44" />
              ) : (
                /* FE-093: caption "yang bisa dipakai sekarang" dihapus —
                   hanya mengulang label "Saldo Tersedia". */
                <Amount
                  value={available ?? Number.NaN}
                  size="large"
                  tone="inverse"
                  hidden={hidden}
                />
              )}
              {loading ? (
                <Skeleton height={tokens.typography.caption.lineHeight} className="w-36" />
              ) : showHeld ? (
                <Pressable
                  onPress={onPressHeld}
                  disabled={!onPressHeld}
                  accessibilityRole={onPressHeld ? "button" : undefined}
                  accessibilityLabel={
                    onPressHeld
                      ? `Dalam transaksi: ${formatRupiah(heldValue)}. Ketuk untuk melihat rincian.`
                      : undefined
                  }
                  accessibilityHint={onPressHeld ? "Menampilkan rincian dana dalam transaksi" : undefined}
                  className={cn(
                    "flex-row items-center gap-1.5",
                    onPressHeld && "-m-1 rounded-xs p-1",
                    onPressHeld && focusRing,
                  )}
                >
                  <View className="gap-1">
                    <View className="flex-row items-center gap-1.5">
                      <Icon icon={LockSimple} size="xs" tone="inverse" />
                      <Amount value={heldValue} size="body" tone="inverse" hidden={hidden} />
                      <Text variant="caption" tone="inverse">
                        Dalam transaksi
                      </Text>
                      {onPressHeld ? (
                        <Icon icon={CaretRight} size="xs" tone="inverse" />
                      ) : null}
                    </View>
                    {/*
                     * FE-004: satu kalimat penjelasan baku untuk dana yang
                     * ditahan — dipakai ulang di hero, sheet rincian, dan
                     * sheet holds (lihat lib/labels/escrow.ts).
                     * FE-130: istilah "Ditahan di escrow" sudah baku di
                     * konstanta tersebut; tidak diduplikasi di sini.
                     */}
                    <Text variant="caption" tone="inverse" className="opacity-70">
                      {ESCROW_HELD_EXPLANATION}
                    </Text>
                  </View>
                </Pressable>
              ) : null}
              {/* FE-IMP-4 item 13: sisa limit tarik harian (server). */}
              {!loading && withdrawLimitLeft != null ? (
                <View className="flex-row items-center gap-1.5">
                  <Icon icon={Bank} size="xs" tone="inverse" />
                  <Text variant="caption" tone="inverse">
                    {hidden
                      ? "Sisa limit tarik hari ini disembunyikan"
                      : `Sisa limit tarik hari ini ${formatRupiah(withdrawLimitLeft)}`}
                  </Text>
                </View>
              ) : null}
            </View>
            {onToggleHidden ? (
              // Kotak nyata 44x44 + margin negatif agar tinggi baris label
              // tidak bertambah (pola WalletBalanceCard/HomeOverviewCard).
              <Pressable
                onPress={onToggleHidden}
                accessibilityRole="button"
                accessibilityLabel={hidden ? "Tampilkan saldo" : "Sembunyikan saldo"}
                accessibilityState={{ checked: !hidden }}
                className={cn(
                  "-mr-3 -mt-3 min-h-11 min-w-11 items-center justify-center rounded-full",
                  focusRing,
                )}
              >
                <Icon icon={hidden ? EyeSlash : Eye} size="sm" tone="inverse" />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Card>
  )
}
