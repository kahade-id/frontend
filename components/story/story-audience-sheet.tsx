/**
 * Kahade — <StoryAudienceSheet>: privasi per-story.
 *
 *   - "Semua yang menyimpan profil saya" (default), atau
 *   - "Kecuali beberapa orang": pilih penyimpan profil yang TIDAK boleh melihat.
 *
 * Kandidat = penyimpan profil sendiri (GET /v1/stories/audience/candidates).
 * Pengecualian hanya mempersempit kumpulan penyimpan — tidak pernah memberi
 * akses ke orang yang tidak menyimpan profil.
 */
import { Check } from "phosphor-react-native"
import { useEffect, useState } from "react"
import { View } from "react-native"

import { Avatar } from "@/components/ui/avatar"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { getStoryAudienceCandidates, type StoryAudience, type StoryAudienceCandidate } from "@/lib/api/story"
import { userMessage } from "@/lib/api/errors"
import { useT } from "@/lib/i18n"
import { useApiQuery } from "@/lib/use-api-query"
import { UsersThree } from "phosphor-react-native"

export type StoryAudienceSheetProps = {
  visible: boolean
  value: StoryAudience
  onChange: (next: StoryAudience) => void
  onRequestClose: () => void
}

export function StoryAudienceSheet({ visible, value, onChange, onRequestClose }: StoryAudienceSheetProps) {
  const t = useT()
  const [mode, setMode] = useState<StoryAudience["mode"]>(value.mode)
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(
    new Set(value.mode === "savers_except" ? value.excludedUserIds : []),
  )

  useEffect(() => {
    if (!visible) return
    setMode(value.mode)
    setExcluded(new Set(value.mode === "savers_except" ? value.excludedUserIds : []))
  }, [visible, value])

  const candidates = useApiQuery(
    "story-audience-candidates",
    (signal) => getStoryAudienceCandidates(signal),
    visible && mode === "savers_except",
  )

  const toggle = (userId: string) => {
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const done = () => {
    if (mode === "all_savers") onChange({ mode: "all_savers" })
    else onChange({ mode: "savers_except", excludedUserIds: [...excluded] })
    onRequestClose()
  }

  return (
    <BottomSheet
      visible={visible}
      onRequestClose={onRequestClose}
      title={t("Siapa yang bisa melihat")}
      description={t("Hanya orang yang menyimpan profil Anda yang bisa melihat story.")}
      footer={
        <Button variant="primary" fullWidth onPress={done} accessibilityLabel={t("Simpan privasi")}>
          {t("Simpan")}
        </Button>
      }
    >
      <View className="gap-2 pb-2">
        <Option
          label={t("Semua yang menyimpan profil saya")}
          selected={mode === "all_savers"}
          onPress={() => setMode("all_savers")}
        />
        <Option
          label={t("Kecuali beberapa orang")}
          selected={mode === "savers_except"}
          onPress={() => setMode("savers_except")}
        />

        {mode === "savers_except" ? (
          <View className="mt-2 gap-2">
            {candidates.loading && !candidates.data ? (
              <View className="gap-2">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="w-full" height={44} />
                ))}
              </View>
            ) : candidates.error && !candidates.data ? (
              <ErrorState title={t("Daftar belum bisa dimuat")} description={userMessage(candidates.error)} onRetry={candidates.reload} />
            ) : (candidates.data ?? []).length === 0 ? (
              <EmptyState icon={UsersThree} title={t("Belum ada penyimpan profil")} description={t("Daftar ini terisi saat ada yang menyimpan profil Anda.")} compact />
            ) : (
              (candidates.data ?? []).map((u: StoryAudienceCandidate) => (
                <CandidateRow
                  key={u.userId}
                  user={u}
                  excluded={excluded.has(u.userId)}
                  onToggle={() => toggle(u.userId)}
                />
              ))
            )}
            <Text variant="caption" tone="tertiary">
              {t("{n} orang dikecualikan", { n: excluded.size })}
            </Text>
          </View>
        ) : null}
      </View>
    </BottomSheet>
  )
}

function Option({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      className="flex-row items-center justify-between rounded-md border border-border px-4 py-3"
    >
      <Text variant="label" weight={600}>{label}</Text>
      {selected ? <Icon icon={Check} size="sm" tone="active" /> : null}
    </PressableScale>
  )
}

function CandidateRow({
  user,
  excluded,
  onToggle,
}: {
  user: StoryAudienceCandidate
  excluded: boolean
  onToggle: () => void
}) {
  const t = useT()
  const name = user.fullName || `@${user.username}`
  return (
    <PressableScale
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: excluded }}
      accessibilityLabel={t("Kecualikan {name}", { name })}
      className="flex-row items-center gap-3 py-2"
    >
      <Avatar source={user.avatarUrl ?? undefined} name={name} size="sm" />
      <View className="flex-1">
        <Text variant="label" weight={600} numberOfLines={1}>{name}</Text>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>@{user.username}</Text>
      </View>
      {excluded ? <Icon icon={Check} size="sm" tone="active" /> : null}
    </PressableScale>
  )
}
