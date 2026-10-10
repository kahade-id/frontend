/**
 * Kahade — <StoryRing>: avatar dengan ring status story.
 *
 * Warna ring (mengikuti WhatsApp Status):
 *   - `unseen`  → ring primary (belum dilihat)
 *   - `seen`    → ring abu-abu (sudah dilihat)
 *   - `muted`   → ring putus-putus (dibisukan; tetap bisa dibuka)
 *   - `empty`   → tanpa ring (story sendiri belum ada)
 *
 * Motion (2026-10-08, penyegaran UI/UX story):
 *   - Tekan = avatar MENGECIL halus (spring) lalu kembali — umpan balik tak
 *     terlihat sebelumnya: satu-satunya isyarat bahwa ketukan terdaftar
 *     adalah perpindahan halaman, yang baru terjadi ratusan ms kemudian.
 *   - Masuk = fade + naik 8px per ubin (<FadeIn>, sudah mendukung Stagger di
 *     <StoryTray>) sehingga tray tidak "muncul begitu saja" di atas daftar
 *     chat. Reduced motion: tanpa animasi (audit #2).
 *   - Ring yang belum dilihat diberi napas ekstra (padding 3px) agar benar-
 *     benar menonjol dibanding yang sudah dilihat; ubin yang dibisukan
 *     diredupkan (opacity) — hierarki terbaca sebelum membaca nama.
 *
 * Unggahan (2026-10-10): `pending` menerima progress byte (0..1) → angka
 * persen di atas avatar, bukan spinner buta (video 50 MB di 4G ≈ 8 menit).
 * `failed` = ikon peringatan di posisi badge "+" supaya kegagalan terlihat
 * tanpa membaca caption.
 *
 * Keputusan non-obvious:
 *   - Ring adalah View border (bukan gambar): tidak ada biaya decode dan warnanya
 *     langsung mengikuti token tema.
 *   - Tombol "+" adalah Pressable TERPISAH dari area avatar: keduanya tidak
 *     bersarang, sehingga tap pada "+" tidak ikut membuka viewer.
 *   - Skala press memakai RN `Animated` (native driver) — BUKAN reanimated:
 *     transform/opacity sederhana, 60fps tanpa menambah worklet per ubin
 *     (tray bisa memuat belasan ubin). Pola sama dengan <PressableScale>.
 */
import { Plus, Warning } from "phosphor-react-native"
import { memo, useCallback, useRef } from "react"
import { Animated, View } from "react-native"
import { PressableScale } from "@/components/ui/pressable-scale"

import { Avatar } from "@/components/ui/avatar"
import { Icon } from "@/components/ui/icon"
import { Spinner } from "@/components/ui/spinner"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"
import { useReducedMotion } from "@/lib/use-reduced-motion"

export type StoryRingState = "unseen" | "seen" | "muted" | "empty"

export type StoryRingPending = {
  /** 0..1; null = belum mulai / tahap buat story → spinner. */
  progress: number | null
}

export type StoryRingProps = {
  name: string
  avatarUrl?: string | null
  ringState: StoryRingState
  /** Unggahan berjalan (story sendiri). */
  pending?: StoryRingPending | null
  /** Unggahan gagal — badge peringatan menggantikan "+". */
  failed?: boolean
  /** Tampilkan badge "+" (story sendiri). */
  showAddBadge?: boolean
  onPress: () => void
  onPressAdd?: () => void
  accessibilityLabel: string
  testID?: string
}

const RING_CLASS: Record<StoryRingState, string> = {
  // 2026-10-08: ring yang belum dilihat diberi tebal 2.5px + napas 3px
  // sehingga urutan perhatiannya jelas: belum dilihat > sudah dilihat > bisu.
  unseen: "border-[2.5px] border-primary p-[3px]",
  seen: "border-2 border-border-control p-[2px]",
  muted: "border-2 border-dashed border-border-control p-[2px]",
  empty: "border-2 border-transparent p-[2px]",
}

/** Skala avatar saat ditekan (§8 motion — kecil, tidak teatrikal). */
const PRESS_SCALE = 0.94
/** Redup untuk story yang dibisukan (tetap bisa dibuka). */
const MUTED_OPACITY = 0.7

export const StoryRing = memo(function StoryRing({
  name,
  avatarUrl,
  ringState,
  pending = null,
  failed = false,
  showAddBadge = false,
  onPress,
  onPressAdd,
  accessibilityLabel,
  testID,
}: StoryRingProps) {
  const reducedMotion = useReducedMotion()
  /**
   * Skala tekan DIKELOLA SENDIRI (bukan `scaleOnPress` <PressableScale>):
   * yang mengecil harus AVATAR-nya saja, bukan ring — kalau ring ikut
   * mengecil, seluruh ubin terasa "berdenyut" dan berantakan saat tray
   * digulir. `useNativeDriver` menjaga 60fps tanpa menyentuh layout.
   */
  const press = useRef(new Animated.Value(1)).current
  const springTo = useCallback(
    (value: number) => {
      if (reducedMotion) {
        press.setValue(1)
        return
      }
      Animated.spring(press, {
        toValue: value,
        // tokens.motion.spring (keputusan §8) — konsisten dengan seluruh app.
        ...(tokens.motion.spring as object),
        useNativeDriver: true,
      }).start()
    },
    [press, reducedMotion],
  )
  const handlePressIn = useCallback(() => springTo(PRESS_SCALE), [springTo])
  const handlePressOut = useCallback(() => springTo(1), [springTo])
  const isMuted = ringState === "muted"
  const percent =
    pending && pending.progress !== null ? Math.round(Math.min(1, Math.max(0, pending.progress)) * 100) : null

  return (
    <View className="relative" style={isMuted ? { opacity: MUTED_OPACITY } : undefined}>
      <PressableScale
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        scaleOnPress={false}
        className={cn("h-[64px] w-[64px] items-center justify-center rounded-full", RING_CLASS[ringState])}
      >
        <Animated.View style={{ transform: [{ scale: press }] }}>
          <Avatar source={avatarUrl ?? undefined} name={name} size="lg" />
        </Animated.View>
        {pending ? (
          <View
            className="absolute inset-0 items-center justify-center rounded-full bg-background/70"
            accessibilityLiveRegion="polite"
          >
            {percent !== null && percent < 100 ? (
              <Text variant="caption" weight={700}>
                {`${percent}%`}
              </Text>
            ) : (
              <Spinner size="sm" />
            )}
          </View>
        ) : null}
      </PressableScale>
      {failed ? (
        <View
          className="absolute -bottom-0.5 -right-0.5 h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-danger"
          pointerEvents="none"
        >
          <Icon icon={Warning} size="xs" tone="inverse" weight="fill" />
        </View>
      ) : showAddBadge && onPressAdd ? (
        <PressableScale
          onPress={onPressAdd}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          className="absolute -bottom-0.5 -right-0.5 h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-primary"
        >
          <Icon icon={Plus} size="xs" tone="inverse" />
        </PressableScale>
      ) : null}
    </View>
  )
})
