/**
 * Kahade — strip sorotan story di profil (arsip permanen: "Katalog", "Testimoni").
 * Terpisah dari <ProfileHighlightsStrip> (highlight etalase produk).
 * Disembunyikan saat kosong atau gagal muat (fail closed, tanpa placeholder palsu).
 */
import { router } from "expo-router"
import { Pressable, ScrollView, View } from "react-native"

import { Picture } from "@/components/ui/picture"
import { Text } from "@/components/ui/text"
import { getStoryHighlights, type StoryHighlight } from "@/lib/api/story"
import { useT } from "@/lib/i18n"
import { ROUTES } from "@/lib/routes"
import { useApiQuery } from "@/lib/use-api-query"

export function StoryHighlightsStrip({ userId }: { userId: string | null | undefined }) {
  const t = useT()
  const query = useApiQuery<StoryHighlight[]>(
    `story-highlights-${userId ?? "none"}`,
    (signal) => getStoryHighlights(userId ?? "", signal),
    Boolean(userId),
  )

  if (!userId || query.error || !query.data || query.data.length === 0) return null

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-4 px-4 pb-3"
      accessibilityLabel={t("Sorotan story")}
    >
      {query.data.map((h) => (
        <Pressable
          key={h.id}
          onPress={() => router.push(ROUTES.storyViewer(userId, { highlightId: h.id }))}
          accessibilityRole="button"
          accessibilityLabel={t("Buka sorotan {title}", { title: h.title })}
          className="w-16 items-center gap-1"
        >
          <View className="h-16 w-16 overflow-hidden rounded-full border border-border bg-surface">
            {h.coverUrl ? <Picture source={h.coverUrl} alt="" width={64} height={64} radius="md" className="rounded-full" /> : null}
          </View>
          <Text variant="caption" numberOfLines={1} className="w-16 text-center">
            {h.title}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  )
}
