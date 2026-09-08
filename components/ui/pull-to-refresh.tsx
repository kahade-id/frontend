import { cssInterop } from "nativewind"
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
 * ============================ ATURAN EMAS ============================
 * Komponen ini TIDAK BOLEH pernah mematikan scroll. Lihat laporan audit
 * docs/audit/PULL-TO-REFRESH-2026-09-08.md: sumber keluhan "ga bisa di
 * scroll" bukan gesture-nya, melainkan upaya menjaga gesture tidak berebut
 * dengan scroll lewat `scrollEnabled`. Setiap variasi lockdown itu punya
 * jalur lepas yang bolong:
 *   - `scrollEnabled={!refreshing}` mengunci layar SELAMA refresh — 20 detik
 *     per percobaan di lib/api/config.ts (API_TIMEOUT_MS) dan sampai 2 retry
 *     di lib/api/client.ts, jadi di jaringan lambat layar beku ±1 menit;
 *   - di web `scrollEnabled={false}` berarti `overflow:hidden`
 *     (node_modules/react-native-web/.../ScrollViewBase.js, styles.scrollDisabled),
 *     bukan sekadar "tidak menerima sentuhan";
 *   - `scrollLocked` via runOnJS setState bisa tidak pernah dilepas bila
 *     gesture dibatalkan tanpa onFinalize (unmount, `enabled` berbalik,
 *     reattach RNGH) -> terkunci permanen sampai sentuhan berikutnya.
 * Kuncinya memang TIDAK diperlukan: tarikan hanya boleh aktif di puncak
 * (scrollOffset ~ 0), dan di sana scroll native tidak punya tempat untuk
 * pergi — `bounces={false}` (iOS) dan `overScrollMode="never"` (Android)
 * sudah dipasang. Jadi tidak ada yang perlu dilindungi dari scroll, dan tidak
 * ada yang boleh dikunci dari scroll.
 * ======================================================================
 *
 * Mekanika (reanimated + gesture-handler):
 *   - `Gesture.Pan()` dengan MANUAL ACTIVATION. Keputusan activate/fail diambil
 *     di `onTouchesMove` pada UI thread lewat `lib/pull-math.ts` (murni +
 *     teruji): pan hanya boleh AKTIF bila sedang di puncak DAN tarik turun
 *     melewati 10px; di luar itu pan langsung FAIL sehingga scroll 100%
 *     native dan tidak pernah "ditahan" oleh handler yang menggantung.
 *     `activeOffsetY` tidak dipakai lagi: aktif di setiap tarikan ≥10px di mana
 *     saja dalam list — termasuk di tengah list yang sedang discroll.
 *   - `Gesture.Native()` tetap dikomposisikan `Simultaneous` mewakili scroll di
 *     dalam sistem RNGH supaya ScrollView (versi gesture-handler) di bawah
 *     detector tetap menerima sentuhan seperti biasa.
 *   - Anchor: saat pan AKTIF, `translationY` saat itu disimpan sebagai `anchor`;
 *     jarak tarik = translationY - anchor. Tanpa ini, gerakan yang sudah dipakai
 *     scroll ikut terhitung sebagai tarikan.
 *   - Konten (ScrollView) di-translateY oleh shared value `pull`; area logo
 *     berada DI BELAKANG konten (absolute top), tinggi = ambang. Menarik
 *     konten ke bawah "menyingkap" logo — tidak perlu animasi height.
 *   - 1:1 sampai ambang; setelahnya resistensi 0.35 dan cap 1.6x ambang
 *     supaya tarikan tidak tanpa batas (§8 "1:1" berlaku sampai threshold).
 *   - Lepas tarikan SELALU via `withSpring` (bukan `pull.value = 0` mentah,
 *     yang membuat konten "nendang" balik seketika).
 *   - `decided`/`reached`/`anchor` di-reset di `onFinalize`, BUKAN hanya di
 *     `onTouchesDown`. `onTouchesDown` adalah event yang boleh tidak datang
 *     (handler sempat tidak terpasang, sentuhan dimulai saat `enabled` false);
 *     kalau reset hanya terjadi di sana, satu gesture yang batal membuat pan
 *     tidak pernah bisa memutuskan lagi -> pull-to-refresh mati permanen
 *     untuk sisa hidup layar.
 *   - GUARD TERSANGKUT mode controlled: `startRefresh` menarik indikator ke
 *     ambang, lalu settle bergantung transisi prop `refreshing` true→false.
 *     Refresh yang SANGAT cepat bisa menyelesaikan transisi itu dalam satu
 *     batch render sehingga effect settle tidak melihatnya — indikator tertinggal
 *     di ambang. `startRefresh` men-settle sendiri bila prop tidak pernah
 *     terkonfirmasi true, dan `enabled` yang berbalik false selalu men-settle.
 *   - Prop callback dibaca lewat ref (`handlers`), bukan lewat deps `useMemo`.
 *     Alasan: `onRefresh={() => void query.refresh()}` adalah fungsi baru tiap
 *     render layar; bila ia masuk deps, objek gesture baru dibuat setiap render
 *     dan RNGH menulis ulang config handler di TENGAH gesture yang sedang
 *     berjalan (GestureDetector: `useEffect(..., [props])` -> updateHandlers).
 *     Dengan ref, identitas gesture stabil dan hanya `enabled`/`threshold`
 *     (primitif) yang boleh mengubahnya.
 *   - Haptic saat ambang tercapai lewat prop `onThresholdReached` (expo-haptics
 *     sudah terpasang). Belum ada layar yang memasangnya — opsional, tidak wajib.
 *   - Settle memakai `withSpring(tokens.motion.spring)` — config yang sama
 *     dengan BottomSheet (§8) agar satu kosakata gerak.
 *   - Reduce Motion (audit #2): SENGAJA tidak dimatikan. Translate mengikuti
 *     jari pengguna 1:1 dan spring settle hanya mengembalikan konten dari titik
 *     jari dilepas ke 0 — gerakan "esensial untuk fungsi" (pengecualian
 *     WCAG 2.3.3), bukan dekorasi. PulsingLogo di dalamnya sudah membaca
 *     useReducedMotion() sendiri.
 *   - Web (§11) — dua hal yang harus dijaga bersamaan:
 *       1. `touchAction="pan-y"` di <GestureDetector>. Default RNGH adalah
 *          `touch-action: none`, dan detector memasang itu LANGSUNG di elemen
 *          yang bisa di-scroll (lihat GestureHandlerWebDelegate.setTouchAction).
 *          Tanpa props ini, seluruh layar di web tidak bisa digeser dengan
 *          sentuhan — bukan hanya saat menarik. `pan-y` mengembalikan scroll
 *          native browser; tarikan tetap bekerja karena di puncak browser tidak
 *          punya ruang untuk scroll sehingga tidak mengirim pointercancel.
 *       2. `overscroll-behavior-y: contain` pada scroller, supaya tarikan di
 *          puncak tidak diteruskan ke dokumen (kalau tidak, <body> yang
 *          bergeser dan indikator tidak bergerak).
 *   - `Animated.View` reanimated tidak di-interop NativeWind -> className di
 *     ScrollView / View anak.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  Platform,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native"
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
import { decidePull, isAtTop, pullDistance, reachedThreshold } from "@/lib/pull-math"
import { tokens } from "@/lib/tokens"

const AnimatedScrollView = Animated.createAnimatedComponent(GHScrollView)
// This third-party animated wrapper is not one of NativeWind's registered RN
// primitives. Without the mapping, contentContainerClassName is silently ignored.
cssInterop(AnimatedScrollView, {
  className: "style",
  contentContainerClassName: "contentContainerStyle",
})

const DEFAULT_THRESHOLD = tokens.space[16] // 64px
/**
 * Skala logo saat mulai tersingkap -> 1 di ambang. Tidak ada token untuk ini
 * (§8 hanya mendefinisikan scale.press 0.97 untuk button); 0.7 dipilih agar
 * pertumbuhan terlihat tapi logo tidak pernah "mengecil ke titik".
 */
const LOGO_SCALE_FROM = 0.7

/**
 * Web only. `overscrollBehaviorY` bukan kunci style React Native, jadi tidak
 * pernah dipasang di native (RN dev memvalidasi kunci style yang tidak
 * dikenal); di react-native-web kunci ini di-hyphenate ke CSS
 * `overscroll-behavior-y`.
 */
const WEB_OVERSCROLL_CONTAIN: StyleProp<ViewStyle> | undefined =
  Platform.OS === "web"
    ? ({ overscrollBehaviorY: "contain" } as unknown as ViewStyle)
    : undefined

export type PullToRefreshProps = Omit<ViewProps, "children"> & {
  children: ReactNode
  /** Fetch ulang. Bila mengembalikan Promise, indikator menunggu sampai selesai. */
  onRefresh: () => void | Promise<void>
  /**
   * Kontrol eksternal (mis. SWR `isValidating`). Bila diberikan, komponen
   * tidak mengelola state refresh sendiri — settle terjadi saat nilai ini
   * kembali false.
   *
   * Prop ini HANYA mengendalikan indikator. Ia dengan sengaja tidak lagi
   * menyentuh `scrollEnabled`: selama ini itulah yang membuat layar tidak
   * bisa di-scroll selama refresh berjalan (lihat "ATURAN EMAS" di kepala).
   */
  refreshing?: boolean
  /** Jarak tarik (px) yang memicu refresh. Default 64 (space.16). */
  threshold?: number
  /** Dipanggil sekali per gesture saat ambang tercapai — tempat haptic (§8). */
  onThresholdReached?: () => void
  /** Matikan gesture (mis. saat layar dalam state error penuh) */
  enabled?: boolean
  contentContainerClassName?: string
  /**
   * `scrollEnabled` sengaja TIDAK di-omit: pemilik layar boleh
   * mematikannya (mis. saat modal terbuka). Yang tidak boleh adalah
   * komponen ini melakukannya.
   */
  scrollViewProps?: Omit<
    ScrollViewProps,
    "children" | "onScroll" | "scrollEventThrottle" | "bounces" | "refreshControl"
  >
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
  // Manual activation: keputusan activate/fail hanya SEKALI per gesture.
  const decided = useSharedValue(false)
  const touchStartY = useSharedValue(0)
  const touchStartX = useSharedValue(0)

  // JS state (hanya untuk merender indikator)
  const [internalRefreshing, setInternalRefreshing] = useState(false)

  const controlled = refreshingProp !== undefined
  const refreshing = controlled ? refreshingProp : internalRefreshing
  useEffect(() => {
    isRefreshing.value = refreshing
  }, [refreshing, isRefreshing])

  /**
   * Callback yang dibaca dari JS thread. Disimpan di ref supaya objek gesture
   * tidak dibuat ulang setiap render (lihat catatan di kepala file).
   */
  const handlers = useRef({ onRefresh, onThresholdReached, controlled, threshold, refreshing })
  handlers.current = { onRefresh, onThresholdReached, controlled, threshold, refreshing }

  // Mode controlled & uncontrolled: saat refresh selesai (true -> false), settle ke 0.
  const prevRefreshing = useRef(refreshing)
  useEffect(() => {
    if (prevRefreshing.current && !refreshing) pull.value = withSpring(0, tokens.motion.spring)
    prevRefreshing.current = refreshing
  }, [refreshing, pull])

  /**
   * Gesture dimatikan di tengah tarikan (mis. layar beralih ke <LoadingScreen>
   * karena `enabled={refreshable && !loading}`). onFinalize tidak dijamin
   * datang untuk handler yang baru saja dinonaktifkan, jadi konten bisa
   * tertinggal tergeser — dan konten yang tergeser membuat baris paling bawah
   * tidak pernah sampai ke layar. Settle + reset eksplisit di sini.
   *
   * BILA refresh masih berjalan, JANGAN settle: indikatornya sengaja
   * ditahan di ambang selama `refreshing`, dan parent boleh flipping
   * `enabled` (mis. muat-awal menimpa refresh) di tengah jalan — men-settle
   * di saat itu akan mematikan logo sebelum datanya tiba.
   */
  useEffect(() => {
    if (enabled) return
    pulling.value = false
    reached.value = false
    decided.value = false
    anchor.value = 0
    if (!refreshing && pull.value !== 0) pull.value = withSpring(0, tokens.motion.spring)
  }, [anchor, decided, enabled, pull, pulling, reached, refreshing])

  const startRefresh = useCallback(async () => {
    // Debounce spam pull (audit #051): dua sumber diperiksa karena dua hal yang
    // berbeda. `isRefreshing.value` adalah nilai yang sudah dikomit ke UI
    // thread; `handlers.current.refreshing` adalah prop render terakhir —
    // di mode controlled, refresh bisa sudah dimulai oleh induk (mis.
    // refresh-on-focus) sesaat sebelum gesture ini finalize, dan shared value
    // belum sempat disinkronkan oleh useEffect.
    const { onRefresh: run, controlled: isControlled, threshold: limit, refreshing: busy } =
      handlers.current
    if (isRefreshing.value || busy) return
    pull.value = withSpring(limit, tokens.motion.spring)
    // Error dari onRefresh adalah urusan parent (tampilkan Banner/Toast di
    // sana). Di sini cukup ditelan supaya tidak menjadi unhandled rejection
    // (dipanggil dari runOnJS, tidak ada pemanggil yang bisa menangkapnya)
    // dan indikator selalu kembali ke posisi 0.
    if (isControlled) {
      void Promise.resolve(run())
        .catch(() => undefined)
        .finally(() => {
          // GUARD TERSANGKUT: bila transisi prop `refreshing` true→false
          // tuntas dalam satu batch (refresh cepat), effect settle di atas
          // tidak melihat transisinya dan pull tertinggal di ambang.
          // Settle di sini hanya bila prop TIDAK pernah terkonfirmasi true;
          // bila terkonfirmasi, effect settle yang kembali mengurus.
          if (!isRefreshing.value) pull.value = withSpring(0, tokens.motion.spring)
        })
      return
    }
    setInternalRefreshing(true)
    try {
      await run()
    } catch {
      // ditelan — lihat komentar di atas
    } finally {
      // useEffect di atas melakukan spring ke 0 saat state berubah
      setInternalRefreshing(false)
    }
  }, [isRefreshing, pull])

  const notifyThreshold = useCallback(() => handlers.current.onThresholdReached?.(), [])

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
        // MANUAL ACTIVATION: keputusan aktif/fail diambil sendiri di
        // `onTouchesMove`. Dengan `activeOffsetY`, pan aktif di SETIAP
        // tarik-turun ≥10px di mana pun — termasuk di tengah list yang sedang
        // discroll — lalu bersaing dengan scroll native sampai jari lepas.
        .manualActivation(true)
        .onTouchesDown((e) => {
          const touch = e.allTouches[0]
          decided.value = false
          touchStartY.value = touch?.absoluteY ?? 0
          touchStartX.value = touch?.absoluteX ?? 0
          reached.value = false
          pulling.value = false
        })
        .onTouchesMove((e, stateManager) => {
          if (decided.value) return
          const touch = e.allTouches[0]
          if (!touch) return
          const dy = touch.absoluteY - touchStartY.value
          const dx = touch.absoluteX - touchStartX.value
          const decision = decidePull({ offsetY: scrollOffset.value, dy, dx })
          if (decision === "hold") return
          decided.value = true
          if (decision === "activate") {
            // Di puncak + tarik turun: pan mengambil alih. Anchor = posisi
            // jari saat keputusan, supaya tarikan mulai dari 0 dan tidak
            // melompat sebesar gerakan yang sudah terlanjur terjadi.
            anchor.value = dy
            stateManager.activate()
            return
          }
          // Bukan tarikan (list belum di puncak, atau jari bergerak ke atas /
          // menyamping): FAIL permanen untuk sentuhan ini, bukan sekadar diam.
          // Handler yang dibiarkan UNDETERMINED ikut menahan antrean gesture
          // sepanjang sentuhan -> scroll terasa tersendat/beku.
          stateManager.fail()
        })
        .onUpdate((e) => {
          if (isRefreshing.value) return

          // Pengaman: scroll bisa berpindah dari puncak selama gesture aktif
          // (mis. satu frame sebelum tarikan mulai, atau fling sisa). Lepas
          // tarikan dengan halus dan biarkan scroll bekerja — TANPA menyentuh
          // scrollEnabled, karena tidak ada yang boleh melumpuhkan scroll.
          if (!isAtTop(scrollOffset.value)) {
            if (pulling.value) {
              pulling.value = false
              pull.value = withSpring(0, tokens.motion.spring)
            }
            anchor.value = e.translationY
            return
          }

          const dy = e.translationY - anchor.value
          if (dy <= 0) {
            if (pulling.value) {
              pulling.value = false
              // Lepas dengan spring, BUKAN `pull.value = 0` mentah — konten
              // yang "nendang" balik seketika terasa seperti bug.
              pull.value = withSpring(0, tokens.motion.spring)
            }
            // Jari berbalik ke atas dari puncak: anchor ikut, agar tarikan
            // berikutnya dimulai dari titik balik. Scroll native mengambil
            // alih di arah ini dengan sendirinya (konten tidak bisa didorong
            // ke atas oleh kita).
            anchor.value = e.translationY
            return
          }

          pulling.value = true

          // 1:1 sampai ambang, lalu resistensi + cap (lihat lib/pull-math.ts).
          const distance = pullDistance(dy, threshold)
          pull.value = distance

          if (!reached.value && reachedThreshold(distance, threshold)) {
            reached.value = true
            runOnJS(notifyThreshold)()
          }
        })
        .onFinalize(() => {
          const wasPulling = pulling.value
          const triggered = reached.value
          // Reset per-gesture di SINI juga, bukan hanya di onTouchesDown
          // (lihat catatan "decided" di kepala file).
          pulling.value = false
          reached.value = false
          decided.value = false
          anchor.value = 0
          if (isRefreshing.value) return
          if (triggered && wasPulling) runOnJS(startRefresh)()
          else if (pull.value !== 0) pull.value = withSpring(0, tokens.motion.spring)
        }),
    // Hanya primitif + shared value. `startRefresh`/`notifyThreshold` stabil
    // (useCallback tanpa prop di deps) sehingga identitas `pan` tidak berubah
    // saat layar render di tengah tarikan.
    [
      anchor,
      decided,
      enabled,
      isRefreshing,
      notifyThreshold,
      pull,
      pulling,
      reached,
      scrollOffset,
      startRefresh,
      threshold,
      touchStartX,
      touchStartY,
    ],
  )

  const composed = useMemo(() => Gesture.Simultaneous(pan, nativeScroll), [pan, nativeScroll])

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

  return (
    <View className={cn("flex-1 overflow-hidden", className)} {...rest}>
      {/* Area logo di belakang konten — tinggi = ambang */}
      <View
        // `pointerEvents` WAJIB hidup di dalam `style`, bukan sebagai prop:
        // React Native menandai prop `pointerEvents` deprecated dan
        // react-native-web hanya mengenalnya lewat StyleSheet compiler
        // (aturan H scripts/check-a11y.mjs). Tanpanya, lapisan setinggi ambang
        // ini menelan sentuhan pertama pada baris teratas daftar.
        style={[{ pointerEvents: "none" }, { height: threshold }]}
        // `accessible` agar label live-region benar-benar diumumkan; logo di
        // dalamnya murni dekoratif (audit #4).
        accessible={refreshing}
        accessibilityLiveRegion="polite"
        accessibilityLabel={refreshing ? "Memuat ulang" : undefined}
        className="absolute inset-x-0 top-0 items-center justify-center"
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
        <GestureDetector gesture={composed} touchAction="pan-y">
          <AnimatedScrollView
            className="flex-1"
            contentContainerClassName={cn("grow", contentContainerClassName)}
            style={WEB_OVERSCROLL_CONTAIN}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={onScroll}
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
