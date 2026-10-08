/**
 * Kahade — <StoryHighlightSheet>: sorot story sendiri ke arsip profil.
 *
 * Sorotan = arsip permanen. Server MENYALIN media story saat disorot, jadi
 * story tetap tampil di sorotan walau sudah lewat 24 jam.
 *
 * Dua jalur:
 *   1. Tambah ke sorotan yang sudah ada (PATCH, `storyIds` = daftar lengkap).
 *   2. Buat sorotan baru (POST) dengan judul preset "Katalog"/"Testimoni" atau
 *      judul bebas.
 *
 * Optimistis: sorotan yang dipilih langsung ditandai "Tersimpan"; bila server
 * menolak, tanda dicabut dan toast menjelaskan galatnya.
 */
import { Star } from "phosphor-react-native"
import { useCallback, useState } from "react"
import { View } from "react-native"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/toast"
import { userMessage } from "@/lib/api/errors"
import {
  STORY_HIGHLIGHT_TITLE_MAX,
  createStoryHighlight,
  getStoryHighlights,
  updateStoryHighlight,
  type StoryHighlight,
} from "@/lib/api/story"
import { getMeCached, type UserProfile } from "@/lib/api/users"
import { useT } from "@/lib/i18n"
import { useApiQuery } from "@/lib/use-api-query"

export type StoryHighlightSheetProps = {
  visible: boolean
  storyId: string
  onRequestClose: () => void
}

const PRESET_TITLES = ["Katalog", "Testimoni"] as const

export function StoryHighlightSheet({ visible, storyId, onRequestClose }: StoryHighlightSheetProps) {
  const t = useT()
  const toast = useToast()
  const me = useApiQuery<UserProfile | null>("story-hl-me", (signal) => getMeCached(signal), visible)
  const myId = me.data?.userId ?? me.data?.id ?? null
  const list = useApiQuery(
    `story-hl-list-${myId ?? "none"}`,
    (signal) => getStoryHighlights(myId ?? "", signal),
    visible && myId !== null,
  )

  /** Sorotan yang sudah disimpan di sesi ini (optimistis). */
  const [savedIds, setSavedIds] = useState<ReadonlySet<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [customTitle, setCustomTitle] = useState("")

  const alreadyIn = (h: StoryHighlight) =>
    h.stories.some((s) => s.id === storyId) || savedIds.has(h.id)

  const addToExisting = useCallback(
    async (h: StoryHighlight) => {
      if (busy || alreadyIn(h)) return
      setBusy(true)
      setSavedIds((prev) => new Set(prev).add(h.id))
      try {
        await updateStoryHighlight(h.id, { storyIds: [...h.stories.map((s) => s.id), storyId] })
        toast.show({ title: t("Disorot ke {title}", { title: h.title }), tone: "success" })
        list.refresh()
      } catch (err) {
        setSavedIds((prev) => {
          const next = new Set(prev)
          next.delete(h.id)
          return next
        })
        toast.show({ title: t("Sorotan belum tersimpan"), description: userMessage(err), tone: "danger" })
      } finally {
        setBusy(false)
      }
    },
    // alreadyIn membaca savedIds; busy & storyId cukup sebagai dependensi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy, storyId, toast, t, list],
  )

  const createNew = useCallback(
    async (title: string) => {
      const clean = title.trim()
      if (!clean || busy) return
      if (clean.length > STORY_HIGHLIGHT_TITLE_MAX) {
        toast.show({ title: t("Judul terlalu panjang"), description: t("Maksimal {n} karakter.", { n: STORY_HIGHLIGHT_TITLE_MAX }), tone: "danger" })
        return
      }
      setBusy(true)
      try {
        const hl = await createStoryHighlight({ title: clean, storyIds: [storyId] })
        setSavedIds((prev) => new Set(prev).add(hl.id))
        setCustomTitle("")
        toast.show({ title: t("Sorotan {title} dibuat", { title: clean }), tone: "success" })
        list.refresh()
      } catch (err) {
        toast.show({ title: t("Sorotan belum dibuat"), description: userMessage(err), tone: "danger" })
      } finally {
        setBusy(false)
      }
    },
    [busy, storyId, toast, t, list],
  )

  return (
    <BottomSheet visible={visible} onRequestClose={onRequestClose} title={t("Sorot ke profil")} description={t("Sorotan tetap tampil di profil setelah 24 jam.")}>
      <View className="gap-4 pb-2">
        {(list.data ?? []).length > 0 ? (
          <View className="gap-2">
            <Text variant="caption" tone="secondary">{t("Sorotan yang ada")}</Text>
            {(list.data ?? []).map((h) => {
              const done = alreadyIn(h)
              return (
                <PressableScale
                  key={h.id}
                  onPress={() => void addToExisting(h)}
                  disabled={done || busy}
                  accessibilityRole="button"
                  accessibilityLabel={done ? t("{title} sudah berisi story ini", { title: h.title }) : t("Tambahkan ke {title}", { title: h.title })}
                  className="flex-row items-center gap-3 rounded-md border border-border px-3 py-3"
                >
                  <Icon icon={Star} size="sm" tone={done ? "active" : "default"} />
                  <View className="flex-1">
                    <Text variant="label" weight={600}>{h.title}</Text>
                    <Text variant="caption" tone="tertiary">{t("{n} story", { n: h.storyCount })}</Text>
                  </View>
                  {done ? <Text variant="caption" tone="secondary">{t("Tersimpan")}</Text> : null}
                </PressableScale>
              )
            })}
          </View>
        ) : null}

        <View className="gap-2">
          <Text variant="caption" tone="secondary">{t("Sorotan baru")}</Text>
          <View className="flex-row flex-wrap gap-2">
            {PRESET_TITLES.map((title) => (
              <PressableScale
                key={title}
                onPress={() => void createNew(title)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={t("Buat sorotan {title}", { title: t(title) })}
                className="rounded-full border border-border px-4 py-2"
              >
                <Text variant="label" weight={600}>{t(title)}</Text>
              </PressableScale>
            ))}
          </View>
          <Input
            value={customTitle}
            onChangeText={setCustomTitle}
            placeholder={t("Judul lain")}
            maxLength={STORY_HIGHLIGHT_TITLE_MAX}
            accessibilityLabel={t("Judul sorotan")}
          />
          <Button
            variant="primary"
            onPress={() => void createNew(customTitle)}
            disabled={busy || customTitle.trim().length === 0}
            loading={busy}
            accessibilityLabel={t("Buat sorotan")}
          >
            {t("Buat sorotan")}
          </Button>
        </View>
      </View>
    </BottomSheet>
  )
}
