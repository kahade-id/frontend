/**
 * Kahade — viewer story fullscreen (`/story/[userId]`).
 *
 * Perilaku (ala WhatsApp Status):
 *   - Progress bar per story; segmen aktif diisi lewat SATU shared value yang
 *     dianimasikan di UI thread (`withTiming`). Segmen lain statis.
 *   - Tap kiri/kanan → mundur/maju (lihat lib/story/playback.ts). Di ujung
 *     penulis → penulis berikutnya dari tray; di ujung terakhir → tutup.
 *   - Tekan-tahan → pause (sisa durasi dilanjutkan saat dilepas). Fokus input
 *     balasan juga men-pause.
 *   - Geser ke bawah → tutup. Gesture dipisah dari tombol/tag/input: lapisan
 *     kontrol diletakkan DI ATAS lapisan gesture, jadi sentuhan tidak saling
 *     menelan.
 *
 * Motion (2026-10-08, penyegaran UI/UX story):
 *   - BUKA: layar mengembang dari 0.92 + fade masuk (220ms, kurva enter) —
 *     terasa seperti story "membesar dari ubin tray", bukan potongan layar
 *     baru yang menimpa.
 *   - TUTUP (geser ke bawah): selain turun, layar MENGECIL ke 0.86 dan
 *     membulat (radius 24) sementara latar meredup — bahasa dismiss yang sama
 *     dengan Instagram/WhatsApp. Dulu hanya translateY + opacity, sehingga
 *     gerakan terasa seperti "menggeser kertas", bukan menutup lapisan.
 *   - GANTI SEGMEN: media crossfade + sedikit zoom-out (1.03 → 1) tiap kali
 *     story berganti, supaya potongan antar story tidak terasa "menjepret".
 *   - Semua updater `useAnimatedStyle` murni membaca shared value — nol
 *     pemanggilan fungsi JS di dalamnya (aturan worklet repo).
 *
 * Aturan worklet (penting): `useAnimatedStyle` hanya membaca shared value.
 * Pemanggilan fungsi JS (navigasi, setState) selalu lewat `runOnJS` dari
 * callback gesture/animasi, tidak pernah dari dalam updater style.
 *
 * Interaksi (semua optimistis + rollback):
 *   - tandai dilihat (ring abu-abu di tray setelah story terakhir),
 *   - reaksi emoji cepat,
 *   - balas → masuk sebagai chat ke pemilik,
 *   - tanya stok → draft chat berisi pertanyaan stok (tidak terkirim otomatis),
 *   - bisukan kontak; untuk story sendiri: hapus, lihat viewer, sorot.
 */
import { router } from "expo-router"
import { Image } from "expo-image"
import {
  DotsThree,
  Eye,
  PaperPlaneRight,
  ShoppingBag,
  SpeakerSlash,
  Star,
  Trash,
  X,
  Megaphone,
} from "phosphor-react-native"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { KeyboardAvoidingView, Platform, Pressable, TextInput, View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  Easing,
  type SharedValue,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated"

import { ActionSheet, type ActionSheetItem } from "@/components/ui/action-sheet"
import { Avatar } from "@/components/ui/avatar"
import { Dialog } from "@/components/ui/modal"
import { ErrorState } from "@/components/ui/error-state"
import { Icon } from "@/components/ui/icon"
import { LoadingScreen } from "@/components/ui/loading-screen"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"
import { StoryHighlightSheet } from "@/components/story/story-highlight-sheet"
import { StoryViewersSheet } from "@/components/story/story-viewers-sheet"
import { getOrCreateDm } from "@/lib/api/chat"
import { userMessage } from "@/lib/api/errors"
import {
  STORY_REACTIONS,
  deleteStory,
  getStoryTray,
  getUserStories,
  isStoryActive,
  markStoryViewed,
  muteStoryAuthor,
  replyToStory,
  setStoryReaction,
  unmuteStoryAuthor,
  type Story,
  type StoryReaction,
} from "@/lib/api/story"
import { getMeCached, type UserProfile } from "@/lib/api/users"
import { formatPriceSticker, askStockPrefill } from "@/lib/story/compose"
import { applyTrayOverlay } from "@/lib/story/tray"
import {
  hideStoryLocal,
  markAuthorSeenLocal,
  markStorySeenLocal,
  runOptimistic,
  setMutedLocal,
  setReactionLocal,
  useStoryLocal,
} from "@/lib/story/local-state"
import {
  STORY_SEGMENT_MS,
  clampIndex,
  remainingSegmentMs,
  stepBack,
  stepForward,
  tapActionAt,
} from "@/lib/story/playback"
import { saveChatDraft } from "@/lib/chat-drafts"
import { formatRelativeTime } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { useT } from "@/lib/i18n"
import { ROUTES } from "@/lib/routes"
import { serverNow } from "@/lib/server-time"
import { useApiQuery } from "@/lib/use-api-query"

type Props = {
  userId: string
  highlightId: string | null
}

type Sequence = { userId: string; hasStories: boolean }

export default function StoryViewerScreen({ userId, highlightId }: Props) {
  const t = useT()
  const toast = useToast()
  const local = useStoryLocal()

  const meQuery = useApiQuery<UserProfile | null>("story-viewer-me", (signal) => getMeCached(signal))
  const myUserId = meQuery.data?.userId ?? meQuery.data?.id ?? null

  const feed = useApiQuery(`story-user-${userId}`, (signal) => getUserStories(userId, signal), !highlightId)
  const trayQuery = useApiQuery("story-tray", (signal) => getStoryTray(signal))
  const seenRevision = useRef(local.revision)
  useEffect(() => {
    if (seenRevision.current === local.revision) return
    seenRevision.current = local.revision
    feed.refresh()
    trayQuery.refresh()
  }, [local.revision, feed, trayQuery])

  const author = feed.data?.author ?? null
  const isOwn = myUserId !== null && userId === myUserId

  /** Story aktif, belum dihapus (optimistis), urut pemutaran. */
  const stories = useMemo<Story[]>(() => {
    const now = serverNow()
    return (feed.data?.stories ?? []).filter(
      (s) => !local.hiddenStoryIds.has(s.id) && isStoryActive(s, now),
    )
  }, [feed.data, local.hiddenStoryIds])

  /** Urutan penulis untuk maju/mundur — sama dengan urutan tray. */
  const sequence = useMemo<Sequence[]>(() => {
    if (!trayQuery.data) return []
    const view = applyTrayOverlay(trayQuery.data, local, myUserId ?? undefined)
    const list: Sequence[] = []
    if (view.own) list.push({ userId: view.own.author.userId, hasStories: view.own.storyCount > 0 })
    for (const e of view.others) list.push({ userId: e.author.userId, hasStories: e.storyCount > 0 })
    return list.filter((x) => x.hasStories)
  }, [trayQuery.data, local, myUserId])

  const seqIndex = sequence.findIndex((s) => s.userId === userId)
  const nextAuthorId = seqIndex >= 0 ? (sequence[seqIndex + 1]?.userId ?? null) : null
  const prevAuthorId = seqIndex > 0 ? (sequence[seqIndex - 1]?.userId ?? null) : null

  const [index, setIndex] = useState(0)
  const [holding, setHolding] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [viewersOpen, setViewersOpen] = useState(false)
  const [highlightOpen, setHighlightOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [replyText, setReplyText] = useState("")
  const [replyBusy, setReplyBusy] = useState(false)

  const safeIndex = clampIndex(index, stories.length)
  const current = stories[safeIndex] ?? null
  const paused = holding || inputFocused || menuOpen || viewersOpen || highlightOpen || confirmDelete

  // ---- Navigasi antar penulis / tutup (dipanggil dari JS, tidak dari worklet) ----

  const goNextAuthor = useCallback(() => {
    if (nextAuthorId) router.replace(ROUTES.storyViewer(nextAuthorId))
    else router.back()
  }, [nextAuthorId])

  const goPrevAuthor = useCallback(() => {
    if (prevAuthorId) router.replace(ROUTES.storyViewer(prevAuthorId))
  }, [prevAuthorId])

  const close = useCallback(() => {
    router.back()
  }, [])

  const advance = useCallback(() => {
    const step = stepForward(safeIndex, stories.length, nextAuthorId !== null)
    if (step.kind === "index") setIndex(step.index)
    else if (step.kind === "next-author") goNextAuthor()
    else close()
  }, [safeIndex, stories.length, nextAuthorId, goNextAuthor, close])

  const retreat = useCallback(() => {
    const step = stepBack(safeIndex, prevAuthorId !== null)
    if (step.kind === "index") setIndex(step.index)
    else if (step.kind === "prev-author") goPrevAuthor()
  }, [safeIndex, prevAuthorId, goPrevAuthor])

  // Ref agar callback animasi (UI thread → runOnJS) selalu memanggil versi terbaru.
  const advanceRef = useRef(advance)
  advanceRef.current = advance
  const onSegmentDone = useCallback(() => advanceRef.current(), [])

  const onTapAt = useCallback(
    (ratioX: number) => {
      if (paused) return
      const action = tapActionAt(ratioX)
      if (action === "forward") advanceRef.current()
      else if (action === "back") retreat()
    },
    [paused, retreat],
  )
  const onTapRef = useRef(onTapAt)
  onTapRef.current = onTapAt

  // ---- Progress (UI thread) ----

  const progress = useSharedValue(0)
  const segmentIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!current) return
    if (segmentIdRef.current !== current.id) {
      cancelAnimation(progress)
      progress.value = 0
      segmentIdRef.current = current.id
    }
    if (paused) {
      cancelAnimation(progress)
      return
    }
    const remaining = remainingSegmentMs(progress.value, STORY_SEGMENT_MS)
    if (remaining <= 0) {
      onSegmentDone()
      return
    }
    progress.value = withTiming(
      1,
      { duration: remaining, easing: Easing.linear },
      (finished) => {
        if (finished) runOnJS(onSegmentDone)()
      },
    )
    return () => cancelAnimation(progress)
  }, [current, paused, progress, onSegmentDone])

  // Reset posisi saat penulis berganti.
  useEffect(() => {
    setIndex(0)
    segmentIdRef.current = null
    progress.value = 0
  }, [userId, progress])

  // ---- Tandai dilihat (optimistis, rollback bila gagal) ----

  useEffect(() => {
    if (!current || isOwn) return
    const isLast = safeIndex === stories.length - 1
    const undoStory = markStorySeenLocal(current.id)
    const undoAuthor = isLast ? markAuthorSeenLocal(userId, true) : null
    if (current.viewed) return
    markStoryViewed(current.id).catch(() => {
      undoStory()
      undoAuthor?.()
    })
    // Hanya bergantung pada story aktif; `stories` diturunkan darinya.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, isOwn, safeIndex, stories.length, userId])

  // ---- Gesture ----

  const [layoutWidth, setLayoutWidth] = useState(1)
  const dragY = useSharedValue(0)
  /**
   * Progress tutup (0 = terbuka, 1 = tertutup). Satu sumber untuk skala,
   * radius, dan redup latar — dihitung dari `dragY` di dalam worklet, tanpa
   * memanggil fungsi JS apa pun.
   */
  const dismissProgress = useSharedValue(0)
  const dragStyle = useAnimatedStyle(() => {
    const p = dismissProgress.value
    return {
      transform: [{ translateY: dragY.value }, { scale: 1 - p * 0.14 }],
      // Meredup perlahan ke latar hitam di belakangnya (root `bg-black`):
      // kartu benar-benar terasa "ditutup", bukan sekadar digeser.
      opacity: 1 - p * 0.35,
      borderRadius: p * 24,
      overflow: "hidden",
    }
  })
  /**
   * Reveal BUKA: 0.92 → 1 + fade. Dipisah dari `dragY` supaya gerakan tutup
   * tidak pernah menimpa progress buka (dua animasi berbeda pada transform
   * yang sama akan saling membatalkan).
   */
  const openProgress = useSharedValue(0)
  const openStyle = useAnimatedStyle(() => ({
    opacity: openProgress.value,
    transform: [{ scale: 0.92 + openProgress.value * 0.08 }],
  }))
  useEffect(() => {
    openProgress.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) })
    return () => {
      cancelAnimation(openProgress)
    }
  }, [openProgress])

  /**
   * Crossfade + zoom-out halus tiap kali segmen berganti (`current.id`).
   * Shared value di-reset lalu dinaikkan, jadi story yang sama tidak
   * beranimasi dua kali.
   */
  const segmentFade = useSharedValue(1)
  const segmentStyle = useAnimatedStyle(() => ({
    opacity: segmentFade.value,
    transform: [{ scale: 1.03 - segmentFade.value * 0.03 }],
  }))
  useEffect(() => {
    segmentFade.value = 0
    segmentFade.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) })
    return () => {
      cancelAnimation(segmentFade)
    }
  }, [current?.id, segmentFade])

  const closeFromGesture = useCallback(() => {
    router.back()
  }, [])

  const pan = Gesture.Pan()
    .activeOffsetY(14)
    .failOffsetX([-18, 18])
    .onUpdate((e) => {
      dragY.value = Math.max(0, e.translationY)
      // Progress tutup dihitung DI SINI (bukan di dalam updater style):
      // updater `useAnimatedStyle` harus murni membaca shared value —
      // menulis dari dalamnya memicu evaluasi ganda per frame.
      // 320px seretan = progress penuh, jadi redup terasa jauh sebelum
      // jari mencapai dasar layar.
      dismissProgress.value = Math.min(1, Math.max(0, dragY.value / 320))
    })
    .onEnd((e) => {
      if (e.translationY > 140 || e.velocityY > 900) {
        dismissProgress.value = withTiming(1, { duration: 180 })
        dragY.value = withTiming(800, { duration: 180 }, (finished) => {
          if (finished) runOnJS(closeFromGesture)()
        })
      } else {
        dismissProgress.value = withSpring(0, { damping: 22, stiffness: 240 })
        dragY.value = withSpring(0, { damping: 22, stiffness: 240 })
      }
    })

  const tap = Gesture.Tap()
    .maxDuration(220)
    .maxDistance(12)
    .onEnd((e) => {
      const ratio = e.x / Math.max(1, layoutWidth)
      runOnJS(onTapRef.current)(ratio)
    })

  const hold = Gesture.LongPress()
    .minDuration(200)
    .maxDistance(12)
    .onStart(() => {
      runOnJS(setHolding)(true)
    })
    .onFinalize(() => {
      runOnJS(setHolding)(false)
    })

  const gesture = Gesture.Exclusive(pan, Gesture.Race(tap, hold))

  // ---- Reaksi (optimistis) ----

  const burst = useSharedValue(0)
  const burstStyle = useAnimatedStyle(() => ({
    opacity: burst.value > 0 ? 1 : 0,
    transform: [{ scale: 0.6 + burst.value * 0.8 }],
  }))
  const [lastBurst, setLastBurst] = useState<StoryReaction | null>(null)

  const react = useCallback(
    async (emoji: StoryReaction) => {
      if (!current) return
      haptic("select")
      setLastBurst(emoji)
      burst.value = withSequence(withTiming(1, { duration: 160 }), withTiming(0, { duration: 420 }))
      const storyId = current.id
      const res = await runOptimistic(
        () => setReactionLocal(storyId, emoji),
        () => setStoryReaction(storyId, emoji),
      )
      if (!res.ok) {
        haptic("error")
        toast.show({
          title: t("Reaksi gagal dikirim"),
          description: userMessage(res.error),
          tone: "danger",
        })
      }
    },
    [current, burst, toast, t],
  )

  const reactionFor = current ? (local.reactions.has(current.id) ? local.reactions.get(current.id) : current.myReaction) : null

  // ---- Balas (optimistis: input langsung kosong; dipulihkan bila gagal) ----

  const sendReply = useCallback(async () => {
    const text = replyText.trim()
    if (!text || !current || replyBusy) return
    setReplyBusy(true)
    setReplyText("")
    try {
      const { roomId } = await replyToStory(current.id, text)
      toast.show({
        title: t("Balasan terkirim"),
        tone: "success",
        action: {
          label: t("Buka chat"),
          onPress: () => router.push(ROUTES.chatRoom(roomId, author?.fullName || `@${author?.username ?? ""}`)),
        },
      })
    } catch (err) {
      setReplyText(text)
      toast.show({
        title: t("Balasan belum terkirim"),
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setReplyBusy(false)
    }
  }, [replyText, current, replyBusy, toast, t, author])

  // ---- Tanya Stok: buka DM + draft pertanyaan (tidak terkirim otomatis) ----

  const askStock = useCallback(async () => {
    if (!current?.askStock || !author) return
    const productId = current.askStock.productId
    const title = productId
      ? current.productTags.find((p) => p.productId === productId)?.title ?? null
      : null
    try {
      const room = await getOrCreateDm(author.username)
      saveChatDraft(room.id, askStockPrefill(title))
      router.replace(ROUTES.chatRoom(room.id, author.fullName || `@${author.username}`))
    } catch (err) {
      toast.show({ title: t("Chat belum bisa dibuka"), description: userMessage(err), tone: "danger" })
    }
  }, [current, author, toast, t])

  // ---- Menu ⋯ ----

  const isMuted = author ? (local.muted.get(author.userId) ?? false) : false

  const toggleMute = useCallback(async () => {
    if (!author) return
    const nextMuted = !isMuted
    const res = await runOptimistic(
      () => setMutedLocal(author.userId, nextMuted),
      () => (nextMuted ? muteStoryAuthor(author.userId) : unmuteStoryAuthor(author.userId)),
    )
    if (!res.ok) {
      toast.show({ title: t("Pengaturan bisu belum tersimpan"), description: userMessage(res.error), tone: "danger" })
    } else {
      toast.show({
        title: nextMuted ? t("Story dibisukan") : t("Bisu dibatalkan"),
        tone: "neutral",
      })
    }
  }, [author, isMuted, toast, t])

  const removeCurrent = useCallback(async () => {
    if (!current) return
    const storyId = current.id
    const authorId = current.author.userId
    const res = await runOptimistic(
      () => hideStoryLocal(storyId, authorId),
      () => deleteStory(storyId),
    )
    if (!res.ok) {
      toast.show({ title: t("Story belum terhapus"), description: userMessage(res.error), tone: "danger" })
      return
    }
    toast.show({ title: t("Story dihapus"), tone: "neutral" })
    if (stories.length <= 1) router.back()
  }, [current, stories.length, toast, t])

  const menuActions: ActionSheetItem[] = isOwn
    ? [
        { key: "viewers", label: t("Lihat viewer"), icon: Eye, onPress: () => setViewersOpen(true) },
        { key: "highlight", label: t("Sorot ke profil"), icon: Star, onPress: () => setHighlightOpen(true) },
        { key: "manage", label: t("Kelola story"), icon: Megaphone, onPress: () => router.push(ROUTES.storyManage) },
        { key: "delete", label: t("Hapus story"), icon: Trash, destructive: true, onPress: () => setConfirmDelete(true) },
      ]
    : [
        {
          key: "mute",
          label: isMuted ? t("Batalkan bisu") : t("Bisukan story kontak ini"),
          icon: SpeakerSlash,
          onPress: () => void toggleMute(),
        },
      ]

  // ---- Render ----

  const ringName = author ? author.fullName || `@${author.username}` : ""

  if (!highlightId && feed.loading && !feed.data) {
    return (
      <Screen edges={[]} padded={false} background="background">
        <LoadingScreen message={t("Memuat story…")} />
      </Screen>
    )
  }

  if (!highlightId && feed.error && !feed.data) {
    return (
      <Screen edges={[]} padded={false}>
        <ErrorState
          title={t("Story tidak bisa dibuka")}
          description={feed.error ?? undefined}
          onRetry={feed.reload}
          action={
            <PressableScale onPress={close} accessibilityRole="button" accessibilityLabel={t("Tutup")} className="px-4 py-2">
              <Text variant="body" tone="secondary">{t("Tutup")}</Text>
            </PressableScale>
          }
        />
      </Screen>
    )
  }

  if (!current) {
    return (
      <Screen edges={[]} padded={false}>
        <ErrorState
          title={t("Tidak ada story")}
          description={t("Story sudah habis masa tayangnya atau dihapus.")}
          action={
            <PressableScale onPress={close} accessibilityRole="button" accessibilityLabel={t("Tutup")} className="px-4 py-2">
              <Text variant="body" tone="secondary">{t("Tutup")}</Text>
            </PressableScale>
          }
        />
      </Screen>
    )
  }

  const ago = formatRelativeTime(current.createdAt, serverNow())

  return (
    <View
      className="flex-1 bg-black"
      onLayout={(e) => setLayoutWidth(e.nativeEvent.layout.width)}
      accessibilityLabel={t("Story dari {name}", { name: ringName })}
    >
      {/* Lapisan media + gesture (paling bawah). Latar hitam root (`bg-black`)
          adalah kanvas tempat kartu mengecil & meredup saat ditutup. */}
      <GestureDetector gesture={gesture}>
        <Animated.View style={[{ flex: 1 }, dragStyle, openStyle]}>
          <Animated.View style={[{ flex: 1 }, segmentStyle]}>
            {current.kind === "image" && current.mediaUrl ? (
              <Image
                source={{ uri: current.mediaUrl }}
                style={{ flex: 1 }}
                contentFit="contain"
                cachePolicy="memory-disk"
                transition={0}
                accessibilityLabel={current.text ?? t("Foto story")}
              />
            ) : (
              <View
                className="flex-1 items-center justify-center px-8"
                style={{ backgroundColor: current.backgroundColor ?? "#1F2937" }}
              >
                <Text variant="h2" className="text-center text-white">
                  {current.text ?? ""}
                </Text>
              </View>
            )}
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      {/* Lapisan kontrol (di atas gesture). */}
      <View pointerEvents="box-none" className="absolute inset-0">
        <View className="px-3 pt-2" pointerEvents="box-none">
          <View className="flex-row gap-1">
            {stories.map((s, i) => (
              <SegmentBar key={s.id} index={i} activeIndex={safeIndex} progress={progress} />
            ))}
          </View>
          <View className="mt-3 flex-row items-center gap-3">
            <Avatar source={author?.avatarUrl ?? undefined} name={ringName} size="sm" />
            <View className="flex-1">
              <Text variant="label" weight={600} className="text-white" numberOfLines={1}>
                {ringName}
              </Text>
              <Text variant="caption" className="text-white/80" numberOfLines={1}>
                {ago}
              </Text>
            </View>
            {isOwn ? (
              <Text variant="caption" className="text-white/80">
                {t("{n} dilihat", { n: current.viewCount })}
              </Text>
            ) : null}
            <PressableScale
              onPress={() => setMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t("Opsi story")}
              className="h-10 w-10 items-center justify-center"
            >
              <Icon icon={DotsThree} size="md" tone="inverse" />
            </PressableScale>
            <PressableScale
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel={t("Tutup")}
              className="h-10 w-10 items-center justify-center"
            >
              <Icon icon={X} size="md" tone="inverse" />
            </PressableScale>
          </View>
        </View>

        {/* Tag produk: tap → detail produk. */}
        {current.productTags.map((tag) => (
          <View
            key={tag.productId}
            style={{ position: "absolute", left: `${Math.round(tag.x * 100)}%`, top: `${Math.round(tag.y * 100)}%` }}
          >
            <Pressable
              onPress={() => {
                setHolding(false)
                router.push(ROUTES.showcaseDetail(tag.productId))
              }}
              accessibilityRole="link"
              accessibilityLabel={t("Lihat produk {name}", { name: tag.title || t("produk") })}
              className="flex-row items-center gap-1 rounded-full bg-black/70 px-3 py-1.5"
            >
              <Icon icon={ShoppingBag} size="xs" tone="inverse" />
              <Text variant="caption" weight={600} className="text-white" numberOfLines={1}>
                {tag.title || t("Lihat produk")}
              </Text>
            </Pressable>
          </View>
        ))}

        {/* Stiker harga. */}
        {current.priceSticker ? (
          <View className="absolute left-0 right-0 items-center" style={{ top: "42%" }} pointerEvents="none">
            <View className="rounded-md bg-white px-4 py-2">
              <Text variant="label" weight={700} className="text-black">
                {formatPriceSticker(current.priceSticker.amount)}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Burst reaksi. */}
        {lastBurst ? (
          <Animated.View pointerEvents="none" style={[burstStyle]} className="absolute inset-0 items-center justify-center">
            <Text variant="display" className="text-white">{lastBurst}</Text>
          </Animated.View>
        ) : null}

        {/* Footer: tanya stok, balasan, reaksi — atau viewer untuk pemilik. */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="absolute bottom-0 left-0 right-0"
          pointerEvents="box-none"
        >
          <View className="gap-3 px-3 pb-6 pt-3" pointerEvents="box-none">
            {current.askStock && !isOwn ? (
              <View className="flex-row">
                <PressableScale
                  onPress={() => void askStock()}
                  accessibilityRole="button"
                  accessibilityLabel={t("Tanya stok")}
                  className="flex-row items-center gap-2 rounded-full bg-white px-4 py-2"
                >
                  <Icon icon={ShoppingBag} size="xs" tone="default" />
                  <Text variant="label" weight={600} className="text-black">
                    {t("Tanya Stok")}
                  </Text>
                </PressableScale>
              </View>
            ) : null}

            {isOwn ? (
              <PressableScale
                onPress={() => setViewersOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={t("Lihat viewer")}
                className="flex-row items-center gap-2 self-start rounded-full bg-black/60 px-4 py-2"
              >
                <Icon icon={Eye} size="xs" tone="inverse" />
                <Text variant="label" weight={600} className="text-white">
                  {t("{n} dilihat", { n: current.viewCount })}
                </Text>
              </PressableScale>
            ) : (
              <>
                <View className="flex-row items-center justify-between">
                  {STORY_REACTIONS.map((emoji) => (
                    <PressableScale
                      key={emoji}
                      onPress={() => void react(emoji)}
                      accessibilityRole="button"
                      accessibilityLabel={t("Beri reaksi {emoji}", { emoji })}
                      accessibilityState={{ selected: reactionFor === emoji }}
                      className={`h-11 w-11 items-center justify-center rounded-full ${
                        reactionFor === emoji ? "bg-white/30" : ""
                      }`}
                    >
                      <Text variant="bodyLarge">{emoji}</Text>
                    </PressableScale>
                  ))}
                </View>
                <View className="flex-row items-center gap-2">
                  <TextInput
                    value={replyText}
                    onChangeText={setReplyText}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    placeholder={t("Balas story…")}
                    placeholderTextColor="#D1D5DB"
                    maxLength={200}
                    returnKeyType="send"
                    onSubmitEditing={() => void sendReply()}
                    accessibilityLabel={t("Balas story")}
                    className="flex-1 rounded-full border border-white/40 bg-black/50 px-4 py-2.5 text-white"
                  />
                  <PressableScale
                    onPress={() => void sendReply()}
                    disabled={replyBusy || replyText.trim().length === 0}
                    accessibilityRole="button"
                    accessibilityLabel={t("Kirim balasan")}
                    className="h-11 w-11 items-center justify-center rounded-full bg-white"
                  >
                    <Icon icon={PaperPlaneRight} size="sm" tone="default" />
                  </PressableScale>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>

      <ActionSheet
        visible={menuOpen}
        onRequestClose={() => setMenuOpen(false)}
        title={ringName}
        actions={menuActions}
      />

      <StoryViewersSheet
        visible={viewersOpen}
        storyId={current.id}
        onRequestClose={() => setViewersOpen(false)}
      />

      <StoryHighlightSheet
        visible={highlightOpen}
        storyId={current.id}
        onRequestClose={() => setHighlightOpen(false)}
      />

      <Dialog
        title={t("Hapus story ini?")}
        description={t("Story akan hilang dari semua orang yang bisa melihatnya.")}
        visible={confirmDelete}
        destructive
        confirmLabel={t("Hapus")}
        cancelLabel={t("Batal")}
        onConfirm={() => {
          setConfirmDelete(false)
          void removeCurrent()
        }}
        onCancel={() => setConfirmDelete(false)}
        onRequestClose={() => setConfirmDelete(false)}
      />
    </View>
  )
}

/** Satu segmen progress. Segmen aktif memakai shared value; lainnya statis. */
function SegmentBar({
  index,
  activeIndex,
  progress,
}: {
  index: number
  activeIndex: number
  progress: SharedValue<number>
}) {
  const activeStyle = useAnimatedStyle(() => ({ width: `${Math.round(progress.value * 100)}%` }))
  if (index < activeIndex) return <View className="h-[3px] flex-1 rounded-full bg-white" />
  if (index > activeIndex) return <View className="h-[3px] flex-1 rounded-full bg-white/30" />
  return (
    <View className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
      <Animated.View className="h-[3px] rounded-full bg-white" style={activeStyle} />
    </View>
  )
}

