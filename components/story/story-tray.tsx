/**
 * Kahade — <StoryTray>: baris story horizontal di atas daftar chat.
 *
 * Urutan: story SENDIRI paling kiri (selalu tampil, meski kosong — tombol "+"
 * untuk membuat story), lalu kontak yang punya story aktif (belum dilihat dulu,
 * lalu sudah dilihat, bisu paling kanan).
 *
 * Sumber data: GET /v1/stories/tray (lewat useApiQuery → refresh saat layar
 * kembali fokus) + overlay lokal (lib/story/local-state.ts) supaya ring langsung
 * berubah saat story dilihat/dibisukan, sebelum server merespons.
 *
 * Kegagalan memuat tray TIDAK memblokir daftar chat: tray disembunyikan kecuali
 * tombol "+" sendiri, supaya pengguna tetap bisa membuat story.
 */
import { router } from "expo-router"
import { useCallback, useEffect, useMemo, useRef } from "react"
import { ScrollView, View } from "react-native"

import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { StoryRing, type StoryRingState } from "@/components/story/story-ring"
import { getMeCached, type UserProfile } from "@/lib/api/users"
import { getStoryTray, type StoryTrayEntry } from "@/lib/api/story"
import { useApiQuery } from "@/lib/use-api-query"
import { useStoryLocal } from "@/lib/story/local-state"
import { applyTrayOverlay } from "@/lib/story/tray"
import { ROUTES } from "@/lib/routes"
import { useT } from "@/lib/i18n"

const TILE_WIDTH = 72

function ringFor(entry: { hasUnseen: boolean; muted: boolean }): StoryRingState {
  if (entry.muted) return "muted"
  return entry.hasUnseen ? "unseen" : "seen"
}

export function StoryTray() {
  const t = useT()
  const local = useStoryLocal()
  const me = useApiQuery<UserProfile | null>("story-tray-me", (signal) => getMeCached(signal))
  const tray = useApiQuery("story-tray", (signal) => getStoryTray(signal))
  // Muat ulang saat ada mutasi story yang sukses (lihat `revision` di local-state).
  const seenRevision = useRef(local.revision)
  useEffect(() => {
    if (seenRevision.current === local.revision) return
    seenRevision.current = local.revision
    tray.refresh()
  }, [local.revision, tray])

  const myUserId = me.data?.userId ?? me.data?.id ?? null

  const view = useMemo(() => {
    if (!tray.data) return null
    return applyTrayOverlay(tray.data, local, myUserId ?? undefined)
  }, [tray.data, local, myUserId])

  const openViewer = useCallback((userId: string) => {
    router.push(ROUTES.storyViewer(userId))
  }, [])

  const openCreate = useCallback(() => {
    router.push(ROUTES.storyCreate)
  }, [])

  const ownName = me.data?.fullName || me.data?.username || t("Story saya")
  const ownAvatar = me.data?.avatarUrl ?? view?.own?.author.avatarUrl ?? null
  const ownEntry = view?.own ?? null
  const ownHasStories = ownEntry !== null && ownEntry.storyCount > 0
  const ownPending = local.pending.length > 0

  if (tray.loading && !tray.data) {
    return (
      <View className="flex-row gap-3 px-4 pb-3 pt-1" accessibilityLabel={t("Memuat story")}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} width={TILE_WIDTH} height={92} />
        ))}
      </View>
    )
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="grow-0"
      contentContainerClassName="gap-3 px-4 pb-3 pt-1"
      accessibilityLabel={t("Story")}
    >
      <StoryTile
        width={TILE_WIDTH}
        name={t("Story saya")}
        caption={ownPending ? t("Mengunggah…") : ownHasStories ? t("Story saya") : t("Tambah story")}
      >
        <StoryRing
          name={ownName}
          avatarUrl={ownAvatar}
          ringState={ownHasStories ? "seen" : "empty"}
          pending={ownPending}
          showAddBadge
          onPress={ownHasStories && myUserId ? () => openViewer(myUserId) : openCreate}
          onPressAdd={openCreate}
          accessibilityLabel={
            ownHasStories ? t("Lihat story saya") : t("Buat story baru")
          }
          testID="story-tray-own"
        />
      </StoryTile>

      {view?.others.map((entry) => (
        <OtherTile key={entry.author.userId} entry={entry} onOpen={openViewer} />
      ))}
    </ScrollView>
  )
}

function OtherTile({
  entry,
  onOpen,
}: {
  entry: StoryTrayEntry
  onOpen: (userId: string) => void
}) {
  const t = useT()
  const name = entry.author.fullName || `@${entry.author.username}`
  const state = ringFor(entry)
  return (
    <StoryTile width={TILE_WIDTH} name={name} caption={name} dim={entry.muted}>
      <StoryRing
        name={name}
        avatarUrl={entry.author.avatarUrl}
        ringState={state}
        onPress={() => onOpen(entry.author.userId)}
        accessibilityLabel={
          state === "unseen"
            ? t("Lihat story {name}, belum dilihat", { name })
            : t("Lihat story {name}", { name })
        }
        testID={`story-tray-${entry.author.userId}`}
      />
    </StoryTile>
  )
}

function StoryTile({
  width,
  name,
  caption,
  dim = false,
  children,
}: {
  width: number
  name: string
  caption: string
  dim?: boolean
  children: React.ReactNode
}) {
  return (
    <View style={{ width }} className="items-center gap-1" accessibilityLabel={name}>
      {children}
      <Text
        variant="caption"
        tone={dim ? "tertiary" : "secondary"}
        numberOfLines={1}
        className="w-full text-center"
      >
        {caption}
      </Text>
    </View>
  )
}
