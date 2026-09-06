/**
 * Kahade — <IncomingCallPrompt> (§6.2 layer Modal, §8 motion, §1 "satu
 * titik kejutan").
 *
 * Layar penuh panggilan masuk (suara/video) dari lawan transaksi: Avatar xl
 * di tengah dengan ring berdenyut, nama H2, sub-judul (jenis panggilan ·
 * konteks order), dan dua tombol bulat di bawah — Tolak (destructive) dan
 * Terima (primary). Komponen ini PRESENTASIONAL: tidak mengatur ringtone,
 * getar, CallKeep, atau visibilitas; pemanggil menaruhnya di Modal/layar
 * layer 60 dan memutus render saat panggilan berakhir.
 *
 * Keputusan non-obvious:
 *   - Ring berdenyut = SATU-SATUNYA motion di layar ini (§1 poin 6). Dibuat
 *     dengan Reanimated `withRepeat(withTiming)` di UI thread: dua lingkaran
 *     `border-border` yang membesar (scale 1 -> 1.35) sambil memudar
 *     (opacity 0.6 -> 0), berselang setengah periode. Border, bukan fill —
 *     §6 melarang shadow/glow, dan ring garis tipis membaca sebagai
 *     "gelombang suara", bukan dekorasi. Durasi 1400ms — sengaja di luar
 *     rentang §8 (250–350ms) karena ini loop ambient seperti "Splash/Loading
 *     loop", bukan transisi interaksi.
 *   - Terima = `bg-primary` (hitam), BUKAN hijau. §2.3 semantic success
 *     dikhususkan untuk status transaksi; aksi utama di sistem ini selalu
 *     hitam (§1). Tolak = `bg-danger` karena mengakhiri/menolak adalah aksi
 *     destruktif — konsisten dengan Button variant destructive. Ikon
 *     PhoneX (bukan PhoneDisconnect) untuk "tolak", PhoneDisconnect dipakai
 *     InCallControlsBar untuk "tutup" — dua makna, dua glyph.
 *   - Tombol 64px (`h-16 w-16`), lebih besar dari IconButton md (48): target
 *     harus bisa ditekan tanpa melihat, saat ponsel diangkat cepat. Karena
 *     itu tidak memakai <IconButton> (ukuran terkunci sm/md), melainkan
 *     PressableScale langsung dengan kelas ukuran eksplisit — satu-satunya
 *     tempat di sistem dengan tombol 64px, didokumentasikan di sini.
 *   - Label "Tolak"/"Terima" caption di bawah tombol, bukan hanya ikon:
 *     panggilan masuk sering dibuka dari lock screen dengan mata setengah
 *     terbuka — label teks mengurangi salah tekan.
 *   - `callType` mengganti ikon Terima (Phone / VideoCamera) dan teks default
 *     sub-judul; `subtitle` eksplisit menimpanya (mis. tambah konteks order).
 *   - Tidak ada aksi "Balas dengan pesan" — di luar scope escrow; kalau
 *     dibutuhkan, tambahkan slot `footer` daripada tombol ketiga.
 */
import { useEffect } from "react"
import { View, type ViewProps } from "react-native"
import { Phone, PhoneX, VideoCamera } from "phosphor-react-native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated"

import { Avatar, type AvatarProps } from "@/components/ui/avatar"
import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { useReducedMotion } from "@/lib/use-reduced-motion"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export type IncomingCallType = "voice" | "video"

export type IncomingCallPromptProps = Omit<ViewProps, "children"> & {
  callerName: string
  avatar?: AvatarProps["source"]
  verified?: boolean
  callType?: IncomingCallType
  /** Menimpa teks default "Panggilan suara masuk" / "Panggilan video masuk" */
  subtitle?: string
  onAccept: () => void
  onDecline: () => void
  /** Matikan ring berdenyut (mis. saat menunggu izin mikrofon) */
  ringing?: boolean
  labels?: { accept?: string; decline?: string; voice?: string; video?: string }
  className?: string
}

const DEFAULT_LABELS = {
  accept: "Terima",
  decline: "Tolak",
  voice: "Panggilan suara masuk",
  video: "Panggilan video masuk",
}

/** Periode satu denyut. Lihat header untuk alasan di luar rentang §8. */
const PULSE_MS = 1400

export function IncomingCallPrompt({
  callerName,
  avatar,
  verified = false,
  callType = "voice",
  subtitle,
  onAccept,
  onDecline,
  ringing = true,
  labels,
  className,
  ...rest
}: IncomingCallPromptProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const sub = subtitle ?? (callType === "video" ? t.video : t.voice)

  return (
    <View accessible={false}
      accessibilityViewIsModal
      accessibilityLabel={`${sub} dari ${callerName}`}
      className={cn("flex-1 items-center justify-between bg-background px-6 py-16", className)}
      {...rest}
    >
      <View className="flex-1 items-center justify-center gap-6">
        <View className="items-center justify-center">
          <PulseRing active={ringing} delay={0} />
          <PulseRing active={ringing} delay={PULSE_MS / 2} />
          <Avatar source={avatar} name={callerName} size="xl" verified={verified} />
        </View>

        <View className="items-center gap-1">
          <Text variant="h2" tone="primary" className="text-center">
            {callerName}
          </Text>
          <Text variant="body" tone="secondary" className="text-center">
            {sub}
          </Text>
        </View>
      </View>

      <View className="w-full flex-row items-start justify-evenly">
        <CallAction
          icon={PhoneX}
          label={t.decline}
          tone="danger"
          onPress={onDecline}
          accessibilityHint="Menolak panggilan"
        />
        <CallAction
          icon={callType === "video" ? VideoCamera : Phone}
          label={t.accept}
          tone="primary"
          onPress={onAccept}
          accessibilityHint="Menerima panggilan"
        />
      </View>
    </View>
  )
}

/**
 * Lingkaran border yang membesar & memudar. Absolute agar menumpuk di pusat
 * avatar — pengecualian sadar dari aturan flex (§ Layout), karena overlap
 * memang dibutuhkan. Ukuran dasar = avatar xl (80px, h-20 w-20).
 */
function PulseRing({ active, delay }: { active: boolean; delay: number }) {
  const progress = useSharedValue(0)
  // Reduce Motion (audit #2): pulsa berulang tanpa batas adalah pemicu
  // vestibular klasik -> ring tampil statis (progress 0: scale 1, opacity
  // 0.6) selama `active`, tanpa loop.
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (active) {
      progress.value = 0
      if (reducedMotion) return
      progress.value = withDelay(
        delay,
        withRepeat(
          withTiming(1, { duration: PULSE_MS, easing: Easing.out(Easing.quad) }),
          -1,
          false,
        ),
      )
    } else {
      progress.value = withTiming(0, { duration: reducedMotion ? 0 : 250 })
    }
  }, [active, delay, progress, reducedMotion])

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + progress.value * 0.35 }],
    opacity: active ? 0.6 * (1 - progress.value) : 0,
  }))

  return (
    <Animated.View
      pointerEvents="none"
      className="absolute h-20 w-20 rounded-full border border-border"
      style={style}
    />
  )
}

function CallAction({
  icon,
  label,
  tone,
  onPress,
  accessibilityHint,
}: {
  icon: typeof Phone
  label: string
  tone: "primary" | "danger"
  onPress: () => void
  accessibilityHint: string
}) {
  return (
    <View className="items-center gap-2">
      <PressableScale hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button"
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        onPress={onPress}
        className={cn(
          "h-16 w-16 items-center justify-center rounded-full",
          tone === "danger" ? "bg-danger" : "bg-primary",
        )}
      >
        <View>
          <Icon icon={icon} size="lg" tone="inverse" weight="fill" />
        </View>
      </PressableScale>
      <Text variant="caption" tone="secondary" weight={500}>
        {label}
      </Text>
    </View>
  )
}