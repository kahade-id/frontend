/**
 * Kahade — <PullToRefresh> (§9.13 Pull-to-Refresh custom, §8 "signature").
 *
 * Satu-satunya momen loading selain full-screen yang memakai LOGO BRAND
 * (§8 tabel): tarik ke bawah -> konten mengikuti jari 1:1 -> saat ambang
 * tercapai logo "hidup" -> lepas -> logo berdenyut (PulsingLogo) sampai
 * `onRefresh` selesai -> spring settle kembali ke 0.
 *
 * Kenapa TIDAK memakai <RefreshControl> RN (non-obvious): RefreshControl
 * merender spinner OS (ActivityIndicator/Material) yang tidak bisa diganti
 * logo, dan tidak memberi progress gesture real-time. §8 menuntut drag 1:1
 * + logo Kahade, jadi gesture ditangani sendiri.
 *
 * Mekanika:
 *   - PanResponder pada pembungkus dengan `onMoveShouldSetPanResponderCapture`
 *     yang HANYA mengambil gesture bila (a) tidak sedang refresh, (b) offset
 *     ScrollView <= 0, dan (c) gerakan dominan ke bawah. Di luar itu,
 *     ScrollView bekerja normal — jadi tidak berebut gesture dengan scroll.
 *   - Konten (ScrollView) di-translateY oleh Animated.Value `pull`; area logo
 *     berada DI BELAKANG konten (absolute top), tinggi = ambang. Menarik
 *     konten ke bawah "menyingkap" logo — tidak perlu animasi height (yang
 *     tidak didukung native driver).
 *   - 1:1 sampai ambang; setelahnya resistensi 0.35 dan cap 1.6x ambang
 *     supaya tarikan tidak tanpa batas (§8 "1:1" berlaku sampai threshold).
 *   - Ambang default 64px (space.16 — "top spacing layar penuh"), cukup
 *     untuk logo `md` (40px) + napas.
 *   - `bounces={false}` di iOS: overscroll bawaan akan menggandakan efek.
 *   - Haptic saat ambang tercapai (§8) dipanggil lewat `onThresholdReached`
 *     — expo-haptics belum ada di package.json; komponen tidak menambah
 *     dependensi diam-diam. Pemanggil: `onThresholdReached={() =>
 *     Haptics.impactAsync(...)}` setelah paket ditambahkan.
 *   - RN Animated (bukan reanimated) mengikuti keputusan BottomSheet agar
 *     satu mekanisme animasi di seluruh primitif; migrasi ke reanimated
 *     tidak mengubah API komponen.
 *   - Web (§11): PanResponder RN Web mendukung pointer/touch; drag mouse
 *     ikut bekerja. Tidak ada state hover.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  Animated,
  Platform,
  ScrollView,
  PanResponder,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
  type ViewProps,
} from "react-native"

import { PulsingLogo } from "@/components/ui/loading-screen"
import { Logo } from "@/components/ui/logo"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"

const DEFAULT_THRESHOLD = tokens.space[16] // 64px
const OVERPULL_RESISTANCE = 0.35
const OVERPULL_MAX_RATIO = 1.6
const CAPTURE_MIN_DY = 4
/**
 * Skala logo saat mulai tersingkap -> 1 di ambang. Tidak ada token untuk ini
 * (§8 hanya mendefinisikan scale.press 0.97 untuk button); 0.7 dipilih agar
 * pertumbuhan terlihat tapi logo tidak pernah "mengecil ke titik".
 */
const LOGO_SCALE_FROM = 0.7

export type PullToRefreshProps = Omit<ViewProps, "children"> & {
  children: ReactNode
  /** Fetch ulang. Bila mengembalikan Promise, indikator menunggu sampai selesai. */
  onRefresh: () => void | Promise<void>
  /**
   * Kontrol eksternal (mis. SWR `isValidating`). Bila diberikan, komponen
   * tidak mengelola state refresh sendiri — settle terjadi saat nilai ini
   * kembali false.
   */
  refreshing?: boolean
  /** Jarak tarik (px) yang memicu refresh. Default 64 (space.16). */
  threshold?: number
  /** Dipanggil sekali per gesture saat ambang tercapai — tempat haptic (§8). */
  onThresholdReached?: () => void
  /** Matikan gesture (mis. saat layar dalam state error penuh) */
  enabled?: boolean
  contentContainerClassName?: string
  scrollViewProps?: Omit<ScrollViewProps, "children" | "onScroll" | "scrollEventThrottle" | "bounces">
  className?: string
}

export function PullToRefresh({
  children,
  onRefresh,
  refreshing: refreshingProp,
  threshold = DEFAULT_THRESHOLD,
  onThresholdReached,
  enabled = true,
  contentContainerClassName,
  scrollViewProps,
  className,
  ...rest
}: PullToRefreshProps) {
  const pull = useRef(new Animated.Value(0)).current
  const scrollOffset = useRef(0)
  const reachedRef = useRef(false)
  const [internalRefreshing, setInternalRefreshing] = useState(false)
  const [dragging, setDragging] = useState(false)

  const controlled = refreshingProp !== undefined
  const refreshing = controlled ? refreshingProp : internalRefreshing
  const refreshingRef = useRef(refreshing)
  refreshingRef.current = refreshing

  const springTo = useCallback(
    (to: number, onDone?: () => void) => {
      Animated.spring(pull, {
        toValue: to,
        ...tokens.motion.spring,
        useNativeDriver: true,
      }).start(({ finished }) => finished && onDone?.())
    },
    [pull],
  )

  // Mode controlled: saat parent selesai (true -> false), settle ke 0.
  const prevRefreshing = useRef(refreshing)
  useEffect(() => {
    if (prevRefreshing.current && !refreshing) springTo(0)
    prevRefreshing.current = refreshing
  }, [refreshing, springTo])

  const startRefresh = useCallback(async () => {
    springTo(threshold)
    if (controlled) {
      void onRefresh()
      return
    }
    setInternalRefreshing(true)
    try {
      await onRefresh()
    } finally {
      // useEffect di atas melakukan spring ke 0 saat state berubah
      setInternalRefreshing(false)
    }
  }, [controlled, onRefresh, springTo, threshold])

  const dampen = useCallback(
    (dy: number) => {
      if (dy <= threshold) return dy
      const over = (dy - threshold) * OVERPULL_RESISTANCE
      return Math.min(threshold + over, threshold * OVERPULL_MAX_RATIO)
    },
    [threshold],
  )

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_e, g) =>
          enabled &&
          !refreshingRef.current &&
          scrollOffset.current <= 0 &&
          g.dy > CAPTURE_MIN_DY &&
          Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderGrant: () => {
          reachedRef.current = false
          setDragging(true)
        },
        onPanResponderMove: (_e, g) => {
          const d = dampen(Math.max(0, g.dy))
          pull.setValue(d)
          if (!reachedRef.current && d >= threshold) {
            reachedRef.current = true
            onThresholdReached?.()
          }
        },
        onPanResponderRelease: () => {
          setDragging(false)
          if (reachedRef.current) void startRefresh()
          else springTo(0)
        },
        onPanResponderTerminate: () => {
          setDragging(false)
          springTo(0)
        },
      }),
    [dampen, enabled, onThresholdReached, pull, springTo, startRefresh, threshold],
  )

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffset.current = e.nativeEvent.contentOffset.y
  }, [])

  // Indikator: logo statis muncul proporsional saat ditarik (opacity & scale
  // dari progress), berganti PulsingLogo saat refresh berjalan.
  const progress = pull.interpolate({
    inputRange: [0, threshold],
    outputRange: [0, 1],
    extrapolate: "clamp",
  })
  const logoScale = pull.interpolate({
    inputRange: [0, threshold],
    outputRange: [LOGO_SCALE_FROM, 1],
    extrapolate: "clamp",
  })

  return (
    <View className={cn("flex-1 overflow-hidden", className)} {...panResponder.panHandlers} {...rest}>
      {/* Area logo di belakang konten — tinggi = ambang */}
      <View
        pointerEvents="none"
        accessibilityLiveRegion="polite"
        accessibilityLabel={refreshing ? "Memuat ulang" : undefined}
        className="absolute inset-x-0 top-0 items-center justify-center"
        style={{ height: threshold }}
      >
        {refreshing ? (
          <PulsingLogo size="md" />
        ) : (
          <Animated.View style={{ opacity: progress, transform: [{ scale: logoScale }] }}>
            <Logo variant="mark" size="md" />
          </Animated.View>
        )}
      </View>

      {/* Animated.View tidak di-interop NativeWind -> className di ScrollView */}
      <Animated.View style={{ flex: 1, transform: [{ translateY: pull }] }}>
        <ScrollView
          className="flex-1 bg-background"
          contentContainerClassName={cn("grow", contentContainerClassName)}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          // Saat gesture kita aktif, scroll dimatikan agar tidak ada
          // pergerakan ganda; iOS bounces dimatikan karena overscroll bawaan
          // akan menggandakan efek tarik.
          scrollEnabled={!dragging && !refreshing}
          bounces={Platform.OS === "ios" ? false : undefined}
          {...scrollViewProps}
        >
          {children}
        </ScrollView>
      </Animated.View>
    </View>
  )
}
