/**
 * Kahade — <SubscriptionBenefitList> + <SubscriptionHistoryListItem>
 * (§9.17 List Item, §3.1 Mono, §2.3 status, §13 format).
 * API: GET /v1/subscriptions/benefits, GET /v1/subscriptions/history
 *
 * BenefitList — manfaat langganan AKTIF pengguna dengan pemakaian:
 *   ikon -> nama manfaat + deskripsi -> kanan: "3 / 10" Mono + ProgressBar
 *   tipis (untuk kuota) atau Check (untuk manfaat tak berkuota).
 *   Berbeda dari SubscriptionPlanCard yang menampilkan daftar manfaat
 *   sebagai fitur pemasaran (included/tidak) — di sini yang penting SISA.
 *   - ProgressBar tone: primary; berubah warning bila sisa <= 20%,
 *     danger bila habis. Ini status kuota, jadi semantik dibenarkan (§2.3).
 *   - Kuota tak terbatas (`limit` undefined) -> Badge "Tanpa batas", bukan
 *     "∞": simbol matematika kurang terbaca di caption.
 *
 * HistoryListItem — satu entri riwayat langganan/pembayaran:
 *   IconBox -> "Kahade Plus · Bulanan" + periode Mono -> nominal <Amount>
 *   + Badge status di kanan.
 *   - Periode ("1 Agu – 31 Agu 2026") sudah diformat pemanggil (§13).
 *   - Status REFUNDED nominal dicoret; FAILED nominal secondary.
 */
import { Check, Crown } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Amount } from "@/components/ui/amount"
import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { IconBox } from "@/components/ui/icon-box"
import { ListItem, type ListItemProps } from "@/components/ui/list-item"
import { ProgressBar, type ProgressTone } from "@/components/ui/progress-bar"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

// ------------------------------------------------------------------
// Benefit list
// ------------------------------------------------------------------

export type SubscriptionBenefitUsage = {
  id: string
  label: string
  description?: string
  icon?: IconComponent
  /** Terpakai periode ini */
  used?: number
  /** undefined = tanpa batas */
  limit?: number
  /** Sudah diformat (§13), mis. "Reset 1 Okt 2026" */
  resetHint?: string
}

export type SubscriptionBenefitListProps = Omit<ViewProps, "children"> & {
  items: readonly SubscriptionBenefitUsage[]
  unlimitedLabel?: string
  className?: string
}

function quotaTone(used: number, limit: number): ProgressTone {
  if (limit <= 0) return "primary"
  const remaining = (limit - used) / limit
  if (remaining <= 0) return "danger"
  if (remaining <= 0.2) return "warning"
  return "primary"
}

export function SubscriptionBenefitList({
  items,
  unlimitedLabel = "Tanpa batas",
  className,
  ...rest
}: SubscriptionBenefitListProps) {
  return (
    <View className={cn("w-full", className)} {...rest}>
      {items.map((b, i) => {
        const hasQuota = typeof b.limit === "number"
        const used = b.used ?? 0
        const pct = hasQuota && b.limit! > 0 ? Math.min(100, Math.round((used / b.limit!) * 100)) : 0
        const a11y = hasQuota ? `${b.label}, ${used} dari ${b.limit} terpakai` : `${b.label}, ${unlimitedLabel}`

        return (
          <View key={b.id} accessible accessibilityLabel={a11y}>
            <View className="flex-row items-start gap-3 px-6 py-3">
              <IconBox icon={b.icon ?? Crown} size="md" variant="surface" />
              <View className="flex-1 gap-1">
                <View className="flex-row items-start justify-between gap-3">
                  <Text variant="body" weight={500} tone="primary" numberOfLines={2} className="flex-1">
                    {b.label}
                  </Text>
                  {hasQuota ? (
                    <Text variant="monoBody" tone={used >= b.limit! ? "danger" : "primary"}>
                      {used} / {b.limit}
                    </Text>
                  ) : (
                    <View className="flex-row items-center gap-1">
                      <Icon icon={Check} size="xs" tone="success" />
                      <Badge tone="success" variant="soft">
                        {unlimitedLabel}
                      </Badge>
                    </View>
                  )}
                </View>
                {b.description ? (
                  <Text variant="caption" tone="secondary" className="leading-5">
                    {b.description}
                  </Text>
                ) : null}
                {hasQuota ? <ProgressBar value={pct} size="sm" tone={quotaTone(used, b.limit!)} /> : null}
                {b.resetHint ? (
                  <Text variant="caption" tone="secondary">
                    {b.resetHint}
                  </Text>
                ) : null}
              </View>
            </View>
            {i < items.length - 1 ? <View className="ml-[76px] h-px bg-border" /> : null}
          </View>
        )
      })}
    </View>
  )
}

// ------------------------------------------------------------------
// History list item
// ------------------------------------------------------------------

export type SubscriptionPaymentStatus = "PAID" | "PENDING" | "FAILED" | "REFUNDED"

export const SUBSCRIPTION_PAYMENT_LABELS: Record<SubscriptionPaymentStatus, string> = {
  PAID: "Lunas",
  PENDING: "Menunggu",
  FAILED: "Gagal",
  REFUNDED: "Dikembalikan",
}

const PAYMENT_TONE: Record<SubscriptionPaymentStatus, BadgeTone> = {
  PAID: "success",
  PENDING: "warning",
  FAILED: "danger",
  REFUNDED: "neutral",
}

export type SubscriptionHistoryListItemProps = Omit<ListItemProps, "title" | "subtitle" | "leading" | "trailing"> & {
  planName: string
  /** Mis. "Bulanan" / "Tahunan" */
  periodLabel?: string
  /** Sudah diformat: "1 Agu – 31 Agu 2026" */
  periodRange: string
  amount: number
  status: SubscriptionPaymentStatus | string
  /** Metode bayar, mis. "BCA Virtual Account" */
  paymentMethod?: string
  /** ID transaksi teknis — Mono */
  invoiceId?: string
  labels?: Partial<Record<SubscriptionPaymentStatus, string>>
}

export function SubscriptionHistoryListItem({
  planName,
  periodLabel,
  periodRange,
  amount,
  status,
  paymentMethod,
  invoiceId,
  labels,
  ...rest
}: SubscriptionHistoryListItemProps) {
  const t = { ...SUBSCRIPTION_PAYMENT_LABELS, ...labels }
  const s = status as SubscriptionPaymentStatus
  const statusLabel = t[s] ?? status
  const tone = PAYMENT_TONE[s] ?? "neutral"
  const paid = status === "PAID"
  const refunded = status === "REFUNDED"

  return (
    <ListItem
      leading={<IconBox icon={Crown} size="md" variant={paid ? "inverted" : "surface"} />}
      title={periodLabel ? `${planName} \u00B7 ${periodLabel}` : planName}
      subtitle={
        <View className="flex-row flex-wrap items-center gap-x-2">
          <Text variant="monoBody" tone="secondary">
            {periodRange}
          </Text>
          {paymentMethod ? (
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {paymentMethod}
            </Text>
          ) : null}
          {invoiceId ? (
            <Text variant="monoBody" tone="secondary" numberOfLines={1}>
              {invoiceId}
            </Text>
          ) : null}
        </View>
      }
      trailing={
        <View className="items-end gap-1">
          <Amount
            value={amount}
            size="body"
            sign="never"
            tone={paid ? "primary" : "secondary"}
            className={cn(refunded && "line-through")}
          />
          <Badge tone={tone} variant="soft">
            {statusLabel}
          </Badge>
        </View>
      }
      accessibilityLabel={`${planName}, ${periodRange}, ${statusLabel}`}
      {...rest}
    />
  )
}
