/**
 * Baris aksi sosial layar detail Etalase — suka · komentar · bagikan · simpan.
 *
 * Diekstrak dari `app/showcase/[id].tsx` (G-11/S9: layar itu hanya boleh
 * menyusut; plafon barisnya tidak bisa naik). Komponen ini murni presentasional:
 * seluruh state sosial tetap milik pemanggil lewat `useShowcaseSocialActions`,
 * jadi tidak ada perilaku baru — hanya paritas markup dengan kartu feed
 * (Suka memakai <LikeAction>: merah + motion pop/ring, permintaan produk
 * 2026-09-23).
 */
import { ChatCircle, Export } from "phosphor-react-native"
import { View } from "react-native"

import { Icon } from "@/components/ui/icon"
import { LikeAction } from "@/components/ui/like-button"
import { SaveAction } from "@/components/ui/save-button"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"
import { formatCountCompact } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"

type Props = {
  liked: boolean
  likeCount: number
  /** S-01: tap kedua saat request berjalan mengantre, tombol tampil sibuk. */
  likePending: boolean
  onToggleLike: () => void
  onShowLikers?: () => void
  commentTotal: number
  onCommentPress: () => void
  saved: boolean
  /** S-02: simpan optimistis — state sibuk eksplisit untuk a11y. */
  savedPending: boolean
  onToggleSave: () => void
  onShowSavers?: () => void
  onShare: () => void
  onShareLongPress?: () => void
}

export function ShowcaseDetailActions({
  liked,
  likeCount,
  likePending,
  onToggleLike,
  onShowLikers,
  commentTotal,
  onCommentPress,
  saved,
  savedPending,
  onToggleSave,
  onShowSavers,
  onShare,
  onShareLongPress,
}: Props) {
  // i18n: label aksesibilitas mengikuti bahasa aktif.
  useLanguage()
  return (
    <View className="flex-row items-center px-2 pt-1">
      <LikeAction
        liked={liked}
        count={likeCount}
        label="Suka"
        busy={likePending}
        onPress={onToggleLike}
        onLongPress={onShowLikers}
      />
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={translate("Tulis komentar")}
        accessibilityHint={translate("{x} komentar", { x: formatCountCompact(commentTotal) })}
        onPress={onCommentPress}
        containerClassName={cn(
          "min-h-11 flex-row items-center rounded-md px-3",
          focusRing,
        )}
        className="flex-row items-center gap-1.5"
      >
        <Icon icon={ChatCircle} size="md" tone="active" />
        <Text variant="caption" weight={600} className="tabular-nums">
          {formatCountCompact(commentTotal)}
        </Text>
        <Text variant="caption" tone="secondary">
          Komentar
        </Text>
      </PressableScale>
      <View className="flex-1" />
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={translate("Bagikan")}
        accessibilityHint={translate("Bagikan etalase ini")}
        onPress={onShare}
        // S-03: long-press = detail ringan jumlah dibagikan (pemanggil
        // mengirim handler; opsional — tanpa handler perilaku tidak berubah).
        onLongPress={onShareLongPress}
        containerClassName={cn(
          "min-h-11 min-w-11 items-center justify-center rounded-md",
          focusRing,
        )}
      >
        <Icon icon={Export} size="md" tone="active" />
      </PressableScale>
      {/* Audit 2026-10-08: <SaveAction> bersama dengan kartu feed — crossfade
          + pop; guard long-press (daftar penyimpan) ada di dalamnya. */}
      <SaveAction
        saved={saved}
        busy={savedPending}
        accessibilityHint={translate("Simpan etalase ini")}
        onPress={onToggleSave}
        onLongPress={onShowSavers}
      />
    </View>
  )
}
