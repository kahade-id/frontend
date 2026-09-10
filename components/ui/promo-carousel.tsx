/**
 * Kahade — <PromoCarousel> kartu sorotan fitur di Beranda (§9.6 Card,
 * §5 radius lg khusus hero, §9.25 PageIndicator).
 *
 * Pager horizontal berisi 2–4 kartu "sorotan" — fitur produk yang ingin
 * ditonjolkan ke pengguna (escrow, Order Link, referral, verifikasi). Pola
 * banner promo super app, tetapi isinya edukasi fitur Kahade sendiri — bukan
 * iklan pihak ketiga — sehingga tetap tenang: warna dari palet soft semantik,
 * tanpa gambar bitmap yang bersaing dengan angka saldo di atasnya.
 *
 * Keputusan non-obvious:
 *   - Lebar kartu = lebar container − 2×24 (screen padding), diukur lewat
 *     `onLayout` — bukan `useWindowDimensions`: di web konten di-cap 520px
 *     (§11) sehingga lebar jendela bukan lebar kolom.
 *   - `snapToOffsets` = i × (lebar kartu + gap 12) → satu kartu per halaman,
 *     kartu berikut mengintip di tepi kanan sebagai isyarat bisa digeser.
 *     Bukan `snapToInterval`: konten diawali inset 24px, jadi kelipatan
 *     interval murni akan meleset 24px dari tepi kartu; offset eksplisit
 *     0, interval, 2·interval tepat menaruh kartu ke-i sejajar screen
 *     padding, dan offset terakhir == scroll maksimum (kartu terakhir
 *     tidak "menggantung").
 *     Index halaman dihitung dari `onScroll` (throttle 32ms), BUKAN
 *     `onMomentumScrollEnd`: react-native-web tidak memancarkan event
 *     momentum, sehingga <PageIndicator> di web tidak pernah berpindah.
 *     `setIndex` dengan nilai sama di-bail-out React — murah.
 *   - Kartu memakai `rounded-lg` (12px) — satu-satunya radius besar di
 *     Beranda selain kartu hero, sesuai batasan v2 §5 (hero saja).
 *   - Ikon di lingkaran fill tone (accent/info/warning) dengan ikon
 *     "inverse": primary-foreground putih di light dan gelap di dark —
 *     kontras ≥ 3:1 di keempat kombinasi (WCAG 1.4.11 objek grafis).
 *   - Satu kartu = satu tautan penuh (<RouteLink>, bukan <Card href>) supaya
 *     di web menjadi <a> sungguhan; CTA di dalamnya hanya visual (Text),
 *     bukan tombol bersarang. Tidak memakai <Card> karena varian Card selalu
 *     memasang bg + rounded-md sendiri, dan menimpanya lewat className
 *     bergantung urutan CSS — rapuh di NativeWind.
 */
import { useCallback, useState } from "react"
import { ArrowRight } from "phosphor-react-native"
import {
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewProps,
} from "react-native"
import type { Href } from "expo-router"

import { Icon, type IconComponent } from "@/components/ui/icon"
import { PageIndicator } from "@/components/ui/page-indicator"
import { RouteLink } from "@/components/ui/route-link"
import { ScrollRow } from "@/components/ui/scroll-row"
import { Text, type TextTone } from "@/components/ui/text"
import { summarize } from "@/lib/a11y"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"

export type PromoTone = "accent" | "info" | "warning"

export type PromoItem = {
  key: string
  /** Label pendek di badge (mis. "Escrow") */
  eyebrow: string
  title: string
  description: string
  /** Teks CTA visual (mis. "Pelajari") */
  cta: string
  icon: IconComponent
  tone?: PromoTone
  href: Href
}

export type PromoCarouselProps = Omit<ViewProps, "children"> & {
  items: readonly PromoItem[]
  className?: string
}

const cardBg: Record<PromoTone, string> = {
  accent: "bg-accent-soft",
  info: "bg-info-soft",
  warning: "bg-warning-soft",
}

const circleBg: Record<PromoTone, string> = {
  accent: "bg-accent",
  info: "bg-info",
  warning: "bg-warning",
}

const eyebrowTone: Record<PromoTone, TextTone> = {
  accent: "accent",
  info: "info",
  warning: "warning",
}

const GAP = tokens.space[3]
const INSET = tokens.layout.screenPaddingX

export function PromoCarousel({ items, className, ...rest }: PromoCarouselProps) {
  const [width, setWidth] = useState(0)
  const [index, setIndex] = useState(0)

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width)
  }, [])

  // Kartu selebar kolom konten; halaman berikutnya mengintip lewat gap.
  const cardW = Math.max(0, width - INSET * 2)
  const interval = cardW + GAP
  const offsets = items.map((_, i) => i * interval)

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (interval <= 0) return
      const next = Math.round(e.nativeEvent.contentOffset.x / interval)
      setIndex(Math.min(items.length - 1, Math.max(0, next)))
    },
    [interval, items.length],
  )

  if (items.length === 0) return null

  return (
    <View onLayout={onLayout} className={cn("w-full gap-3", className)} {...rest}>
      {cardW > 0 ? (
        <ScrollRow
          gap={3}
          align="start"
          snapToOffsets={offsets}
          decelerationRate="fast"
          onScroll={onScroll}
          scrollEventThrottle={32}
        >
          {items.map((item) => {
            const tone = item.tone ?? "accent"
            return (
              <View key={item.key} style={{ width: cardW }}>
                <RouteLink
                  href={item.href}
                  accessibilityLabel={summarize([item.eyebrow, item.title, item.description])}
                  accessibilityHint={item.cta}
                  haptic
                  containerClassName="w-full rounded-lg"
                  className={cn(
                    "w-full flex-row items-center gap-4 overflow-hidden rounded-lg p-5",
                    cardBg[tone],
                  )}
                >
                  <View className="flex-1 gap-2">
                    <Text variant="label" tone={eyebrowTone[tone]}>
                      {item.eyebrow}
                    </Text>
                    <Text variant="h3" tone="primary" numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text variant="caption" tone="secondary" numberOfLines={2}>
                      {item.description}
                    </Text>
                    <View className="flex-row items-center gap-1 pt-1">
                      <Text variant="label" tone="primary">
                        {item.cta}
                      </Text>
                      <Icon icon={ArrowRight} size="xs" weight="bold" tone="active" />
                    </View>
                  </View>
                  <View
                    className={cn(
                      "h-16 w-16 items-center justify-center rounded-full",
                      circleBg[tone],
                    )}
                  >
                    <Icon icon={item.icon} size="xl" weight="fill" tone="inverse" />
                  </View>
                </RouteLink>
              </View>
            )
          })}
        </ScrollRow>
      ) : null}
      {items.length > 1 ? <PageIndicator count={items.length} index={index} /> : null}
    </View>
  )
}
