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
 * Mekanika (reanimated + gesture-handler):
 *   - `Gesture.Pan()` dengan MANUAL ACTIVATION (audit setelah laporan
 *     pengguna: "layar ikut turun mengikuti tangan & list tak bisa discroll
 *     sampai ujung"). Sebelumnya pan memakai `activeOffsetY([10, 1000])`
 *     sehingga pan AKTIF di setiap tarik-ke-bawah ≥10px DI MANA SAJA dalam
 *     list — bukan hanya di puncak. Pan yang aktif di tengah list bersaing
 *     dengan scroll native sepanjang sentuhan (event forwarding RNGH native,
 *     pointer capture di web) dan itulah penyebab scroll tersendat/beku
 *     dekat ujung. Sekarang: pan hanya boleh AKTIF bila `scrollOffset <= 0`
 *     DAN tarik turun melewati 10px (diputuskan di `onTouchesMove` pada UI
 *     thread). Di luar kondisi itu pan langsung FAIL dan scroll 100% native.
 *   - `Gesture.Native()` tetap dikomposisikan `Simultaneous` mewakili scroll
 *     di dalam sistem RNGH supaya ScrollView (versi gesture-handler) di
 *     bawah detector tetap menerima sentuhan seperti biasa.
 *   - Anchor: saat pan AKTIF, `translationY` saat itu disimpan sebagai
 *     `anchor`; jarak tarik = translationY - anchor. Tanpa ini, gerakan
 *     yang sudah dipakai scroll ikut terhitung sebagai tarikan.
 *   - Selama tarikan aktif `scrollEnabled` MEMBENAR-benar dimatikan lewat
 *     runOnJS (`scrollLocked` — sebelumnya hanya klaim komentar tanpa kode,
 *     sehingga scroll native dan tarikan saling berebut gerakan di puncak).
 *     Dinyalakan lagi saat tarikan lepas/gesture selesai.
 *   - Konten (ScrollView) di-translateY oleh shared value `pull`; area logo
 *     berada DI BELAKANG konten (absolute top), tinggi = ambang. Menarik
 *     konten ke bawah "menyingkap" logo — tidak perlu animasi height.
 *   - 1:1 sampai ambang; setelahnya resistensi 0.35 dan cap 1.6x ambang
 *     supaya tarikan tidak tanpa batas (§8 "1:1" berlaku sampai threshold).
 *   - Lepas tarikan SELALU via `withSpring` (sebelumnya `pull.value = 0`
 *     mentah di dua cabang — konten "nendang" balik seketika).
 *   - Ambang default 64px (space.16 — "top spacing layar penuh"), cukup
 *     untuk logo `md` (40px) + napas.
 *   - `bounces={false}` di iOS & `overScrollMode="never"` di Android:
 *     overscroll bawaan akan menggandakan efek tarik / menampilkan glow OS.
 *   - Haptic saat ambang tercapai lewat prop `onThresholdReached`
 *     (expo-haptics sudah terpasang; pemanggil:
 *     `onThresholdReached={() => Haptics.impactAsync(...)}`). Belum ada
 *     layar yang memasangnya — opsional, tidak wajib.
 *   - Settle memakai `withSpring(tokens.motion.spring)` — config yang sama
 *     dengan BottomSheet (§8) agar satu kosakata gerak.
 *   - GUARD TERSANGKUT mode controlled (audit): `startRefresh` menarik
 *     indikator ke ambang, lalu settle bergantung transisi prop `refreshing`
 *     true→false. Refresh yang SANGAT cepat bisa menyelesaikan transisi itu
 *     dalam satu batch render sehingga effect settle tidak melihatnya —
 *     indikator tersangkut di ambang, konten tergeser permanen, dan UJUNG
 *     BAWAH list tidak bisa dinaikkan ke layar. `startRefresh` kini juga
 *     men-settle sendiri bila prop tidak pernah terkonfirmasi true.
 *   - Reduce Motion (audit #2): SENGAJA tidak dimatikan. Translate mengikuti
 *     jari pengguna 1:1 dan spring settle hanya mengembalikan konten dari
 *     titik jari dilepas ke 0 — gerakan "esensial untuk fungsi" (pengecualian
 *     WCAG 2.3.3), bukan dekorasi. PulsingLogo di dalamnya sudah membaca
 *     useReducedMotion() sendiri.
 *   - Web (§11): dengan manual activation, pan TIDAK pernah aktif di tengah
 *     list sehingga scroll roda/drag native browser tidak pernah terganggu;
 *     drag-mouse untuk refresh hanya aktif di puncak.
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
// This third-party animated wrapper is not one of NativeWind's registered RN
// primitives. Without the mapping, contentContainerClassName is silently ignored.
cssInterop(AnimatedScrollView, {
  className: "style",
  contentContainerClassName: "contentContainerStyle",
})

const DEFAULT_THRESHOLD = tokens.space[16] // 64px
const OVERPULL_RESISTANCE = 0.35
const OVERPULL_MAX_RATIO = 1.6
/**
 * Skala logo saat mulai tersingkap -> 1 di ambang. Tidak ada token untuk ini
 * (§8 hanya mendefinisikan scale.press 0.97 untuk button); 0.7 dipilih agar
 * pertumbuhan terlihat tapi logo tidak pernah "mengecil ke titik".
 */
const LOGO_SCALE_FROM = 0.7

/** Tarik turun minimal (px, sejak sentuh) sebelum pan boleh AKTIF di puncak. */
const PULL_ACTIVATE_OFFSET = 10
/** Gesture yang tidak sedang di puncak di-FAIL setelah melewati ambang ini. */
const FAIL_OFFSET_Y = 8
const FAIL_OFFSET_X = 20

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
  scrollViewProps?: Omit<
    ScrollViewProps,
    "children" | "onScroll" | "scrollEventThrottle" | "bounces"
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

  // JS state (hanya untuk render indikator & scrollEnabled)
  const [internalRefreshing, setInternalRefreshing] = useState(false)
  const [scrollLocked, setScrollLocked] = useState(false)

  const controlled = refreshingProp !== undefined
  const refreshing = controlled ? refreshingProp : internalRefreshing
  useEffect(() => {
    isRefreshing.value = refreshing
  }, [refreshing, isRefreshing])

  const lockScroll = useCallback((value: boolean) => setScrollLocked(value), [])

  // Mode controlled & uncontrolled: saat refresh selesai (true -> false), settle ke 0.
  const prevRefreshing = useRef(refreshing)
  useEffect(() => {
    if (prevRefreshing.current && !refreshing) pull.value = withSpring(0, tokens.motion.spring)
    prevRefreshing.current = refreshing
  }, [refreshing, pull])

  const startRefresh = useCallback(async () => {
    // Debounce spam pull: ignore if already refreshing (audit #051)
    if (isRefreshing.value || refreshing) return
    pull.value = withSpring(threshold, tokens.motion.spring)
    // Error dari onRefresh adalah urusan parent (tampilkan Banner/Toast di
    // sana). Di sini cukup ditelan supaya tidak menjadi unhandled rejection
    // (dipanggil dari runOnJS, tidak ada pemanggil yang bisa menangkapnya)
    // dan indikator selalu kembali ke posisi 0.
    if (controlled) {
      void Promise.resolve(onRefresh())
        .catch(() => undefined)
        .finally(() => {
          // GUARD TERSANGKUT: bila transisi prop `refreshing` true→false
          // tuntas dalam satu batch (refresh cepat), effect settle di atas
          // tidak melihat transisinya dan pull tertinggal di ambang —
          // konten tergeser permanen dan ujung bawah list tak terjangkau.
          // Settle di sini hanya bila prop TIDAK pernah terkonfirmasi true;
          // bila terkonfirmasi, effect settle yang kembali mengurus.
          if (!isRefreshing.value) pull.value = withSpring(0, tokens.motion.spring)
        })
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
  }, [controlled, isRefreshing, onRefresh, pull, threshold])

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
        // MANUAL ACTIVATION: tanpa ini, `activeOffsetY` membuat pan aktif di
        // SETIAP tarik-turun ≥10px di mana pun — termasuk di tengah list yang
        // sedang discroll — dan pan yang aktif bersaing dengan scroll native
        // sampai jari lepas (tersendat/beku dekat ujung, layar "ikut tangan").
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
          if (scrollOffset.value > 0) {
            // Belum di puncak: pan TIDAK PERNAH boleh ikut — scroll murni
            // native sampai jari lepas. Inilah yang menjaga list panjang
            // tetap bisa discroll sampai ujung atas/bawah.
            if (Math.abs(dy) > FAIL_OFFSET_Y || Math.abs(dx) > FAIL_OFFSET_X) {
              decided.value = true
              stateManager.fail()
            }
            return
          }
          if (dy > PULL_ACTIVATE_OFFSET) {
            // Di puncak + tarik turun: pan mengambil alih. Anchor = posisi
            // jari saat keputusan, supaya tarikan mulai 0 (tidak melompat
            // sebesar gerakan yang sudah terlanjur terjadi).
            decided.value = true
            anchor.value = dy
            stateManager.activate()
          } else if (dy < -FAIL_OFFSET_Y || Math.abs(dx) > FAIL_OFFSET_X) {
            decided.value = true
            stateManager.fail()
          }
        })
        .onUpdate((e) => {
          if (isRefreshing.value) return

          // Pengaman: lock scrollEnabled ada latensi JS-thread; bila scroll
          // sempat bergeser dari puncak saat pan aktif, lepas tarikan dengan
          // halus dan biarkan scroll berjalan.
          if (scrollOffset.value > 0) {
            if (pulling.value) {
              pulling.value = false
              runOnJS(lockScroll)(false)
              pull.value = withSpring(0, tokens.motion.spring)
            }
            anchor.value = e.translationY
            return
          }

          const dy = e.translationY - anchor.value
          if (dy <= 0) {
            if (pulling.value) {
              pulling.value = false
              runOnJS(lockScroll)(false)
              // Lepas dengan spring, BUKAN `pull.value = 0` mentah —
              // konten yang "nendang" balik seketika terasa seperti bug.
              pull.value = withSpring(0, tokens.motion.spring)
            }
            // Jari bergerak ke atas dari puncak: anchor ikut agar tarikan
            // berikutnya dimulai dari titik balik, bukan dari awal gesture.
            anchor.value = e.translationY
            return
          }

          if (!pulling.value) {
            pulling.value = true
            // Kunci scroll SELAMA tarikan (jalan di UI-thread → runOnJS).
            // Tanpa ini scroll native ikut mengonsumsi gerakan vertikal dan
            // berebut dengan translate 1:1 di puncak.
            runOnJS(lockScroll)(true)
          }

          // 1:1 sampai ambang, lalu resistensi + cap.
          let d = dy
          if (d > threshold) {
            d = Math.min(
              threshold + (d - threshold) * OVERPULL_RESISTANCE,
              threshold * OVERPULL_MAX_RATIO,
            )
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
          // Selalu buka kunci — setState dengan nilai sama diabaikan React,
          // jadi panggilan redundan tidak merender ulang.
          runOnJS(lockScroll)(false)
          if (isRefreshing.value) return
          if (reached.value && wasPulling) runOnJS(startRefresh)()
          else if (pull.value !== 0) pull.value = withSpring(0, tokens.motion.spring)
        }),
    [
      anchor,
      decided,
      enabled,
      isRefreshing,
      lockScroll,
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
        // `accessible` agar label live-region benar-benar diumumkan; logo di
        // dalamnya murni dekoratif (audit #4).
        accessible={refreshing}
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
            className="flex-1"
            contentContainerClassName={cn("grow", contentContainerClassName)}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={onScroll}
            scrollEnabled={!refreshing && !scrollLocked}
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
