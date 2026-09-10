/**
 * Kahade — <HomeOverviewCard> kartu hero Beranda (§9.6 Card, §3.1 Mono Large,
 * §13 format, §14 keamanan).
 *
 * Satu kartu yang merangkum tiga hal yang paling sering dicek pengguna saat
 * membuka app — mengikuti pola "kartu akun" super app: identitas produk di
 * atas, angka penting di tengah, satu pemberitahuan penting di kaki kartu.
 *
 *   1. Saldo   → `GET /v1/wallet` : saldo tersedia (Mono Large) + dana yang
 *                ditahan escrow (accent = momen trust, v2 §2.3b) + toggle
 *                sembunyikan + tiga aksi dompet (Isi saldo / Tarik / Transfer)
 *                sebagai ikon bulat + caption (pola WalletBalanceCard).
 *   2. Statistik → `GET /v1/orders/summary` : Aktif · Selesai · Sengketa,
 *                tiga kolom tabular yang bisa ditekan menuju daftar terkait.
 *   3. Notice  → satu baris "perlu perhatian" di kaki kartu (sengketa aktif,
 *                transaksi berjalan, atau ajakan transaksi pertama). Pemanggil
 *                yang memutuskan isinya; komponen hanya menggambar.
 *
 * Keputusan non-obvious:
 *   - `elevation="medium"`: satu-satunya kartu hero di Beranda yang memang
 *     "mengambang" di atas konten lain (v2 §5.2). Kartu lain di layar ini
 *     flat/low.
 *   - Tiap bagian punya error + retry SENDIRI (prop `walletError` /
 *     `summaryError`): saldo gagal tidak boleh menghilangkan statistik order,
 *     dan sebaliknya. Bagian yang gagal diganti <ErrorState compact> di
 *     tempatnya sehingga tinggi kartu tetap stabil.
 *   - Grouping screen reader (audit #4): blok saldo dibungkus <CardSummary>
 *     (satu elemen: "Saldo tersedia, Rp1.250.000, Rp350.000 ditahan di
 *     escrow"), sementara toggle mata, tombol aksi, kolom statistik, dan
 *     notice tetap kontrol fokusable terpisah. Root kartu TIDAK berlabel.
 *   - Angka statistik memakai Sofia Sans tabular (`h2`), bukan Mono: ini
 *     HITUNGAN, bukan nominal/ID (§3.1). Sengketa > 0 satu-satunya yang
 *     memakai tone danger — warna semantik eksklusif untuk status kritikal.
 *   - Notice tone "danger" memakai bg-danger-soft + teks danger (AA 5.83:1),
 *     bukan bg-danger solid: kaki kartu merah pekat terlalu keras untuk layar
 *     pembuka. Tone "primary" (bg-primary + teks inverse) untuk ajakan biasa.
 *   - Loading = Skeleton hanya pada angka; label & kontrol tetap tampil agar
 *     layout stabil dan aksi dompet tetap bisa dijangkau saat refetch.
 */
import { CaretRight, Eye, EyeSlash, Wallet } from "phosphor-react-native"
import { Pressable, View, type ViewProps } from "react-native"

import { Amount } from "@/components/ui/amount"
import { Card, CardSummary } from "@/components/ui/card"
import type { ElevationLevel } from "@/lib/elevation"
import { Divider } from "@/components/ui/divider"
import { ErrorState } from "@/components/ui/error-state"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Skeleton } from "@/components/ui/skeleton"
import { Text, type TextTone } from "@/components/ui/text"
import { summarize } from "@/lib/a11y"
import { cn } from "@/lib/cn"
import { focusRing, focusRingInset } from "@/lib/focus-ring"
import { formatNumber, formatRupiah } from "@/lib/format"
import { tokens } from "@/lib/tokens"

export type OverviewWalletAction = {
  key: string
  label: string
  icon: IconComponent
  onPress: () => void
}

export type OverviewStat = {
  key: string
  label: string
  count: number
  /** Angka tone danger bila > 0 (mis. sengketa) */
  critical?: boolean
  onPress?: () => void
}

export type OverviewNotice = {
  title: string
  description?: string
  tone?: "primary" | "danger"
  onPress: () => void
}

export type HomeOverviewCardLabels = {
  available: string
  held: string
  hide: string
  show: string
  walletErrorTitle: string
  summaryErrorTitle: string
}

const DEFAULT_LABELS: HomeOverviewCardLabels = {
  available: "Saldo tersedia",
  held: "ditahan di escrow",
  hide: "Sembunyikan saldo",
  show: "Tampilkan saldo",
  walletErrorTitle: "Gagal memuat saldo",
  summaryErrorTitle: "Gagal memuat ringkasan order",
}

export type HomeOverviewCardProps = Omit<ViewProps, "children"> & {
  available?: number
  held?: number
  hidden?: boolean
  onToggleHidden?: () => void
  walletLoading?: boolean
  walletError?: string | null
  onRetryWallet?: () => void
  walletActions?: readonly OverviewWalletAction[]
  stats: readonly OverviewStat[]
  summaryLoading?: boolean
  summaryError?: string | null
  onRetrySummary?: () => void
  notice?: OverviewNotice
  labels?: Partial<HomeOverviewCardLabels>
  /** Tanpa border (di atas latar abu) */
  borderless?: boolean
  /** Override elevasi kartu */
  elevation?: ElevationLevel
  className?: string
}

export function HomeOverviewCard({
  available,
  held,
  hidden = false,
  onToggleHidden,
  walletLoading = false,
  walletError,
  onRetryWallet,
  walletActions = [],
  stats,
  summaryLoading = false,
  summaryError,
  onRetrySummary,
  notice,
  labels,
  borderless = false,
  elevation: cardElevation,
  className,
  ...rest
}: HomeOverviewCardProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const heldValue = held ?? 0
  const showHeld = heldValue > 0

  const balanceSummary = walletLoading
    ? `Memuat ${t.available}`
    : hidden
      ? `${t.available} disembunyikan`
      : summarize([
          t.available,
          formatRupiah(available ?? Number.NaN),
          showHeld ? `${formatRupiah(heldValue)} ${t.held}` : undefined,
        ])

  return (
    <Card variant="elevated" elevation={cardElevation ?? "medium"} padded={false} borderless={borderless} className={className} {...rest}>
      {/* ── Saldo ─────────────────────────────────────────────── */}
      <View className="gap-4 p-5">
        {walletError ? (
          <ErrorState
            compact
            title={t.walletErrorTitle}
            description={walletError}
            onRetry={onRetryWallet}
          />
        ) : (
          <View className="flex-row items-start justify-between gap-3">
            <CardSummary label={balanceSummary} className="flex-1 gap-1">
              <View className="flex-row items-center gap-2">
                <Icon icon={Wallet} size="xs" tone="default" />
                <Text variant="caption" weight={500} tone="secondary">
                  {t.available}
                </Text>
              </View>
              {walletLoading ? (
                <Skeleton height={tokens.typography.monoLarge.lineHeight} className="w-44" />
              ) : (
                <Amount value={available ?? Number.NaN} size="large" hidden={hidden} />
              )}
              {walletLoading ? (
                <Skeleton height={tokens.typography.caption.lineHeight} className="w-36" />
              ) : showHeld ? (
                <View className="flex-row items-center gap-1">
                  <Amount value={heldValue} size="body" tone="accent" hidden={hidden} />
                  <Text variant="caption" tone="accent">
                    {t.held}
                  </Text>
                </View>
              ) : null}
            </CardSummary>
            {onToggleHidden ? (
              // Kotak nyata 44x44 + margin negatif agar tinggi baris label
              // tidak bertambah (pola WalletBalanceCard, audit #1).
              <Pressable
                onPress={onToggleHidden}
                accessibilityRole="button"
                accessibilityLabel={hidden ? t.show : t.hide}
                accessibilityState={{ checked: !hidden }}
                className={cn(
                  "-mr-3 -mt-3 min-h-11 min-w-11 items-center justify-center rounded-xs",
                  focusRing,
                )}
              >
                <Icon icon={hidden ? EyeSlash : Eye} size="sm" tone="default" />
              </Pressable>
            ) : null}
          </View>
        )}

        {walletActions.length > 0 ? (
          // Ikon bulat + caption bertumpuk (pola WalletBalanceCard), bukan tiga
          // <Button> berjajar: di lebar 360 tiap kolom hanya ±85px — label
          // "Isi saldo" + ikon di dalam pill akan patah dua baris.
          <View className="flex-row gap-2" accessibilityRole="toolbar">
            {walletActions.map((a) => (
              <PressableScale
                key={a.key}
                accessibilityRole="button"
                accessibilityLabel={a.label}
                accessibilityHint={`Buka ${a.label}`}
                haptic
                onPress={a.onPress}
                containerClassName={cn("flex-1 rounded-sm", focusRing)}
                className="items-center gap-2 py-1"
              >
                <View className="h-11 w-11 items-center justify-center rounded-full bg-surface dark:bg-surface-elevated">
                  <Icon icon={a.icon} size="sm" tone="active" />
                </View>
                <Text ellipsizeMode="tail" variant="caption" weight={500} tone="primary" numberOfLines={1}>
                  {a.label}
                </Text>
              </PressableScale>
            ))}
          </View>
        ) : null}
      </View>

      <Divider />

      {/* ── Statistik order ──────────────────────────────────── */}
      {summaryError ? (
        <View className="px-5">
          <ErrorState
            compact
            title={t.summaryErrorTitle}
            description={summaryError}
            onRetry={onRetrySummary}
          />
        </View>
      ) : (
        <View className="flex-row items-stretch">
          {stats.map((s, i) => {
            const valueTone: TextTone =
              s.critical && s.count > 0 ? "danger" : s.count === 0 ? "secondary" : "primary"
            return (
              <View key={s.key} className="flex-1 flex-row">
                {i > 0 ? <Divider orientation="vertical" className="my-4" /> : null}
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={
                    summaryLoading ? `Memuat ${s.label}` : `${s.label}, ${formatNumber(s.count)}`
                  }
                  accessibilityHint={s.onPress ? `Buka daftar ${s.label.toLowerCase()}` : undefined}
                  accessibilityState={{ disabled: !s.onPress }}
                  disabled={!s.onPress}
                  scaleOnPress={false}
                  onPress={s.onPress}
                  containerClassName={cn("flex-1", focusRingInset)}
                  className="items-center gap-1 px-2 py-4"
                >
                  {summaryLoading ? (
                    <Skeleton height={tokens.typography.h2.lineHeight} className="w-10" />
                  ) : (
                    <Text variant="h2" tone={valueTone} className="tabular-nums">
                      {formatNumber(s.count)}
                    </Text>
                  )}
                  <Text
                    ellipsizeMode="tail"
                    variant="caption"
                    tone="secondary"
                    numberOfLines={1}
                    className="text-center"
                  >
                    {s.label}
                  </Text>
                </PressableScale>
              </View>
            )
          })}
        </View>
      )}

      {/* ── Notice kaki kartu ────────────────────────────────── */}
      {notice ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={summarize([notice.title, notice.description])}
          scaleOnPress={false}
          haptic
          onPress={notice.onPress}
          containerClassName={cn("w-full", focusRingInset)}
          className={cn(
            "flex-row items-center gap-3 px-5 py-3",
            notice.tone === "danger" ? "bg-danger-soft" : "bg-primary",
          )}
        >
          <View className="flex-1 gap-0.5">
            <Text
              variant="body"
              weight={600}
              tone={notice.tone === "danger" ? "danger" : "inverse"}
              numberOfLines={1}
            >
              {notice.title}
            </Text>
            {notice.description ? (
              <Text
                variant="caption"
                tone={notice.tone === "danger" ? "danger" : "inverse"}
                numberOfLines={1}
              >
                {notice.description}
              </Text>
            ) : null}
          </View>
          <View
            className={cn(
              "h-8 w-8 items-center justify-center rounded-full",
              notice.tone === "danger" ? "bg-danger" : "bg-primary-foreground",
            )}
          >
            <Icon
              icon={CaretRight}
              size="xs"
              weight="bold"
              tone={notice.tone === "danger" ? "inverse" : "active"}
            />
          </View>
        </PressableScale>
      ) : null}
    </Card>
  )
}
