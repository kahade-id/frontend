/**
 * Kahade — <StoryRing>: avatar dengan ring status story.
 *
 * Warna ring (mengikuti WhatsApp Status):
 *   - `unseen`  → ring primary (belum dilihat)
 *   - `seen`    → ring abu-abu (sudah dilihat)
 *   - `muted`   → ring putus-putus (dibisukan; tetap bisa dibuka)
 *   - `empty`   → tanpa ring (story sendiri belum ada)
 *
 * Keputusan non-obvious:
 *   - Ring adalah View border (bukan gambar): tidak ada biaya decode dan warnanya
 *     langsung mengikuti token tema.
 *   - `pending` menampilkan spinner di atas avatar saat story sendiri sedang
 *     diunggah (optimistis, lihat lib/story/local-state.ts).
 *   - Tombol "+" adalah Pressable TERPISAH dari area avatar: keduanya tidak
 *     bersarang, sehingga tap pada "+" tidak ikut membuka viewer.
 */
import { Plus } from "phosphor-react-native"
import { memo } from "react"
import { View } from "react-native"
import { PressableScale } from "@/components/ui/pressable-scale"

import { Avatar } from "@/components/ui/avatar"
import { Icon } from "@/components/ui/icon"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/cn"

export type StoryRingState = "unseen" | "seen" | "muted" | "empty"

export type StoryRingProps = {
  name: string
  avatarUrl?: string | null
  ringState: StoryRingState
  pending?: boolean
  /** Tampilkan badge "+" (story sendiri). */
  showAddBadge?: boolean
  onPress: () => void
  onPressAdd?: () => void
  accessibilityLabel: string
  testID?: string
}

const RING_CLASS: Record<StoryRingState, string> = {
  unseen: "border-2 border-primary",
  seen: "border-2 border-border-control",
  muted: "border-2 border-dashed border-border-control",
  empty: "border-2 border-transparent",
}

export const StoryRing = memo(function StoryRing({
  name,
  avatarUrl,
  ringState,
  pending = false,
  showAddBadge = false,
  onPress,
  onPressAdd,
  accessibilityLabel,
  testID,
}: StoryRingProps) {
  return (
    <View className="relative">
      <PressableScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        className={cn("h-[64px] w-[64px] items-center justify-center rounded-full p-[2px]", RING_CLASS[ringState])}
      >
        <Avatar source={avatarUrl ?? undefined} name={name} size="lg" />
        {pending ? (
          <View className="absolute inset-0 items-center justify-center rounded-full bg-background/60">
            <Spinner size="sm" />
          </View>
        ) : null}
      </PressableScale>
      {showAddBadge && onPressAdd ? (
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
