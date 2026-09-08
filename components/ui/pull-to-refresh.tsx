/**
 * Kahade — pull-to-refresh custom yang mengikuti gerakan tangan.
 *
 * Keputusan produk: indikator harus custom (logo Kahade) dan konten mengikuti
 * jari 1:1 sampai ambang. Implementasi ini TIDAK memakai RefreshControl native.
 *
 * Guard keselamatan setelah insiden force-close:
 * - hanya memakai PanResponder + Animated bawaan React Native (JS thread);
 * - tidak ada RNGH Gesture.Pan/manualActivation/stateManager.activate/fail;
 * - tidak ada Reanimated/worklet pada jalur sentuhan/scroll;
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

import { PulsingLogo } from "@/components/ui/loading-screen"
import { Logo } from "@/components/ui/logo"
import { cn } from "@/lib/cn"
import {
  pullDistance,
  reachedThreshold,
  shouldCapturePull,
} from "@/lib/pull-math"
import { tokens } from "@/lib/tokens"

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

  const springTo = useCallback(
    (toValue: number) => {
      pull.stopAnimation()
      Animated.spring(pull, {
        toValue,
        ...tokens.motion.spring,
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
