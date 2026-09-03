/**
 * Kahade — <FloatingActionButton> (§9.1 Button primary, §6 no-shadow,
 * §6.2 z-index sticky, §8 motion).
 *
 * Aksi utama satu layar yang harus selalu terjangkau di atas konten scroll:
 * "Buat transaksi", "Tulis pesan", "Tambah rekening". Satu FAB per layar,
 * pojok kanan bawah, di atas safe-area + Bottom Tab Bar.
 *
 * Keputusan non-obvious:
 *   - Tanpa shadow (§6). FAB Material bergantung pada elevation untuk
 *     "mengangkat" tombol dari konten; di sistem flat pemisahnya adalah
 *     KONTRAS fill `bg-primary` (hitam di light / putih di dark) — selalu
 *     berlawanan dengan background, sehingga sudah cukup terpisah tanpa
 *     border tambahan. Border `border-primary` 1px ditambahkan hanya agar
 *     tepi tetap tegas di atas gambar/foto (sama seperti Card inverted).
 *   - Bentuk `rounded-full` 56px (pill khusus, §5) — bukan md 8px: FAB
 *     adalah pengecualian pill yang disebut §5 ("pill khusus"), dan kotak
 *     56px radius 8 terlihat seperti Card kecil yang tersesat, bukan tombol.
 *   - `extended` (ikon + label) untuk layar kosong/onboarding di mana user
 *     belum tahu artinya ikon "+". Saat list mulai di-scroll pemanggil boleh
 *     mengubah ke `extended={false}`; transisi lebar dianimasikan.
 *   - Hide-on-scroll: `visible=false` menggeser FAB keluar bawah (translateY
 *     = 56 + offset) dengan spring tokens.motion.spring via reanimated
 *     `withSpring` — konsisten dengan BottomSheet. Pemanggil mendeteksi arah
 *     scroll (`onScroll`) dan mengirim `visible`; komponen tidak memasang
 *     scroll listener sendiri karena tidak tahu ScrollView mana yang
 *     relevan.
 *   - Posisi `absolute` adalah pengecualian yang diizinkan (overlay di atas
 *     konten); offset bawah = insets.bottom + `bottomOffset` (default 24 =
 *     space[6]). Untuk layar dengan Bottom Tab Bar kirim `bottomOffset`
 *     tinggi tab bar + 16.
 *   - `z-sticky` (10): FAB sejajar Bottom Tab Bar, DI BAWAH backdrop (40)
 *     supaya tertutup saat BottomSheet/Modal terbuka — FAB tidak boleh
 *     "menembus" scrim.
 *   - Ikon tone "inverse" (primary-foreground) mengikuti aturan Button
 *     primary; `Plus` default karena 80% FAB adalah "buat baru".
 *   - `accessibilityLabel` WAJIB (seperti IconButton) — FAB ikon-saja tanpa
 *     label tidak terbaca screen reader.
 */
import { Plus } from "phosphor-react-native"
import { useEffect } from "react"
import { View } from "react-native"
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Icon, type IconComponent } from "@/components/ui/icon"
import { PressableScale, type PressableScaleProps } from "@/components/ui/pressable-scale"
import { Spinner } from "@/components/ui/spinner"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"

export type FloatingActionButtonProps = Omit<
  PressableScaleProps,
  "children" | "className" | "accessibilityLabel"
> & {
  /** Wajib — nama aksi untuk screen reader dan label `extended` */
  accessibilityLabel: string
  icon?: IconComponent
  /** Tampilkan label di samping ikon */
  extended?: boolean
  /** Label teks saat extended (default = accessibilityLabel) */
  label?: string
  /** false = geser keluar layar (hide-on-scroll) */
  visible?: boolean
  loading?: boolean
  /** Jarak dari tepi bawah (di atas safe-area). Default 24 (space.6). */
  bottomOffset?: number
  /** Jarak dari tepi kanan. Default 24 (space.6). */
  rightOffset?: number
  /** Render tanpa posisi absolute (untuk ditaruh pemanggil sendiri) */
  inline?: boolean
  className?: string
}

const SIZE = 56

export function FloatingActionButton({
  accessibilityLabel,
  icon = Plus,
  extended = false,
  label,
  visible = true,
  loading = false,
  bottomOffset = tokens.space[6],
  rightOffset = tokens.space[6],
  inline = false,
  disabled,
  className,
  containerClassName,
  ...rest
}: FloatingActionButtonProps) {
  const insets = useSafeAreaInsets()
  const isDisabled = disabled || loading
  const hiddenOffset = SIZE + bottomOffset + insets.bottom

  const translateY = useSharedValue(visible ? 0 : hiddenOffset)
  const opacity = useSharedValue(visible ? 1 : 0)

  useEffect(() => {
    translateY.value = withSpring(visible ? 0 : hiddenOffset, tokens.motion.spring)
    opacity.value = withTiming(visible ? 1 : 0, { duration: tokens.motion.duration.fast })
  }, [visible, hiddenOffset, translateY, opacity])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }))

  const button = (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      containerClassName={cn("self-end", containerClassName)}
      className={cn(
        "h-14 flex-row items-center justify-center gap-2 rounded-full border border-primary bg-primary",
        extended ? "px-5" : "w-14",
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Spinner size="md" tone="inverse" />
      ) : (
        <>
          <Icon icon={icon} size="md" tone="inverse" weight="bold" />
          {extended ? (
            <Text variant="body" weight={600} tone="inverse" numberOfLines={1}>
              {label ?? accessibilityLabel}
            </Text>
          ) : null}
        </>
      )}
    </PressableScale>
  )

  if (inline) return button

  return (
    <View
      pointerEvents="box-none"
      className="absolute z-sticky"
      style={{ right: rightOffset, bottom: insets.bottom + bottomOffset }}
    >
      <Animated.View pointerEvents={visible ? "auto" : "none"} style={animatedStyle}>
        {button}
      </Animated.View>
    </View>
  )
}
