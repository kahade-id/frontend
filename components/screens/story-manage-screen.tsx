/**
 * Kahade — layar kelola story (`/story/manage`), tiga tab:
 *   1. Story aktif — daftar story sendiri, sisa umur, jumlah viewer, hapus.
 *   2. Sorotan    — arsip permanen: ubah judul, hapus sorotan.
 *   3. Bisu       — kontak yang story-nya dibisukan; batalkan bisu.
 *
 * Semua aksi optimistis: hapus & bisu memakai overlay lokal yang sama dengan
 * tray & viewer (lib/story/local-state.ts), jadi perubahan langsung terlihat di
 * seluruh aplikasi. Bila server menolak, overlay dibatalkan dan toast tampil.
 */
import { router } from "expo-router"
import { Eye, Megaphone, PencilSimple, Play, SpeakerSlash, Trash } from "phosphor-react-native"
import { useCallback, useMemo, useState } from "react"
import { ScrollView, View } from "react-native"
import { Picture } from "@/components/ui/picture"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Screen } from "@/components/ui/screen"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"
import { Header } from "@/components/ui/header"
import { StoryViewersSheet } from "@/components/story/story-viewers-sheet"
import { userMessage } from "@/lib/api/errors"
import {
  STORY_HIGHLIGHT_TITLE_MAX,
  deleteStory,
  deleteStoryHighlight,
  getMutedStoryAuthors,
  getMyStories,
  getStoryHighlights,
  storyRemainingMs,
  unmuteStoryAuthor,
  updateStoryHighlight,
  type Story,
  type StoryHighlight,
} from "@/lib/api/story"
import { getMeCached, type UserProfile } from "@/lib/api/users"
import { formatCountdown, formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n"
import { formatMediaClock } from "@/lib/media-viewer"
import { ROUTES } from "@/lib/routes"
import { serverNow } from "@/lib/server-time"
import {
  bumpStoryRevision,
  hideStoryLocal,
  runOptimistic,
  setMutedLocal,
  useStoryLocal,
} from "@/lib/story/local-state"
import { useApiQuery } from "@/lib/use-api-query"

type Tab = "active" | "highlights" | "muted"

export default function StoryManageScreen() {
  const t = useT()
  const [tab, setTab] = useState<Tab>("active")

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title={t("Kelola story")} showBack />
      <View className="px-4 pb-3">
        <SegmentedControl<Tab>
          accessibilityLabel={t("Bagian kelola story")}
          value={tab}
          onChange={setTab}
          items={[
            { value: "active", label: t("Aktif") },
            { value: "highlights", label: t("Sorotan") },
            { value: "muted", label: t("Bisu") },
          ]}
        />
      </View>
      {tab === "active" ? <ActiveTab /> : tab === "highlights" ? <HighlightsTab /> : <MutedTab />}
    </Screen>
  )
}

// ---------------------------------------------------------------------------
// Tab 1 — story aktif
// ---------------------------------------------------------------------------

function ActiveTab() {
  const t = useT()
  const toast = useToast()
  const local = useStoryLocal()
  const query = useApiQuery("story-manage-mine", (signal) => getMyStories(signal))
  const [viewersFor, setViewersFor] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Story | null>(null)

  const rows = useMemo(() => {
    const now = serverNow()
    return (query.data ?? []).filter((s) => !local.hiddenStoryIds.has(s.id) && storyRemainingMs(s, now) > 0)
  }, [query.data, local.hiddenStoryIds])

  const confirmDelete = useCallback(async () => {
    const target = deleteTarget
    if (!target) return
    setDeleteTarget(null)
    const res = await runOptimistic(
      () => hideStoryLocal(target.id, target.author.userId),
      () => deleteStory(target.id),
    )
    if (res.ok) {
      bumpStoryRevision()
      toast.show({ title: t("Story dihapus"), tone: "neutral" })
    } else {
      toast.show({ title: t("Story belum terhapus"), description: userMessage(res.error), tone: "danger" })
    }
  }, [deleteTarget, toast, t])

  if (query.loading && !query.data) return <ListSkeleton />
  if (query.error && !query.data) {
    return <ErrorState title={t("Story belum bisa dimuat")} description={userMessage(query.error)} onRetry={query.reload} />
  }

  return (
    <>
      <ScrollView contentContainerClassName="gap-3 px-4 pb-10">
        {rows.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title={t("Belum ada story aktif")}
            description={t("Story yang Anda bagikan tampil di sini selama 24 jam.")}
            action={
              <Button variant="primary" fullWidth={false} onPress={() => router.push(ROUTES.storyCreate)} accessibilityLabel={t("Buat story")}>
                {t("Buat story")}
              </Button>
            }
          />
        ) : (
          rows.map((s) => (
            <View key={s.id} className="flex-row items-center gap-3 rounded-md border border-border p-3">
              <StoryThumb story={s} />
              <View className="flex-1 gap-1">
                <Text variant="label" weight={600} numberOfLines={1}>
                  {storyRowTitle(s, t)}
                </Text>
                <Text variant="caption" tone="secondary" numberOfLines={1}>
                  {t("Sisa {time}", { time: formatCountdown(Math.floor(storyRemainingMs(s, serverNow()) / 1000)) })}
                </Text>
                <Text variant="caption" tone="tertiary" numberOfLines={1}>
                  {t("{n} dilihat", { n: formatNumber(s.viewCount) })}
                  {s.audience?.mode === "savers_except" ? ` · ${t("Kecuali {n} orang", { n: s.audience.excludedUserIds.length })}` : ""}
                </Text>
              </View>
              <PressableScale
                onPress={() => setViewersFor(s.id)}
                accessibilityRole="button"
                accessibilityLabel={t("Lihat viewer")}
                className="h-10 w-10 items-center justify-center"
              >
                <Icon icon={Eye} size="sm" tone="default" />
              </PressableScale>
              <PressableScale
                onPress={() => setDeleteTarget(s)}
                accessibilityRole="button"
                accessibilityLabel={t("Hapus story")}
                className="h-10 w-10 items-center justify-center"
              >
                <Icon icon={Trash} size="sm" tone="danger" />
              </PressableScale>
            </View>
          ))
        )}
      </ScrollView>

      <StoryViewersSheet
        visible={viewersFor !== null}
        storyId={viewersFor ?? ""}
        onRequestClose={() => setViewersFor(null)}
      />

      <Dialog
        title={t("Hapus story ini?")}
        description={t("Story akan hilang dari semua orang yang bisa melihatnya.")}
        visible={deleteTarget !== null}
        destructive
        confirmLabel={t("Hapus")}
        cancelLabel={t("Batal")}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
        onRequestClose={() => setDeleteTarget(null)}
      />
    </>
  )
}

/**
 * Judul baris: caption bila ada; selain itu jenis media. Video (2026-10-10)
 * menyertakan durasi "0:15" supaya story video terbaca tanpa membuka viewer.
 */
function storyRowTitle(story: Story, t: ReturnType<typeof useT>): string {
  const caption = story.text?.trim()
  if (story.kind === "text") return caption || t("Story teks")
  if (caption) return caption
  if (story.kind === "video") {
    const clock = typeof story.durationMs === "number" ? formatMediaClock(story.durationMs / 1000) : null
    return clock ? `${t("Video story")} · ${clock}` : t("Video story")
  }
  return t("Foto story")
}

/** Thumbnail baris: foto, poster video (+ ikon putar), atau latar warna story teks. */
function StoryThumb({ story }: { story: Story }) {
  if (story.kind === "image" && story.mediaUrl) {
    return <Picture source={story.mediaUrl} alt="" width={48} height={64} radius="sm" />
  }
  if (story.kind === "video") {
    return (
      <View className="h-16 w-12 overflow-hidden rounded-sm bg-black">
        {story.thumbnailUrl ? <Picture source={story.thumbnailUrl} alt="" width={48} height={64} radius="sm" /> : null}
        <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
          <View className="h-6 w-6 items-center justify-center rounded-full bg-black/60">
            <Icon icon={Play} size="xs" tone="inverse" weight="fill" />
          </View>
        </View>
      </View>
    )
  }
  return (
    <View
      className="h-16 w-12 rounded-sm bg-surface-elevated"
      style={story.backgroundColor ? { backgroundColor: story.backgroundColor } : undefined}
    />
  )
}

// ---------------------------------------------------------------------------
// Tab 2 — sorotan
// ---------------------------------------------------------------------------

function HighlightsTab() {
  const t = useT()
  const toast = useToast()
  const me = useApiQuery<UserProfile | null>("story-manage-me", (signal) => getMeCached(signal))
  const myId = me.data?.userId ?? me.data?.id ?? null
  const query = useApiQuery(
    `story-manage-hl-${myId ?? "none"}`,
    (signal) => getStoryHighlights(myId ?? "", signal),
    myId !== null,
  )
  const [renaming, setRenaming] = useState<StoryHighlight | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [removing, setRemoving] = useState<StoryHighlight | null>(null)
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set())
  const [titles, setTitles] = useState<Record<string, string>>({})

  const rows = (query.data ?? []).filter((h) => !hidden.has(h.id))

  const saveRename = useCallback(async () => {
    const target = renaming
    const title = renameValue.trim()
    if (!target || !title) return
    if (title.length > STORY_HIGHLIGHT_TITLE_MAX) {
      toast.show({ title: t("Judul terlalu panjang"), tone: "danger" })
      return
    }
    setRenaming(null)
    const res = await runOptimistic(
      () => {
        const prev = titles[target.id]
        setTitles((m) => ({ ...m, [target.id]: title }))
        return () =>
          setTitles((m) => {
            const next = { ...m }
            if (prev === undefined) delete next[target.id]
            else next[target.id] = prev
            return next
          })
      },
      () => updateStoryHighlight(target.id, { title }),
    )
    if (!res.ok) toast.show({ title: t("Judul belum tersimpan"), description: userMessage(res.error), tone: "danger" })
    else query.refresh()
  }, [renaming, renameValue, titles, toast, t, query])

  const confirmRemove = useCallback(async () => {
    const target = removing
    if (!target) return
    setRemoving(null)
    const res = await runOptimistic(
      () => {
        setHidden((prev) => new Set(prev).add(target.id))
        return () =>
          setHidden((prev) => {
            const next = new Set(prev)
            next.delete(target.id)
            return next
          })
      },
      () => deleteStoryHighlight(target.id),
    )
    if (!res.ok) toast.show({ title: t("Sorotan belum terhapus"), description: userMessage(res.error), tone: "danger" })
  }, [removing, toast, t])

  if (query.loading && !query.data) return <ListSkeleton />
  if (query.error && !query.data) {
    return <ErrorState title={t("Sorotan belum bisa dimuat")} description={userMessage(query.error)} onRetry={query.reload} />
  }

  return (
    <>
      <ScrollView contentContainerClassName="gap-3 px-4 pb-10">
        {rows.length === 0 ? (
          <EmptyState
            icon={PencilSimple}
            title={t("Belum ada sorotan")}
            description={t("Sorot story dari viewer story untuk menyimpannya permanen di profil.")}
            compact
          />
        ) : (
          rows.map((h) => (
            <View key={h.id} className="flex-row items-center gap-3 rounded-md border border-border p-3">
              <View className="flex-1">
                <Text variant="label" weight={600} numberOfLines={1}>{titles[h.id] ?? h.title}</Text>
                <Text variant="caption" tone="secondary">{t("{n} story", { n: h.storyCount })}</Text>
              </View>
              <PressableScale
                onPress={() => {
                  setRenameValue(titles[h.id] ?? h.title)
                  setRenaming(h)
                }}
                accessibilityRole="button"
                accessibilityLabel={t("Ubah judul sorotan")}
                className="h-10 w-10 items-center justify-center"
              >
                <Icon icon={PencilSimple} size="sm" tone="default" />
              </PressableScale>
              <PressableScale
                onPress={() => setRemoving(h)}
                accessibilityRole="button"
                accessibilityLabel={t("Hapus sorotan")}
                className="h-10 w-10 items-center justify-center"
              >
                <Icon icon={Trash} size="sm" tone="danger" />
              </PressableScale>
            </View>
          ))
        )}
      </ScrollView>

      <BottomSheet
        visible={renaming !== null}
        onRequestClose={() => setRenaming(null)}
        title={t("Ubah judul sorotan")}
        footer={
          <Button variant="primary" fullWidth onPress={() => void saveRename()} disabled={renameValue.trim().length === 0} accessibilityLabel={t("Simpan judul")}>
            {t("Simpan")}
          </Button>
        }
      >
        <View className="pb-2">
          <Input value={renameValue} onChangeText={setRenameValue} maxLength={STORY_HIGHLIGHT_TITLE_MAX} accessibilityLabel={t("Judul sorotan")} />
        </View>
      </BottomSheet>

      <Dialog
        title={t("Hapus sorotan ini?")}
        description={t("Story di dalamnya tidak ikut terhapus dari berkas Anda, tetapi sorotan hilang dari profil.")}
        visible={removing !== null}
        destructive
        confirmLabel={t("Hapus")}
        cancelLabel={t("Batal")}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setRemoving(null)}
        onRequestClose={() => setRemoving(null)}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Tab 3 — bisu
// ---------------------------------------------------------------------------

function MutedTab() {
  const t = useT()
  const toast = useToast()
  const local = useStoryLocal()
  const query = useApiQuery("story-manage-muted", (signal) => getMutedStoryAuthors(signal))

  const rows = (query.data ?? []).filter((a) => local.muted.get(a.userId) !== false)

  const unmute = useCallback(
    async (userId: string) => {
      const res = await runOptimistic(
        () => setMutedLocal(userId, false),
        () => unmuteStoryAuthor(userId),
      )
      if (!res.ok) {
        toast.show({ title: t("Bisu belum dibatalkan"), description: userMessage(res.error), tone: "danger" })
      } else {
        bumpStoryRevision()
      }
    },
    [toast, t],
  )

  if (query.loading && !query.data) return <ListSkeleton />
  if (query.error && !query.data) {
    return <ErrorState title={t("Daftar bisu belum bisa dimuat")} description={userMessage(query.error)} onRetry={query.reload} />
  }

  return (
    <ScrollView contentContainerClassName="gap-3 px-4 pb-10">
      {rows.length === 0 ? (
        <EmptyState
          icon={SpeakerSlash}
          title={t("Tidak ada story yang dibisukan")}
          description={t("Bisukan story kontak dari viewer story agar tidak tampil di depan tray.")}
          compact
        />
      ) : (
        rows.map((a) => {
          const name = a.fullName || `@${a.username}`
          return (
            <View key={a.userId} className="flex-row items-center gap-3 rounded-md border border-border p-3">
              <View className="flex-1">
                <Text variant="label" weight={600} numberOfLines={1}>{name}</Text>
                <Text variant="caption" tone="tertiary" numberOfLines={1}>@{a.username}</Text>
              </View>
              <Button variant="secondary" size="sm" fullWidth={false} onPress={() => void unmute(a.userId)} accessibilityLabel={t("Batalkan bisu {name}", { name })}>
                {t("Batalkan bisu")}
              </Button>
            </View>
          )
        })
      )}
    </ScrollView>
  )
}

function ListSkeleton() {
  return (
    <View className="gap-3 px-4 pt-2">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="w-full" height={72} />
      ))}
    </View>
  )
}
