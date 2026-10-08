/**
 * Kahade — <StoryViewersSheet>: siapa saja yang sudah melihat story sendiri.
 *
 * Hanya pemilik yang bisa membuka (server menolak selain pemilik). Diambil
 * saat sheet dibuka (enabled = visible) dan dimuat ulang tiap kali dibuka.
 */
import { useMemo } from "react"
import { View } from "react-native"

import { Avatar } from "@/components/ui/avatar"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { getStoryViewers, type StoryViewer } from "@/lib/api/story"
import { userMessage } from "@/lib/api/errors"
import { formatRelativeTime } from "@/lib/format"
import { useT } from "@/lib/i18n"
import { serverNow } from "@/lib/server-time"
import { useApiQuery } from "@/lib/use-api-query"
import { Eye } from "phosphor-react-native"

export type StoryViewersSheetProps = {
  visible: boolean
  storyId: string
  onRequestClose: () => void
}

export function StoryViewersSheet({ visible, storyId, onRequestClose }: StoryViewersSheetProps) {
  const t = useT()
  const query = useApiQuery(
    `story-viewers-${storyId}`,
    (signal) => getStoryViewers(storyId, { page: 1, limit: 50 }, signal),
    visible,
  )

  const rows = useMemo<StoryViewer[]>(() => query.data?.viewers ?? [], [query.data])
  const total = query.data?.total ?? rows.length

  return (
    <BottomSheet
      visible={visible}
      onRequestClose={onRequestClose}
      title={t("Dilihat oleh")}
      description={t("{n} orang", { n: total })}
    >
      {query.loading && !query.data ? (
        <View className="gap-3 px-1 py-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="w-full" height={44} />
          ))}
        </View>
      ) : query.error && !query.data ? (
        <ErrorState
          title={t("Viewer belum bisa dimuat")}
          description={userMessage(query.error)}
          onRetry={query.reload}
        />
      ) : rows.length === 0 ? (
        <EmptyState icon={Eye} title={t("Belum ada yang melihat")} description={t("Viewer muncul di sini setelah ada yang membuka story Anda.")} compact />
      ) : (
        <View className="gap-3 pb-2" accessibilityLabel={t("Daftar viewer")}>
          {rows.map((v) => {
            const name = v.user.fullName || `@${v.user.username}`
            return (
              <View key={v.user.userId} className="flex-row items-center gap-3">
                <Avatar source={v.user.avatarUrl ?? undefined} name={name} size="sm" />
                <View className="flex-1">
                  <Text variant="label" weight={600} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text variant="caption" tone="tertiary" numberOfLines={1}>
                    {formatRelativeTime(v.viewedAt, serverNow())}
                  </Text>
                </View>
                {v.reaction ? <Text variant="bodyLarge">{v.reaction}</Text> : null}
              </View>
            )
          })}
        </View>
      )}
    </BottomSheet>
  )
}
