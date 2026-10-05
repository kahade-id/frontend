/**
 * Kahade — <PillTabBar>: bottom navbar gaya "pill" mengambang.
 *
 * Desain (2026-10-05, persetujuan produk): satu kapsul rounded-full yang
 * mengambang di atas konten; tab aktif ditandai kapsul dalam berisi ikon +
 * label, tab non-aktif hanya ikon. Empat tab: Etalase, Transaksi, Pesan,
 * Notifikasi.
 *
 * v6 (2026-10-05, revisi produk):
 * - TANPA blur, TANPA shadow — border 1px abu kontras sebagai pembatas.
 * - Motion sederhana: indikator BERGESER (timing, tanpa pegas/memantul)
 *   ke tab yang diklik. Tidak ada goyangan.
 * - Indikator = batas slot tab + napas kecil — selalu di tengah konten,
 *   kebal panjang label & ganti bahasa.
 *
 * Warna dari tokens dan mode-aware (inline, bukan className bg-*).
 */
import { memo, useCallback, useEffect, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Reanimated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"

import { Icon, type IconComponent } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { useTheme } from "@/components/theme-provider"
import { modes, tokens } from "@/lib/tokens"

export type PillTabItem = {
  key: string
  label: string
  accessibilityLabel: string
  icon: IconComponent
  /** true bila ada yang belum dibaca */
  badge?: boolean
  /** angka badge ("99+" bila > 99) */
  badgeCount?: number
}

export type PillTabBarProps = {
  items: readonly PillTabItem[]
  value: string
  onChange: (key: string) => void
  accessibilityLabel?: string
}

/**
 * Tinggi visual pill (px) — satu sumber untuk offset konten di atasnya.
 */
export const PILL_TAB_BAR_HEIGHT = 60

const HIT_SLOP = { top: 8, bottom: 8, left: 12, right: 12 } as const
/** Napas horizontal kapsul indikator di kiri-kanan slot tab. */
const PILL_PAD_X = 6

type SlotLayout = { x: number; w: number }

function PillBadge({ count }: { count: number }) {
  const { mode } = useTheme()
  const palette = modes[mode]
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: tokens.colors.semantic.danger[mode].fill },
      ]}
      pointerEvents="none"
    >
      <Text
        variant="caption"
        weight={700}
        style={{ color: palette.primaryForeground, fontSize: 10, lineHeight: 12 }}
      >
        {count > 99 ? "99+" : String(count)}
      </Text>
    </View>
  )
}

function PillTab({
  item,
  active,
  onPress,
}: {
  item: PillTabItem
  active: boolean
  onPress: () => void
}) {
  const { mode } = useTheme()
  const palette = modes[mode]

  return (
    <PressableScale
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={item.accessibilityLabel}
      hitSlop={HIT_SLOP}
      haptic="light"
      onPress={onPress}
      className="items-center justify-center"
    >
      <View style={styles.tabInner}>
        <View style={styles.iconWrap}>
          <Icon
            icon={item.icon}
            size="md"
            active={active}
            color={active ? palette.textPrimary : palette.textSecondary}
          />
          {item.badge && (item.badgeCount ?? 0) > 0 ? (
            <PillBadge count={item.badgeCount ?? 0} />
          ) : null}
        </View>
        {active ? (
          <Text
            variant="body"
            weight={600}
            numberOfLines={1}
            style={{ color: palette.textPrimary }}
          >
            {item.label}
          </Text>
        ) : null}
      </View>
    </PressableScale>
  )
}

function PillTabBarBase({ items, value, onChange, accessibilityLabel }: PillTabBarProps) {
  const { mode } = useTheme()
  const insets = useSafeAreaInsets()
  const reducedMotion = useReducedMotion()

  // Ukur tiap slot (x, lebar relatif baris). Slot = content-sized, jadi
  // indikator yang membungkus slot otomatis di tengah ikon+label.
  const [layouts, setLayouts] = useState<Record<string, SlotLayout>>({})

  const onSlotLayout = useCallback((key: string, x: number, w: number) => {
    setLayouts((prev) => {
      const cur = prev[key]
      if (cur && Math.abs(cur.x - x) < 0.5 && Math.abs(cur.w - w) < 0.5) return prev
      return { ...prev, [key]: { x, w } }
    })
  }, [])

  // Indikator = batas slot + napas. Slot sudah membungkus konten dengan pas,
  // jadi indikator selalu di tengah — tanpa perlu mengukur konten terpisah.
  const active = layouts[value]
  const pillXTarget = active ? active.x - PILL_PAD_X : 0
  const pillWTarget = active ? active.w + PILL_PAD_X * 2 : 0

  const pillX = useSharedValue(0)
  const pillW = useSharedValue(0)

  useEffect(() => {
    if (pillWTarget <= 0) return
    if (reducedMotion) {
      pillX.value = pillXTarget
      pillW.value = pillWTarget
    } else {
      // (2026-10-05: motion seperti SegmentedControl — withTiming 250ms.)
      const timing = {
        duration: tokens.motion.duration.fast,
      } as const
      pillX.value = withTiming(pillXTarget, timing)
      pillW.value = withTiming(pillWTarget, timing)
    }
  }, [pillXTarget, pillWTarget, reducedMotion, pillX, pillW])

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    width: pillW.value,
  }))

  // (2026-10-05, revisi produk: TANPA transparan — background solid.)
  // Motion seperti SegmentedControl notifikasi: withTiming 250ms.
  const solidBg = modes[mode].surface
  // Kapsul aktif: abu terang (light) / abu lebih terang (dark) — solid.
  const activeBg = mode === "light" ? tokens.colors.gray[200] : tokens.colors.gray[700]

  return (
    <View
      style={[styles.float, { bottom: Math.max(insets.bottom, 12) }]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.pill,
          {
            backgroundColor: solidBg,
          },
        ]}
      >
        <View
          accessibilityRole="tablist"
          accessibilityLabel={accessibilityLabel ?? "Navigasi utama"}
          style={styles.row}
        >
          {pillWTarget > 0 ? (
            <Reanimated.View
              pointerEvents="none"
              style={[styles.activePill, { backgroundColor: activeBg }, pillStyle]}
            />
          ) : null}
          {items.map((item) => (
            <View
              key={item.key}
              onLayout={(e) => {
                const { x, width } = e.nativeEvent.layout
                onSlotLayout(item.key, x, width)
              }}
            >
              <PillTab
                item={item}
                active={item.key === value}
                onPress={() => onChange(item.key)}
              />
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

export const PillTabBar = memo(PillTabBarBase)

const styles = StyleSheet.create({
  float: {
    position: "absolute",
    left: 20,
    right: 20,
    alignItems: "center",
    // Pill compact di tengah: baris shrink-to-fit, slot content-sized.
  },
  pill: {
    borderRadius: 999,
    // (2026-10-05, revisi produk: padding horizontal agar pill aktif di
    // Etalase/Notifikasi tidak menempel background; vertikal tetap compact.)
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  row: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  activePill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: 999,
  },
  tabInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
    minHeight: 48,
  },
  iconWrap: {
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -8,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
})
