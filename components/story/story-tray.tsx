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
 *
 * Motion (2026-10-08, penyegaran UI/UX story):
 *   - Ubin masuk bertahap: fade + naik 8px, jeda 40ms per ubin, dibatasi 8
 *     ubin pertama (tray panjang tidak perlu reveal satu per satu — §8:
 *     <Stagger> hanya untuk deret pendek).
 *   - Ubin ditekan mengecil (spring) — lihat <StoryRing>.
 *   - Reduced motion: tanpa animasi (audit #2).
 */
import { router } from "expo-router"
import { useCallback, useEffect, useMemo, useRef } from "react"
import { ScrollView, View } from "react-native"

import { FadeIn } from "@/components/ui/fade-in"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { StoryRing, type StoryRingState } from "@/components/story/story-ring"
import { getMeCached, type UserProfile } from "@/lib/api/users"
import { getStoryTray, type StoryTrayEntry } from "@/lib/api/story"
import { useApiQuery } from "@/lib/use-api-query"
import { useStoryLocal } from "@/lib/story/local-state"
import { applyTrayOverlay } from "@/lib/story/tray"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { useT } from "@/lib/i18n"

const TILE_WIDTH = 72
/**
 * Jumlah ubin pertama yang mendapat reveal bertahap. Lebih dari ini jeda
 * kumulatifnya (> 300ms) mulai terasa seperti tray yang lambat dimuat.
 */
const STAGGER_LIMIT = 8
const STAGGER_STEP_MS = 40

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
        index={0}
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

      {view?.others.map((entry, i) => (
        <OtherTile key={entry.author.userId} entry={entry} onOpen={openViewer} index={i + 1} />
      ))}
    </ScrollView>
  )
}

function OtherTile({
  entry,
  onOpen,
  index,
}: {
  entry: StoryTrayEntry
  onOpen: (userId: string) => void
  index: number
}) {
  const t = useT()
  const name = entry.author.fullName || `@${entry.author.username}`
  const state = ringFor(entry)
  return (
    <StoryTile width={TILE_WIDTH} name={name} caption={name} dim={entry.muted} index={index}>
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
  index = 0,
  children,
}: {
  width: number
  name: string
  caption: string
  dim?: boolean
  /** Urutan ubin — penentu jeda reveal bertahap. */
  index?: number
  children: React.ReactNode
}) {
  /**
   * Reveal masuk dipasang DI LUAR <View style={{width}}> supaya lebar ubin
   * tetap milik pembungkus: <FadeIn> membungkus anaknya dengan Animated.View
   * `flexGrow/flexShrink` (lihat docblock fade-in.tsx) dan tidak boleh
   * mengubah lebar tetap tray.
   */
  const delay = Math.min(index, STAGGER_LIMIT) * STAGGER_STEP_MS
  return (
    <FadeIn duration="fast" delay={delay} distance={tokens.space[2]}>
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
    </FadeIn>
  )
}
