/**
 * Kahade — kartu "Karya terkait" di detail Etalase.
 *
 * Diekstrak dari `app/showcase/[id].tsx` (mega-batch FE-IMP-1, item 166):
 * quick-like per kartu butuh hook `useShowcaseSocialActions` — hook tidak
 * boleh dipanggil di dalam `.map`, jadi tiap kartu adalah komponennya
 * sendiri (aturan hooks legal).
 *
 * Tampilan identik dengan kartu inline sebelumnya + tombol hati kecil
 * (quick-like) di sudut kanan atas cover.
 */
import { View } from "react-native"
import { router } from "expo-router"
import { Heart } from "phosphor-react-native"

import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"
import { ROUTES } from "@/lib/routes"
import { showcasePriceLabelOrFallback } from "@/lib/showcase-labels"
import { useShowcaseSocialActions } from "@/lib/use-showcase-social-actions"
import type { ShowcaseSocialItem } from "@/lib/api/showcase"

import { IconButton } from "@/components/ui/icon-button"
import { Picture } from "@/components/ui/picture"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"

export function ShowcaseRelatedCard({ rel }: { rel: ShowcaseSocialItem }) {
  // i18n: label aksesibilitas mengikuti bahasa aktif.
  useLanguage()
  // Item 166 (FE-IMP-1): quick-like — hook legal karena komponen per kartu.
  const { liked, likePending, toggleLike } = useShowcaseSocialActions(rel)
  // NP-007: satu sumber kebenaran gambar — coverImageUrl/images[].
  const cover = rel.coverImageUrl ?? undefined

  /*
   * Item 166: quick-like adalah OVERLAY sibling (bukan anak pressable kartu)
   * — pressable bersarang membuat ketuk hati ikut memicu navigasi detail di
   * sebagian platform walau stopPropagation dipanggil.
   */
  return (
    <View className="relative w-36">
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={rel.title}
        onPress={() => router.push(ROUTES.showcaseDetail(rel.id))}
        containerClassName={cn("w-36 overflow-hidden rounded-lg bg-surface-elevated", focusRing)}
      >
        <View className="relative">
          {cover ? (
            // SH-F-007: <Picture> (bukan RN Image mentah) — URL rusak
            // menampilkan fallback ikon, bukan kotak kosong.
            <Picture
              source={cover}
              alt={rel.title}
              className="h-24 w-36"
              radius="none"
              bordered={false}
            />
          ) : (
            <View className="h-24 w-36 items-center justify-center bg-surface">
              <Text variant="caption" tone="secondary">
                {translate("Etalase")}
              </Text>
            </View>
          )}
        </View>
        <View className="p-2">
          {/* TYP-008: judul kartu disamakan dengan kartu feed — body 14px/600. */}
          <Text variant="body" weight={600} numberOfLines={2}>
            {rel.title}
          </Text>
          <Text variant="label" tone="secondary" numberOfLines={1} className="tabular-nums">
            {showcasePriceLabelOrFallback(rel)}
          </Text>
        </View>
      </PressableScale>
      {/* Quick-like: tamu tetap bisa mengetuk — hook mengarahkan login. */}
      <View className="absolute right-1 top-1">
        <IconButton
          icon={Heart}
          variant="ghost"
          size="sm"
          active={liked}
          accessibilityLabel={
            liked ? translate("Batal sukai {x}", { x: rel.title }) : translate("Sukai {x}", { x: rel.title })
          }
          accessibilityState={{ selected: liked }}
          loading={likePending}
          onPress={toggleLike}
          className="bg-background/70"
        />
      </View>
    </View>
  )
}
