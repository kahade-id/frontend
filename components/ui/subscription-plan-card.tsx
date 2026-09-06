/**
 * Kahade — <SubscriptionPlanCard> (§9.6 Card selected/inverted, §9.7 Badge,
 * §3.1 Mono untuk harga, §13 format Rupiah, §9.1 Button).
 *
 * Kartu satu paket langganan (`GET /v1/subscriptions/plans`): nama, harga
 * per periode, daftar manfaat, dan CTA. Dipakai berjajar vertikal (mobile)
 * — pemanggil merender satu kartu per paket, dengan `selected` untuk paket
 * yang sedang dibandingkan dan `current` untuk paket aktif pengguna.
 *
 * Keputusan non-obvious:
 *   - Tidak ada kartu "hero" berwarna/gradien untuk paket unggulan: sistem
 *     monokrom (§1). Paket unggulan (`highlighted`) memakai Card
 *     `variant="inverted"` (bg-primary; ikut invert di dark mode — §9.6
 *     catatan Stat/Highlight) + Badge "Populer". Hanya SATU kartu boleh
 *     `highlighted` per daftar — tanggung jawab pemanggil.
 *   - Di kartu inverted SEMUA teks tone "inverse" tanpa opacity — mengikuti
 *     keputusan <StatCard>: token mode tidak punya "inverse-secondary" dan
 *     opacity menurunkan kontras di bawah AA. Hierarki dari ukuran + weight.
 *   - CTA di kartu inverted: Button `primary` biasa akan menyatu dengan bg
 *     (hitam di atas hitam) dan `secondary` memakai text-primary yang juga
 *     hitam. Solusinya BUKAN varian Button baru, melainkan membungkus CTA
 *     dalam scope NativeWind `vars()` yang menukar `--color-primary` <->
 *     `--color-primary-foreground` (dan text-primary -> primary-foreground).
 *     Button tetap `variant="primary"` dan token tetap satu sumber; hanya
 *     nilainya yang dibalik di subtree kecil itu. Pola ini sama dengan
 *     ThemeProvider yang mengisi CSS var lewat `vars()`.
 *   - Harga Mono 24 (`monoLarge` via <Amount size="large">) + periode
 *     caption di sampingnya ("/bulan"). Harga coret (`originalPrice`) untuk
 *     promo dirender `monoBody` `line-through` — pola yang sama dengan kode
 *     terpakai di BackupCodesDisplay.
 *   - Manfaat: ikon Check Phosphor + body. Manfaat yang TIDAK termasuk
 *     (`included: false`) tetap ditulis dengan ikon Minus dan tone disabled
 *     — pengguna melihat apa yang hilang tanpa membandingkan dua kartu di
 *     kepala. Di kartu inverted, item tidak-termasuk tetap inverse (bukan
 *     disabled abu) karena kontras abu di atas hitam tidak dijamin AA;
 *     pembedanya ikon Minus + a11y label "tidak termasuk".
 *   - CTA: `current` -> `secondary` disabled "Paket aktif"; `highlighted`
 *     -> `primary` (dalam scope inverse); lainnya `secondary`.
 *   - Kartu bisa `onPress` (memilih untuk dibandingkan) TERPISAH dari CTA
 *     `onSubscribe`: Card `selected` menebalkan border ke border-focus (§6).
 *   - `trialLabel` ("Gratis 14 hari pertama") dan `renewalLabel` adalah
 *     string dari pemanggil — copy legal harus bisa diubah tanpa menyentuh
 *     komponen (§12 i18n-ready).
 */
import { Check, Minus } from "phosphor-react-native"
import { useMemo } from "react"
import { View, type ViewProps } from "react-native"
import { vars } from "nativewind"

import { useTheme } from "@/components/theme-provider"
import { Amount } from "@/components/ui/amount"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"
import { Text, type TextTone } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { formatRupiah } from "@/lib/format"
import { tokens } from "@/lib/tokens"

export type SubscriptionBenefit = {
  id: string
  label: string
  included?: boolean
}

export type SubscriptionPlanCardLabels = {
  popular: string
  current: string
  subscribe: string
  choose: string
  notIncluded: string
}

export type SubscriptionPlanCardProps = Omit<ViewProps, "children"> & {
  name: string
  description?: string
  price: number
  /** "/bulan", "/tahun" */
  period: string
  /** Harga sebelum promo (dirender coret) */
  originalPrice?: number
  benefits: SubscriptionBenefit[]
  /** Paket unggulan: kartu inverted + Badge "Populer" — maksimal satu per daftar */
  highlighted?: boolean
  /** Paket yang sedang aktif untuk pengguna */
  current?: boolean
  /** Sedang dibandingkan (border-focus) */
  selected?: boolean
  onPress?: () => void
  onSubscribe?: () => void
  subscribing?: boolean
  trialLabel?: string
  renewalLabel?: string
  labels?: Partial<SubscriptionPlanCardLabels>
  className?: string
}

const DEFAULT_LABELS: SubscriptionPlanCardLabels = {
  popular: "Populer",
  current: "Paket aktif",
  subscribe: "Berlangganan",
  choose: "Pilih paket",
  notIncluded: "tidak termasuk",
}

/**
 * Scope CSS var yang menukar primary <-> primary-foreground. Dipakai untuk
 * elemen bertoken (Button, Badge) di atas bg-primary.
 */
export function useInverseScopeVars() {
  const { mode } = useTheme()
  return useMemo(() => {
    const p = tokens.colors[mode]
    return vars({
      "--color-primary": p.primaryForeground,
      "--color-primary-foreground": p.primary,
      "--color-text-primary": p.primaryForeground,
      "--color-text-secondary": p.primaryForeground,
      "--color-border-default": p.primaryForeground,
    })
  }, [mode])
}

export function SubscriptionPlanCard({
  name,
  description,
  price,
  period,
  originalPrice,
  benefits,
  highlighted = false,
  current = false,
  selected = false,
  onPress,
  onSubscribe,
  subscribing = false,
  trialLabel,
  renewalLabel,
  labels,
  className,
  ...rest
}: SubscriptionPlanCardProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const inverseVars = useInverseScopeVars()
  const inverted = highlighted

  const textTone: TextTone = inverted ? "inverse" : "primary"
  const mutedTone: TextTone = inverted ? "inverse" : "secondary"
  const hintTone: TextTone = inverted ? "inverse" : "secondary"
  const iconTone = inverted ? "inverse" : "default"

  const ctaLabel = current ? t.current : highlighted ? t.subscribe : t.choose
  const ctaVariant = current ? "secondary" : highlighted ? "primary" : "secondary"

  return (
    <Card
      variant={inverted ? "inverted" : "elevated"}
      padded
      selected={selected}
      onPress={onPress}
      accessibilityLabel={`${name}, ${formatRupiah(price)} ${period}${highlighted ? `, ${t.popular}` : ""}${
        current ? `, ${t.current}` : ""
      }`}
      className={cn("gap-5", className)}
      {...rest}
    >
      <View className="flex-row items-start gap-2 tabular-nums">
        <View className="flex-1 gap-1">
          <Text ellipsizeMode="tail" numberOfLines={2} variant="h3" tone={textTone}>
            {name}
          </Text>
          {description ? (
            <Text variant="body" tone={mutedTone}>
              {description}
            </Text>
          ) : null}
        </View>
        {highlighted ? (
          <View style={inverseVars}>
            <Badge tone="neutral" variant="outline">
              {t.popular}
            </Badge>
          </View>
        ) : current ? (
          <Badge tone="success" variant="soft">
            {t.current}
          </Badge>
        ) : null}
      </View>

      <View className="flex-row items-end gap-2">
        <Amount value={price} size="large" tone={inverted ? "inverse" : "primary"} />
        <Text variant="caption" tone={mutedTone} className="pb-1">
          {period}
        </Text>
        {originalPrice != null && originalPrice > price ? (
          <Text variant="monoBody" tone={hintTone} className="pb-1 line-through">
            {formatRupiah(originalPrice)}
          </Text>
        ) : null}
      </View>

      {trialLabel ? (
        <Text variant="label" tone={textTone}>
          {trialLabel}
        </Text>
      ) : null}

      <View className="gap-2">
        {benefits.map((b) => {
          const included = b.included !== false
          return (
            <View
              key={b.id}
              accessible
              accessibilityLabel={included ? b.label : `${b.label}, ${t.notIncluded}`}
              className="flex-row items-start gap-2"
            >
              <View className="pt-[3px]">
                <Icon
                  icon={included ? Check : Minus}
                  size="xs"
                  tone={included ? iconTone : inverted ? "inverse" : "disabled"}
                />
              </View>
              <Text
                variant="body"
                tone={included ? textTone : inverted ? "inverse" : "disabled"}
                className={cn("flex-1", !included && "line-through")}
              >
                {b.label}
              </Text>
            </View>
          )
        })}
      </View>

      {onSubscribe || current ? (
        <View className="gap-2">
          <View style={inverted ? inverseVars : undefined}>
            <Button accessibilityHint="Ketuk untuk berinteraksi" variant={ctaVariant} disabled={current} loading={subscribing} onPress={onSubscribe}>
              {ctaLabel}
            </Button>
          </View>
          {renewalLabel ? (
            <Text variant="caption" tone={hintTone} className="text-center focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
              {renewalLabel}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Card>
  )
}