/**
 * Kahade — viewer story fullscreen (`/story/[userId]`).
 *
 * Perilaku (ala Instagram/WhatsApp Status):
 *   - Progress bar per story; segmen aktif diisi lewat SATU shared value yang
 *     dianimasikan di UI thread (`withTiming`). Foto/teks 5 dtk; VIDEO
 *     mengikuti posisi pemutar (event `timeUpdate`) — buffering otomatis
 *     menahan bar, dan segmen baru mulai saat media SIAP (bukan saat mount).
 *   - Tap kiri/kanan → mundur/maju (lib/story/playback.ts). Di ujung penulis
 *     → penulis berikutnya dari tray; di ujung terakhir → tutup.
 *   - GESER KIRI/KANAN → penulis berikutnya/sebelumnya (2026-10-10). Viewer
 *     TETAP satu layar: penulis diganti sebagai state, feed tetangga sudah
 *     di-prefetch (lib/story/feed-cache.ts), jadi tidak ada layar loading
 *     putih di antaranya (dulu `router.replace` me-mount ulang layar).
 *   - Tekan-tahan / sedang menggeser / sheet terbuka / app ke latar → pause.
 *   - Geser ke bawah → tutup. Lapisan kontrol diletakkan DI ATAS lapisan
 *     gesture, jadi sentuhan tidak saling menelan.
 *   - Area atas/bawah menghormati safe-area (progress bar tidak lagi tenggelam
 *     di balik notch) dan status bar dipaksa terang di atas latar hitam.
 *
 * Motion:
 *   - BUKA: mengembang dari 0.92 + fade (220ms). TUTUP: turun + mengecil ke
 *     0.86 + membulat sementara latar meredup. GANTI SEGMEN: crossfade + zoom
 *     halus. Semua updater `useAnimatedStyle` murni membaca shared value.
 *
 * Interaksi (semua optimistis + rollback):
 *   - tandai dilihat (server dipanggil setelah story tampil ≥ 0,6 dtk —
 *     tap cepat 10 story tidak menembak 10 POST),
 *   - reaksi emoji cepat (ketuk ulang = hapus reaksi),
 *   - balas → chat ke pemilik; tanya stok → draft chat,
 *   - bisukan kontak, LAPORKAN story, bagikan profil; story sendiri: hapus,
 *     lihat viewer, sorot.
 *   - mode SOROTAN (`highlightId`): arsip permanen — hanya tonton & tag
 *     produk; reaksi/balas/tandai-dilihat dimatikan (story asli bisa sudah
 *     kedaluwarsa → 404).
 */
import { router } from "expo-router"
import { Image } from "expo-image"
import { StatusBar } from "expo-status-bar"
import {
  DotsThree,
  Eye,
  Flag,
  PaperPlaneRight,
  ShareNetwork,
  ShoppingBag,
  SpeakerHigh,
  SpeakerSlash,
  SpeakerX,
  Star,
  Trash,
  X,
  Megaphone,
  WarningCircle,
} from "phosphor-react-native"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AppState, KeyboardAvoidingView, Platform, Pressable, TextInput, View, useWindowDimensions } from "react-native"
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
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { ActionSheet, type ActionSheetItem } from "@/components/ui/action-sheet"
import { Avatar } from "@/components/ui/avatar"
import { Dialog } from "@/components/ui/modal"
import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Spinner } from "@/components/ui/spinner"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"
import { isExpoVideoAvailable } from "@/components/ui/feed-video"
import { StoryHighlightSheet } from "@/components/story/story-highlight-sheet"
import { StoryReportSheet } from "@/components/story/story-report-sheet"
import { StoryVideo } from "@/components/story/story-video"
import { StoryViewersSheet } from "@/components/story/story-viewers-sheet"
import { getOrCreateDm } from "@/lib/api/chat"
import { userMessage } from "@/lib/api/errors"
import {
  STORY_REACTIONS,
  STORY_TEXT_MAX,
  deleteStory,
  getStoryHighlights,
  getStoryTray,
  getUserStories,
  isStoryActive,
  markStoryViewed,
  muteStoryAuthor,
  replyToStory,
  setStoryReaction,
  unmuteStoryAuthor,
  type Story,
  type StoryAuthor,
  type StoryHighlight,
  type StoryReaction,
  type StoryUserStories,
} from "@/lib/api/story"
import { getMeCached, type UserProfile } from "@/lib/api/users"
import { profileUrl } from "@/lib/deeplinks"
import { formatPriceSticker, askStockPrefill } from "@/lib/story/compose"
import { createFeedCache } from "@/lib/story/feed-cache"
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
  clampIndex,
  remainingSegmentMs,
  segmentDurationMs,
  stepBack,
  stepForward,
  swipeAuthorAction,
  tapActionAt,
} from "@/lib/story/playback"
import { saveChatDraft } from "@/lib/chat-drafts"
import { formatRelativeTime } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { useT } from "@/lib/i18n"
import { useStoryRealtime } from "@/lib/realtime/use-story-realtime"
import { ROUTES } from "@/lib/routes"
import { serverNow } from "@/lib/server-time"
import { shareContent } from "@/lib/share"
import { useApiQuery } from "@/lib/use-api-query"

type Props = {
  userId: string
  highlightId: string | null
}

type Sequence = { userId: string; hasStories: boolean }

type FeedState = {
  status: "loading" | "ready" | "error"
  author: StoryAuthor | null
  stories: Story[]
  error: string | null
}

/** Feed per penulis (story aktif) & arsip sorotan — dipakai lintas pembukaan viewer. */
const feedCache = createFeedCache<StoryUserStories>({ ttlMs: 60_000, max: 12 })
const highlightCache = createFeedCache<StoryHighlight[]>({ ttlMs: 120_000, max: 8 })
/** Story yang sudah dilaporkan di sesi ini (menu menampilkan "Sudah dilaporkan"). */
const reportedStoryIds = new Set<string>()
/** Preferensi suara video story — sesi berjalan (Instagram mengingat pilihan terakhir). */
let storySoundMuted = false

/** Jeda sebelum view dikirim ke server — kontrak: "dipanggil saat story tampil ≥ 1 detik". */
const MARK_VIEWED_DELAY_MS = 600

const FEED_LOADING: FeedState = { status: "loading", author: null, stories: [], error: null }

/**
 * State feed DIKUNCI ke kunci penulis+sorotan. Tanpa kunci ini, saat penulis
 * berganti (geser/tap) state lama masih dipakai satu render sebelum effect
 * memuat yang baru — story penulis sebelumnya berkedip di bawah nama penulis
 * baru, dan `current.id` yang salah sempat masuk ke efek tandai-dilihat.
 */
type KeyedFeedState = FeedState & { key: string }

function useAuthorFeed(userId: string, highlightId: string | null, revision: number) {
  const key = `${userId}|${highlightId ?? ""}`
  const readFromCache = useCallback((): FeedState | null => {
    if (highlightId) {
      const list = highlightCache.get(userId)
      if (!list) return null
      return toHighlightState(list, highlightId)
    }
    const feed = feedCache.get(userId)
    return feed ? { status: "ready", author: feed.author, stories: feed.stories, error: null } : null
  }, [userId, highlightId])

  const [state, setState] = useState<KeyedFeedState>(() => ({ key, ...(readFromCache() ?? FEED_LOADING) }))
  const generation = useRef(0)

  const load = useCallback(
    (opts: { silent: boolean }) => {
      const gen = ++generation.current
      const cached = opts.silent ? null : readFromCache()
      if (cached) {
        setState({ key, ...cached })
        return
      }
      if (!opts.silent) {
        setState((prev) =>
          prev.key === key && prev.status === "ready" ? prev : { key, ...FEED_LOADING, author: prev.key === key ? prev.author : null },
        )
      }
      const run = highlightId
        ? highlightCache.load(userId, () => getStoryHighlights(userId)).then((list) => toHighlightState(list, highlightId))
        : feedCache
            .load(userId, () => getUserStories(userId))
            .then((feed): FeedState => ({ status: "ready", author: feed.author, stories: feed.stories, error: null }))
      run
        .then((next) => {
          if (gen === generation.current) setState({ key, ...next })
        })
        .catch((err: unknown) => {
          if (gen !== generation.current) return
          setState((prev) =>
            prev.key === key && prev.status === "ready"
              ? prev
              : { key, status: "error", author: prev.key === key ? prev.author : null, stories: [], error: userMessage(err) },
          )
        })
    },
    [key, userId, highlightId, readFromCache],
  )

  useEffect(() => {
    load({ silent: false })
  }, [load])

  // Mutasi story sukses (hapus/sorot/buat) → segarkan diam, data lama tetap tampil.
  const seenRevision = useRef(revision)
  useEffect(() => {
    if (seenRevision.current === revision) return
    seenRevision.current = revision
    feedCache.invalidate(userId)
    highlightCache.invalidate(userId)
    load({ silent: true })
  }, [revision, userId, load])

  const reload = useCallback(() => {
    feedCache.invalidate(userId)
    highlightCache.invalidate(userId)
    setState((prev) => ({ ...prev, key, status: "loading", error: null }))
    load({ silent: true })
  }, [key, userId, load])

  // Kunci tidak cocok (penulis baru, effect belum jalan): cache atau loading — bukan data penulis lama.
  const view: FeedState = state.key === key ? state : (readFromCache() ?? FEED_LOADING)
  return { ...view, reload, silentReload: () => load({ silent: true }) }
}

function toHighlightState(list: StoryHighlight[], highlightId: string): FeedState {
  const hl = list.find((h) => h.id === highlightId)
  const stories = hl?.stories ?? []
  return { status: "ready", author: stories[0]?.author ?? null, stories, error: null }
}

export default function StoryViewerScreen({ userId: routeUserId, highlightId }: Props) {
  const t = useT()
  const toast = useToast()
  const insets = useSafeAreaInsets()
  const local = useStoryLocal()

  // Penulis aktif = STATE (bukan rute): geser/tap antar penulis tidak me-mount ulang layar.
  const [userId, setUserId] = useState(routeUserId)
  useEffect(() => {
    setUserId(routeUserId)
  }, [routeUserId])

  const meQuery = useApiQuery<UserProfile | null>("story-viewer-me", (signal) => getMeCached(signal))
  const myUserId = meQuery.data?.userId ?? meQuery.data?.id ?? null

  const feed = useAuthorFeed(userId, highlightId, local.revision)
  const trayQuery = useApiQuery("story-tray", (signal) => getStoryTray(signal))
  useStoryRealtime(() => {
    feedCache.invalidate()
    feed.silentReload()
    trayQuery.refresh()
  })

  const author = feed.author
  const isOwn = myUserId !== null && userId === myUserId
  const isHighlight = highlightId !== null
  const videoPlayable = useMemo(() => isExpoVideoAvailable(), [])

  /** Story aktif, belum dihapus (optimistis), urut pemutaran. Sorotan: apa adanya. */
  const stories = useMemo<Story[]>(() => {
    if (isHighlight) return feed.stories
    const now = serverNow()
    return feed.stories.filter((s) => !local.hiddenStoryIds.has(s.id) && isStoryActive(s, now))
  }, [feed.stories, local.hiddenStoryIds, isHighlight])

  /** Urutan penulis untuk maju/mundur — sama dengan urutan tray. */
  const sequence = useMemo<Sequence[]>(() => {
    if (!trayQuery.data || isHighlight) return []
    const view = applyTrayOverlay(trayQuery.data, local, myUserId ?? undefined)
    const list: Sequence[] = []
    if (view.own) list.push({ userId: view.own.author.userId, hasStories: view.own.storyCount > 0 })
    for (const e of view.others) list.push({ userId: e.author.userId, hasStories: e.storyCount > 0 })
    return list.filter((x) => x.hasStories)
  }, [trayQuery.data, local, myUserId, isHighlight])

  const seqIndex = sequence.findIndex((s) => s.userId === userId)
  const nextAuthorId = seqIndex >= 0 ? (sequence[seqIndex + 1]?.userId ?? null) : null
  const prevAuthorId = seqIndex > 0 ? (sequence[seqIndex - 1]?.userId ?? null) : null

  const [index, setIndex] = useState(0)
  const [holding, setHolding] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [backgrounded, setBackgrounded] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [viewersOpen, setViewersOpen] = useState(false)
  const [highlightOpen, setHighlightOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [replyText, setReplyText] = useState("")
  const [replyBusy, setReplyBusy] = useState(false)
  const [soundMuted, setSoundMuted] = useState(storySoundMuted)
  /** Media siap / gagal — dikunci ke id story supaya onLoad yang mendahului efek tidak hilang. */
  const [readyId, setReadyId] = useState<string | null>(null)
  const [errorId, setErrorId] = useState<string | null>(null)
  /** Naik tiap "Coba lagi" media — ikut masuk `key` supaya pemutar/gambar benar-benar di-mount ulang. */
  const [mediaAttempt, setMediaAttempt] = useState(0)
  /** Hanya pemicu render ulang menu setelah story dilaporkan (`reportedStoryIds` modul). */
  const [, bumpReported] = useState(0)

  const safeIndex = clampIndex(index, stories.length)
  const current = stories[safeIndex] ?? null
  const paused =
    holding ||
    dragging ||
    backgrounded ||
    inputFocused ||
    menuOpen ||
    viewersOpen ||
    highlightOpen ||
    reportOpen ||
    confirmDelete
  const isVideoSegment = current?.kind === "video" && videoPlayable
  const mediaReady = current ? current.kind === "text" || readyId === current.id : false
  const mediaError = current ? errorId === current.id : false

  // App ke latar → pause (video tetap bersuara kalau tidak).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => setBackgrounded(state !== "active"))
    return () => sub.remove()
  }, [])

  // ---- Navigasi antar penulis / tutup (dipanggil dari JS, tidak dari worklet) ----

  /**
   * 2026-10-08 (temuan #17): tutup story TIDAK boleh hanya `router.back()`.
   * Pada cold start dari deep link `/story/<id>` adalah SATU-SATUNYA entri
   * stack — `router.back()` no-op = pengguna terjebak. Fallback `/chat`
   * (tray story hidup di sana).
   */
  const closeStory = useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace(ROUTES.chat)
  }, [])

  const progress = useSharedValue(0)
  const segmentIdRef = useRef<string | null>(null)
  const dragX = useSharedValue(0)

  const switchAuthor = useCallback(
    (id: string) => {
      haptic("select")
      segmentIdRef.current = null
      cancelAnimation(progress)
      progress.value = 0
      dragX.value = 0
      setIndex(0)
      setReplyText("")
      setUserId(id)
      // URL tetap sinkron (share/deep link/back) tanpa me-mount ulang layar.
      router.setParams({ userId: id })
    },
    [progress, dragX],
  )

  const goNextAuthor = useCallback(() => {
    if (nextAuthorId) switchAuthor(nextAuthorId)
    else closeStory()
  }, [nextAuthorId, switchAuthor, closeStory])

  const goPrevAuthor = useCallback(() => {
    if (prevAuthorId) switchAuthor(prevAuthorId)
  }, [prevAuthorId, switchAuthor])

  const advance = useCallback(() => {
    const step = stepForward(safeIndex, stories.length, nextAuthorId !== null)
    if (step.kind === "index") setIndex(step.index)
    else if (step.kind === "next-author") goNextAuthor()
    else closeStory()
  }, [safeIndex, stories.length, nextAuthorId, goNextAuthor, closeStory])

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

  useEffect(() => {
    if (!current) return
    if (segmentIdRef.current !== current.id) {
      cancelAnimation(progress)
      progress.value = 0
      segmentIdRef.current = current.id
    }
    // Video yang bisa diputar: bar mengikuti posisi pemutar (lihat onVideoProgress).
    if (isVideoSegment) {
      if (paused) cancelAnimation(progress)
      return
    }
    if (paused || !mediaReady) {
      cancelAnimation(progress)
      return
    }
    const duration = segmentDurationMs(current, { videoPlayable })
    const remaining = remainingSegmentMs(progress.value, duration)
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
  }, [current, paused, mediaReady, isVideoSegment, videoPlayable, progress, onSegmentDone])

  const onVideoProgress = useCallback(
    (fraction: number) => {
      // Dipanggil ~5×/dtk: animasikan ke posisi berikutnya supaya bar mulus, bukan melompat.
      progress.value = withTiming(fraction, { duration: 220, easing: Easing.linear })
    },
    [progress],
  )
  const onVideoReady = useCallback(() => {
    if (current) setReadyId(current.id)
  }, [current])
  const onVideoEnded = useCallback(() => {
    progress.value = 1
    onSegmentDone()
  }, [progress, onSegmentDone])
  const onMediaError = useCallback(() => {
    if (current) setErrorId(current.id)
  }, [current])

  // ---- Prefetch tetangga: feed penulis berikutnya + media story berikutnya ----

  useEffect(() => {
    if (!nextAuthorId || isHighlight) return
    void feedCache.load(nextAuthorId, () => getUserStories(nextAuthorId)).catch(() => undefined)
  }, [nextAuthorId, isHighlight])

  useEffect(() => {
    const next = stories[safeIndex + 1]
    const nextFeed = nextAuthorId ? feedCache.peek(nextAuthorId) : null
    const candidates = [next, nextFeed?.stories[0]]
    for (const s of candidates) {
      if (!s) continue
      // Hanya gambar/poster — berkas video tidak pernah di-prefetch (boros kuota).
      const url = s.kind === "image" ? s.mediaUrl : s.kind === "video" ? s.thumbnailUrl : null
      if (url) Image.prefetch(url, "memory-disk").catch(() => undefined)
    }
  }, [stories, safeIndex, nextAuthorId])

  // ---- Tandai dilihat (optimistis; server setelah tampil ≥ 0,6 dtk) ----

  useEffect(() => {
    if (!current || isOwn || isHighlight) return
    const isLast = safeIndex === stories.length - 1
    const undoStory = markStorySeenLocal(current.id)
    const undoAuthor = isLast ? markAuthorSeenLocal(userId, true) : null
    if (current.viewed) return
    const timer = setTimeout(() => {
      markStoryViewed(current.id).catch(() => {
        undoStory()
        undoAuthor?.()
      })
    }, MARK_VIEWED_DELAY_MS)
    return () => clearTimeout(timer)
    // Hanya bergantung pada story aktif; `stories` diturunkan darinya.
  }, [current?.id, isOwn, isHighlight, safeIndex, stories.length, userId])

  // ---- Gesture ----

  // Awal = lebar jendela (bukan 1 px): ambang geser 30% lebar sudah benar sebelum onLayout pertama.
  const { width: windowWidth } = useWindowDimensions()
  const [layoutWidth, setLayoutWidth] = useState(Math.max(1, windowWidth))
  const dragY = useSharedValue(0)
  /**
   * Progress tutup (0 = terbuka, 1 = tertutup). Satu sumber untuk skala,
   * radius, dan redup latar — dihitung dari `dragY` di dalam worklet.
   */
  const dismissProgress = useSharedValue(0)
  const dragStyle = useAnimatedStyle(() => {
    const p = dismissProgress.value
    return {
      transform: [{ translateX: dragX.value }, { translateY: dragY.value }, { scale: 1 - p * 0.14 }],
      opacity: 1 - p * 0.35,
      borderRadius: p * 24,
      overflow: "hidden",
    }
  })
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

  const onSwipeEnd = useCallback(
    (translationX: number, velocityX: number) => {
      const action = swipeAuthorAction(translationX, velocityX, layoutWidth, {
        hasNext: nextAuthorId !== null,
        hasPrev: prevAuthorId !== null,
      })
      if (action === "none") {
        dragX.value = withSpring(0, { damping: 22, stiffness: 240 })
        return
      }
      const target = action === "next" ? -layoutWidth : layoutWidth
      const go = action === "next" ? goNextAuthor : goPrevAuthor
      dragX.value = withTiming(target, { duration: 160, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(go)()
      })
    },
    [layoutWidth, nextAuthorId, prevAuthorId, dragX, goNextAuthor, goPrevAuthor],
  )
  const onSwipeEndRef = useRef(onSwipeEnd)
  onSwipeEndRef.current = onSwipeEnd
  const swipeEnd = useCallback((tx: number, vx: number) => onSwipeEndRef.current(tx, vx), [])

  const hasNext = nextAuthorId !== null
  const hasPrev = prevAuthorId !== null

  const panY = Gesture.Pan()
    .activeOffsetY(14)
    .failOffsetX([-18, 18])
    .onStart(() => {
      runOnJS(setDragging)(true)
    })
    .onUpdate((e) => {
      dragY.value = Math.max(0, e.translationY)
      dismissProgress.value = Math.min(1, Math.max(0, dragY.value / 320))
    })
    .onEnd((e) => {
      if (e.translationY > 140 || e.velocityY > 900) {
        dismissProgress.value = withTiming(1, { duration: 180 })
        dragY.value = withTiming(800, { duration: 180 }, (finished) => {
          if (finished) runOnJS(closeStory)()
        })
      } else {
        dismissProgress.value = withSpring(0, { damping: 22, stiffness: 240 })
        dragY.value = withSpring(0, { damping: 22, stiffness: 240 })
      }
    })
    .onFinalize(() => {
      runOnJS(setDragging)(false)
    })

  const panX = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-16, 16])
    .onStart(() => {
      runOnJS(setDragging)(true)
    })
    .onUpdate((e) => {
      // Ke arah tanpa tetangga: ikut sedikit saja (karet) — isyarat "tidak ada lagi".
      const blocked = (e.translationX < 0 && !hasNext) || (e.translationX > 0 && !hasPrev)
      dragX.value = blocked ? e.translationX * 0.25 : e.translationX
    })
    .onEnd((e) => {
      runOnJS(swipeEnd)(e.translationX, e.velocityX)
    })
    .onFinalize(() => {
      runOnJS(setDragging)(false)
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

  const gesture = Gesture.Exclusive(panY, panX, Gesture.Race(tap, hold))

  // ---- Reaksi (optimistis; ketuk ulang = hapus) ----

  const burst = useSharedValue(0)
  const burstStyle = useAnimatedStyle(() => ({
    opacity: burst.value > 0 ? 1 : 0,
    transform: [{ scale: 0.6 + burst.value * 0.8 }],
  }))
  const [lastBurst, setLastBurst] = useState<StoryReaction | null>(null)

  const reactionFor = current
    ? local.reactions.has(current.id)
      ? (local.reactions.get(current.id) ?? null)
      : current.myReaction
    : null

  const react = useCallback(
    async (emoji: StoryReaction) => {
      if (!current) return
      const storyId = current.id
      const removing = reactionFor === emoji
      haptic("select")
      if (!removing) {
        setLastBurst(emoji)
        burst.value = withSequence(withTiming(1, { duration: 160 }), withTiming(0, { duration: 420 }))
      }
      const next = removing ? null : emoji
      const res = await runOptimistic(
        () => setReactionLocal(storyId, next),
        () => setStoryReaction(storyId, next),
      )
      if (!res.ok) {
        haptic("error")
        toast.show({
          title: removing ? t("Reaksi belum dihapus") : t("Reaksi gagal dikirim"),
          description: userMessage(res.error),
          tone: "danger",
        })
      }
    },
    [current, reactionFor, burst, toast, t],
  )

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
    if (stories.length <= 1) closeStory()
  }, [current, stories.length, toast, t, closeStory])

  const shareProfile = useCallback(async () => {
    if (!author) return
    const name = author.fullName || `@${author.username}`
    await shareContent({
      url: profileUrl(author.username),
      message: t("Lihat story {name} di Kahade", { name }),
      title: t("Bagikan profil"),
    })
  }, [author, t])

  const toggleSound = useCallback(() => {
    setSoundMuted((prev) => {
      storySoundMuted = !prev
      return !prev
    })
  }, [])

  const alreadyReported = current ? reportedStoryIds.has(current.id) : false
  const menuActions: ActionSheetItem[] = isHighlight
    ? [{ key: "share", label: t("Bagikan profil"), icon: ShareNetwork, onPress: () => void shareProfile() }]
    : isOwn
      ? [
          { key: "viewers", label: t("Lihat viewer"), icon: Eye, onPress: () => setViewersOpen(true) },
          { key: "highlight", label: t("Sorot ke profil"), icon: Star, onPress: () => setHighlightOpen(true) },
          { key: "share", label: t("Bagikan profil"), icon: ShareNetwork, onPress: () => void shareProfile() },
          { key: "manage", label: t("Kelola story"), icon: Megaphone, onPress: () => router.push(ROUTES.storyManage) },
          { key: "delete", label: t("Hapus story"), icon: Trash, destructive: true, onPress: () => setConfirmDelete(true) },
        ]
      : [
          { key: "share", label: t("Bagikan profil"), icon: ShareNetwork, onPress: () => void shareProfile() },
          {
            key: "mute",
            label: isMuted ? t("Batalkan bisu") : t("Bisukan story kontak ini"),
            icon: SpeakerSlash,
            onPress: () => void toggleMute(),
          },
          {
            key: "report",
            label: alreadyReported ? t("Sudah dilaporkan") : t("Laporkan story"),
            icon: Flag,
            destructive: !alreadyReported,
            disabled: alreadyReported,
            onPress: () => setReportOpen(true),
          },
        ]

  // ---- Render ----

  const ringName = author ? author.fullName || `@${author.username}` : ""
  const topPad = Math.max(insets.top, 8)
  const bottomPad = Math.max(insets.bottom, 16)

  if (feed.status === "loading" && !current) {
    return (
      <View className="flex-1 bg-black" style={{ paddingTop: topPad }} accessibilityLabel={t("Memuat story…")}>
        <StatusBar style="light" />
        <View className="px-3 pt-2">
          <View className="flex-row gap-1">
            {[0, 1, 2].map((i) => (
              <View key={i} className="h-[3px] flex-1 rounded-full bg-white/20" />
            ))}
          </View>
          <View className="mt-3 flex-row items-center gap-3">
            <View className="h-8 w-8 rounded-full bg-white/15" />
            <View className="h-3 w-28 rounded-full bg-white/15" />
            <View className="flex-1" />
            <CloseButton onPress={closeStory} label={t("Tutup")} />
          </View>
        </View>
        <View className="flex-1 items-center justify-center">
          <Spinner tone="inverse" />
        </View>
      </View>
    )
  }

  if (feed.status === "error" && !current) {
    return (
      <ViewerMessage
        topPad={topPad}
        title={t("Story tidak bisa dibuka")}
        description={feed.error ?? undefined}
        primaryLabel={t("Coba lagi")}
        onPrimary={feed.reload}
        closeLabel={t("Tutup")}
        onClose={closeStory}
      />
    )
  }

  if (!current) {
    return (
      <ViewerMessage
        topPad={topPad}
        title={t("Tidak ada story")}
        description={t("Story sudah habis masa tayangnya atau dihapus.")}
        closeLabel={t("Tutup")}
        onClose={closeStory}
      />
    )
  }

  const ago = formatRelativeTime(current.createdAt, serverNow())
  const caption = current.kind !== "text" ? current.text?.trim() || null : null
  const mediaLabel =
    current.kind === "video" ? t("Video story") : current.kind === "image" ? t("Foto story") : t("Story teks")

  return (
    <View
      className="flex-1 bg-black"
      onLayout={(e) => setLayoutWidth(e.nativeEvent.layout.width)}
      accessibilityLabel={t("Story dari {name}", { name: ringName })}
    >
      <StatusBar style="light" />
      {/* Lapisan media + gesture (paling bawah). */}
      <GestureDetector gesture={gesture}>
        <Animated.View style={[{ flex: 1 }, dragStyle, openStyle]}>
          <Animated.View style={[{ flex: 1 }, segmentStyle]}>
            {current.kind === "image" && current.mediaUrl ? (
              <Image
                key={`${current.id}:${mediaAttempt}`}
                source={{ uri: current.mediaUrl }}
                style={{ flex: 1 }}
                contentFit="contain"
                cachePolicy="memory-disk"
                priority="high"
                transition={0}
                onLoad={() => setReadyId(current.id)}
                onError={onMediaError}
                accessibilityLabel={current.text ?? t("Foto story")}
              />
            ) : current.kind === "video" && current.mediaUrl ? (
              isVideoSegment ? (
                <StoryVideo
                  key={`${current.id}:${mediaAttempt}`}
                  uri={current.mediaUrl}
                  poster={current.thumbnailUrl}
                  paused={paused || mediaError}
                  muted={soundMuted}
                  onReady={onVideoReady}
                  onProgress={onVideoProgress}
                  onEnded={onVideoEnded}
                  onError={onMediaError}
                  accessibilityLabel={current.text ?? t("Video story")}
                />
              ) : (
                <View className="flex-1">
                  {current.thumbnailUrl ? (
                    <Image
                      key={`${current.id}:${mediaAttempt}`}
                      source={{ uri: current.thumbnailUrl }}
                      style={{ flex: 1 }}
                      contentFit="contain"
                      cachePolicy="memory-disk"
                      transition={0}
                      onLoad={() => setReadyId(current.id)}
                      onError={onMediaError}
                      accessibilityLabel={current.text ?? t("Video story")}
                    />
                  ) : (
                    <View className="flex-1" onLayout={() => setReadyId(current.id)} />
                  )}
                  <View className="absolute inset-x-0 bottom-28 items-center" pointerEvents="none">
                    <View className="rounded-full bg-black/60 px-3 py-1.5">
                      <Text variant="caption" className="text-white">
                        {t("Perbarui aplikasi untuk memutar video")}
                      </Text>
                    </View>
                  </View>
                </View>
              )
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

      {/* Media belum siap: indikator kecil, bar progress menunggu. */}
      {!mediaReady && !mediaError ? (
        <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
          <Spinner tone="inverse" />
        </View>
      ) : null}
      {mediaError ? (
        <View className="absolute inset-0 items-center justify-center px-8" pointerEvents="box-none">
          <View className="items-center gap-3 rounded-md bg-black/70 px-5 py-4">
            <Icon icon={WarningCircle} size="md" tone="inverse" />
            <Text variant="label" weight={600} className="text-center text-white">
              {t("{media} gagal dimuat", { media: mediaLabel })}
            </Text>
            <View className="flex-row gap-2">
              <PressableScale
                onPress={() => {
                  // Key media berubah → expo-image/pemutar memulai permintaan baru (bukan hanya hapus overlay).
                  setErrorId(null)
                  setReadyId(null)
                  setMediaAttempt((n) => n + 1)
                }}
                accessibilityRole="button"
                accessibilityLabel={t("Coba lagi")}
                className="rounded-full bg-white px-4 py-2"
              >
                <Text variant="label" weight={600} className="text-black">{t("Coba lagi")}</Text>
              </PressableScale>
              <PressableScale
                onPress={() => advanceRef.current()}
                accessibilityRole="button"
                accessibilityLabel={t("Lewati")}
                className="rounded-full border border-white/40 px-4 py-2"
              >
                <Text variant="label" weight={600} className="text-white">{t("Lewati")}</Text>
              </PressableScale>
            </View>
          </View>
        </View>
      ) : null}

      {/* Lapisan kontrol (di atas gesture). */}
      <View pointerEvents="box-none" className="absolute inset-0">
        <View className="px-3" style={{ paddingTop: topPad + 6 }} pointerEvents="box-none">
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
                {isHighlight ? t("Sorotan") : ago}
              </Text>
            </View>
            {isVideoSegment ? (
              <PressableScale
                onPress={toggleSound}
                accessibilityRole="button"
                accessibilityLabel={soundMuted ? t("Nyalakan suara") : t("Matikan suara")}
                accessibilityState={{ selected: !soundMuted }}
                className="h-10 w-10 items-center justify-center"
              >
                <Icon icon={soundMuted ? SpeakerX : SpeakerHigh} size="md" tone="inverse" />
              </PressableScale>
            ) : null}
            <PressableScale
              onPress={() => setMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t("Opsi story")}
              className="h-10 w-10 items-center justify-center"
            >
              <Icon icon={DotsThree} size="md" tone="inverse" />
            </PressableScale>
            <CloseButton onPress={closeStory} label={t("Tutup")} />
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

        {/* Footer: caption, tanya stok, balasan, reaksi — atau viewer untuk pemilik. */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="absolute bottom-0 left-0 right-0"
          pointerEvents="box-none"
        >
          <View className="gap-3 px-3 pt-3" style={{ paddingBottom: bottomPad }} pointerEvents="box-none">
            {caption ? (
              <View className="items-center" pointerEvents="none">
                <View className="rounded-md bg-black/60 px-3 py-2">
                  <Text variant="body" weight={600} className="text-center text-white" numberOfLines={4}>
                    {caption}
                  </Text>
                </View>
              </View>
            ) : null}

            {current.askStock && !isOwn && !isHighlight ? (
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

            {isHighlight ? null : isOwn ? (
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
                      accessibilityLabel={
                        reactionFor === emoji ? t("Hapus reaksi {emoji}", { emoji }) : t("Beri reaksi {emoji}", { emoji })
                      }
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
                    maxLength={STORY_TEXT_MAX}
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

      <StoryReportSheet
        visible={reportOpen}
        storyId={current.id}
        onRequestClose={() => setReportOpen(false)}
        onReported={(id) => {
          reportedStoryIds.add(id)
          bumpReported((n) => n + 1)
        }}
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

function CloseButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-10 w-10 items-center justify-center"
    >
      <Icon icon={X} size="md" tone="inverse" />
    </PressableScale>
  )
}

/** Pesan di atas latar hitam viewer (galat/kosong) — tanpa layar putih. */
function ViewerMessage({
  topPad,
  title,
  description,
  primaryLabel,
  onPrimary,
  closeLabel,
  onClose,
}: {
  topPad: number
  title: string
  description?: string
  primaryLabel?: string
  onPrimary?: () => void
  closeLabel: string
  onClose: () => void
}) {
  return (
    <View className="flex-1 bg-black" style={{ paddingTop: topPad }}>
      <StatusBar style="light" />
      <View className="flex-row justify-end px-3 pt-2">
        <CloseButton onPress={onClose} label={closeLabel} />
      </View>
      <View className="flex-1 items-center justify-center gap-3 px-8">
        <Text variant="h3" className="text-center text-white">{title}</Text>
        {description ? (
          <Text variant="body" className="text-center text-white/80">{description}</Text>
        ) : null}
        <View className="mt-2 flex-row gap-2">
          {primaryLabel && onPrimary ? (
            <PressableScale
              onPress={onPrimary}
              accessibilityRole="button"
              accessibilityLabel={primaryLabel}
              className="rounded-full bg-white px-5 py-2.5"
            >
              <Text variant="label" weight={600} className="text-black">{primaryLabel}</Text>
            </PressableScale>
          ) : null}
          <PressableScale
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
            className="rounded-full border border-white/40 px-5 py-2.5"
          >
            <Text variant="label" weight={600} className="text-white">{closeLabel}</Text>
          </PressableScale>
        </View>
      </View>
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
