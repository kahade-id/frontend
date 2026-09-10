/**
 * Kahade — <PromoCarousel> kartu sorotan fitur di Beranda (§9.6 Card,
 * §5 radius lg khusus hero, §9.25 PageIndicator).
 *
 * Pager horizontal berisi 2–4 kartu "sorotan" — fitur produk yang ingin
 * ditonjolkan ke pengguna (escrow, Order Link, referral). Ciri:
 *   - Kartu selebar `lebar container − inset × 2 − peek × 2` sehingga kartu
 *     sebelumnya dan sesudah MENGINTIP di kedua sisi (bukan cuma kanan),
 *     memberi isyarat "ini bisa digeser dua arah".
 *   - `snapToOffsets` eksak per kartu; decelerationRate fast.
 *   - Infinite loop: kartu di-clone (akhir ditempel di depan, awal di belakang)
 *     saat scroll mencapai ujung, kita jump (tanpa animasi) ke clone lalu
 *     scroll normal lagi. Implementasi ringan tanpa FlatList — cukup View
 *     dalam ScrollView karena jumlah kartu sedikit (≤ 6).
 *   - Title dibatasi 1 baris (`numberOfLines={1}`) + adjustsFontSizeToFit
 *     supaya tinggi kartu selalu sama dan carousel stabil.
 *   - CTA = teks underline SAJA, tanpa panah/ikon (sesuai permintaan desain).
 *   - PageIndicator dot tetap tampil di tengah.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import {
  ScrollView,
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
import { Text, type TextTone } from "@/components/ui/text"
import { summarize } from "@/lib/a11y"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"

export type PromoTone = "accent" | "info" | "warning"

export type PromoItem = {
  key: string
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
/** Intipan kartu sebelum/sesudah di sisi kiri/kanan */
const PEEK = 20

export function PromoCarousel({ items, className, ...rest }: PromoCarouselProps) {
  const [width, setWidth] = useState(0)
  const [index, setIndex] = useState(0)
  const scrollRef = useRef<ScrollView>(null)
  const [ready, setReady] = useState(false)
  const programmaticRef = useRef(false)

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width)
  }, [])

  // Lebar kartu: layak dikurangi inset kiri-kanan + peek kedua sisi
  const cardW = Math.max(0, width - INSET * 2 - PEEK * 2)
  const interval = cardW + GAP
  const isInfinite = items.length > 1
  // Clone: [last, ...items, first] untuk infinite loop
  const visibleItems = isInfinite ? [items[items.length - 1], ...items, items[0]] : items
  const offsets = visibleItems.map((_, i) => INSET + i * interval - PEEK)
  // Index "asli" user: di posisi awal kita sudah loncat ke clone ke-1 (=item pertama)
  const startOffset = isInfinite ? offsets[1] : offsets[0]

  // Saat layout siap, loncat ke item ke-1 (bukan clone awal) — tanpa animasi.
  useEffect(() => {
    if (width <= 0 || ready || cardW <= 0) return
    setReady(true)
    if (isInfinite) {
      // setTimeout agar scrollTo terjadi setelah ScrollView mount.
      setTimeout(() => {
        programmaticRef.current = true
        scrollRef.current?.scrollTo({ x: startOffset, y: 0, animated: false })
      }, 16)
    }
  }, [width, ready, cardW, startOffset, isInfinite])

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (interval <= 0) return
      const x = e.nativeEvent.contentOffset.x
      const i = Math.round((x - INSET + PEEK) / interval)
      const n = items.length
      if (!isInfinite) {
        setIndex(Math.min(n - 1, Math.max(0, i)))
        return
      }
      // i === 0 → kita sedang di clone "last"; lompat ke item terakhir (clone yang ada di index n).
      // i === n+1 → kita sedang di clone "first"; lompat ke item pertama (index 1).
      if (i === 0) {
        const targetOffset = offsets[n]
        programmaticRef.current = true
        scrollRef.current?.scrollTo({ x: targetOffset, y: 0, animated: false })
        setIndex(n - 1)
        return
      }
      if (i === n + 1) {
        const targetOffset = offsets[1]
        programmaticRef.current = true
        scrollRef.current?.scrollTo({ x: targetOffset, y: 0, animated: false })
        setIndex(0)
        return
      }
      setIndex(Math.min(n - 1, Math.max(0, i - 1)))
    },
    [interval, items.length, isInfinite, offsets],
  )

  // Index yang di-track untuk indikator didasarkan pada momentum END (bukan
  // scroll kontinu), agar dot tidak berkedip saat scroll melewati clone.
  // Tapi tetap update indikator selama menggulung untuk feel responsif
  // (lewati posisi clone).
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (interval <= 0 || programmaticRef.current) {
        programmaticRef.current = false
        return
      }
      const x = e.nativeEvent.contentOffset.x
      const i = Math.round((x - INSET + PEEK) / interval)
      const n = items.length
      if (!isInfinite) {
        setIndex(Math.min(n - 1, Math.max(0, i)))
        return
      }
      if (i <= 0) setIndex(n - 1)
      else if (i >= n + 1) setIndex(0)
      else setIndex(i - 1)
    },
    [interval, items.length, isInfinite],
  )

  if (items.length === 0) return null

  return (
    <View onLayout={onLayout} className={cn("w-full gap-3", className)} {...rest}>
      {cardW > 0 ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          decelerationRate="fast"
          snapToOffsets={offsets}
          snapToAlignment="start"
          contentContainerStyle={{ paddingHorizontal: INSET - PEEK }}
          onScroll={onScroll}
          onMomentumScrollEnd={onMomentumEnd}
          scrollEventThrottle={32}
          contentInsetAdjustmentBehavior="never"
        >
          {visibleItems.map((item, idx) => {
            const tone = item.tone ?? "accent"
            return (
              <View key={`${item.key}-${idx}`} style={{ width: cardW, marginHorizontal: GAP / 2 }}>
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
                    <Text
                      variant="h3"
                      tone="primary"
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                    >
                      {item.title}
                    </Text>
                    <Text variant="caption" tone="secondary" numberOfLines={2}>
                      {item.description}
                    </Text>
                    <View className="pt-1">
                      <Text
                        variant="label"
                        tone="primary"
                        className="self-start underline underline-offset-2"
                      >
                        {item.cta}
                      </Text>
                    </View>
                  </View>
                  <View
                    className={cn(
                      "h-16 w-16 shrink-0 items-center justify-center rounded-full",
                      circleBg[tone],
                    )}
                  >
                    <Icon icon={item.icon} size="xl" weight="fill" tone="inverse" />
                  </View>
                </RouteLink>
              </View>
            )
          })}
        </ScrollView>
      ) : null}
      {items.length > 1 ? <PageIndicator count={items.length} index={index} /> : null}
    </View>
  )
}
