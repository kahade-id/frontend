/**
 * Kahade — baris penulis pada detail Etalase (di atas media, selaras kartu feed).
 *
 * Diekstrak dari `app/showcase/[id].tsx` (G-11 audit 2026-09-20 / S9): god
 * component hanya boleh menyusut. Di sini juga tempat aksi pemilik
 * (D-21 audit 2026-09-23: shortcut "Ubah karya") dan pelapor (B-05).
 */
import { useEffect, useState } from "react"
import { View } from "react-native"
import { router } from "expo-router"
import { CaretRight, Flag, PencilSimple, Star } from "phosphor-react-native"

import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"
import { ROUTES } from "@/lib/routes"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"
import { formatDateTime, formatDecimal } from "@/lib/format"
import type { ShowcaseSocialItem } from "@/lib/api/showcase"
import type { VerificationBadge } from "@/lib/api/users"
import { getPublicRatingSummary, type PublicRatingSummary } from "@/lib/api/ratings"

import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { PressableScale } from "@/components/ui/pressable-scale"
import { FeedFollowButton } from "@/components/ui/feed-follow-button"
import { Text } from "@/components/ui/text"
import { VerifiedName } from "@/components/ui/verified-name"

type ShowcaseAuthorRowProps = {
  item: Pick<ShowcaseSocialItem, "id" | "author" | "createdAt">
  isOwner: boolean
  hasSession: boolean
  /** Buka sheet laporan untuk item ini. */
  onReport: () => void
}

/**
 * U5-007 (journey): cuplikan rating penjual di baris penulis (layar detail).
 * `GET /v1/users/:username/ratings?page=1&limit=1` — tanpa endpoint baru.
 * Fail closed: bila ringkasan tak tersedia/gagal dimuat, baris disembunyikan
 * (JANGAN mengarang — khususnya "98% selesai" yang tidak ada di payload).
 * Ketuk → profil penulis (tab Ulasan tersedia di sana).
 */
function SellerRatingLine({ username, hasSession }: { username: string; hasSession: boolean }) {
  const [summary, setSummary] = useState<PublicRatingSummary | null>(null)
  useEffect(() => {
    const ctrl = new AbortController()
    void getPublicRatingSummary(username, ctrl.signal)
      .then((result) => setSummary(result))
      .catch(() => {
        // ringkasan opsional — kegagalan = sembunyikan, bukan error
      })
    return () => ctrl.abort()
  }, [username])
  if (summary == null || summary.averageRating == null || summary.distribution.total <= 0) {
    return null
  }
  const goProfile = () =>
    router.push(
      hasSession
        ? ROUTES.userProfile(username)
        : ROUTES.loginRequired(`/user/${encodeURIComponent(username)}`),
    )
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={translate("Lihat ulasan {x}", { x: username })}
      onPress={goProfile}
      className="flex-row items-center gap-1 self-start"
    >
      <Icon icon={Star} size="xs" tone="warning" weight="fill" />
      <Text variant="caption" tone="secondary" className="tabular-nums">
        {`${formatDecimal(summary.averageRating, 1)} · ${summary.distribution.total} ${translate("ulasan")}`}
      </Text>
    </PressableScale>
  )
}

export function ShowcaseAuthorRow({ item, isOwner, hasSession, onReport }: ShowcaseAuthorRowProps) {
  // i18n: label aksesibilitas mengikuti bahasa aktif.
  useLanguage()
  // T2-F12 (audit UI/UX 2026-09-28): fullName kosong/spasi → pakai username
  // (pola defensif yang sama dengan kartu feed: fullName?.trim() || username).
  const displayName = item.author.fullName?.trim() || item.author.username
  return (
    <View className="flex-row items-center gap-3 px-5 pt-4">
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={translate("Lihat profil {x}", {
          x: displayName,
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
          name={displayName}
          size="md"
        />
        <View className="flex-1 gap-0.5">
          {/* S1: seal 3-tier di samping nama (sumber: badge backend, sama
              dengan profil); fallback boolean KYC bila badge belum ada. */}
          <VerifiedName
            name={displayName}
            variant="body"
            badges={item.author.badges as unknown as VerificationBadge[]}
            verified={item.author.isKycVerified === true}
            tier={item.author.sealTier ?? null}
            textProps={{ weight: 600 }}
          />
          <Text variant="caption" tone="secondary" numberOfLines={1} className="tabular-nums">
            {`@${item.author.username} · ${formatDateTime(item.createdAt)}`}
          </Text>
          {/* U5-007: cuplikan rating penjual (opsional, fail closed). */}
          <SellerRatingLine username={item.author.username} hasSession={hasSession} />
        </View>
        {isOwner ? <Badge variant="outline">Anda</Badge> : null}
        {/* Item 153 (FE-IMP-1): chevron — menandakan baris penulis bisa
            diketuk menuju profil (affordance yang selama ini implisit). */}
        <Icon icon={CaretRight} size="sm" tone="default" />
      </PressableScale>
      {/* Item 154 (FE-IMP-1): follow langsung dari detail (optimistis,
          rollback, gate tamu) — sama seperti di kartu feed. */}
      {!isOwner ? <FeedFollowButton username={item.author.username} isOwner={false} /> : null}
      {/* B-05 selaras: bendera disembunyikan untuk item sendiri. */}
      {!isOwner ? (
        <IconButton icon={Flag} variant="ghost" size="sm" accessibilityLabel={translate("Laporkan")} onPress={onReport} />
      ) : null}
      {/* S8 (audit 2026-09-26): "Ubah karya" langsung membuka editor ITEM INI
          via `?edit=<id>` — bukan sekadar daftar kelola. */}
      {isOwner ? (
        <IconButton
          icon={PencilSimple}
          variant="ghost"
          size="sm"
          accessibilityLabel={translate("Ubah etalase")}
          accessibilityHint={translate("Ubah etalase ini")}
          onPress={() =>
            router.push({
              pathname: ROUTES.showcaseManagement,
              params: { edit: item.id },
            } as never)
          }
        />
      ) : null}
    </View>
  )
}
