/**
 * Toast — notifikasi sementara non-blocking. Terdiri dari:
 *   - <ToastProvider>  : pasang SEKALI di root (di dalam ThemeProvider &
 *                        SafeAreaProvider) — merender viewport + antrean.
 *   - useToast()       : { show, dismiss, dismissAll } dari komponen mana pun.
 *   - <ToastItem>      : presentasi satu toast (internal — H-14: dulu diekspor
 *                        "untuk story/preview", padahal repo ini tidak punya
 *                        infrastruktur story; ekspor mati dihapus).
 *
 * Keputusan:
 *   1. Posisi default TOP (di bawah safe-area) karena bottom sering bertabrakan
 *      dengan TabBar/sticky CTA di flow escrow. Bisa dipilih per toast.
 *   2. Animasi memakai Animated core (bukan Reanimated) agar konsisten dengan
 *      PressableScale & tetap jalan di web tanpa worklet. Masuk: slide 8px +
 *      fade (kurva enter) + scale 0.97→1 spring playful (v2); keluar: fade
 *      cepat 150ms kurva exit. Durasi masuk motion.duration.fast.
 *   3. Maks 2 toast tampil sekaligus per posisi (MAX_VISIBLE, antrean FIFO)
 *      supaya tidak menutup layar; sisanya menyusul setelah ada yang habis.
 *   4. Di web viewport dibatasi `md:max-w-content` dan di-center (§11).
 *   5. Toast tone tidak memakai bg semantik pekat — kotak `bg-surface-elevated
 *      border-border` + elevasi medium (v2 §5.2) dengan ikon berwarna.
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

import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/cn"
import { elevationStyle } from "@/lib/elevation"
import { focusRing } from "@/lib/focus-ring"
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
  /** ms; 0 = persist sampai dismiss manual. Default 4000 (danger 8000). */
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
/**
 * H-01 (audit 2026-09-22): antrean toast dulu TUMBUH TANPA BATAS. Saat
 * sekumpulan request gagal bersamaan (offline, 5xx massal), pengguna menerima
 * puluhan toast untuk keadaan yang sama; masing-masing 4–8 detik, jadi toast
 * terakhir baru muncul belasan detik setelah kejadiannya — dan pesan basi itu
 * justru menutupi layar saat pengguna sudah menekan "Coba lagi".
 *
 * Dua penjaga:
 *   - MAX_QUEUE: panjang antrean (tampil + menunggu) dibatasi; yang TERTUA
 *     dibuang karena pesan terbaru mencerminkan keadaan sekarang.
 *   - COALESCE_WINDOW_MS: toast dengan isi + posisi + tone identik dalam
 *     jendela ini MENGGANTIKAN yang lama (durasi mulai ulang) alih-alih
 *     menumpuk jadi dua baris kembar.
 */
const MAX_QUEUE = 5
const COALESCE_WINDOW_MS = 1500

let counter = 0

/** Kunci koalesensi: isi toast yang dianggap "pesan yang sama". */
function coalesceKey(opts: ToastOptions): string {
  return [opts.position ?? "top", opts.tone ?? "neutral", opts.title, opts.description ?? ""].join(
    "\u0001",
  )
}

/** Isi toast terakhir per kunci koalesensi + id yang masih hidup. */
type RecentMap = Map<string, { id: string; at: number }>

/**
 * Logika antrean (H-01) sebagai fungsi MURNI supaya batas antrean, koalesensi,
 * dan pemotongan per posisi bisa diuji tanpa merender React
 * (`tests/toast-queue.test.tsx`). `ToastProvider` hanya menyimpan hasilnya.
 */
export function enqueueToast(
  queue: readonly ToastRecord[],
  recent: RecentMap,
  opts: ToastOptions,
  id: string,
  now: number = Date.now(),
): { queue: ToastRecord[]; recent: RecentMap } {
  const key = coalesceKey(opts)
  const last = recent.get(key)
  const previous =
    last && now - last.at < COALESCE_WINDOW_MS ? queue.find((t) => t.id === last.id) : undefined
  // Koalesensi: isi sama baru saja tampil → ganti yang lama (durasi mulai ulang).
  let next = previous ? queue.filter((t) => t.id !== previous.id) : [...queue]
  next.push({ ...opts, id })

  // Batas antrean dihitung PER POSISI: toast aksi di bawah tidak boleh terbuang
  // oleh hujan pesan error di atas. Yang TERTUA per posisi yang dibuang.
  const position = opts.position ?? "top"
  const samePosition = next.filter((t) => (t.position ?? "top") === position)
  if (samePosition.length > MAX_QUEUE) {
    const dropped = new Set(samePosition.slice(0, samePosition.length - MAX_QUEUE).map((t) => t.id))
    next = next.filter((t) => !dropped.has(t.id))
  }

  // Peta koalesensi dibersihkan bersama antrean supaya tidak tumbuh selamanya.
  const alive = new Set(next.map((t) => t.id))
  const nextRecent: RecentMap = new Map()
  for (const [k, entry] of recent) if (alive.has(entry.id)) nextRecent.set(k, entry)
  nextRecent.set(key, { id, at: now })
  return { queue: next, recent: nextRecent }
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([])
  /**
   * Cermin state untuk pemanggilan berurutan dalam satu tick: `show`/`dismiss`
   * dipanggil dari callback async, dan pembacaan lewat cermin ini membuat
   * keputusan antrean (buang tertua, koalesensi) tidak bergantung pada
   * `setState` yang belum ter-flush. State tetap satu-satunya sumber render.
   */
  const queueRef = useRef<ToastRecord[]>([])
  const recentRef = useRef<RecentMap>(new Map())

  const commit = useCallback((next: ToastRecord[]) => {
    queueRef.current = next
    setToasts(next)
  }, [])

  const dismiss = useCallback(
    (id: string) => {
      const next = queueRef.current.filter((t) => t.id !== id)
      const alive = new Set(next.map((t) => t.id))
      const nextRecent: RecentMap = new Map()
      for (const [key, entry] of recentRef.current) if (alive.has(entry.id)) nextRecent.set(key, entry)
      recentRef.current = nextRecent
      commit(next)
    },
    [commit],
  )

  const dismissAll = useCallback(() => {
    recentRef.current = new Map()
    commit([])
  }, [commit])

  const show = useCallback(
    (opts: ToastOptions) => {
      const id = `toast-${++counter}`
      const { queue, recent } = enqueueToast(queueRef.current, recentRef.current, opts, id)
      recentRef.current = recent
      commit(queue)
      return id
    },
    [commit],
  )

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
    <View
      className={cn(
        "absolute left-0 right-0 z-banner items-center px-4",
        position === "top" ? "top-0" : "bottom-0",
      )}
      style={[{ pointerEvents: "box-none" }, position === "top" ? { paddingTop: insets.top + tokens.space[2] } : { paddingBottom: insets.bottom + tokens.space[2] }]}
    >
      <View style={{ pointerEvents: "box-none" }} className="w-full gap-2 md:max-w-content">
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

type ToastItemProps = {
  toast: ToastRecord
  position?: ToastPosition
  onDismiss: () => void
}

function ToastItem({ toast, position = "top", onDismiss }: ToastItemProps) {
  const tone = toast.tone ?? "neutral"
  const duration =
    toast.duration ?? (tone === "danger" ? DANGER_DURATION : DEFAULT_DURATION)
  const dismissible = toast.dismissible ?? duration === 0

  // Reduce Motion (audit #2): slide+scale dihilangkan, fade dipertahankan
  // tapi instan (0ms) supaya `start` callback dismiss tetap jalan.
  const reducedMotion = useReducedMotion()
  const reducedRef = useRef(reducedMotion)
  reducedRef.current = reducedMotion
  const { mode } = useTheme()
  const slideOffset = position === "top" ? -tokens.space[2] : tokens.space[2]

  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(reducedMotion ? 0 : slideOffset)).current
  const scale = useRef(new Animated.Value(reducedMotion ? 1 : tokens.motion.scale.press)).current

  const animateOut = useCallback(
    (cb: () => void) => {
      const reduced = reducedRef.current
      const exit = tokens.motion.easing.exit
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: motionDuration(reduced, tokens.motion.duration.press),
          easing: Easing.bezier(exit[0], exit[1], exit[2], exit[3]),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: reduced ? 0 : slideOffset,
          duration: motionDuration(reduced, tokens.motion.duration.press),
          easing: Easing.bezier(exit[0], exit[1], exit[2], exit[3]),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => finished && cb())
    },
    [opacity, translateY, slideOffset],
  )

  useEffect(() => {
    const reduced = reducedRef.current
    const enter = tokens.motion.easing.enter
    const enterEasing = Easing.bezier(enter[0], enter[1], enter[2], enter[3])
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: motionDuration(reduced, tokens.motion.duration.fast),
        easing: enterEasing,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: motionDuration(reduced, tokens.motion.duration.fast),
        easing: enterEasing,
        useNativeDriver: true,
      }),
      // v2: scale spring playful — dilewati total saat reduced (nilai awal 1).
      ...(reduced
        ? []
        : [
            Animated.spring(scale, {
              toValue: 1,
              ...tokens.motion.springPlayful,
              useNativeDriver: true,
            }),
          ]),
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
      style={[elevationStyle("medium", mode), { opacity, transform: [{ translateY }, { scale }] }]}
      className="w-full flex-row items-start gap-3 rounded-md border border-border bg-surface-elevated px-4 py-3"
    >
      {IconCmp ? (
        <View className="pt-[2px]">
          <Icon icon={IconCmp} size="sm" tone={iconTone[tone]} weight="fill" />
        </View>
      ) : null}

      <View className="flex-1 gap-0.5">
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
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            toast.action?.onPress()
            animateOut(onDismiss)
          }}
          className={cn("min-h-11 justify-center rounded-xs px-2 active:opacity-disabled", focusRing)}
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