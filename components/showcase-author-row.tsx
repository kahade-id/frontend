/**
 * Kahade — baris penulis pada detail Etalase (di atas media, selaras kartu feed).
 *
 * Diekstrak dari `app/showcase/[id].tsx` (G-11 audit 2026-09-20 / S9): god
 * component hanya boleh menyusut. Di sini juga tempat aksi pemilik
 * (D-21 audit 2026-09-23: shortcut "Ubah karya") dan pelapor (B-05).
 */
import { View } from "react-native"
import { router } from "expo-router"
import { Flag, PencilSimple } from "phosphor-react-native"

import { translate } from "@/lib/i18n/translate"
import { ROUTES } from "@/lib/routes"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"
import { formatDateTime } from "@/lib/format"
import type { ShowcaseSocialItem } from "@/lib/api/showcase"

import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { IconButton } from "@/components/ui/icon-button"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"

type ShowcaseAuthorRowProps = {
  item: Pick<ShowcaseSocialItem, "author" | "createdAt">
  isOwner: boolean
  hasSession: boolean
  /** Buka sheet laporan untuk item ini. */
  onReport: () => void
}

export function ShowcaseAuthorRow({ item, isOwner, hasSession, onReport }: ShowcaseAuthorRowProps) {
  return (
    <View className="flex-row items-center gap-3 px-5 pt-4">
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={translate("Lihat profil {x}", {
          x: item.author.fullName ?? item.author.username,
        })}
        // H-04 (audit 2026-09-23): profil publik user terproteksi — tamu
        // diarahkan ke loginRequired dengan `next`, bukan menabrak dinding.
        onPress={() =>
          router.push(
            hasSession
              ? ROUTES.userProfile(item.author.username)
              : ROUTES.loginRequired(`/user/${encodeURIComponent(item.author.username)}`),
          )
        }
        containerClassName={cn("flex-1 flex-row items-center rounded-md", focusRing)}
        className="flex-1 flex-row items-center gap-3"
      >
        <Avatar
          source={item.author.avatarUrl ? { uri: item.author.avatarUrl } : undefined}
          name={item.author.fullName ?? item.author.username}
          size="md"
          verified={item.author.isKycVerified === true}
        />
        <View className="flex-1 gap-0.5">
          <Text variant="body" weight={600} numberOfLines={1}>
            {item.author.fullName ?? item.author.username}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1} className="tabular-nums">
            {`@${item.author.username} · ${formatDateTime(item.createdAt)}`}
          </Text>
        </View>
        {isOwner ? <Badge variant="outline">Anda</Badge> : null}
      </PressableScale>
      {/* B-05 selaras: bendera disembunyikan untuk item sendiri. */}
      {!isOwner ? (
        <IconButton icon={Flag} variant="ghost" size="sm" accessibilityLabel="Laporkan" onPress={onReport} />
      ) : null}
      {/* D-21 (audit 2026-09-23): shortcut "Ubah karya" di detail untuk pemilik —
          dulu hanya lewat Pengaturan › showcase saya. Menuju halaman manajemen
          (daftar karya sendiri → edit). */}
      {isOwner ? (
        <IconButton
          icon={PencilSimple}
          variant="ghost"
          size="sm"
          accessibilityLabel="Ubah karya"
          accessibilityHint={translate("Buka pengelolaan karya etalase")}
          onPress={() => router.push(ROUTES.showcaseManagement)}
        />
      ) : null}
    </View>
  )
}
