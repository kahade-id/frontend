/**
 * Kahade — <FavoriteIconButton> (§9.1 Icon button, §7, §8).
 *
 * Toggle "favorit/simpan" untuk etalase penjual, showcase, dan pengguna.
 * Ikon Heart Phosphor: kosong = weight regular + text-tertiary, aktif =
 * weight fill + text-primary — mengikuti aturan §7 untuk ikon selected.
 *
 * TETAP MONOKROM (non-obvious): tidak ada hati merah. Warna danger
 * eksklusif untuk status transaksi (§2.3) dan sistem ini monokrom (§1);
 * pola yang sama dipakai <Rating> (bintang hitam, bukan emas).
 *
 * Kenapa tidak memakai <IconButton active> langsung: IconButton merender
 * ikon di dalam struktur tertutup, sedangkan di sini ikon perlu "berdenyut"
 * sekali saat DIAKTIFKAN — umpan balik bahwa aksi tersimpan, mengingat tidak
 * ada perubahan warna mencolok. Denyut = scale 1 -> 1.25 -> 1 lewat
 * reanimated `withSequence(withSpring)` memakai tokens.motion.spring, di UI
 * thread, hanya pada transisi false -> true (menonaktifkan tidak berdenyut —
 * itu aksi "mengambil kembali", bukan perayaan). Pressed-scale 0.97 di
 * PressableScale dimatikan supaya dua animasi scale tidak bertumpuk.
 *
 * Kontrak state sama dengan <FollowButton>: `active` dari parent,
 * `onToggle(next)` mengembalikan nilai berikutnya; optimistic update dan
 * rollback urusan parent. `count` opsional (jumlah penyuka) dirender Mono
 * Body di kanan ikon karena itu angka data (§3.1).
 *
 * Hit area sm=40 / md=48 mengikuti IconButton; `accessibilityLabel` wajib
 * (enforcement tipe, sama seperti IconButton).
 */
import { Heart } from "phosphor-react-native"
import { useEffect, useRef } from "react"
import { View } from "react-native"
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from "react-native-reanimated"

import { Icon } from "@/components/ui/icon"
import { PressableScale, type PressableScaleProps } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { formatNumber } from "@/lib/format"
import { tokens } from "@/lib/tokens"
import { useReducedMotion } from "@/lib/use-reduced-motion"

export type FavoriteIconButtonSize = "sm" | "md"

export type FavoriteIconButtonProps = Omit<
  PressableScaleProps,
  "children" | "className" | "accessibilityLabel" | "onPress"
> & {
  active: boolean
  onToggle: (next: boolean) => void
  /** Wajib — mis. "Simpan ke favorit" */
  accessibilityLabel: string
  size?: FavoriteIconButtonSize
  /** Jumlah penyuka; dirender Mono di kanan ikon */
  count?: number
  className?: string
}

const sizeBox: Record<FavoriteIconButtonSize, string> = {
  sm: "h-10 min-w-10",
  md: "h-12 min-w-12",
}

/** Puncak denyut; tidak ada token untuk ini — 1.25 cukup terlihat tanpa keluar dari hit area 48 */
const POP_SCALE = 1.25

export function FavoriteIconButton({
  active,
  onToggle,
  accessibilityLabel,
  size = "md",
  count,
  disabled,
  className,
  containerClassName,
  accessibilityState,
  ...rest
}: FavoriteIconButtonProps) {
  const scale = useSharedValue(1)
  const prevActive = useRef(active)
  // Reduce Motion (audit #2): pop dekoratif dilewati; perubahan fill ikon
  // sudah cukup menyampaikan state aktif.
  const reducedMotion = useReducedMotion()

  // Denyut hanya pada transisi false -> true (lihat header file).
  useEffect(() => {
    if (active && !prevActive.current && !reducedMotion) {
      scale.value = withSequence(
        withSpring(POP_SCALE, { ...tokens.motion.spring, stiffness: 400 }),
        withSpring(1, tokens.motion.spring),
      )
    }
    prevActive.current = active
  }, [active, scale])

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active, disabled: !!disabled, ...accessibilityState }}
      scaleOnPress={false}
      disabled={disabled}
      onPress={() => onToggle(!active)}
      containerClassName={cn("self-start", containerClassName)}
      className={cn(
        "flex-row items-center justify-center gap-1 rounded-sm px-2",
        sizeBox[size],
        className,
      )}
      {...rest}
    >
      <Animated.View style={iconStyle}>
        <Icon icon={Heart} size={size === "sm" ? "sm" : "md"} active={active} />
      </Animated.View>
      {count != null ? (
        <View>
          <Text variant="monoBody" tone={active ? "primary" : "secondary"} numberOfLines={1}>
            {formatNumber(count)}
          </Text>
        </View>
      ) : null}
    </PressableScale>
  )
}
