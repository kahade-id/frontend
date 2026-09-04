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
 * Mekanika (reanimated + gesture-handler):
 *   - `Gesture.Pan()` dikomposisikan `Gesture.Simultaneous(pan, Gesture.Native())`
 *     dan dipasang lewat satu <GestureDetector> yang membungkus <ScrollView>
 *     dari react-native-gesture-handler. `Gesture.Native()` mewakili scroll
 *     native di dalam sistem RNGH, dan `Simultaneous` berarti pan TIDAK
 *     merebut sentuhan: scroll selalu menerima gesture yang sama. Pan hanya
 *     "melakukan sesuatu" bila offset scroll <= 0 (dibaca dari shared value
 *     yang diisi `useAnimatedScrollHandler`, jadi keputusan ini murni UI
 *     thread). Di luar kondisi itu pan diam dan scroll berjalan normal —
 *     ini yang membedakan dari PanResponder capture lama, yang harus
 *     menebak lebih dulu siapa pemilik gesture sebelum scroll mulai.
 *   - Anchor: saat offset pertama kali menyentuh 0 di tengah gesture (user
 *     scroll ke atas lalu terus menarik), `translationY` saat itu disimpan
 *     sebagai `anchor`; jarak tarik = translationY - anchor. Tanpa ini,
 *     jarak yang sudah dipakai untuk scroll ikut terhitung sebagai tarikan.
 *   - Selama tarikan aktif (pull > 0) `scrollEnabled` dimatikan lewat
 *     runOnJS supaya gerakan jari balik ke atas mengecilkan tarikan, bukan
 *     menggulir konten; dinyalakan lagi saat jari lepas.
 *   - Konten (ScrollView) di-translateY oleh shared value `pull`; area logo
 *     berada DI BELAKANG konten (absolute top), tinggi = ambang. Menarik
 *     konten ke bawah "menyingkap" logo — tidak perlu animasi height.
 *   - 1:1 sampai ambang; setelahnya resistensi 0.35 dan cap 1.6x ambang
 *     supaya tarikan tidak tanpa batas (§8 "1:1" berlaku sampai threshold).
 *   - Ambang default 64px (space.16 — "top spacing layar penuh"), cukup
 *     untuk logo `md` (40px) + napas.
 *   - `bounces={false}` di iOS & `overScrollMode="never"` di Android:
 *     overscroll bawaan akan menggandakan efek tarik / menampilkan glow OS.
 *   - Haptic saat ambang tercapai (§8) dipanggil lewat `onThresholdReached`
 *     — expo-haptics belum ada di package.json; komponen tidak menambah
 *     dependensi diam-diam. Pemanggil: `onThresholdReached={() =>
 *     Haptics.impactAsync(...)}` setelah paket ditambahkan.
 *   - Settle memakai `withSpring(tokens.motion.spring)` — config yang sama
 *     dengan BottomSheet (§8) agar satu kosakata gerak.
 *   - Reduce Motion (audit #2): SENGAJA tidak dimatikan. Translate mengikuti
 *     jari pengguna 1:1 dan spring settle hanya mengembalikan konten dari
 *     titik jari dilepas ke 0 — gerakan "esensial untuk fungsi" (pengecualian
 *     WCAG 2.3.3), bukan dekorasi. PulsingLogo di dalamnya sudah membaca
 *     useReducedMotion() sendiri.
 *   - Web (§11): Gesture Handler mendukung pointer/mouse; drag mouse ikut
 *     bekerja. Tidak ada state hover.
 *   - `Animated.View` reanimated tidak di-interop NativeWind -> className di
 *     ScrollView / View anak.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Platform, View, type ScrollViewProps, type ViewProps } from "react-native"
import { Gesture, GestureDetector, ScrollView as GHScrollView } from "react-native-gesture-handler"
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated"

import { PulsingLogo } from "@/components/ui/loading-screen"
import { Logo } from "@/components/ui/logo"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"

const AnimatedScrollView = Animated.createAnimatedComponent(GHScrollView)

const DEFAULT_THRESHOLD = tokens.space[16] // 64px
const OVERPULL_RESISTANCE = 0.35
const OVERPULL_MAX_RATIO = 1.6
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
  // UI-thread state
  const pull = useSharedValue(0)
  const scrollOffset = useSharedValue(0)
  const anchor = useSharedValue(0)
  const pulling = useSharedValue(false)
  const reached = useSharedValue(false)
  const isRefreshing = useSharedValue(false)

  // JS state (hanya untuk render indikator & scrollEnabled)
  const [internalRefreshing, setInternalRefreshing] = useState(false)
  const [dragging, setDragging] = useState(false)

  const controlled = refreshingProp !== undefined
  const refreshing = controlled ? refreshingProp : internalRefreshing
  useEffect(() => {
    isRefreshing.value = refreshing
  }, [refreshing, isRefreshing])

  // Mode controlled & uncontrolled: saat refresh selesai (true -> false), settle ke 0.
  const prevRefreshing = useRef(refreshing)
  useEffect(() => {
    if (prevRefreshing.current && !refreshing) pull.value = withSpring(0, tokens.motion.spring)
    prevRefreshing.current = refreshing
  }, [refreshing, pull])

  const startRefresh = useCallback(async () => {
    pull.value = withSpring(threshold, tokens.motion.spring)
    // Error dari onRefresh adalah urusan parent (tampilkan Banner/Toast di
    // sana). Di sini cukup ditelan supaya tidak menjadi unhandled rejection
    // (dipanggil dari runOnJS, tidak ada pemanggil yang bisa menangkapnya)
    // dan indikator selalu kembali ke posisi 0.
    if (controlled) {
      void Promise.resolve(onRefresh()).catch(() => undefined)
      return
    }
    setInternalRefreshing(true)
    try {
      await onRefresh()
    } catch {
      // ditelan — lihat komentar di atas
    } finally {
      // useEffect di atas melakukan spring ke 0 saat state berubah
      setInternalRefreshing(false)
    }
  }, [controlled, onRefresh, pull, threshold])

  const notifyThreshold = useCallback(() => onThresholdReached?.(), [onThresholdReached])

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollOffset.value = e.contentOffset.y
    },
  })

  // Gesture.Native() mewakili scroll native ScrollView di dalam sistem RNGH,
  // sehingga bisa dikomposisikan `Simultaneous` dengan pan kita (lihat header).
  const nativeScroll = useMemo(() => Gesture.Native(), [])

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .onBegin((e) => {
          reached.value = false
          pulling.value = false
          anchor.value = e.translationY
        })
        .onUpdate((e) => {
          if (isRefreshing.value) return

          // Belum di puncak: biarkan ScrollView bekerja, geser anchor mengikuti jari.
          if (scrollOffset.value > 0) {
            if (pulling.value) {
              pulling.value = false
              pull.value = 0
              runOnJS(setDragging)(false)
            }
            anchor.value = e.translationY
            return
          }

          const dy = e.translationY - anchor.value
          if (dy <= 0) {
            if (pulling.value) {
              pulling.value = false
              pull.value = 0
              runOnJS(setDragging)(false)
            }
            // Jari bergerak ke atas dari puncak: anchor ikut agar tarikan
            // berikutnya dimulai dari titik balik, bukan dari awal gesture.
            anchor.value = e.translationY
            return
          }

          if (!pulling.value) {
            pulling.value = true
            runOnJS(setDragging)(true)
          }

          // 1:1 sampai ambang, lalu resistensi + cap.
          let d = dy
          if (d > threshold) {
            d = Math.min(threshold + (d - threshold) * OVERPULL_RESISTANCE, threshold * OVERPULL_MAX_RATIO)
          }
          pull.value = d

          if (!reached.value && d >= threshold) {
            reached.value = true
            runOnJS(notifyThreshold)()
          }
        })
        .onFinalize(() => {
          const wasPulling = pulling.value
          pulling.value = false
          if (wasPulling) runOnJS(setDragging)(false)
          if (isRefreshing.value) return
          if (reached.value && wasPulling) runOnJS(startRefresh)()
          else if (pull.value !== 0) pull.value = withSpring(0, tokens.motion.spring)
        }),
    [anchor, enabled, isRefreshing, notifyThreshold, pull, pulling, reached, scrollOffset, startRefresh, threshold],
  )

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pull.value }],
  }))

  // Indikator: logo statis muncul proporsional saat ditarik (opacity & scale
  // dari progress), berganti PulsingLogo saat refresh berjalan.
  const logoStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pull.value, [0, threshold], [0, 1], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(pull.value, [0, threshold], [LOGO_SCALE_FROM, 1], Extrapolation.CLAMP) },
    ],
  }))

  const composed = useMemo(() => Gesture.Simultaneous(pan, nativeScroll), [pan, nativeScroll])

  return (
    <View className={cn("flex-1 overflow-hidden", className)} {...rest}>
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
          <Animated.View style={logoStyle}>
            <Logo variant="mark" size="md" />
          </Animated.View>
        )}
      </View>

      <Animated.View style={[{ flex: 1 }, contentStyle]}>
        {/* Pan (luar) + Native (scroll) berjalan bersamaan: scroll tidak pernah diblokir */}
        <GestureDetector gesture={composed}>
          <AnimatedScrollView
            className="flex-1 bg-background"
            contentContainerClassName={cn("grow", contentContainerClassName)}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={onScroll}
            // Saat tarikan aktif, scroll dimatikan agar gerakan balik ke atas
            // mengecilkan tarikan, bukan menggulir; overscroll OS dimatikan
            // karena akan menggandakan efek tarik (iOS) / glow (Android).
            scrollEnabled={!dragging && !refreshing}
            bounces={Platform.OS === "ios" ? false : undefined}
            overScrollMode={Platform.OS === "android" ? "never" : undefined}
            {...scrollViewProps}
          >
            {children}
          </AnimatedScrollView>
        </GestureDetector>
      </Animated.View>
    </View>
  )
}
