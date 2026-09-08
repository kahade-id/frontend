/**
 * Kahade — <PullToRefresh> yang memprioritaskan keselamatan scroll.
 *
 * Insiden 2026-09-08 membuktikan bahwa pull-to-refresh custom tidak layak
 * berada di jalur input utama aplikasi. Satu komponen ini dipakai puluhan
 * layar; Pan manual RNGH + worklet Reanimated milik versi sebelumnya berjalan
 * pada setiap sentuhan vertikal. Kegagalan di state manager/worklet terjadi di
 * UI/native thread, di luar React ErrorBoundary, sehingga gejalanya bukan
 * error state yang bisa dipulihkan melainkan layar menutup/force-close.
 *
 * Implementasi ini sengaja membuang SELURUH mesin gesture custom:
 * - tidak ada GestureDetector/Gesture.Native/Gesture.Pan;
 * - tidak ada manualActivation atau stateManager.activate/fail;
 * - tidak ada worklet/useAnimatedScrollHandler/translateY;
 * - tidak pernah mengubah scrollEnabled berdasarkan status request.
 *
 * Android dan iOS sekarang memakai RefreshControl bawaan React Native. Ia
 * terintegrasi langsung dengan ScrollView native, hanya aktif ketika offset
 * berada di puncak, tetap membiarkan fling/scroll berjalan, dan tidak membuat
 * state machine gesture kedua yang bersaing dengan scroller. Web tetap memakai
 * ScrollView native browser; RefreshControl RN Web memang no-op, jadi tidak
 * dipasang agar tidak ada elemen/handler palsu di jalur scroll.
 *
 * Trade-off yang disengaja: indikator native menggantikan logo custom. Brand
 * tidak boleh dibayar dengan risiko force-close. Warna indikator tetap memakai
 * token tema Kahade. Jika kelak logo custom diperlukan lagi, implementasikan
 * sebagai dukungan native RefreshControl, bukan gesture JS yang membungkus
 * scroller.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import {
  Platform,
  RefreshControl,
  ScrollView,
  View,
  type ScrollViewProps,
  type ViewProps,
} from "react-native"

import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"

const DEFAULT_THRESHOLD = tokens.space[16]

export type PullToRefreshProps = Omit<ViewProps, "children"> & {
  children: ReactNode
  /** Fetch ulang. Promise yang reject ditangkap agar tidak menjadi unhandled rejection. */
  onRefresh: () => void | Promise<void>
  /** Status controlled dari query/parent. Bila tidak diberikan, dikelola lokal. */
  refreshing?: boolean
  /**
   * @deprecated RefreshControl native menentukan ambang sesuai platform.
   * Dipertahankan agar pemanggil lama tidak rusak saat migrasi keselamatan ini.
   */
  threshold?: number
  /** Dipanggil ketika RefreshControl native sudah memutuskan ambang tercapai. */
  onThresholdReached?: () => void
  /** Nonaktifkan pemicu refresh tanpa pernah menonaktifkan scroll. */
  enabled?: boolean
  contentContainerClassName?: string
  scrollViewProps?: Omit<ScrollViewProps, "children" | "refreshControl">
  className?: string
}

export function PullToRefresh({
  children,
  onRefresh,
  refreshing: refreshingProp,
  // Ambang ditentukan native. Alias underscore mencegah prop lama bocor ke View.
  threshold: _threshold = DEFAULT_THRESHOLD,
  onThresholdReached,
  enabled = true,
  contentContainerClassName,
  scrollViewProps,
  className,
  ...rest
}: PullToRefreshProps) {
  const { mode } = useTheme()
  const palette = tokens.colors[mode]
  const controlled = refreshingProp !== undefined
  const [internalRefreshing, setInternalRefreshing] = useState(false)
  const inFlight = useRef(false)
  const mounted = useRef(true)
  const refreshing = controlled ? refreshingProp : internalRefreshing

  useEffect(() => {
    return () => {
      mounted.current = false
    }
  }, [])

  /**
   * Handler stabil dan re-entrancy safe. `inFlight` diubah sinkron sebelum
   * callback user dipanggil, jadi dua event native dalam render yang sama tidak
   * pernah mengirim dua request. Callback sinkron yang melempar juga ditangkap.
   */
  const handleRefresh = useCallback(() => {
    if (!enabled || refreshing || inFlight.current) return

    inFlight.current = true
    if (!controlled) setInternalRefreshing(true)

    try {
      onThresholdReached?.()
    } catch {
      // Haptic/telemetry opsional tidak boleh membatalkan refresh data.
    }

    let result: void | Promise<void>
    try {
      result = onRefresh()
    } catch {
      result = undefined
    }

    void Promise.resolve(result)
      .catch(() => undefined)
      .finally(() => {
        inFlight.current = false
        if (!controlled && mounted.current) setInternalRefreshing(false)
      })
  }, [controlled, enabled, onRefresh, onThresholdReached, refreshing])

  // iOS tidak memiliki prop `enabled` pada native RefreshControl. Saat
  // disabled dan idle, kontrol harus dilepas seluruhnya agar pull tidak dapat
  // terpicu. Jika refresh eksternal sedang aktif, kontrol tetap dirender hanya
  // untuk menunjukkan status; handleRefresh sendiri tetap diganjal `enabled`.
  const refreshControl =
    Platform.OS !== "web" && (enabled || refreshing) ? (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={handleRefresh}
        enabled={enabled}
        colors={[palette.primary]}
        progressBackgroundColor={palette.surfaceElevated}
        tintColor={palette.textPrimary}
        progressViewOffset={tokens.space[2]}
      />
    ) : undefined

  return (
    <View className={cn("flex-1 overflow-hidden", className)} {...rest}>
      <ScrollView
        className="flex-1"
        contentContainerClassName={cn("grow", contentContainerClassName)}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        // Dibutuhkan iOS agar refresh tetap bisa ditarik saat konten lebih
        // pendek daripada viewport. Ini tidak mematikan atau mengunci scroll.
        alwaysBounceVertical={enabled}
        {...scrollViewProps}
        // Harus SESUDAH spread: pemanggil tidak boleh mengganti kontrol aman
        // ini dengan handler custom melalui object yang lolos dari TypeScript.
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
    </View>
  )
}
