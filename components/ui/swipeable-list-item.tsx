/**
 * Kahade — <SwipeableListItem> (§9.17 List Item, §8 spring, §15 reanimated +
 * gesture-handler, §12 aksi destruktif).
 *
 * Membungkus satu baris list (biasanya <ListItem>/<ChatRoomListItem>) dengan
 * aksi tersembunyi yang muncul saat digeser: kiri = arsip/tandai dibaca,
 * kanan = hapus. Untuk daftar chat, notifikasi, rekening tersimpan.
 *
 * Keputusan non-obvious:
 *   - Reanimated `useSharedValue` + `Gesture.Pan()` (bukan RN Swipeable /
 *     PanResponder): translasi baris dibaca UI thread, jadi fling di
 *     FlatList panjang tidak tersendat saat JS sibuk merender sel baru —
 *     alasan yang sama dengan migrasi Slider/BottomSheet.
 *   - `activeOffsetX(±12)` + `failOffsetY(±8)`: pan hanya diklaim setelah
 *     gerakan horizontal jelas; gerakan vertikal kecil langsung
 *     menyerahkan gesture ke ScrollView/FlatList induk. Tanpa failOffsetY,
 *     scroll list terasa "lengket" di setiap baris swipeable.
 *   - Snap dua tahap: geser < 40% lebar aksi -> kembali 0; >= 40% -> snap
 *     terbuka (lebar aksi); geser > 60% lebar baris ATAU fling velocity >
 *     800 px/s -> `onSwipeFull` (aksi "penuh" ala Mail). Semua snap memakai
 *     `withSpring(tokens.motion.spring)`.
 *   - Reduce Motion (audit #2): SENGAJA tidak dimatikan. Translate mengikuti
 *     jari dan spring snap hanya menyelesaikan gerakan dari titik jari
 *     dilepas ke posisi snap terdekat — esensial untuk fungsi (pengecualian
 *     WCAG 2.3.3). Pengguna Reduce Motion tetap punya jalur tanpa gesture
 *     lewat `accessibilityActions`.
 *   - Aksi destruktif (hapus) TIDAK dieksekusi langsung dari swipe penuh
 *     kalau `confirmFull` true: baris menutup lalu `onSwipeFull("right")`
 *     dipanggil — pemanggil menampilkan Dialog (§10). Default `confirmFull`
 *     true untuk sisi kanan (destructive) — menghapus riwayat transaksi
 *     tanpa konfirmasi melanggar §12.
 *   - Hanya SATU baris terbuka pada satu waktu: `useSwipeableGroup()` opsional
 *     di parent memberikan `openId` shared value; baris lain menutup saat
 *     satu mulai digeser. Tanpa group, tiap baris independen.
 *   - Aksi dirender di belakang baris sebagai kolom `bg-surface` (netral)
 *     atau `bg-danger` (destructive) selebar `actionWidth` (default 80 =
 *     ikon 24 + label caption + padding). Warna fill semantik dipakai
 *     PENUH (bukan soft) karena area ini muncul hanya saat swipe aktif
 *     dan harus terbaca cepat; teks di atasnya `inverse`-like: putih di
 *     light, gray-950 di dark — mengikuti Button destructive.
 *   - Tidak ada shadow/overlay pada baris yang bergeser (§6): batas antara
 *     baris dan aksi adalah perbedaan fill saja.
 *   - Web: gesture tetap jalan (Gesture Handler web), tetapi tanpa aksi
 *     alternatif keyboard swipe tidak aksesibel -> tiap aksi juga
 *     dirender sebagai tombol `accessible` yang bisa difokus screen reader
 *     lewat `accessibilityActions` pada wrapper.
 */
import type { ReactNode } from "react"
import { useCallback, useMemo, useState } from "react"
import { View, type AccessibilityActionEvent, type LayoutChangeEvent, type ViewProps } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated"

import { Icon, type IconComponent } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"
import { motionDuration, useReducedMotion } from "@/lib/use-reduced-motion"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export type SwipeSide = "left" | "right"

export type SwipeAction = {
  key: string
  label: string
  icon: IconComponent
  onPress: () => void
  /** Fill danger + teks kontras (untuk hapus) */
  destructive?: boolean
}

export type SwipeableListItemProps = Omit<ViewProps, "children"> & {
  children: ReactNode
  /** Aksi yang muncul saat digeser ke KANAN (tampil di sisi kiri) */
  leftActions?: SwipeAction[]
  /** Aksi yang muncul saat digeser ke KIRI (tampil di sisi kanan) */
  rightActions?: SwipeAction[]
  /** Lebar tiap tombol aksi (default 80) */
  actionWidth?: number
  /** Swipe penuh memicu aksi pertama sisi tersebut */
  onSwipeFull?: (side: SwipeSide) => void
  /** Sisi yang memerlukan konfirmasi pemanggil sebelum aksi penuh (default ["right"]) */
  confirmFull?: SwipeSide[]
  disabled?: boolean
  /** Dari useSwipeableGroup(): hanya satu baris terbuka per group */
  group?: SwipeableGroup
  /** ID unik baris dalam group */
  id?: string
  className?: string
}

export type SwipeableGroup = {
  openId: SharedValue<string | null>
}

/** Panggil di parent list agar hanya satu baris terbuka pada satu waktu. */
export function useSwipeableGroup(): SwipeableGroup {
  const openId = useSharedValue<string | null>(null)
  return useMemo(() => ({ openId }), [openId])
}

const ACTIVE_OFFSET_X = 12
const FAIL_OFFSET_Y = 8
const SNAP_RATIO = 0.4
const FULL_RATIO = 0.6
/** px/detik */
const FULL_VELOCITY = 800

export function SwipeableListItem({
  children,
  leftActions = [],
  rightActions = [],
  actionWidth = 80,
  onSwipeFull,
  confirmFull = ["right"],
  disabled = false,
  group,
  id,
  className,
  ...rest
}: SwipeableListItemProps) {
  const reducedMotion = useReducedMotion() // respect OS reduced motion (WCAG 2.3.3)
  const translateX = useSharedValue(0)
  const rowWidth = useSharedValue(0)
  const [, setOpenState] = useState<SwipeSide | null>(null)

  const leftWidth = leftActions.length * actionWidth
  const rightWidth = rightActions.length * actionWidth
  const rowId = id ?? "row"

  const close = useCallback(() => {
    translateX.value = withSpring(0, tokens.motion.spring)
    setOpenState(null)
  }, [translateX])

  const fireFull = useCallback(
    (side: SwipeSide) => {
      const actions = side === "left" ? leftActions : rightActions
      if (confirmFull.includes(side) || onSwipeFull) {
        onSwipeFull?.(side)
      } else {
        actions[0]?.onPress()
      }
    },
    [confirmFull, leftActions, onSwipeFull, rightActions],
  )

  const setOpen = useCallback((side: SwipeSide | null) => setOpenState(side), [])

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled && (leftWidth > 0 || rightWidth > 0))
        .activeOffsetX([-ACTIVE_OFFSET_X, ACTIVE_OFFSET_X])
        .failOffsetY([-FAIL_OFFSET_Y, FAIL_OFFSET_Y])
        .onBegin(() => {
          if (group && group.openId.value !== rowId) {
            group.openId.value = rowId
          }
        })
        .onChange((e) => {
          // Posisi awal = state terbuka saat ini; batasi ke sisi yang punya aksi.
          const start = translateX.value - e.changeX
          let next = start + e.changeX
          if (leftWidth === 0) next = Math.min(0, next)
          if (rightWidth === 0) next = Math.max(0, next)
          // Rubber-band setelah melewati lebar aksi (setengah kecepatan)
          if (next > leftWidth) next = leftWidth + (next - leftWidth) * 0.5
          if (next < -rightWidth) next = -rightWidth + (next + rightWidth) * 0.5
          translateX.value = next
        })
        .onEnd((e) => {
          const x = translateX.value
          const w = rowWidth.value || 1
          const spring = { ...tokens.motion.spring, velocity: e.velocityX }

          // Swipe penuh
          if (leftWidth > 0 && (x > w * FULL_RATIO || (x > leftWidth && e.velocityX > FULL_VELOCITY))) {
            translateX.value = withSpring(0, spring)
            runOnJS(setOpen)(null)
            runOnJS(fireFull)("left")
            return
          }
          if (rightWidth > 0 && (x < -w * FULL_RATIO || (x < -rightWidth && e.velocityX < -FULL_VELOCITY))) {
            translateX.value = withSpring(0, spring)
            runOnJS(setOpen)(null)
            runOnJS(fireFull)("right")
            return
          }

          // Snap terbuka / tertutup
          if (x > leftWidth * SNAP_RATIO && leftWidth > 0) {
            translateX.value = withSpring(leftWidth, spring)
            runOnJS(setOpen)("left")
          } else if (x < -rightWidth * SNAP_RATIO && rightWidth > 0) {
            translateX.value = withSpring(-rightWidth, spring)
            runOnJS(setOpen)("right")
          } else {
            translateX.value = withSpring(0, spring)
            runOnJS(setOpen)(null)
          }
        })
        .onFinalize((_e, success) => {
          if (!success) translateX.value = withSpring(0, tokens.motion.spring)
        }),
    [disabled, fireFull, group, leftWidth, rightWidth, rowId, rowWidth, setOpen, translateX],
  )

  // Tutup bila baris lain di group dibuka (worklet reaktif via animated style).
  const rowStyle = useAnimatedStyle(() => {
    if (group && group.openId.value !== rowId && translateX.value !== 0) {
      translateX.value = withSpring(0, tokens.motion.spring)
    }
    return { transform: [{ translateX: translateX.value }] }
  })

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      rowWidth.value = e.nativeEvent.layout.width
    },
    [rowWidth],
  )

  // Aksesibilitas: aksi swipe tersedia sebagai custom actions (TalkBack/VoiceOver).
  const a11yActions = [...leftActions, ...rightActions].map((a) => ({ name: a.key, label: a.label }))
  const handleA11yAction = useCallback(
    (e: AccessibilityActionEvent) => {
      const all = [...leftActions, ...rightActions]
      all.find((a) => a.key === e.nativeEvent.actionName)?.onPress()
    },
    [leftActions, rightActions],
  )

  return (
    <View
      className={cn("relative w-full overflow-hidden", className)}
      onLayout={handleLayout}
      accessibilityActions={a11yActions.length ? a11yActions : undefined}
      onAccessibilityAction={a11yActions.length ? handleA11yAction : undefined}
      {...rest}
    >
      {/* Lapisan aksi di belakang baris */}
      <View pointerEvents="box-none" className="absolute inset-0 flex-row justify-between">
        <View className="flex-row">
          {leftActions.map((a) => (
            <ActionButton key={a.key} action={a} width={actionWidth} onDone={close} />
          ))}
        </View>
        <View className="flex-row">
          {rightActions.map((a) => (
            <ActionButton key={a.key} action={a} width={actionWidth} onDone={close} />
          ))}
        </View>
      </View>

      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>
          <View className="w-full bg-background">{children}</View>
        </Animated.View>
      </GestureDetector>
    </View>
  )
}

function ActionButton({ action, width, onDone }: { action: SwipeAction; width: number; onDone: () => void }) {
  // Lebar lewat style (angka runtime dari prop) — bukan class arbitrer.
  return (
    <View style={{ width }} className="h-full">
      <PressableScale accessibilityHint="Ketuk untuk berinteraksi" hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button"
        accessibilityRole="button"
        accessibilityLabel={action.label}
        scaleOnPress={false}
        onPress={() => {
          onDone()
          action.onPress()
        }}
        containerClassName="h-full w-full"
        className={cn(
          "h-full w-full items-center justify-center gap-1 px-2",
          action.destructive ? "bg-danger" : "bg-surface border-y border-border",
        )}
      >
        <Icon icon={action.icon} size="md" tone={action.destructive ? "inverse" : "active"} />
        <Text ellipsizeMode="tail"
          variant="caption"
          weight={500}
          tone={action.destructive ? "inherit" : "primary"}
          className={cn(action.destructive && "text-white dark:text-gray-950")}
          numberOfLines={1}
        >
          {action.label}
        </Text>
      </PressableScale>
    </View>
  )
}