/**
 * Toast — notifikasi sementara non-blocking. Terdiri dari:
 *   - <ToastProvider>  : pasang SEKALI di root (di dalam ThemeProvider &
 *                        SafeAreaProvider) — merender viewport + antrean.
 *   - useToast()       : { show, dismiss, dismissAll } dari komponen mana pun.
 *   - <ToastItem>      : presentasi satu toast (diekspor untuk story/preview).
 *
 * Keputusan:
 *   1. Posisi default TOP (di bawah safe-area) karena bottom sering bertabrakan
 *      dengan TabBar/sticky CTA di flow escrow. Bisa dipilih per toast.
 *   2. Animasi memakai Animated core (bukan Reanimated) agar konsisten dengan
 *      PressableScale & tetap jalan di web tanpa worklet. Slide 8px + fade,
 *      durasi motion.duration.fast, easing standard.
 *   3. Maks 3 toast tampil sekaligus (antrean FIFO) supaya tidak menutup layar.
 *   4. Di web viewport dibatasi `md:max-w-content` dan di-center (§11).
 *   5. Toast tone tidak memakai bg semantik pekat — kotak `bg-surface-elevated
 *      border-border` dengan ikon berwarna, mengikuti prinsip monokrom §6.
 *      Aksi (mis. "Urungkan") lewat TextLink-style Text agar tetap ringkas.
 *   6. Toast tidak bergantung pada Alert supaya keduanya bisa berubah bebas.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { Animated, Easing, Pressable, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { CheckCircle, Info, Warning, WarningCircle, X } from "phosphor-react-native"

import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"
import { motionDuration, useReducedMotion } from "@/lib/use-reduced-motion"
import { Icon, type IconComponent, type IconTone } from "./icon"
import { IconButton } from "./icon-button"
import { Text } from "./text"

export type ToastTone = "neutral" | "success" | "danger" | "warning" | "info"
export type ToastPosition = "top" | "bottom"

export type ToastOptions = {
  title: string
  description?: string
  tone?: ToastTone
  /** ms; 0 = persist sampai dismiss manual. Default 4000 (danger 6000). */
  duration?: number
  position?: ToastPosition
  icon?: IconComponent | null
  action?: { label: string; onPress: () => void }
  /** Tampilkan tombol X (default true bila duration 0) */
  dismissible?: boolean
}

export type ToastRecord = ToastOptions & { id: string }

type ToastContextValue = {
  show: (opts: ToastOptions) => string
  dismiss: (id: string) => void
  dismissAll: () => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const MAX_VISIBLE = 2
const DEFAULT_DURATION = 4000
const DANGER_DURATION = 8000

let counter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const dismissAll = useCallback(() => setToasts([]), [])

  const show = useCallback((opts: ToastOptions) => {
    const id = `toast-${++counter}`
    setToasts((prev) => [...prev, { ...opts, id }])
    return id
  }, [])

  const value = useMemo(() => ({ show, dismiss, dismissAll }), [show, dismiss, dismissAll])

  const top = toasts.filter((t) => (t.position ?? "top") === "top").slice(0, MAX_VISIBLE)
  const bottom = toasts.filter((t) => t.position === "bottom").slice(0, MAX_VISIBLE)

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport position="top" toasts={top} onDismiss={dismiss} />
      <ToastViewport position="bottom" toasts={bottom} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast harus dipakai di dalam <ToastProvider>")
  return ctx
}

// ------------------------------------------------------------------
// Viewport
// ------------------------------------------------------------------

function ToastViewport({
  position,
  toasts,
  onDismiss,
}: {
  position: ToastPosition
  toasts: ToastRecord[]
  onDismiss: (id: string) => void
}) {
  const insets = useSafeAreaInsets()
  if (toasts.length === 0) return null

  return (
    <View accessible={false}
      pointerEvents="box-none"
      className={cn(
        "absolute left-0 right-0 z-banner items-center px-4",
        position === "top" ? "top-0" : "bottom-0",
      )}
      style={position === "top" ? { paddingTop: insets.top + tokens.space[2] } : { paddingBottom: insets.bottom + tokens.space[2] }}
    >
      <View pointerEvents="box-none" className="w-full gap-2 md:max-w-content">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} position={position} onDismiss={() => onDismiss(t.id)} />
        ))}
      </View>
    </View>
  )
}

// ------------------------------------------------------------------
// Item
// ------------------------------------------------------------------

const defaultIcon: Record<ToastTone, IconComponent> = {
  neutral: Info,
  success: CheckCircle,
  danger: WarningCircle,
  warning: Warning,
  info: Info,
}

const iconTone: Record<ToastTone, IconTone> = {
  neutral: "active",
  success: "success",
  danger: "danger",
  warning: "warning",
  info: "info",
}

export type ToastItemProps = {
  toast: ToastRecord
  position?: ToastPosition
  onDismiss: () => void
}

export function ToastItem({ toast, position = "top", onDismiss }: ToastItemProps) {
  const tone = toast.tone ?? "neutral"
  const duration =
    toast.duration ?? (tone === "danger" ? DANGER_DURATION : DEFAULT_DURATION)
  const dismissible = toast.dismissible ?? duration === 0

  // Reduce Motion (audit #2): slide dihilangkan (translateY tetap 0), fade
  // dipertahankan tapi instan (0ms) supaya `start` callback dismiss tetap jalan.
  const reducedMotion = useReducedMotion()
  const reducedRef = useRef(reducedMotion)
  reducedRef.current = reducedMotion
  const slideOffset = position === "top" ? -tokens.space[2] : tokens.space[2]

  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(reducedMotion ? 0 : slideOffset)).current

  const animateOut = useCallback(
    (cb: () => void) => {
      const reduced = reducedRef.current
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: motionDuration(reduced, tokens.motion.duration.press),
          easing: Easing.bezier(...tokens.motion.easing.standard),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: reduced ? 0 : slideOffset,
          duration: motionDuration(reduced, tokens.motion.duration.press),
          easing: Easing.bezier(...tokens.motion.easing.standard),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => finished && cb())
    },
    [opacity, translateY, slideOffset],
  )

  useEffect(() => {
    const reduced = reducedRef.current
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: motionDuration(reduced, tokens.motion.duration.fast),
        easing: Easing.bezier(...tokens.motion.easing.standard),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: motionDuration(reduced, tokens.motion.duration.fast),
        easing: Easing.bezier(...tokens.motion.easing.standard),
        useNativeDriver: true,
      }),
    ]).start()

    if (duration === 0) return
    const timer = setTimeout(() => animateOut(onDismiss), duration)
    return () => clearTimeout(timer)
    // onDismiss stabil per id; sengaja tidak masuk deps agar timer tidak reset

  }, [duration])

  const IconCmp = toast.icon === null ? null : (toast.icon ?? defaultIcon[tone])

  return (
    <Animated.View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{ opacity, transform: [{ translateY }] }}
      className="w-full flex-row items-start gap-3 rounded-md border border-border bg-surface-elevated px-4 py-3"
    >
      {IconCmp ? (
        <View className="pt-[2px]">
          <Icon icon={IconCmp} size="sm" tone={iconTone[tone]} weight="fill" />
        </View>
      ) : null}

      <View className="flex-1 gap-[2px]">
        <Text ellipsizeMode="tail" variant="body" weight={600} numberOfLines={2}>
          {toast.title}
        </Text>
        {toast.description ? (
          <Text variant="caption" tone="secondary" numberOfLines={3}>
            {toast.description}
          </Text>
        ) : null}
      </View>

      {toast.action ? (
        <Pressable accessibilityHint="Ketuk untuk berinteraksi" hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          onPress={() => {
            toast.action?.onPress()
            animateOut(onDismiss)
          }}
          className="min-h-[44px] justify-center px-2 active:opacity-disabled focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <Text variant="label" weight={600}>
            {toast.action.label}
          </Text>
        </Pressable>
      ) : null}

      {dismissible ? (
        <IconButton
          icon={X}
          variant="ghost"
          size="sm"
          accessibilityLabel="Tutup notifikasi"
          onPress={() => animateOut(onDismiss)}
          className="-mr-2 -mt-1"
        />
      ) : null}
    </Animated.View>
  )
}