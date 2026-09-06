/**
 * Screen — Profil Publik User (Binance Social / Creator Profile style)
 *
 * Menggabungkan layout sosial modern:
 *  - Cover Banner dengan floating navigation bar (Back, Search, Share, More).
 *  - Avatar bulat besar (overlapping banner) dengan badge verifikasi.
 *  - Action row (Ikuti / Edit profil, Transaksi, Chat, Favorit).
 *  - Identitas (Nama lengkap, @username, Bio multi-line).
 *  - Counter statistik interaktif (Mengikuti, Pengikut, Ulasan, Skor Kepercayaan).
 *  - Tab navigasi in-page: Konten (Showcase), Tanya Jawab (Q&A), Ulasan (Ratings), Tentang (Info).
 *  - Filter chip per kategori tab.
 *  - In-tab social feed cards dengan galeri foto multi-kolom (+N badge), Q&A thread, ulasan rating.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { Pressable, View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
  CaretLeft,
  ChatCircleDots,
  DotsThreeVertical,
  Flag,
  Handshake,
  Heart,
  Images,
  MagnifyingGlass,
  PencilSimple,
  Prohibit,
  SealCheck,
  ShareNetwork,
  ShieldCheck,
  Star,
  UserCircle,
} from "phosphor-react-native"

import { api, isApiError, userMessage } from "@/lib/api"
import type { PublicRatingFilter, Rating } from "@/lib/api/ratings"
import { readMyRatings } from "@/lib/api/ratings"
import type {
  PublicUserProfile,
  QuestionComment,
  QuestionItem,
  ShowcaseItem,
} from "@/lib/api/users"
import {
  readQuestionComments,
  readQuestionList,
} from "@/lib/api/users"
import { useCopy } from "@/lib/clipboard"
import { profileUrl } from "@/lib/deeplinks"
import { formatDate, formatDateTime, formatDecimal, formatNumber } from "@/lib/format"
import { goBackOrNavigate } from "@/lib/navigation"
import { ROUTES } from "@/lib/routes"
import { shareContent } from "@/lib/share"
import { tokens } from "@/lib/tokens"

import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { FavoriteIconButton } from "@/components/ui/favorite-icon-button"
import { FollowButton } from "@/components/ui/follow-button"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { ListLoading } from "@/components/ui/paginated-list"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { QACard } from "@/components/ui/qa-card"
import { QaCommentComposer, QaCommentItem } from "@/components/ui/qa-comment-item"
import { RatingReviewCard, type RatingPerson } from "@/components/ui/rating-review-card"
import { Screen } from "@/components/ui/screen"
import { ShowcaseGalleryGrid } from "@/components/ui/showcase-gallery-grid"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"

type ProfileTab = "content" | "questions" | "ratings" | "about"

const RATING_FILTERS: { value: PublicRatingFilter; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "positive", label: "Positif" },
  { value: "neutral", label: "Netral" },
  { value: "negative", label: "Negatif" },
]

export default function UserProfileScreen() {
  const { username: rawUsername } = useLocalSearchParams<{ username: string }>()
  const username = rawUsername ?? ""
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const { copy } = useCopy()

  // Profile data state
  const [profile, setProfile] = useState<PublicUserProfile | null>(null)
  const [meId, setMeId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Follow & favorite state
  const [favorite, setFavorite] = useState(false)
  const [favLoading, setFavLoading] = useState(false)
  const [following, setFollowing] = useState<boolean | null>(null)
  const [followLoading, setFollowLoading] = useState(false)
  const [followerCount, setFollowerCount] = useState<number | null>(null)
  const [followingCount, setFollowingCount] = useState<number | null>(null)

  // Active tab state
  const [activeTab, setActiveTab] = useState<ProfileTab>("content")

  // Showcase / Konten state
  const [showcaseItems, setShowcaseItems] = useState<ShowcaseItem[]>([])
  const [showcaseLoading, setShowcaseLoading] = useState(false)

  // Questions / Tanya Jawab state
  const [questions, setQuestions] = useState<QuestionItem[]>([])
  const [questionsLoading, setQuestionsLoading] = useState(false)
  const [askOpen, setAskOpen] = useState(false)
  const [askText, setAskText] = useState("")
  const [asking, setAsking] = useState(false)
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null)
  const [questionComments, setQuestionComments] = useState<{
    items: QuestionComment[]
    loading: boolean
  }>({ items: [], loading: false })
  const [commentText, setCommentText] = useState("")
  const [commentSending, setCommentSending] = useState(false)
  const [deleteQ, setDeleteQ] = useState<QuestionItem | null>(null)
  const [deleteC, setDeleteC] = useState<QuestionComment | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Ratings / Ulasan state
  const [ratings, setRatings] = useState<Rating[]>([])
  const [ratingsLoading, setRatingsLoading] = useState(false)
  const [ratingFilter, setRatingFilter] = useState<PublicRatingFilter>("all")

  // Safety / Block dialog
  const [blockOpen, setBlockOpen] = useState(false)
  const [blocking, setBlocking] = useState(false)
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false)

  const handle = profile?.username ?? username
  const isSelf = Boolean(meId && profile?.id && meId === profile.id)

  const profileRequest = useRef(0)

  // Fetch all tab contents
  const fetchTabContents = useCallback(
    async (targetName: string) => {
      setShowcaseLoading(true)
      setQuestionsLoading(true)
      setRatingsLoading(true)

      void api.users
        .getPublicShowcase(targetName)
        .then((res) => setShowcaseItems(res ?? []))
        .catch(() => setShowcaseItems([]))
        .finally(() => setShowcaseLoading(false))

      void api.users
        .getPublicQuestions(targetName, { page: 1, limit: 20 })
        .then((res) => {
          const { items } = readQuestionList(res)
          setQuestions(items)
        })
        .catch(() => setQuestions([]))
        .finally(() => setQuestionsLoading(false))

      void api.ratings
        .getPublicRatings(targetName, {
          page: 1,
          limit: 20,
          ...(ratingFilter === "all" ? {} : { filter: ratingFilter }),
        })
        .then((res) => {
          const { items } = readMyRatings(res)
          setRatings(items)
        })
        .catch(() => setRatings([]))
        .finally(() => setRatingsLoading(false))
    },
    [ratingFilter],
  )

  const fetchProfile = useCallback(async () => {
    const started = ++profileRequest.current
    const current = () => profileRequest.current === started
    setFollowing(null)
    setFollowerCount(null)
    setFollowingCount(null)
    if (!username) return
    setLoading(true)
    setError(null)
    try {
      const [res, me] = await Promise.all([
        api.users.getUserByUsername(username),
        api.users.getMe().catch(() => null),
      ])
      if (!current()) return
      setProfile(res)
      setMeId(me?.id ?? null)
      const targetName = res.username ?? username

      // Fetch tab data
      void fetchTabContents(targetName)

      // Auxiliary social checks
      void api.users
        .isFavorite(targetName)
        .then((r) => {
          if (current()) setFavorite(Boolean(r?.favorited))
        })
        .catch(() => {
          if (current()) setFavorite(false)
        })

      void api.users
        .getFollowers(targetName, { page: 1, limit: 1 })
        .then((rows) => {
          if (current()) setFollowerCount(rows.meta.total ?? null)
        })
        .catch(() => {
          if (current()) setFollowerCount(null)
        })

      void api.users
        .getFollowing(targetName, { page: 1, limit: 1 })
        .then((rows) => {
          if (current()) setFollowingCount(rows.meta.total ?? null)
        })
        .catch(() => {
          if (current()) setFollowingCount(null)
        })

      if (me?.username) {
        void api.users
          .getFollowers(targetName, { page: 1, limit: 20, search: me.username })
          .then((result) => {
            const found = result.data.some((user) => user.id === me.id)
            if (current()) setFollowing(found ? true : result.meta.totalPages <= 1 ? false : null)
          })
          .catch(() => {
            if (current()) setFollowing(null)
          })
      }
    } catch (err) {
      if (current()) {
        setError(
          isApiError(err) && err.status !== 404 ? userMessage(err) : "Profil tidak ditemukan.",
        )
      }
    } finally {
      if (current()) setLoading(false)
    }
  }, [username, fetchTabContents])

  useEffect(() => {
    void fetchProfile()
    return () => {
      profileRequest.current += 1
    }
  }, [fetchProfile])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchProfile()
    setRefreshing(false)
  }, [fetchProfile])

  // Follow / Favorite actions
  const handleFollow = useCallback(
    async (next: boolean) => {
      if (!handle) return
      setFollowing(next)
      setFollowerCount((c) => (c == null ? c : Math.max(0, c + (next ? 1 : -1))))
      setFollowLoading(true)
      try {
        if (next) await api.users.followUser(handle)
        else await api.users.unfollowUser(handle)
      } catch (err) {
        setFollowing(!next)
        setFollowerCount((c) => (c == null ? c : Math.max(0, c + (next ? -1 : 1))))
        toast.show({
          title: next ? "Gagal mengikuti" : "Gagal berhenti mengikuti",
          description: isApiError(err) ? userMessage(err) : undefined,
          tone: "danger",
        })
      } finally {
        setFollowLoading(false)
      }
    },
    [handle, toast],
  )

  const handleFavorite = useCallback(
    async (next: boolean) => {
      if (!handle) return
      setFavLoading(true)
      try {
        if (next) await api.users.addFavorite(handle)
        else await api.users.removeFavorite(handle)
        setFavorite(next)
      } catch (err: unknown) {
        toast.show({
          title: "Gagal memperbarui favorit",
          description: userMessage(err),
          tone: "danger",
        })
      } finally {
        setFavLoading(false)
      }
    },
    [handle, toast],
  )

  const handleShare = useCallback(async () => {
    if (!handle) return
    const url = profileUrl(handle)
    const outcome = await shareContent({
      title: `@${handle} di Kahade`,
      message: `Lihat profil ${profile?.fullName ?? `@${handle}`} di Kahade`,
      url,
    })
    if (outcome === "unavailable") {
      const ok = await copy(url)
      toast.show({
        title: ok ? "Tautan profil disalin" : "Tidak bisa membagikan",
        tone: ok ? "success" : "danger",
      })
    }
  }, [handle, profile?.fullName, copy, toast])

  const handleBlock = useCallback(async () => {
    if (!profile?.id) return
    setBlocking(true)
    try {
      await api.settings.blockUser(profile.id)
      toast.show({ title: "Pengguna diblokir", tone: "success", duration: 3000 })
      setBlockOpen(false)
      goBackOrNavigate(ROUTES.home)
    } catch (err: unknown) {
      toast.show({
        title: "Gagal memblokir pengguna",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setBlocking(false)
    }
  }, [profile?.id, toast])

  // Question & Comment handlers
  const submitAsk = useCallback(async () => {
    if (!username || askText.trim().length < 5) return
    setAsking(true)
    try {
      await api.users.addQuestion(username, askText.trim())
      toast.show({ title: "Pertanyaan terkirim", tone: "success", duration: 3000 })
      setAskOpen(false)
      setAskText("")
      const res = await api.users.getPublicQuestions(username, { page: 1, limit: 20 })
      const { items } = readQuestionList(res)
      setQuestions(items)
    } catch (err) {
      toast.show({
        title: "Gagal mengirim pertanyaan",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setAsking(false)
    }
  }, [username, askText, toast])

  const toggleComments = useCallback(
    async (q: QuestionItem) => {
      if (openQuestionId === q.id) {
        setOpenQuestionId(null)
        return
      }
      setOpenQuestionId(q.id)
      setQuestionComments({ items: [], loading: true })
      try {
        const body = await api.users.getQuestionComments(q.id, { page: 1, limit: 20 })
        const { items } = readQuestionComments(body)
        setQuestionComments({ items, loading: false })
      } catch {
        setQuestionComments({ items: [], loading: false })
        toast.show({ title: "Gagal memuat komentar", tone: "danger" })
      }
    },
    [openQuestionId, toast],
  )

  const submitComment = useCallback(async () => {
    if (!openQuestionId || !commentText.trim() || commentSending) return
    setCommentSending(true)
    try {
      await api.users.addQuestionComment(openQuestionId, { content: commentText.trim() })
      setCommentText("")
      const body = await api.users.getQuestionComments(openQuestionId, { page: 1, limit: 20 })
      const { items } = readQuestionComments(body)
      setQuestionComments({ items, loading: false })
      toast.show({ title: "Komentar terkirim", tone: "success", duration: 3000 })
    } catch (err) {
      toast.show({
        title: "Gagal mengirim komentar",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setCommentSending(false)
    }
  }, [openQuestionId, commentText, commentSending, toast])

  const handleDelete = useCallback(async () => {
    if (deleting) return
    setDeleting(true)
    try {
      if (deleteQ) {
        await api.users.deleteQuestion(deleteQ.id)
        setDeleteQ(null)
        if (openQuestionId === deleteQ.id) setOpenQuestionId(null)
        toast.show({ title: "Pertanyaan dihapus", tone: "neutral", duration: 3000 })
        const res = await api.users.getPublicQuestions(username, { page: 1, limit: 20 })
        const { items } = readQuestionList(res)
        setQuestions(items)
      } else if (deleteC && openQuestionId) {
        await api.users.deleteQuestionComment(deleteC.id)
        setDeleteC(null)
        toast.show({ title: "Komentar dihapus", tone: "neutral", duration: 3000 })
        const body = await api.users.getQuestionComments(openQuestionId, { page: 1, limit: 20 })
        const { items } = readQuestionComments(body)
        setQuestionComments({ items, loading: false })
      }
    } catch (err) {
      toast.show({ title: "Gagal menghapus", description: userMessage(err), tone: "danger" })
    } finally {
      setDeleting(false)
    }
  }, [deleting, deleteQ, deleteC, openQuestionId, username, toast])

  const isMyQuestion = (q: QuestionItem) => !!meId && q.asker?.id === meId
  const isMyComment = (c: QuestionComment) => !!meId && c.authorId === meId

  return (
    <Screen edges={["top"]} padded={false}>
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-0 pb-16"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[16] },
        }}
      >
        {/* ── Top Cover Banner with Floating Navigation ──────── */}
        <View accessible={false} className="relative h-32 w-full overflow-hidden bg-surface border-b border-border">
          {/* Subtle brand pattern overlay */}
          <View className="absolute inset-0 bg-overlay/10" />

          {/* Floating Top Bar */}
          <View className="w-full flex-row items-center justify-between px-4 pt-3">
            <IconButton
              icon={CaretLeft}
              variant="secondary"
              size="sm"
              accessibilityLabel="Kembali"
              className="h-9 w-9 rounded-full bg-overlay"
              onPress={() => goBackOrNavigate(ROUTES.home)}
            />

            <View className="flex-row items-center gap-2">
              <IconButton
                icon={MagnifyingGlass}
                variant="secondary"
                size="sm"
                accessibilityLabel="Pencarian"
                className="h-9 w-9 rounded-full bg-overlay"
                onPress={() => router.push(ROUTES.search)}
              />
              <IconButton
                icon={ShareNetwork}
                variant="secondary"
                size="sm"
                accessibilityLabel="Bagikan Profil"
                className="h-9 w-9 rounded-full bg-overlay"
                onPress={() => void handleShare()}
              />
              {!isSelf && profile ? (
                <IconButton
                  icon={DotsThreeVertical}
                  variant="secondary"
                  size="sm"
                  accessibilityLabel="Pilihan lainnya"
                  className="h-9 w-9 rounded-full bg-overlay"
                  onPress={() => setMoreOptionsOpen(true)}
                />
              ) : null}
            </View>
          </View>
        </View>

        {loading && !profile ? (
          <View className="px-6 pt-4 gap-4">
            <View className="flex-row items-end justify-between -mt-12">
              <Skeleton shape="circle" width={76} height={76} className="border-4 border-background" />
              <Skeleton width={96} height={36} className="rounded-sm" />
            </View>
            <Skeleton height={24} className="w-3/5" />
            <Skeleton height={16} className="w-4/5" />
            <Skeleton height={16} className="w-2/5" />
          </View>
        ) : error ? (
          <View className="px-6 pt-8">
            <ErrorState title="Gagal memuat profil" description={error} onRetry={() => void fetchProfile()} />
          </View>
        ) : profile ? (
          <View className="w-full">
            {/* ── Avatar & Follow Action Row ────────────────────── */}
            <View className="flex-row items-end justify-between px-6 -mt-11">
              <View className="rounded-full border-4 border-background bg-background">
                <Avatar source={profile.avatarUrl ? { uri: profile.avatarUrl } : undefined} name={profile.fullName ?? handle} size="xl" />
              </View>

              <View className="flex-row items-center gap-2 pb-1">
                {isSelf ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={PencilSimple}
                    onPress={() => router.push(ROUTES.editProfile)}
                  >
                    Edit Profil
                  </Button>
                ) : (
                  <>
                    <IconButton
                      icon={ChatCircleDots}
                      variant="secondary"
                      size="sm"
                      accessibilityLabel="Kirim Pesan"
                      onPress={() => router.push(ROUTES.chat)}
                    />
                    <FollowButton
                      following={following === true}
                      loading={followLoading || following == null}
                      onToggle={(next) => void handleFollow(next)}
                    />
                    <FavoriteIconButton
                      active={favorite}
                      disabled={favLoading}
                      onToggle={(next) => void handleFavorite(next)}
                      accessibilityLabel={favorite ? "Hapus favorit" : "Simpan favorit"}
                      size="md"
                    />
                  </>
                )}
              </View>
            </View>

            {/* ── User Identity & Bio ──────────────────────────── */}
            <View className="gap-2 px-6 pt-3">
              <View className="flex-row items-center gap-1.5">
                <Text variant="h2" weight={700} tone="primary">
                  {profile.fullName || `@${handle}`}
                </Text>
                {profile.verified ? (
                  <Icon icon={SealCheck} size="sm" active weight="fill" />
                ) : null}
              </View>

              {profile.bio ? (
                <Text variant="body" tone="secondary" numberOfLines={4}>
                  {profile.bio}
                </Text>
              ) : (
                <Text variant="caption" tone="tertiary">
                  Pengguna terdaftar Kahade Escrow & Marketplace
                </Text>
              )}

              {/* ── Stats / Counter Strip ────────────────────────── */}
              <View className="flex-row flex-wrap items-center gap-4 pt-2">
                <Pressable accessibilityHint="Ketuk untuk berinteraksi" hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button" onPress={() => router.push(ROUTES.followers(handle, "following"))}>
                  <Text variant="body" tone="secondary">
                    <Text variant="body" weight={700} tone="primary">
                      {formatNumber(followingCount ?? 0)}{" "}
                    </Text>
                    Mengikuti
                  </Text>
                </Pressable>

                <Pressable onPress={() => router.push(ROUTES.followers(handle))}>
                  <Text variant="body" tone="secondary">
                    <Text variant="body" weight={700} tone="primary">
                      {formatNumber(followerCount ?? 0)}{" "}
                    </Text>
                    Pengikut
                  </Text>
                </Pressable>

                {profile.rating != null ? (
                  <Pressable onPress={() => setActiveTab("ratings")}>
                    <Text variant="body" tone="secondary">
                      <Text variant="body" weight={700} tone="primary">
                        {formatDecimal(profile.rating)} ★{" "}
                      </Text>
                      Ulasan
                    </Text>
                  </Pressable>
                ) : null}

                {profile.trustScore != null ? (
                  <View className="flex-row items-center gap-1">
                    <Icon icon={ShieldCheck} size="xs" active />
                    <Text variant="body" weight={700} tone="primary">
                      {profile.trustScore}
                    </Text>
                    <Text variant="caption" tone="secondary">
                      Skor
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Quick Transaction Button for non-self */}
              {!isSelf ? (
                <View className="pt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={Handshake}
                    onPress={() => router.push(ROUTES.createTransactionWith(handle))}
                  >
                    Buat Transaksi Escrow
                  </Button>
                </View>
              ) : null}
            </View>

            {/* ── Tabs Bar ─────────────────────────────────────── */}
            <View className="w-full border-b border-border bg-background pt-4">
              <View className="flex-row items-center px-6">
                {[
                  { key: "content" as ProfileTab, label: "Konten" },
                  { key: "questions" as ProfileTab, label: "Tanya Jawab" },
                  { key: "ratings" as ProfileTab, label: "Ulasan" },
                  { key: "about" as ProfileTab, label: "Tentang" },
                ].map((tab) => {
                  const isActive = activeTab === tab.key
                  return (
                    <Pressable
                      key={tab.key}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: isActive }}
                      onPress={() => setActiveTab(tab.key)}
                      className="mr-6 py-3 relative"
                    >
                      <Text
                        variant="body"
                        weight={isActive ? 700 : 500}
                        tone={isActive ? "primary" : "secondary"}
                      >
                        {tab.label}
                      </Text>
                      {isActive ? (
                        <View className="absolute bottom-0 inset-x-0 h-0.5 bg-primary rounded-full" />
                      ) : null}
                    </Pressable>
                  )
                })}
              </View>
            </View>

            {/* ── Tab Content 1: Konten (Showcase / Feed) ───────── */}
            {activeTab === "content" ? (
              <View className="px-6 pt-4 gap-4">
                {showcaseLoading ? (
                  <ListLoading />
                ) : showcaseItems.length === 0 ? (
                  <EmptyState
                    icon={Images}
                    title="Belum ada konten"
                    description={`@${handle} belum membagikan foto atau showcase produk.`}
                  />
                ) : (
                  showcaseItems.map((item, idx) => (
                    <Card key={item.id ?? idx} padded className="gap-3 bg-surface border border-border rounded-md">
                      {/* Card Author Header */}
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-2">
                          <Avatar source={profile.avatarUrl ? { uri: profile.avatarUrl } : undefined} name={handle} size="xs" />
                          <View>
                            <Text variant="caption" weight={600} tone="primary">
                              {profile.fullName || `@${handle}`}
                            </Text>
                            <Text variant="caption" tone="tertiary">
                              Showcase #{idx + 1}
                            </Text>
                          </View>
                        </View>
                        <Badge tone="neutral" variant="outline">Produk</Badge>
                      </View>

                      {/* Post Caption */}
                      {item.caption ? (
                        <Text variant="body" tone="primary">
                          {item.caption}
                        </Text>
                      ) : null}

                      {/* Photo Grid Preview */}
                      <ShowcaseGalleryGrid
                        columns={3}
                        max={3}
                        items={[
                          {
                            id: item.id ?? String(idx),
                            source: item.imageUrl ?? item.fileKey ?? "",
                            alt: item.caption ?? "Foto Showcase",
                          },
                        ]}
                      />

                      {/* Post Interaction Footer */}
                      <View className="flex-row items-center justify-between pt-2 border-t border-border">
                        <View className="flex-row items-center gap-4">
                          <View className="flex-row items-center gap-1">
                            <Icon icon={Heart} size="sm" tone="default" />
                            <Text variant="caption" tone="secondary">Suka</Text>
                          </View>
                          <Pressable
                            onPress={() => {
                              setActiveTab("questions")
                              setAskOpen(true)
                            }}
                            className="flex-row items-center gap-1"
                          >
                            <Icon icon={ChatCircleDots} size="sm" tone="default" />
                            <Text variant="caption" tone="secondary">Tanya</Text>
                          </Pressable>
                        </View>

                        {!isSelf ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onPress={() => router.push(ROUTES.createTransactionWith(handle))}
                          >
                            Beli Sekarang
                          </Button>
                        ) : null}
                      </View>
                    </Card>
                  ))
                )}
              </View>
            ) : null}

            {/* ── Tab Content 2: Tanya Jawab (Q&A) ──────────────── */}
            {activeTab === "questions" ? (
              <View className="px-6 pt-4 gap-4">
                <View className="flex-row items-center justify-between">
                  <Text variant="label" tone="secondary">
                    Pertanyaan Pengguna ({questions.length})
                  </Text>
                  <Button size="sm" variant="secondary" onPress={() => setAskOpen(true)}>
                    Bertanya
                  </Button>
                </View>

                {questionsLoading ? (
                  <ListLoading />
                ) : questions.length === 0 ? (
                  <EmptyState
                    icon={ChatCircleDots}
                    title="Belum ada pertanyaan"
                    description={`Jadilah yang pertama bertanya kepada @${handle}.`}
                    action={
                      <Button variant="secondary" onPress={() => setAskOpen(true)}>
                        Ajukan Pertanyaan
                      </Button>
                    }
                  />
                ) : (
                  questions.map((q) => (
                    <View key={q.id} className="gap-2">
                      <QACard
                        question={q.question}
                        asker={{
                          name: q.asker?.fullName ?? q.asker?.username ?? "Pengguna",
                          avatar: q.asker?.avatarUrl ? { uri: q.asker.avatarUrl } : undefined,
                        }}
                        date={q.createdAt}
                        answer={
                          q.answer
                            ? {
                                text: q.answer,
                                by: { name: `@${handle}` },
                                date: q.answeredAt ?? q.createdAt,
                              }
                            : undefined
                        }
                        footer={
                          <View className="flex-row items-center gap-3">
                            <Button size="sm" variant="ghost" onPress={() => void toggleComments(q)}>
                              {openQuestionId === q.id ? "Tutup Balasan" : "Lihat Balasan"}
                            </Button>
                            {isMyQuestion(q) ? (
                              <Button size="sm" variant="ghost" onPress={() => setDeleteQ(q)}>
                                Hapus
                              </Button>
                            ) : null}
                          </View>
                        }
                      />

                      {openQuestionId === q.id ? (
                        <Card padded className="gap-3 bg-surface border border-border rounded-md">
                          {questionComments.loading && questionComments.items.length === 0 ? (
                            <ListLoading />
                          ) : questionComments.items.length === 0 ? (
                            <Text variant="caption" tone="secondary">Belum ada komentar.</Text>
                          ) : (
                            questionComments.items.map((c) => (
                              <QaCommentItem
                                key={c.id}
                                authorName={c.authorName ?? c.authorUsername ?? "Pengguna"}
                                authorAvatar={c.authorAvatarUrl ? { source: c.authorAvatarUrl } : undefined}
                                isOwner={c.isOwner}
                                content={c.content}
                                timestamp={formatDateTime(c.createdAt)}
                                reply={c.reply || !!c.parentId}
                                deleted={c.deleted}
                                onDelete={isMyComment(c) && !c.deleted ? () => setDeleteC(c) : undefined}
                              />
                            ))
                          )}

                          <QaCommentComposer
                            value={commentText}
                            onChangeText={setCommentText}
                            onSubmit={() => void submitComment()}
                            submitting={commentSending}
                            maxLength={1000}
                            placeholder={`Tulis balasan untuk @${handle}…`}
                          />
                        </Card>
                      ) : null}
                    </View>
                  ))
                )}
              </View>
            ) : null}

            {/* ── Tab Content 3: Ulasan (Ratings) ───────────────── */}
            {activeTab === "ratings" ? (
              <View className="px-6 pt-4 gap-4">
                <View className="flex-row flex-wrap gap-2">
                  {RATING_FILTERS.map((f) => (
                    <Chip
                      key={f.value}
                      selected={ratingFilter === f.value}
                      onPress={() => setRatingFilter(f.value)}
                    >
                      {f.label}
                    </Chip>
                  ))}
                </View>

                {ratingsLoading ? (
                  <ListLoading />
                ) : ratings.length === 0 ? (
                  <EmptyState
                    icon={Star}
                    title="Belum ada ulasan"
                    description={`Ulasan transaksi dengan @${handle} akan muncul di sini.`}
                  />
                ) : (
                  ratings.map((r) => {
                    const reviewer: RatingPerson = {
                      name: r.authorUsername ?? "Pengguna",
                      avatar: r.authorAvatarUrl ? { uri: r.authorAvatarUrl } : undefined,
                    }
                    return (
                      <RatingReviewCard
                        key={r.id}
                        stars={r.stars}
                        comment={r.comment ?? undefined}
                        reviewer={reviewer}
                        date={r.createdAt}
                        orderId={r.orderId}
                        reply={
                          r.reply
                            ? {
                                id: `reply-${r.id}`,
                                content: r.reply,
                                by: { name: `@${handle}` },
                                role: "seller",
                                date: r.createdAt,
                              }
                            : undefined
                        }
                      />
                    )
                  })
                )}
              </View>
            ) : null}

            {/* ── Tab Content 4: Tentang (About & Info) ─────────── */}
            {activeTab === "about" ? (
              <View className="px-6 pt-4 gap-4">
                <View className="w-full gap-3 rounded-md border border-border bg-surface p-4">
                  <Text variant="body" weight={600} tone="primary">
                    Informasi Akun
                  </Text>
                  <View className="gap-2">
                    <View className="flex-row items-center justify-between">
                      <Text variant="caption" tone="secondary">Status Verifikasi (KYC)</Text>
                      <Badge tone={profile.verified ? "success" : "neutral"}>
                        {profile.verified ? "Terverifikasi" : "Belum Verifikasi"}
                      </Badge>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Text variant="caption" tone="secondary">Skor Kepercayaan</Text>
                      <Text variant="body" weight={600} tone="primary">{profile.trustScore ?? 100} / 100</Text>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Text variant="caption" tone="secondary">Bergabung Sejak</Text>
                      <Text variant="caption" tone="primary">{profile.createdAt ? formatDate(profile.createdAt) : "—"}</Text>
                    </View>
                  </View>
                </View>

                {!isSelf ? (
                  <View className="w-full gap-3 rounded-md border border-border bg-surface p-4">
                    <Text variant="body" weight={600} tone="primary">
                      Keamanan & Tindakan
                    </Text>
                    <View className="flex-row gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={Flag}
                        onPress={() => router.push(ROUTES.reports({ targetId: profile.id, targetName: handle }))}
                      >
                        Laporkan Akun
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        leftIcon={Prohibit}
                        onPress={() => setBlockOpen(true)}
                      >
                        Blokir Pengguna
                      </Button>
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : (
          <EmptyState icon={UserCircle} title="Profil tidak ditemukan" />
        )}
      </PullToRefresh>

      {/* ── Dialog Bertanya ──────────────────────────────────── */}
      <Dialog
        title={`Bertanya kepada @${handle}`}
        description="Pertanyaan Anda akan tampil di profil ini dan dijawab oleh pemiliknya."
        visible={askOpen}
        loading={asking}
        confirmLabel="Kirim Pertanyaan"
        confirmButtonProps={{ disabled: askText.trim().length < 5 }}
        cancelLabel="Batal"
        onConfirm={() => void submitAsk()}
        onCancel={() => setAskOpen(false)}
        onRequestClose={() => setAskOpen(false)}
      >
        <TextArea
          value={askText}
          onChangeText={setAskText}
          placeholder="Tulis pertanyaan Anda minimal 5 karakter…"
          maxLength={500}
          showCount
        />
      </Dialog>

      {/* ── Dialog Hapus Pertanyaan / Komentar ──────────────── */}
      <Dialog
        title={deleteQ ? "Hapus pertanyaan?" : "Hapus komentar?"}
        description={
          deleteQ
            ? "Pertanyaan beserta jawabannya akan dihapus dari profil ini."
            : "Komentar Anda akan dihapus dari utas ini."
        }
        visible={!!deleteQ || !!deleteC}
        destructive
        loading={deleting}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        onConfirm={() => void handleDelete()}
        onCancel={() => {
          setDeleteQ(null)
          setDeleteC(null)
        }}
        onRequestClose={() => {
          setDeleteQ(null)
          setDeleteC(null)
        }}
      />

      {/* ── Dialog Blokir ────────────────────────────────────── */}
      <Dialog
        title={`Blokir @${handle}?`}
        description="Anda tidak akan lagi melihat aktivitas atau dapat bertransaksi dengan pengguna ini."
        visible={blockOpen}
        destructive
        loading={blocking}
        confirmLabel="Blokir"
        cancelLabel="Batal"
        onConfirm={() => void handleBlock()}
        onCancel={() => setBlockOpen(false)}
        onRequestClose={() => setBlockOpen(false)}
      />

      {/* ── Dialog Pilihan Lainnya ──────────────────────────── */}
      <Dialog
        title="Pilihan Akun"
        visible={moreOptionsOpen}
        hideCancel
        confirmLabel="Tutup"
        onConfirm={() => setMoreOptionsOpen(false)}
        onRequestClose={() => setMoreOptionsOpen(false)}
      >
        <View className="gap-2 pt-2">
          <Button
            variant="ghost"
            leftIcon={ShareNetwork}
            onPress={() => {
              setMoreOptionsOpen(false)
              void handleShare()
            }}
          >
            Bagikan Profil
          </Button>
          <Button
            variant="ghost"
            leftIcon={Flag}
            onPress={() => {
              setMoreOptionsOpen(false)
              if (profile?.id) router.push(ROUTES.reports({ targetId: profile.id, targetName: handle }))
            }}
          >
            Laporkan Pengguna
          </Button>
          <Button
            variant="destructive"
            leftIcon={Prohibit}
            onPress={() => {
              setMoreOptionsOpen(false)
              setBlockOpen(true)
            }}
          >
            Blokir Pengguna
          </Button>
        </View>
      </Dialog>
    </Screen>
  )
}