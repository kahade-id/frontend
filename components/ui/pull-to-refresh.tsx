/**
 * Kahade — pull-to-refresh.
 *
 * Keputusan produk: indikator harus custom (logo Kahade) dan konten mengikuti
 * jari 1:1 sampai ambang. Itu dipertahankan di WEB dan iOS lewat
 * PullGestureSurface (PanResponder + Animated bawaan).
 *
 * PENTING — Android memakai pola RNGH `Gesture.Native()` + `Gesture.Pan()`
 * (NativePullGestureSurface), BUKAN PanResponder JS maupun RefreshControl:
 * PanResponder JS tidak dapat merebut gesture dari ScrollView/FlatList native
 * yang kontennya memenuhi layar (native scroll mengklaim gesture & membatalkan
 * responder JS via NativeGestureUtil), sehingga PTR custom versi PanResponder
 * hanya bekerja untuk konten pendek. RNGH berelasi langsung dengan scroller
 * native (simultaneous) sehingga tarikan di puncak tertangkap pada daftar
 * panjang sekalipun, dan indikator tetap logo Kahade. Detail di komentar
 * `NativePullGestureSurface` di bawah.
 *
 * Guard keselamatan (jalur web/iOS) setelah insiden force-close:
 * - hanya memakai PanResponder + Animated bawaan React Native (JS thread);
 * - tidak ada manualActivation/stateManager.activate/fail;
 * - tidak ada Reanimated/worklet pada jalur sentuhan/scroll;
 *   (jalur Android sengaja memakai RNGH+Reanimated yang merupakan pola resmi
 *   RNGH untuk kasus ini — tanpa manualActivation, lihat S7.)
 * - tidak pernah mengubah `scrollEnabled`;
 * - pan hanya mengambil responder bila offset di puncak, gerak satu jari jelas
 *   turun, dan dominan vertikal; scroll biasa di tengah list tidak diambil;
 * - saat pan aktif, ScrollView memang sudah di puncak dan overscroll native
 *   dimatikan, sehingga hanya ada satu pemilik perpindahan visual;
 * - callback/data error tidak dapat menjadi unhandled rejection;
 * - terminate/unmount selalu menghentikan animasi dan membersihkan timer.
 *
 * `PullGestureSurface` diekspor agar FlatList virtual tetap menjadi satu-satunya
 * scroller. Jangan membungkus FlatList dengan ScrollView: gunakan surface ini
 * lalu teruskan `scrollBindings` langsung ke FlatList.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  Animated,
  FlatList,
  PanResponder,
  Platform,
  ScrollView,
  View,
  type FlatListProps,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
  type ViewProps,
} from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Reanimated, {
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
import { dismissKeyboardOnDragProps } from "@/lib/keyboard"
import { cn } from "@/lib/cn"
import {
  OVERPULL_MAX_RATIO,
  OVERPULL_RESISTANCE,
  PULL_CAPTURE_OFFSET,
  pullDistance,
  reachedThreshold,
  shouldCapturePull,
} from "@/lib/pull-math"
import { tokens } from "@/lib/tokens"
import { useReducedMotion } from "@/lib/use-reduced-motion"

// ── Android: PTR custom via RNGH Gesture.Native() + Gesture.Pan() ──────────
/**
 * Mengapa Android TIDAK memakai PullGestureSurface berbasis PanResponder di
 * bawah ini (audit paritas platform):
 *
 * Di Android, begitu ScrollView/FlatList native (yang kontennya memenuhi
 * layar) menerima gerak vertikal melewati touch slop, ia meng-KLAIM gesture
 * secara native (ReactScrollView.handleInterceptedTouchEvent →
 * NativeGestureUtil.notifyNativeGestureStarted) dan membatalkan responder JS
 * induk. PanResponder JS — yang pada web (event DOM, preventDefault di fase
 * capture) dan iOS (responder dapat mengambil alih UIScrollView di posisi
 * atas) bisa menang tarikan — di Android tidak pernah jadi responder saat
 * konten scrollable: pull-to-refresh hanya "hidup" untuk konten pendek.
 * Ini keterbatasan fundamental negosiasi gesture Android, bukan kesalahan
 * threshold: https://github.com/facebook/react-native/issues/25226
 *
 * Solusi: pola resmi RNGH untuk PTR kustom.
 *   - `Gesture.Native()` melingkupi ScrollView/FlatList (native component jadi
 *     anak LANGSUNG GestureDetector) sehingga gerak scroll tetap dikelola
 *     native dan RNGH bisa berelasi dengannya;
 *   - `Gesture.Pan()` dengan `.simultaneousWithExternalGesture(nativeGesture)`
 *     hidup BERSAMA scroll native. Native handler hanya aktif saat scroller
 *     benar-benar berpindah; di posisi atas dengan overscroll dimatikan,
 *     tarikan turun tidak bisa meng-scroll apa pun sehingga Pan yang
 *     menggerakkan indikator — di posisi mana pun dalam daftar.
 *   - Offset scroll dibaca di UI thread lewat useAnimatedScrollHandler; Pan
 *     TIDAK memindahkan konten saat offset > 0 (tanpa manualActivation —
 *     gerak di tengah list tetap sepenuhnya milik scroller karena pan hanya
 *     mengubah translate saat di puncak).
 * Indikator tetap logo Kahade (bukan spinner RefreshControl).
 *
 * Aturan aman yang dijaga scripts/check-screens.mjs (S7):
 *   - Gesture.Native + Pan simultaneous WAJIB; tidak boleh scrollEnabled yang
 *     bergantung state data; touchAction="pan-y" untuk web;
 *   - tanpa manualActivation/stateManager (sumber force-close sebelumnya
 *     pada pola ini).
 */
function NativePullGestureSurface({
  children,
  onRefresh,
  refreshing: refreshingProp,
  threshold = DEFAULT_THRESHOLD,
  onThresholdReached,
  enabled = true,
  // onScroll JS dari pemanggil tidak dapat digabung dengan worklet scroll
  // handler (lihat useAnimatedScrollHandler); saat ini tidak ada pemanggil
  // yang memakainya pada jalur Android.
  onScroll: _ignoredOnScroll,
  className,
  ...rest
}: PullGestureSurfaceProps) {
  const controlled = refreshingProp !== undefined
  const [internalRefreshing, setInternalRefreshing] = useState(false)
  const refreshing = controlled ? Boolean(refreshingProp) : internalRefreshing

  const pull = useSharedValue(0)
  const scrollOffset = useSharedValue(0)
  /** Tarikan sudah "mengunci" di puncak selama gesture jari ini. */
  const engaged = useSharedValue(false)
  /** translationY pan saat baru mengunci — buang gerak yang sudah dipakai scroll. */
  const baselineY = useSharedValue(0)
  /** Ambang sudah terlampaui & onRefresh sudah dipanggil. */
  const locked = useSharedValue(false)

  const reducedMotion = useReducedMotion()
  const reducedSV = useSharedValue(reducedMotion)
  useEffect(() => {
    reducedSV.value = reducedMotion
  }, [reducedMotion, reducedSV])

  // Ref callback supaya gesture (useMemo stabil) tidak perlu dibangun ulang
  // tiap render.
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh
  const onThresholdRef = useRef(onThresholdReached)
  onThresholdRef.current = onThresholdReached
  const controlledRef = useRef(controlled)
  controlledRef.current = controlled

  const fireRefreshJS = useCallback(() => {
    try {
      if (controlledRef.current) {
        onRefreshRef.current?.()
        return
      }
      setInternalRefreshing(true)
      Promise.resolve(onRefreshRef.current?.())
        .catch(() => undefined)
        .finally(() => setInternalRefreshing(false))
    } catch {
      setInternalRefreshing(false)
    }
  }, [])

  const fireThresholdJS = useCallback(() => {
    try {
      onThresholdRef.current?.()
    } catch {
      // Haptic/telemetri opsional tidak boleh membatalkan gesture.
    }
  }, [])

  // Offset scroll dibaca di UI thread — satu-satunya data yang menentukan
  // pan boleh menggerakkan konten.
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollOffset.value = event.contentOffset.y
    },
  })

  const nativeGesture = useMemo(() => Gesture.Native(), [])

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        // Hanya gerak TURUN yang mengaktifkan; angka positif tunggal =
        // activeOffsetYEnd (panGesture RNGH), gerak ke atas tak pernah
        // mengklaim.
        .activeOffsetY(PULL_CAPTURE_OFFSET)
        .failOffsetX([-12, 12])
        .simultaneousWithExternalGesture(nativeGesture)
        .onBegin(() => {
          engaged.value = false
        })
        .onChange((event) => {
          // Di tengah daftar: milik scroller, jangan geser apa pun.
          if (scrollOffset.value > 1) {
            engaged.value = false
            if (pull.value !== 0) pull.value = 0
            return
          }
          if (!engaged.value) {
            engaged.value = true
            baselineY.value = event.translationY
          }
          const dy = event.translationY - baselineY.value
          if (dy <= 0) {
            pull.value = 0
            return
          }
          // Resistensi karet sama dengan jalur web/iOS (lib/pull-math).
          pull.value =
            dy <= threshold
              ? dy
              : Math.min(
                  threshold + (dy - threshold) * OVERPULL_RESISTANCE,
                  threshold * OVERPULL_MAX_RATIO,
                )
          if (!locked.value && pull.value >= threshold) {
            locked.value = true
            runOnJS(fireThresholdJS)()
            runOnJS(fireRefreshJS)()
          }
        })
        .onEnd(() => {
          engaged.value = false
          const target = locked.value ? threshold : 0
          pull.value = reducedSV.value ? target : withSpring(target, tokens.motion.springPlayful)
        })
        .onFinalize((_event, success) => {
          engaged.value = false
          // Gesture dibatalkan sistem (panggilan masuk, pindah scroller):
          // kembali ke posisi awal kecuali refresh sedang berjalan.
          if (!success && !locked.value) {
            pull.value = reducedSV.value ? 0 : withSpring(0, tokens.motion.springPlayful)
          }
        }),
    [
      enabled,
      nativeGesture,
      threshold,
      fireRefreshJS,
      fireThresholdJS,
      reducedSV,
      pull,
      scrollOffset,
      engaged,
      baselineY,
      locked,
    ],
  )

  const composedGesture = useMemo(
    () => Gesture.Simultaneous(nativeGesture, panGesture),
    [nativeGesture, panGesture],
  )

  // Transisi controlled (prop refreshing) / uncontrolled (state internal).
  useEffect(() => {
    locked.value = Boolean(refreshing)
    const target = refreshing ? threshold : 0
    pull.value = reducedMotion ? target : withSpring(target, tokens.motion.springPlayful)
    // Hanya pada perubahan status refresh, bukan saat reducedMotion berubah
    // di tengah jalan (reducedMotion/reducedSV sengaja tidak masuk deps).
  }, [refreshing, threshold, reducedMotion, locked, pull])

  const scrollBindings = useMemo<NativePullBindings>(
    () => ({
      onScroll: scrollHandler,
      // Android: keyboardDismissMode="on-drag" tidak didukung scroller native
      // (lihat lib/keyboard.ts); ini menutup SEMUA layar ber-PTR, web/iOS
      // memakai prop aslinya dari pemanggil.
      onScrollBeginDrag: dismissKeyboardOnDragProps.onScrollBeginDrag,
      scrollEventThrottle: 16,
      // Overscroll native dimatikan: satu-satunya gerakan tarik adalah
      // Animated.View di sini (konsisten dengan jalur web/iOS).
      bounces: false,
      alwaysBounceVertical: false,
      overScrollMode: "never",
    }),
    [scrollHandler],
  )

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pull.value }],
  }))
  const logoOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(pull.value, [0, threshold], [0, 1], Extrapolation.CLAMP),
  }))
  const logoScale = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(pull.value, [0, threshold], [0.7, 1], Extrapolation.CLAMP) },
    ],
  }))

  return (
    <View className={cn("flex-1 overflow-hidden", className)} {...rest}>
      <View
        style={[{ pointerEvents: "none" }, { height: threshold }]}
        accessible={refreshing}
        accessibilityLiveRegion="polite"
        accessibilityLabel={refreshing ? "Memuat ulang" : undefined}
        className="absolute inset-x-0 top-0 items-center justify-center"
      >
        {refreshing ? (
          <PulsingLogo size="md" />
        ) : (
          <Reanimated.View style={[logoOpacity, logoScale]}>
            <Logo variant="mark" size="md" />
          </Reanimated.View>
        )}
      </View>

      <Reanimated.View style={[{ flex: 1 }, contentStyle]}>
        {/* touchAction="pan-y": default RNGH di web adalah none (akan
            membekukan scroll); native component harus anak langsung
            GestureDetector (dokumen Gesture.Native). */}
        <GestureDetector gesture={composedGesture} touchAction="pan-y">
          {children(scrollBindings)}
        </GestureDetector>
      </Reanimated.View>
    </View>
  )
}

type NativePullBindings = Pick<
  ScrollViewProps,
  | "onScroll"
  | "onScrollBeginDrag"
  | "scrollEventThrottle"
  | "bounces"
  | "alwaysBounceVertical"
  | "overScrollMode"
>

const DEFAULT_THRESHOLD = tokens.space[16]
const CONTROLLED_CONFIRM_TIMEOUT_MS = 1_000

type PullScrollBindings = Pick<
  ScrollViewProps,
  | "onScroll"
  | "scrollEventThrottle"
  | "bounces"
  | "alwaysBounceVertical"
  | "overScrollMode"
>

export type PullGestureSurfaceProps = Omit<ViewProps, "children"> & {
  children: (scrollBindings: PullScrollBindings) => ReactNode
  onRefresh: () => void | Promise<void>
  refreshing?: boolean
  threshold?: number
  onThresholdReached?: () => void
  enabled?: boolean
  /** onScroll milik scroller tetap diteruskan setelah offset internal dicatat. */
  onScroll?: ScrollViewProps["onScroll"]
  className?: string
}

/**
 * Shell gesture tanpa scroller sendiri. Bisa membungkus ScrollView ATAU
 * FlatList tanpa membuat nested scroll container.
 */
export function PullGestureSurface({
  children,
  onRefresh,
  refreshing: refreshingProp,
  threshold = DEFAULT_THRESHOLD,
  onThresholdReached,
  enabled = true,
  onScroll,
  className,
  ...rest
}: PullGestureSurfaceProps) {
  const safeThreshold =
    Number.isFinite(threshold) && threshold > 0 ? threshold : DEFAULT_THRESHOLD
  const pull = useRef(new Animated.Value(0)).current
  const scrollOffset = useRef(0)
  const dragDistance = useRef(0)
  const dragging = useRef(false)
  const thresholdNotified = useRef(false)
  const requestActive = useRef(false)
  const mounted = useRef(true)
  const controlledTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sawExternalRefreshing = useRef(false)

  const controlled = refreshingProp !== undefined
  const [internalRefreshing, setInternalRefreshing] = useState(false)
  // Latch ini membuat indikator langsung hidup pada mode controlled, sebelum
  // render parent yang mengubah `refreshing` sempat dikomit.
  const [gestureRefreshing, setGestureRefreshing] = useState(false)
  const refreshing = controlled
    ? Boolean(refreshingProp) || gestureRefreshing
    : internalRefreshing

  const handlers = useRef({
    enabled,
    refreshing,
    externalRefreshing: Boolean(refreshingProp),
    onRefresh,
    onThresholdReached,
    threshold: safeThreshold,
    onScroll,
  })
  handlers.current = {
    enabled,
    refreshing,
    externalRefreshing: Boolean(refreshingProp),
    onRefresh,
    onThresholdReached,
    threshold: safeThreshold,
    onScroll,
  }

  const clearControlledTimer = useCallback(() => {
    if (controlledTimer.current) {
      clearTimeout(controlledTimer.current)
      controlledTimer.current = null
    }
  }, [])

  // v2: preferensi reduced motion dibaca lewat ref agar `springTo` (dan
  // `panResponder` yang memakainya) tidak perlu dibuat ulang.
  const reducedMotion = useReducedMotion()
  const reducedRef = useRef(reducedMotion)
  reducedRef.current = reducedMotion

  const springTo = useCallback(
    (toValue: number) => {
      pull.stopAnimation()
      // Reduced motion: pindah posisi seketika, tanpa pegas.
      if (reducedRef.current) {
        pull.setValue(toValue)
        return
      }
      // v2: settle pakai spring playful — overshoot halus saat konten kembali
      // atau saat indikator mengunci di ambang. Hanya mengubah kurva spring,
      // bukan arsitektur gesture (guard keselamatan di header tetap berlaku).
      Animated.spring(pull, {
        toValue,
        ...tokens.motion.springPlayful,
        useNativeDriver: true,
      }).start()
    },
    [pull],
  )

  const finishRefresh = useCallback(() => {
    clearControlledTimer()
    requestActive.current = false
    sawExternalRefreshing.current = false
    if (mounted.current) {
      setGestureRefreshing(false)
      setInternalRefreshing(false)
    }
    springTo(0)
  }, [clearControlledTimer, springTo])

  const startRefresh = useCallback(() => {
    const current = handlers.current
    if (!current.enabled || current.refreshing || requestActive.current) {
      springTo(0)
      return
    }

    // WEB: pull-to-refresh memuat ulang DOKUMEN (refresh bawaan browser),
    // bukan memanggil endpoint satu per satu — di hosting statis endpoint
    // API sering tak terjangkau sehingga tarikan selalu berakhir "Tidak ada
    // koneksi". Reload memuat ulang seluruh data sekaligus. Indikator
    // dikunci di ambang sampai browser benar-benar memuat ulang.
    if (Platform.OS === "web" && typeof window !== "undefined") {
      springTo(current.threshold)
      try {
        current.onThresholdReached?.()
      } catch {
        // haptic/telemetri opsional
      }
      window.location.reload()
      return
    }

    requestActive.current = true
    springTo(current.threshold)
    if (controlled) setGestureRefreshing(true)
    else setInternalRefreshing(true)

    let result: void | Promise<void>
    let threwSynchronously = false
    try {
      result = current.onRefresh()
    } catch {
      threwSynchronously = true
      result = undefined
    }

    const isThenable =
      result != null && typeof (result as PromiseLike<void>).then === "function"

    if (controlled) {
      // Banyak parent mengubah `refreshing` pada render berikutnya. Hanya
      // callback `void` yang butuh timeout konfirmasi; Promise punya sinyal
      // selesai sendiri dan tidak boleh membuka guard request saat masih aktif.
      if (!isThenable && !threwSynchronously) {
        controlledTimer.current = setTimeout(() => {
          if (
            !handlers.current.externalRefreshing &&
            !sawExternalRefreshing.current
          )
            finishRefresh()
        }, CONTROLLED_CONFIRM_TIMEOUT_MS)
      }

      void Promise.resolve(result)
        .catch(() => undefined)
        .finally(() => {
          if (
            threwSynchronously ||
            (isThenable && !handlers.current.externalRefreshing)
          ) {
            finishRefresh()
          }
        })
      return
    }

    void Promise.resolve(result)
      .catch(() => undefined)
      .finally(finishRefresh)
  }, [controlled, finishRefresh, springTo])

  const startRefreshRef = useRef(startRefresh)
  startRefreshRef.current = startRefresh

  // Mode controlled: prop true mengonfirmasi request parent; transisi kembali
  // false adalah satu-satunya sinyal selesai untuk callback yang return void.
  useEffect(() => {
    if (!controlled) return
    if (refreshingProp) {
      sawExternalRefreshing.current = true
      clearControlledTimer()
      springTo(safeThreshold)
    } else if (sawExternalRefreshing.current) {
      finishRefresh()
    }
  }, [
    clearControlledTimer,
    controlled,
    finishRefresh,
    refreshingProp,
    safeThreshold,
    springTo,
  ])

  useEffect(() => {
    // React Strict Mode menjalankan setup-cleanup-setup pada development.
    mounted.current = true
    return () => {
      mounted.current = false
      clearControlledTimer()
      pull.stopAnimation()
    }
  }, [clearControlledTimer, pull])

  const panResponder = useMemo(() => {
    const resetDrag = () => {
      dragging.current = false
      dragDistance.current = 0
      thresholdNotified.current = false
    }

    const updatePull = (dy: number) => {
      const distance = pullDistance(
        Math.max(0, dy),
        handlers.current.threshold,
      )
      dragDistance.current = distance
      pull.setValue(distance)

      if (
        !thresholdNotified.current &&
        reachedThreshold(distance, handlers.current.threshold)
      ) {
        thresholdNotified.current = true
        try {
          handlers.current.onThresholdReached?.()
        } catch {
          // Haptic/telemetry opsional tidak boleh membatalkan gesture.
        }
      }
    }

    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_event, gesture) =>
        shouldCapturePull({
          offsetY: scrollOffset.current,
          dy: gesture.dy,
          dx: gesture.dx,
          enabled: handlers.current.enabled,
          refreshing: handlers.current.refreshing || requestActive.current,
          touches: gesture.numberActiveTouches,
        }),
      onPanResponderGrant: (_event, gesture) => {
        pull.stopAnimation()
        thresholdNotified.current = false
        dragging.current = true
        // PanResponder mempertahankan dy sejak touch-down. Memakai seluruh dy
        // membuat posisi konten langsung sama dengan tangan saat capture.
        updatePull(gesture.dy)
      },
      onPanResponderMove: (_event, gesture) => {
        if (!dragging.current) return
        updatePull(gesture.dy)
      },
      onPanResponderRelease: () => {
        const trigger =
          dragging.current &&
          reachedThreshold(dragDistance.current, handlers.current.threshold)
        resetDrag()
        if (trigger) startRefreshRef.current()
        else springTo(0)
      },
      onPanResponderTerminate: () => {
        resetDrag()
        springTo(0)
      },
      onPanResponderReject: () => {
        resetDrag()
        springTo(0)
      },
      // Hanya memblokir responder native setelah pull sah di puncak sudah
      // ditangkap. Scroll biasa tidak pernah menjadikan parent responder.
      onShouldBlockNativeResponder: () => true,
    })
  }, [pull, springTo])

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y
      scrollOffset.current = Number.isFinite(y) ? y : 0
      handlers.current.onScroll?.(event)
    },
    [],
  )

  const scrollBindings = useMemo<PullScrollBindings>(
    () => ({
      onScroll: handleScroll,
      scrollEventThrottle: 16,
      // Overscroll native dimatikan karena perpindahan tarik digambar oleh
      // Animated.View. Ini bukan scroll lock; scrolling tetap selalu enabled.
      bounces: false,
      alwaysBounceVertical: false,
      overScrollMode: Platform.OS === "android" ? "never" : undefined,
    }),
    [handleScroll],
  )

  const logoOpacity = pull.interpolate({
    inputRange: [0, safeThreshold],
    outputRange: [0, 1],
    extrapolate: "clamp",
  })
  const logoScale = pull.interpolate({
    inputRange: [0, safeThreshold],
    outputRange: [0.7, 1],
    extrapolate: "clamp",
  })

  return (
    <View
      className={cn("flex-1 overflow-hidden", className)}
      {...rest}
      {...panResponder.panHandlers}
    >
      <View
        style={[{ pointerEvents: "none" }, { height: safeThreshold }]}
        accessible={refreshing}
        accessibilityLiveRegion="polite"
        accessibilityLabel={refreshing ? "Memuat ulang" : undefined}
        className="absolute inset-x-0 top-0 items-center justify-center"
      >
        {refreshing ? (
          <PulsingLogo size="md" />
        ) : (
          <Animated.View
            style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}
          >
            <Logo variant="mark" size="md" />
          </Animated.View>
        )}
      </View>

      <Animated.View style={{ flex: 1, transform: [{ translateY: pull }] }}>
        {children(scrollBindings)}
      </Animated.View>
    </View>
  )
}

export type PullToRefreshProps = Omit<ViewProps, "children"> & {
  children: ReactNode
  onRefresh: () => void | Promise<void>
  refreshing?: boolean
  threshold?: number
  onThresholdReached?: () => void
  enabled?: boolean
  contentContainerClassName?: string
  scrollViewProps?: Omit<
    ScrollViewProps,
    "children" | "scrollEventThrottle" | "refreshControl"
  >
  className?: string
}

/** Pull-to-refresh custom untuk konten non-virtual berbasis ScrollView. */
export function PullToRefresh({
  children,
  onRefresh,
  refreshing,
  threshold,
  onThresholdReached,
  enabled = true,
  contentContainerClassName,
  scrollViewProps,
  className,
  ...rest
}: PullToRefreshProps) {
  // Android: PTR kustom RNGH (lihat catatan NativePullGestureSurface).
  if (Platform.OS === "android") {
    return (
      <NativePullGestureSurface
        onRefresh={onRefresh}
        refreshing={refreshing}
        threshold={threshold}
        onThresholdReached={onThresholdReached}
        enabled={enabled}
        onScroll={scrollViewProps?.onScroll}
        className={className}
        {...rest}
      >
        {(scrollBindings) => (
          <ScrollView
            className="flex-1"
            contentContainerClassName={cn("grow", contentContainerClassName)}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            {...scrollViewProps}
            {...scrollBindings}
          >
            {children}
          </ScrollView>
        )}
      </NativePullGestureSurface>
    )
  }

  return (
    <PullGestureSurface
      onRefresh={onRefresh}
      refreshing={refreshing}
      threshold={threshold}
      onThresholdReached={onThresholdReached}
      enabled={enabled}
      onScroll={scrollViewProps?.onScroll}
      className={className}
      {...rest}
    >
      {(scrollBindings) => (
        <ScrollView
          className="flex-1"
          contentContainerClassName={cn("grow", contentContainerClassName)}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          {...scrollViewProps}
          {...scrollBindings}
        >
          {children}
        </ScrollView>
      )}
    </PullGestureSurface>
  )
}

export type PullToRefreshFlatListProps<ItemT> = Omit<
  FlatListProps<ItemT>,
  | "onRefresh"
  | "refreshing"
  | "refreshControl"
  | "onScroll"
  | "scrollEventThrottle"
> & {
  onRefresh: () => void | Promise<void>
  refreshing: boolean
  refreshEnabled?: boolean
  refreshThreshold?: number
  onRefreshThresholdReached?: () => void
  onScroll?: FlatListProps<ItemT>["onScroll"]
}

/** FlatList virtual dengan gesture custom yang sama, tanpa ScrollView luar. */
export function PullToRefreshFlatList<ItemT>({
  onRefresh,
  refreshing,
  refreshEnabled = true,
  refreshThreshold,
  onRefreshThresholdReached,
  onScroll,
  ...listProps
}: PullToRefreshFlatListProps<ItemT>) {
  // Android: PTR kustom RNGH (lihat catatan NativePullGestureSurface).
  if (Platform.OS === "android") {
    return (
      <NativePullGestureSurface
        onRefresh={onRefresh}
        refreshing={refreshing}
        threshold={refreshThreshold}
        onThresholdReached={onRefreshThresholdReached}
        enabled={refreshEnabled}
        onScroll={onScroll}
        className="flex-1"
      >
        {(scrollBindings) => <FlatList {...listProps} {...scrollBindings} />}
      </NativePullGestureSurface>
    )
  }

  return (
    <PullGestureSurface
      onRefresh={onRefresh}
      refreshing={refreshing}
      threshold={refreshThreshold}
      onThresholdReached={onRefreshThresholdReached}
      enabled={refreshEnabled}
      onScroll={onScroll}
      className="flex-1"
    >
      {(scrollBindings) => <FlatList {...listProps} {...scrollBindings} />}
    </PullGestureSurface>
  )
}
