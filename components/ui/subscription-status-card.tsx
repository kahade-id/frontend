/**
 * Kahade — <SubscriptionStatusCard> status langganan aktif pengguna (§9.6
 * Card, §9.7 Badge, §3.1 Mono untuk tanggal & harga, §9.1 Button).
 *
 * Pasangan <SubscriptionPlanCard> (katalog paket): kartu ini menampilkan
 * `GET /v1/subscriptions/status` — paket yang SEDANG dimiliki, masa berlaku,
 * dan aksi Perpanjang (`POST /v1/subscriptions/renew`) / Berhenti
 * (`POST /v1/subscriptions/cancel`). Anatomi:
 *   nama paket (h3) ..... Badge status
 *   KeyValueList: Periode (MONTHLY/ANNUAL) · Berlaku s.d. · Harga perpanjangan
 *   opsional: sisa hari sebagai caption (warning bila <= 7 hari)
 *   aksi: Perpanjang (primary) · Berhenti berlangganan (ghost)
 *
 * Keputusan non-obvious:
 *   - Status: ACTIVE (success) / EXPIRING (warning — masih aktif tapi sisa
 *     hari <= ambang) / EXPIRED (neutral) / CANCELLED (neutral — masih bisa
 *     dipakai sampai akhir periode bila `endsAt` di masa depan) / NONE
 *     (belum berlangganan). EXPIRING dihitung komponen dari `daysLeft` bila
 *     pemanggil mengirim status ACTIVE — supaya backend tidak perlu status
 *     turunan. Tidak ada merah: langganan habis bukan error.
 *   - NONE dirender sebagai kartu ajakan minimal (judul + deskripsi + CTA
 *     "Lihat paket"), bukan EmptyState besar — kartu ini biasanya duduk di
 *     halaman Profil di antara kartu lain.
 *   - Tombol Berhenti selalu `ghost` (bukan destructive): konsekuensinya
 *     reversibel sampai periode berakhir, dan konfirmasi ada di Modal (§10)
 *     milik pemanggil. Disembunyikan bila sudah CANCELLED/EXPIRED.
 *   - `autoRenew` ditampilkan sebagai baris KeyValue "Perpanjang otomatis:
 *     Aktif/Nonaktif" — bukan Switch di dalam kartu: mengubahnya melibatkan
 *     PIN (SubscribeDto.pin), jadi harus lewat alur terpisah.
 */
import { View, type ViewProps } from "react-native"

import { Amount } from "@/components/ui/amount"
import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardSummary, type CardProps } from "@/components/ui/card"
import { KeyValue, KeyValueList } from "@/components/ui/key-value"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { summarize } from "@/lib/a11y"
import { cn } from "@/lib/cn"
import { hasOwn } from "@/lib/has-own"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export type SubscriptionPeriod = "MONTHLY" | "ANNUAL"
export type SubscriptionStatus = "NONE" | "ACTIVE" | "EXPIRING" | "EXPIRED" | "CANCELLED"

/** Sisa hari yang membuat ACTIVE dianggap EXPIRING */
export const EXPIRING_THRESHOLD_DAYS = 7

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  NONE: "Belum berlangganan",
  ACTIVE: "Aktif",
  EXPIRING: "Segera berakhir",
  EXPIRED: "Berakhir",
  CANCELLED: "Dihentikan",
}

const STATUS_TONE: Record<SubscriptionStatus, BadgeTone> = {
  NONE: "neutral",
  ACTIVE: "success",
  EXPIRING: "warning",
  EXPIRED: "neutral",
  CANCELLED: "neutral",
}

export type SubscriptionStatusCardLabels = Record<SubscriptionStatus, string> & {
  period: string
  monthly: string
  annual: string
  endsAt: string
  renewalPrice: string
  autoRenew: string
  on: string
  off: string
  daysLeft: (n: number) => string
  renew: string
  cancel: string
  browsePlans: string
  noneDescription: string
}

const DEFAULT_LABELS: SubscriptionStatusCardLabels = {
  ...SUBSCRIPTION_STATUS_LABELS,
  period: "Periode",
  monthly: "Bulanan",
  annual: "Tahunan",
  endsAt: "Berlaku s.d.",
  renewalPrice: "Biaya perpanjangan",
  autoRenew: "Perpanjang otomatis",
  on: "Aktif",
  off: "Nonaktif",
  daysLeft: (n) => (n <= 0 ? "Berakhir hari ini" : `${n} hari lagi`),
  renew: "Perpanjang",
  cancel: "Berhenti berlangganan",
  browsePlans: "Lihat paket",
  noneDescription: "Dapatkan biaya escrow lebih rendah dan prioritas penanganan sengketa.",
}

export type SubscriptionStatusCardProps = Omit<CardProps, "children" | "variant" | "padded" | "onPress"> & {
  status: SubscriptionStatus | string
  planName?: string
  period?: SubscriptionPeriod
  /** Sudah diformat pemanggil (§13) */
  endsAt?: string
  daysLeft?: number
  renewalPrice?: number
  autoRenew?: boolean
  onRenew?: () => void
  onCancel?: () => void
  onBrowsePlans?: () => void
  renewing?: boolean
  labels?: Partial<SubscriptionStatusCardLabels>
}

function resolveStatus(status: string, daysLeft?: number): SubscriptionStatus {
  // Own keys only: `in` would accept inherited keys such as "toString".
  if (!hasOwn(SUBSCRIPTION_STATUS_LABELS, status)) return "NONE"
  const s = status as SubscriptionStatus
  if (s === "ACTIVE" && daysLeft != null && daysLeft <= EXPIRING_THRESHOLD_DAYS) return "EXPIRING"
  return s
}

export function SubscriptionStatusCard({
  status,
  planName,
  period,
  endsAt,
  daysLeft,
  renewalPrice,
  autoRenew,
  onRenew,
  onCancel,
  onBrowsePlans,
  renewing = false,
  labels,
  className,
  ...rest
}: SubscriptionStatusCardProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const s = resolveStatus(status, daysLeft)

  if (s === "NONE") {
    return (
      <Card className={cn("gap-4", className)} {...rest}>
        <View className="gap-1">
          <Text variant="h3" tone="primary">
            {t.NONE}
          </Text>
          <Text variant="caption" tone="secondary">
            {t.noneDescription}
          </Text>
        </View>
        {onBrowsePlans ? (
          <Button variant="secondary" onPress={onBrowsePlans}>
            {t.browsePlans}
          </Button>
        ) : null}
      </Card>
    )
  }

  const canRenew = onRenew && (s === "EXPIRING" || s === "EXPIRED" || s === "CANCELLED")
  const canCancel = onCancel && (s === "ACTIVE" || s === "EXPIRING")

  return (
    // Label di <CardSummary>, bukan root: kartu punya Button Perpanjang/Batalkan
    // yang akan tertelan `accessible` root (audit #4).
    <Card className={cn("gap-4", className)} {...rest}>
      <CardSummary
        className="gap-4"
        label={summarize([
          planName,
          t[s],
          daysLeft != null && (s === "ACTIVE" || s === "EXPIRING" || s === "CANCELLED") ? t.daysLeft(daysLeft) : undefined,
          period ? `${t.period} ${period === "MONTHLY" ? t.monthly : t.annual}` : undefined,
          endsAt ? `${t.endsAt} ${endsAt}` : undefined,
          autoRenew != null ? `${t.autoRenew} ${autoRenew ? t.on : t.off}` : undefined,
        ])}
      >
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <Text variant="h3" tone="primary" numberOfLines={1}>
              {planName}
            </Text>
            {daysLeft != null && (s === "ACTIVE" || s === "EXPIRING" || s === "CANCELLED") ? (
              <Text variant="caption" tone={s === "EXPIRING" ? "warning" : "secondary"} className="tabular-nums">
                {t.daysLeft(daysLeft)}
              </Text>
            ) : null}
          </View>
          <Badge tone={STATUS_TONE[s]} variant="soft" dot>
            {t[s]}
          </Badge>
        </View>

        <KeyValueList>
          {period ? <KeyValue label={t.period} value={period === "MONTHLY" ? t.monthly : t.annual} /> : null}
          {endsAt ? <KeyValue label={t.endsAt} value={endsAt} mono /> : null}
          {renewalPrice != null ? <KeyValue label={t.renewalPrice} value={<Amount value={renewalPrice} size="body" tone="primary" />} /> : null}
          {autoRenew != null ? <KeyValue label={t.autoRenew} value={autoRenew ? t.on : t.off} /> : null}
        </KeyValueList>
      </CardSummary>

      {canRenew || canCancel ? (
        <View className="gap-2">
          {canRenew ? (
            <Button variant="primary" onPress={onRenew} loading={renewing}>
              {t.renew}
            </Button>
          ) : null}
          {canCancel ? (
            <Button variant="ghost" onPress={onCancel}>
              {t.cancel}
            </Button>
          ) : null}
        </View>
      ) : null}
    </Card>
  )
}

export function SubscriptionStatusCardSkeleton({ className, ...rest }: Omit<ViewProps, "children"> & { className?: string }) {
  return (
    <View accessible accessibilityRole="progressbar" className={cn("w-full gap-4 rounded-md border border-border bg-surface p-5", className)} accessibilityLabel="Memuat status langganan" {...rest}>
      <View className="flex-row items-start justify-between">
        <View className="gap-2">
          <Skeleton height={20} className="w-32" />
          <Skeleton height={12} className="w-20" />
        </View>
        <Skeleton height={22} className="w-16" />
      </View>
      <Skeleton height={14} className="w-full" />
      <Skeleton height={14} className="w-full" />
      <Skeleton height={14} className="w-full" />
    </View>
  )
}