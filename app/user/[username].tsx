import { useProfileShowcase } from "@/lib/use-profile-showcase"
/**
 * Screen — Profil User (Binance Social / Creator Profile style)
 *
 *  - Navigasi atas di atas kartu sampul (+ untuk profil sendiri, back untuk orang lain).
 *  - Cover kartu (rounded + border + margin).
 *  - Avatar bulat besar menimpa sampul 30% (70% di bawah kartu).
 *  - Identitas: Nama lengkap & @username berdekatan, bio multi-line.
 *  - Statistik interaktif (Mengikuti, Pengikut, Ulasan, Skor) di bawah bio.
 *  - Aksi: [Edit profil] untuk diri sendiri; [Ikuti] + [Kirim Pesan] untuk orang lain.
 *  - Tab navigasi in-page: Etalase, Utas (QEtalase, Tanya Jawab, Ulasan, TentangA), Ulasan, Tentang via <Tabs>.
 *  - Bottom Nav Bar hanya dirender untuk PROFIL SENDIRI.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Pressable, View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"
import {
  Bookmark,
  Briefcase,
  ChatCircleDots,
  DotsThreeVertical,
  Envelope,
  Flag,
  Handshake,
  IdentificationBadge,
  Image as ImageIcon,
  PencilSimple,
  Prohibit,
  SealCheck,
  ShareNetwork,
  ShieldCheck,
  ShieldStar,
  Sparkle,
  UserCircle,
} from "phosphor-react-native"
import { api, isApiError, userMessage } from "@/lib/api"
import type { HiddenReason, PublicUserProfile, QuestionComment, QuestionItem, VerificationBadge } from "@/lib/api/users"
import { readMyRatings, type PublicRatingFilter, type Rating } from "@/lib/api/ratings"
import { createInquiry } from "@/lib/api/chat"
import {
  readQuestionComments,
  readQuestionList,
} from "@/lib/api/users"
import { useCopy } from "@/lib/clipboard"
import { profileUrl } from "@/lib/deeplinks"
import { formatDateTime, formatDecimal, formatNumber } from "@/lib/format"
import { useHasSession } from "@/lib/guest-gate"
import { goBackOrNavigate } from "@/lib/navigation"
import { resolveMediaUrl } from "@/lib/media"
import { ROUTES } from "@/lib/routes"
import { isFilePayload, shareContent, type SharePayload } from "@/lib/share"
import { TEXT_ROW_HIT_SLOP } from "@/lib/hit-slop"
import { logWarn } from "@/lib/telemetry"

import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { VerifiedSeal, VerificationSheet, getSealTier } from "@/components/ui/verified-seal"
import { GreyCheckBadge } from "@/components/ui/grey-check-badge"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Radio, RadioGroup } from "@/components/ui/radio"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { FavoriteIconButton } from "@/components/ui/favorite-icon-button"
import { FollowButton } from "@/components/ui/follow-button"
import { Header } from "@/components/ui/header"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { Picture } from "@/components/ui/picture"
import { IconButton } from "@/components/ui/icon-button"
import { Crossfade } from "@/components/ui/fade-in"
import { ListLoading } from "@/components/ui/paginated-list"
import { DataScroll } from "@/components/ui/data-screen"
import { QACard } from "@/components/ui/qa-card"
import { QaCommentComposer, QaCommentItem } from "@/components/ui/qa-comment-item"
import { ProfileAboutTab } from "@/components/ui/profile-about-tab"
import { ProfileEtalaseTab } from "@/components/ui/profile-etalase-tab"
import { ProfileRatingsTab } from "@/components/ui/profile-ratings-tab"
import { Screen } from "@/components/ui/screen"
import { ShareSheetTrigger } from "@/components/ui/share-sheet-trigger"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { Tabs } from "@/components/ui/tabs"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"

type ProfileTab = "content" | "questions" | "ratings" | "about"

/**
 * Item tab profil — dibuat di dalam komponen via useMemo (bukan konstanta
 * modul) supaya label mengikuti bahasa aktif. Array di-memo agar identitasnya
 * stabil antar render (indikator tab yang meluncur butuh referensi stabil).
 */
function useProfileTabs() {
  const language = useLanguage()
  return useMemo(
    () =>
      [
        { value: "content", label: translate("Etalase") },
        { value: "questions", label: translate("Utas") },
        { value: "ratings", label: translate("Ulasan") },
        { value: "about", label: translate("Tentang") },
      ] as const satisfies readonly { value: ProfileTab; label: string }[],
    [language],
  )
}

/**
 * Alasan sembunyikan komentar QA — sama: label mengikuti bahasa aktif.
 */
function useQaHideReasons(): readonly { value: string; label: string; description: string }[] {
  const language = useLanguage()
  return useMemo(
    () => [
      { value: "SPAM", label: translate("Spam"), description: translate("Link/jualan tidak relevan") },
      { value: "INAPPROPRIATE", label: translate("Tidak pantas"), description: translate("Konten menyinggung") },
      { value: "HARASSMENT", label: translate("Perundungan"), description: translate("Ancaman/pelecehan") },
      { value: "OTHER", label: translate("Lainnya"), description: translate("Sebutkan di keterangan") },
    ],
    [language],
  )
}

/**
 * Tinggi sampul kartu — SAMA dengan COVER_HEIGHT di ProfileHeader
 * (Pengaturan) & Edit Profil (120px) supaya ketiga layar konsisten.
 */
const COVER_HEIGHT = 120


/**
 * Nama ikon badge dari backend adalah string kebab-case Phosphor. Beberapa
 * nama TIDAK ADA di build phosphor-react-native yang terpasang
 * (BadgeCheck, BriefcaseCheck, EnvelopeCheck), jadi dipetakan ke ekuivalen:
 * badge-check → IdentificationBadge, briefcase-check → Briefcase,
 * envelope-check → Envelope. Fallback SealCheck menjaga badge tak dikenal
 * tetap terrender.
 */
const BADGE_ICON: Partial<Record<string, IconComponent>> = {
  "seal-check": SealCheck,
  "badge-check": IdentificationBadge,
  "briefcase-check": Briefcase,
  sparkles: Sparkle,
  "shield-star": ShieldStar,
  "envelope-check": Envelope,
}

export default function UserProfileScreen() {
  const { username: rawUsername } = useLocalSearchParams<{
    username: string
    self?: string
  }>()
  const username = rawUsername ?? ""
  const toast = useToast()
  const { copy } = useCopy()
  // P3 (audit 2026-09-26): tamu di-gate ke login sebelum aksi sosial.
  const hasSession = useHasSession()
  // i18n: tab + alasan hide mengikuti bahasa aktif (dulu konstanta modul).
  const profileTabs = useProfileTabs()
  const qaHideReasons = useQaHideReasons()

  // Profile data state
  const [profile, setProfile] = useState<PublicUserProfile | null>(null)
  const [meId, setMeId] = useState<string | null>(null)
  // BUG#1 (2026-09-26): public USR-XXX untuk perbandingan dengan profile.id
  // (public namespace). meId tetap cuid internal (dipakai untuk authorId).
  const [meUserId, setMeUserId] = useState<string | null>(null)
  const [meUsername, setMeUsername] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Follow & favorite state
  const [favorite, setFavorite] = useState(false)
  const [favLoading, setFavLoading] = useState(false)
  // "Tersimpan" (bookmark pribadi) — terpisah dari favorit publik.
  const [saved, setSaved] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  /** Badge verifikasi aktif (GET /v1/users/{username}/badges). */
  const [badges, setBadges] = useState<VerificationBadge[]>([])
  const [verifySheetOpen, setVerifySheetOpen] = useState(false)
  const [following, setFollowing] = useState<boolean | null>(null)
  const [followLoading, setFollowLoading] = useState(false)
  const [followerCount, setFollowerCount] = useState<number | null>(null)
  const [followingCount, setFollowingCount] = useState<number | null>(null)

  // Inquiry (nego sebelum transaksi) state
  const [inquiryOpen, setInquiryOpen] = useState(false)
  const [inquirySubject, setInquirySubject] = useState("")
  const [inquiryMessage, setInquiryMessage] = useState("")
  const [inquirySending, setInquirySending] = useState(false)

  // Active tab state
  const [activeTab, setActiveTab] = useState<ProfileTab>("content")

  // Etalase / Showcase state — item MENTAH dari API; normalisasi ke bentuk
  // sosial + interaksinya milik <ProfileEtalaseTab> (ekstrak G-11).
  const { items: showcaseItems, loading: showcaseLoading, error: showcaseError, fetch: fetchShowcaseTab } = useProfileShowcase()

  // Questions / Tanya Jawab state
  const [questions, setQuestions] = useState<QuestionItem[]>([])
  const [upvotingId, setUpvotingId] = useState<string | null>(null)
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
  const [hideC, setHideC] = useState<QuestionComment | null>(null)
  const [hideCReason, setHideCReason] = useState<HiddenReason>("SPAM")
  const [hidingC, setHidingC] = useState(false)

  const submitHideComment = useCallback(async () => {
    if (!hideC || hidingC) return
    setHidingC(true)
    try {
      await api.users.hideQAComment(hideC.id, hideCReason)
      setHideC(null)
      toast.show({ title: translate("Komentar disembunyikan"), tone: "success", duration: 2500 })
      // Komentar tersembunyi tidak dikirim lagi oleh server — muat ulang thread.
      if (openQuestionId) {
        const body = await api.users.getQuestionComments(openQuestionId, { page: 1, limit: 20 })
        const { items } = readQuestionComments(body)
        setQuestionComments({ items, loading: false })
      }
    } catch (err) {
      toast.show({
        title: translate("Gagal menyembunyikan komentar"),
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setHidingC(false)
    }
  }, [hideC, hideCReason, hidingC, openQuestionId, toast])
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
  const isSelf = Boolean(
    (meUserId && profile?.id && meUserId === profile.id) ||
      (meUsername &&
        (username.toLowerCase() === meUsername.toLowerCase() ||
          (profile?.username && profile.username.toLowerCase() === meUsername.toLowerCase()))),
  )
  /** Foto sampul pita atas — undefined bila user belum memasangnya. */
  const coverUri = resolveMediaUrl(profile?.headerUrl)

  const profileRequest = useRef(0)
  // Fetch all tab contents
  const fetchTabContents = useCallback(
    async (targetName: string) => {
      setQuestionsLoading(true)
      setRatingsLoading(true)

      fetchShowcaseTab(targetName)

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
    [ratingFilter, fetchShowcaseTab],
  )

  /**
   * `opts.silent` — perbaikan cacat yang terbukti: tarik-untuk-menyegarkan
   * dulu memanggil fungsi ini tanpa pembeda, sehingga `setLoading(true)`
   * mengganti SELURUH profil (header, statistik, tab) dengan kerangka, dan
   * tiga penghitung sosial di-reset ke null lalu diisi ulang — angka pengikut
   * berkedip kosong tiap tarik.
   *
   * Reset itu sendiri benar dan DIPERTAHANKAN untuk kasus yang memang
   * membutuhkannya: pindah ke profil lain (username berubah → effect berjalan
   * → non-silent) harus membuang angka milik profil sebelumnya. Yang salah
   * hanya menerapkannya pada penyegaran profil yang SAMA.
   *
   * `setError(null)` tetap tanpa syarat: penyegaran harus membersihkan error
   * sebelumnya bila kini berhasil.
   *
   * CATATAN — kenapa layar ini TIDAK dimigrasi ke useApiQuery: layar ini
   * memetakan 404 ke "Profil tidak ditemukan." lewat
   * `isApiError(err) && err.status !== 404 ? userMessage(err) : "…"`,
   * sedangkan useApiQuery selalu memanggil `userMessage(err)` dan fungsi itu
   * mengembalikan DEFAULT_ERROR_MESSAGES.UNKNOWN untuk semua non-ApiError
   * (lib/api/errors.ts:202). Melempar Error biasa dari fetcher akan MENGUBAH
   * pesan 404 menjadi generik — regresi nyata. Mempertahankannya butuh
   * mengubah useApiQuery (infrastruktur bersama 20+ layar) hanya demi satu
   * layar, dan layar ini sudah punya perlindungan respons basi sendiri lewat
   * `profileRequest.current`. Jadi manfaat marginalnya kecil, risikonya besar.
   */
  const fetchProfile = useCallback(async (opts?: { silent?: boolean }) => {
    const started = ++profileRequest.current
    const current = () => profileRequest.current === started
    if (!opts?.silent) {
      setFollowing(null)
      setFollowerCount(null)
      setFollowingCount(null)
      setBadges([])
    }
    if (!username) return
    if (!opts?.silent) setLoading(true)
    setError(null)
    try {
      const [res, me] = await Promise.all([
        api.users.getUserByUsername(username),
        api.users.getMeCached().catch((err) => {
          logWarn("profile:me-fallback", err)
          return null
        }),
      ])
      if (!current()) return
      setProfile(res)
      setMeId(me?.id ?? null)
      setMeUserId(me?.userId ?? null)
      setMeUsername(me?.username ?? null)
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
        .checkSavedProfile(targetName)
        .then((isSaved) => {
          if (current()) setSaved(isSaved)
        })
        .catch(() => {
          if (current()) setSaved(false)
        })

      void api.users
        .getVerificationBadges(targetName)
        .then((rows) => {
          if (current()) setBadges(rows)
        })
        .catch(() => {
          if (current()) setBadges([])
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
          isApiError(err) && err.status !== 404 ? userMessage(err) : translate("Profil tidak ditemukan."),
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
    await fetchProfile({ silent: true })
    setRefreshing(false)
  }, [fetchProfile])

  // P3 (audit 2026-09-26): gerbang tamu untuk semua aksi sosial di profil.
  const requireSession = useCallback(() => {
    if (hasSession) return true
    router.push(ROUTES.loginRequired(`/user/${encodeURIComponent(handle)}`))
    return false
  }, [hasSession, handle])

  // Follow / Favorite actions
  const handleFollow = useCallback(
    async (next: boolean) => {
      if (!handle) return
      // P3 (audit 2026-09-26): tamu diarahkan login dulu — jangan tembak
      // endpoint lalu gagal 401 dengan toast "Gagal mengikuti".
      if (!requireSession()) return
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
          title: next ? translate("Gagal mengikuti") : translate("Gagal berhenti mengikuti"),
          description: isApiError(err) ? userMessage(err) : undefined,
          tone: "danger",
        })
      } finally {
        setFollowLoading(false)
      }
    },
    [handle, requireSession, toast],
  )

  const handleFavorite = useCallback(
    async (next: boolean) => {
      if (!handle) return
      if (!requireSession()) return
      setFavLoading(true)
      try {
        if (next) await api.users.addFavorite(handle)
        else await api.users.removeFavorite(handle)
        setFavorite(next)
      } catch (err: unknown) {
        toast.show({
          title: translate("Gagal memperbarui favorit"),
          description: userMessage(err),
          tone: "danger",
        })
      } finally {
        setFavLoading(false)
      }
    },
    [handle, requireSession, toast],
  )

  const handleUpvote = useCallback(
    async (q: QuestionItem, next: boolean) => {
      if (upvotingId) return
      if (!requireSession()) return
      setUpvotingId(q.id)
      const prevCount = q.upvoteCount ?? 0
      const prevActive = q.isUpvotedByViewer === true
      const apply = (patch: Partial<QuestionItem>) =>
        setQuestions((prev) => prev.map((x) => (x.id === q.id ? { ...x, ...patch } : x)))
      apply({ upvoteCount: Math.max(0, prevCount + (next ? 1 : -1)), isUpvotedByViewer: next })
      try {
        const res = next
          ? await api.users.upvoteQuestion(q.id)
          : await api.users.removeQuestionUpvote(q.id)
        apply({ upvoteCount: res.upvoteCount, isUpvotedByViewer: res.upvoted })
      } catch (err: unknown) {
        apply({ upvoteCount: prevCount, isUpvotedByViewer: prevActive })
        toast.show({
          title: translate("Gagal memperbarui dukungan"),
          description: userMessage(err),
          tone: "danger",
        })
      } finally {
        setUpvotingId(null)
      }
    },
    [upvotingId, requireSession, toast],
  )

  /**
   * Simpan / hapus profil dari daftar "Tersimpan" pribadi (app/saved) —
   * terpisah dari favorit publik yang punya counter.
   */
  const handleSaveProfile = useCallback(
    async (next: boolean) => {
      if (saveLoading) return
      setSaveLoading(true)
      try {
        if (next) {
          await api.users.saveProfile(handle)
          setSaved(true)
          toast.show({ title: translate("Profil disimpan"), tone: "success", duration: 2500 })
        } else {
          await api.users.unsaveProfile(handle)
          setSaved(false)
          toast.show({ title: translate("Profil dihapus dari tersimpan"), tone: "success", duration: 2500 })
        }
      } catch (err: unknown) {
        toast.show({
          title: translate("Gagal memperbarui tersimpan"),
          description: userMessage(err),
          tone: "danger",
        })
      } finally {
        setSaveLoading(false)
      }
    },
    [handle, saveLoading, toast],
  )



  /**
   * Payload + fallback berbagi dipisah dari tombolnya supaya <ShareSheetTrigger>
   * dan <IconButton> di header memakai SATU sumber kebenaran. Docblock
   * share-sheet-trigger menegaskan komponennya sengaja tidak menyalin sendiri
   * "agar tidak ada dua sumber kebenaran untuk feedback Disalin" — jadi
   * fallback-nya di sini, dikirim lewat `onUnavailable`.
   */
  const profileSharePayload = useCallback(
    (): SharePayload => {
      const h = handle ?? ""
      return {
        title: translate("@{x} di Kahade", { x: h }),
        message: translate("Lihat profil {x} di Kahade", { x: profile?.fullName ?? `@${h}` }),
        url: profileUrl(h),
      }
    },
    [handle, profile?.fullName],
  )

  const shareUnavailable = useCallback(
    async (payload: SharePayload) => {
      const url = isFilePayload(payload) ? undefined : payload.url
      if (!url) return
      const ok = await copy(url)
      toast.show({
        title: ok ? translate("Tautan profil disalin") : translate("Tidak bisa membagikan"),
        tone: ok ? "success" : "danger",
      })
    },
    [copy, toast],
  )

  const handleShare = useCallback(async () => {
    if (!handle) return
    const payload = profileSharePayload()
    const outcome = await shareContent(payload)
    if (outcome === "unavailable") await shareUnavailable(payload)
  }, [handle, profileSharePayload, shareUnavailable])

  const handleBlock = useCallback(async () => {
    // P3 (audit 2026-09-26): tamu di-gate login sebelum aksi blokir.
    if (!requireSession()) return
    // `profile.id` bisa kosong bila backend tidak mengirim id pada profil publik.
    // Versi lama langsung `return` di sini: tombol Blokir tampak tidak melakukan
    // apa pun. Sekarang username dikirim sebagai identifier cadangan (adapter
    // mencoba id lebih dulu, lalu username bila backend menjawab 404), dan bila
    // keduanya tidak ada pengguna diberi tahu — bukan didiamkan.
    if (!profile?.id && !handle) {
      toast.show({
        title: translate("Gagal memblokir pengguna"),
        description: translate("Identitas pengguna tidak tersedia. Muat ulang halaman lalu coba lagi."),
        tone: "danger",
      })
      return
    }
    setBlocking(true)
    try {
      await api.settings.blockUser(profile?.id ?? "", handle)
      toast.show({ title: translate("Pengguna diblokir"), tone: "success", duration: 3000 })
      setBlockOpen(false)
      goBackOrNavigate(ROUTES.home)
    } catch (err: unknown) {
      toast.show({
        title: translate("Gagal memblokir pengguna"),
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setBlocking(false)
    }
  }, [profile?.id, handle, requireSession, toast])

  // Question & Comment handlers
  // P3 (audit 2026-09-26): buka sheet tanya hanya bila sudah login.
  const openAsk = useCallback(() => {
    if (!requireSession()) return
    setAskOpen(true)
  }, [requireSession])

  const submitAsk = useCallback(async () => {
    if (!username || askText.trim().length < 5) return
    setAsking(true)
    try {
      await api.users.addQuestion(username, askText.trim())
      toast.show({ title: translate("Pertanyaan terkirim"), tone: "success", duration: 3000 })
      setAskOpen(false)
      setAskText("")
      const res = await api.users.getPublicQuestions(username, { page: 1, limit: 20 })
      const { items } = readQuestionList(res)
      setQuestions(items)
    } catch (err) {
      toast.show({
        title: translate("Gagal mengirim pertanyaan"),
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
        toast.show({ title: translate("Gagal memuat komentar"), tone: "danger" })
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
      toast.show({ title: translate("Komentar terkirim"), tone: "success", duration: 3000 })
    } catch (err) {
      toast.show({
        title: translate("Gagal mengirim komentar"),
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
        toast.show({ title: translate("Pertanyaan dihapus"), tone: "neutral", duration: 3000 })
        const res = await api.users.getPublicQuestions(username, { page: 1, limit: 20 })
        const { items } = readQuestionList(res)
        setQuestions(items)
      } else if (deleteC && openQuestionId) {
        await api.users.deleteQuestionComment(deleteC.id)
        setDeleteC(null)
        toast.show({ title: translate("Komentar dihapus"), tone: "neutral", duration: 3000 })
        const body = await api.users.getQuestionComments(openQuestionId, { page: 1, limit: 20 })
        const { items } = readQuestionComments(body)
        setQuestionComments({ items, loading: false })
      }
    } catch (err) {
      toast.show({ title: translate("Gagal menghapus"), description: userMessage(err), tone: "danger" })
    } finally {
      setDeleting(false)
    }
  }, [deleting, deleteQ, deleteC, openQuestionId, username, toast])

  const isMyQuestion = (q: QuestionItem) => !!meId && q.asker?.id === meId
  const isMyComment = (c: QuestionComment) => !!meId && c.authorId === meId

  return (
    <Screen edges={["top"]} padded={false}>
      <DataScroll onRefresh={handleRefresh} refreshing={refreshing} padded={false}>
        {/* ── Top Bar (di atas cover) ──────────────────────────
            <Header transparent>: @username PUSAT di bar — satu-satunya
            tempat username ditulis (baris identitas di bawah hanya nama).
            Profil sekarang seragam memiliki tombol Back untuk semua pengguna. */}
        <Header
          transparent
          title={handle ? `@${handle}` : undefined}
          showBack={true}
          onBack={() => goBackOrNavigate(ROUTES.home)}
          right={
            profile ? (
              isSelf ? (
                <IconButton
                  icon={DotsThreeVertical}
                  variant="ghost"
                  accessibilityLabel={translate("Pengaturan")}
                  onPress={() => router.push(ROUTES.settings)}
                />
              ) : (
                <IconButton
                  icon={DotsThreeVertical}
                  variant="ghost"
                  accessibilityLabel={translate("Pilihan lainnya")}
                  onPress={() => setMoreOptionsOpen(true)}
                />
              )
            ) : null
          }
        />

        {/* ── Top Cover (KARTU) ────────────────────────────────
            Sampul kartu bersih tanpa tombol navigasi di dalamnya. */}
        <View className="px-5 pt-1">
          <View
            className="relative w-full overflow-hidden rounded-md border border-border bg-surface"
            style={{ height: COVER_HEIGHT }}
          >
            {/*
             * Foto sampul (header image) profil — `headerUrl` dari
             * GET /v1/users/{username}. URL dinormalkan lib/media.ts
             * (backend bisa mengirim path relatif). Placeholder ikon hanya
             * tampil SETELAH profil termuat — saat loading kartu dibiarkan
             * polos supaya "Belum ada foto sampul" tidak berkedip sebelum
             * foto milik user yang sebenarnya ber sampul tiba.
             */}
            {coverUri ? (
              <View className="absolute inset-0">
                <Picture
                  source={{ uri: coverUri }}
                  alt={translate("Foto sampul profil")}
                  height={COVER_HEIGHT}
                  radius="none"
                  bordered={false}
                  resizeMode="cover"
                />
              </View>
            ) : profile ? (
              <View className="absolute inset-0 items-center justify-center gap-1">
                <Icon icon={ImageIcon} size="md" tone="default" />
                <Text variant="caption" tone="secondary">
                  Belum ada foto sampul
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* v2: skeleton sebentuk profil → konten crossfade. Skeleton kustom
            (bukan <ListLoading/>) DIPERTAHANKAN — geometrinya disamakan dengan
            konten agar avatar tidak melompat (lihat komentar di bawah). */}
        <Crossfade
          loading={loading && !profile}
          skeleton={
            <View className="px-5 gap-4">
              {/*
               * Geometri kerangka HARUS identik dengan blok `profile` di bawah:
               * avatar menimpa sampul 30% (-mt-6) dengan lingkaran 80px (xl).
               * Selisih sekecil apa pun membuat avatar "melompat" tiap kali
               * data profil tiba — jaga kedua angka ini tetap sinkron.
               */}
              <View className="flex-row items-end justify-between -mt-6">
                <Skeleton shape="circle" width={80} height={80} className="border-4 border-background" />
                <Skeleton width={96} height={36} className="rounded-sm" />
              </View>
              <Skeleton height={24} className="w-3/5" />
              <Skeleton height={14} className="w-2/5" />
              <Skeleton height={16} className="w-4/5" />
              <Skeleton height={16} className="w-2/5" />
            </View>
          }
        >
          {error ? (
          <View className="px-5 pt-8">
            <ErrorState title={translate("Gagal memuat profil")} description={error} onRetry={() => void fetchProfile()} />
          </View>
        ) : profile ? (
          <View className="w-full">
            {/* ── Avatar & Quick Action Row ──────────────────────
                A.2: avatar 80px (xl) menimpa kartu sampul 24px = 30% (dulu
                -mt-12 = 48px/60%); 70% sisanya berada di bawah kartu sehingga
                nama & aksi tidak terdorong jauh ke bawah. */}
            <View className="flex-row items-end justify-between px-5 -mt-6">
              <View className="rounded-full border-4 border-background bg-background">
                <Avatar source={profile.avatarUrl ? { uri: profile.avatarUrl } : undefined} name={profile.fullName ?? handle} size="xl" />
              </View>

              {/* A.4 — hierarki: aksi tersier (♡ Favorit, 🔖 Tersimpan, dan
                  kini ⤴ Bagikan) duduk SATU baris di samping avatar; aksi
                  primer/sekunder ([Ikuti] / [Kirim Pesan]) tetap mendapat
                  baris berlabel sendiri di bawah bio. Bagikan dipindah dari
                  top bar ke sini (permintaan produk 2026-09-21) karena ia
                  aksi terhadap profil ini, bukan navigasi — dan di top bar ia
                  bersaing dengan ⋮.
                  Profil sendiri: [Edit profil] di posisi KIRI baris ini, lalu
                  Bagikan di kanan, sehingga urutan aksinya sama dengan profil
                  orang lain (aksi utama paling kiri). */}
              <View className="flex-row items-center gap-2 pb-1">
                {isSelf ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    fullWidth={false}
                    leftIcon={PencilSimple}
                    onPress={() => router.push(ROUTES.editProfile)}
                  >
                    Edit profil
                  </Button>
                ) : (
                  <>
                    <FavoriteIconButton
                      active={favorite}
                      disabled={favLoading}
                      onToggle={(next) => void handleFavorite(next)}
                      accessibilityLabel={favorite ? translate("Hapus favorit") : translate("Simpan favorit")}
                      size="sm"
                      className="border border-border"
                    />
                    <IconButton
                      icon={Bookmark}
                      variant="secondary"
                      size="sm"
                      active={saved}
                      accessibilityLabel={saved ? translate("Hapus dari tersimpan") : translate("Simpan profil")}
                      loading={saveLoading}
                      onPress={() => void handleSaveProfile(!saved)}
                    />
                  </>
                )}
                <IconButton
                  icon={ShareNetwork}
                  variant="secondary"
                  size="sm"
                  accessibilityLabel={translate("Bagikan profil")}
                  onPress={() => void handleShare()}
                />
              </View>
            </View>

            {/* ── User Identity & Bio ──────────────────────────── */}
            <View className="gap-2 px-5 pt-3">
              {/* A.3 — Nama saja. @username sudah PUSAT di top bar; ditulis
                  lagi di sini membuat dua baris identitas yang isinya sama
                  (permintaan produk 2026-09-21). Bila profil tanpa nama,
                  handle naik jadi nama supaya baris ini tidak kosong. */}
              <View className="flex-row items-center gap-1">
                <Text variant="h2" weight={700} tone="primary">
                  {profile.fullName || `@${handle}`}
                </Text>
                {/* Seal-check 3 tier (emas/biru/abu) — ketuk untuk detail. */}
                <VerifiedSeal badges={badges} verified={profile.verified} size={18} />
                {/*
                 * Benefit 2 Kahade+ ("centang abu"): lencana keanggotaan Plus
                 * MILIK VIEWER — hanya di profil sendiri (isSelf), tidak di
                 * profil orang lain. <VerifiedSeal> di atas tidak diubah.
                 */}
                {isSelf ? <GreyCheckBadge size={18} /> : null}
              </View>

              {/* Badge verifikasi aktif — ketuk untuk melihat keterangan tiap badge. */}
              {badges.length > 0 ? (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={translate("Lihat detail verifikasi akun")}
                    onPress={() => setVerifySheetOpen(true)}
                  >
                    <View className="flex-row flex-wrap items-center gap-1.5 pt-0.5">
                      {badges.map((b) => (
                        <Badge
                          key={b.type}
                          tone="neutral"
                          variant="soft"
                          icon={BADGE_ICON[b.icon] ?? SealCheck}
                          accessibilityLabel={`${b.label}: ${b.description}`}
                        >
                          {b.shortLabel}
                        </Badge>
                      ))}
                    </View>
                  </Pressable>
                  <VerificationSheet
                    visible={verifySheetOpen}
                    onRequestClose={() => setVerifySheetOpen(false)}
                    badges={badges}
                    tier={getSealTier(badges) ?? "gray"}
                  />
                </>
              ) : null}

              {profile.bio ? (
                <Text variant="body" tone="secondary" numberOfLines={4}>
                  {profile.bio}
                </Text>
              ) : (
                <Text variant="caption" tone="tertiary">
                  {translate("Pengguna terdaftar Kahade Escrow & Marketplace")}
                </Text>
              )}

              {/* ── Stats / Counter Strip (langsung di bawah bio) ── */}
              <View className="flex-row flex-wrap items-center gap-4 pt-1">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={translate("{x} mengikuti", { x: formatNumber(followingCount ?? 0) })}
                  hitSlop={TEXT_ROW_HIT_SLOP}
                  onPress={() => router.push(ROUTES.followers(handle, "following"))}
                >
                  <Text variant="body" tone="secondary">
                    <Text variant="body" weight={700} tone="primary">
                      {formatNumber(followingCount ?? 0)}{" "}
                    </Text>
                    {translate("Mengikuti")}
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={translate("{x} pengikut", { x: formatNumber(followerCount ?? 0) })}
                  hitSlop={TEXT_ROW_HIT_SLOP}
                  onPress={() => router.push(ROUTES.followers(handle))}
                >
                  <Text variant="body" tone="secondary">
                    <Text variant="body" weight={700} tone="primary">
                      {formatNumber(followerCount ?? 0)}{" "}
                    </Text>
                    {translate("Pengikut")}
                  </Text>
                </Pressable>

                {profile.rating != null ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={translate("{x} dari {y}, buka ulasan", { x: formatDecimal(profile.rating), y: 5 })}
                    hitSlop={TEXT_ROW_HIT_SLOP}
                    onPress={() => setActiveTab("ratings")}
                  >
                    <Text variant="body" tone="secondary">
                      <Text variant="body" weight={700} tone="primary">
                        {formatDecimal(profile.rating)} ★{" "}
                      </Text>
                      {translate("Ulasan")}
                    </Text>
                  </Pressable>
                ) : null}

                {profile.trustScore != null ? (
                  <View className="flex-row items-center gap-1">
                    {/* v2: skor = accent di semua permukaan (ikut TrustScoreCard). */}
                    <Icon icon={ShieldCheck} size="xs" tone="accent" weight="fill" />
                    <Text variant="body" weight={700} tone="accent">
                      {profile.trustScore}
                    </Text>
                    <Text variant="caption" tone="secondary">
                      {translate("Skor")}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* ── A.4 Action Row (HANYA profil orang lain) ────────
                  PRIMARY  : [Ikuti] — aksi sosial utama.
                  SECONDARY: [Kirim Pesan] — membuka sheet inquiry.
                  Diletakkan di bawah bio & statistik pengikut/mengikuti.
                  Profil sendiri tidak menampilkan tombol-tombol ini. */}
              {!isSelf ? (
                <>
                  <View className="flex-row items-center gap-2 pt-2">
                    <View className="flex-1">
                      <FollowButton
                        fullWidth
                        following={following === true}
                        loading={followLoading || following == null}
                        onToggle={(next) => void handleFollow(next)}
                      />
                    </View>
                    <View className="flex-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        fullWidth
                        leftIcon={ChatCircleDots}
                        onPress={() => {
                          // P3 (audit 2026-09-26): tamu di-gate login sebelum mulai percakapan.
                          if (!requireSession()) return
                          setInquirySubject("")
                          setInquiryMessage("")
                          setInquiryOpen(true)
                        }}
                      >
                        {translate("Kirim Pesan")}
                      </Button>
                    </View>
                  </View>

                  <View className="pt-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={Handshake}
                      onPress={() => router.push(ROUTES.createTransactionWith(handle))}
                    >
                      Buat transaksi escrow
                    </Button>
                  </View>
                </>
              ) : null}
            </View>

            {/* ── Tabs Bar ───────────────────────────────────────── */}
            <View className="pt-4">
              <Tabs<ProfileTab>
                items={profileTabs}
                value={activeTab}
                onChange={setActiveTab}
              />
            </View>

            {/* ── Tab Content 1: Etalase (Showcase) ───────────────
                A.5: list & interaksinya SAMA PERSIS dengan halaman Showcase
                (<ShowcaseFeedItem> + sheet komentar) — seluruhnya milik
                <ProfileEtalaseTab> (ekstrak G-11). */}
            {activeTab === "content" ? (
              <ProfileEtalaseTab
                items={showcaseItems}
                loading={showcaseLoading}
                error={showcaseError}
                onRetry={() => fetchShowcaseTab(handle)}
                handle={handle}
                isSelf={isSelf}
                owner={{
                  id: profile.id,
                  username: handle,
                  fullName: profile.fullName,
                  avatarUrl: profile.avatarUrl,
                  verified: profile.verified,
                }}
              />
            ) : null}

            {/* ── Tab Content 2: Utas (QTab Content 2: Tanya Jawab (Q&A)A, mantan "Tanya Jawab") ──────────────── */}
            {activeTab === "questions" ? (
              <View className="px-5 pt-4 gap-4">
                {/*
                 * D.1 (overflow): <Button> default fullWidth=true (w-full), jadi
                 * tombol "Bertanya" mengambil selebar baris dan meluber keluar
                 * layar. Perbaikan dua sisi: teks dibatasi (flex-1 + 1 baris)
                 * dan tombol dikecilkan ke lebar konten (fullWidth={false}).
                 */}
                <View className="flex-row items-center justify-between gap-3">
                  <Text variant="label" tone="secondary" numberOfLines={1} className="flex-1">
                    {translate("Pertanyaan Pengguna ({x})", { x: questions.length })}
                  </Text>
                  {!isSelf ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      fullWidth={false}
                      onPress={openAsk}
                    >
                      {translate("Bertanya")}
                    </Button>
                  ) : null}
                </View>

                {questionsLoading ? (
                  <ListLoading />
                ) : questions.length === 0 ? (
                  <EmptyState
                    icon={ChatCircleDots}
                    title={translate("Belum ada pertanyaan")}
                    description={
                      isSelf
                        ? translate("Belum ada pertanyaan dari pengguna lain.")
                        : translate("Jadilah yang pertama bertanya kepada @{x}.", { x: handle })
                    }
                    action={
                      !isSelf ? (
                        <Button variant="secondary" fullWidth={false} onPress={openAsk}>
                          {translate("Ajukan pertanyaan")}
                        </Button>
                      ) : undefined
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
                        upvote={{
                          count: q.upvoteCount ?? 0,
                          active: q.isUpvotedByViewer === true,
                          loading: upvotingId === q.id,
                          onToggle: (next) => void handleUpvote(q, next),
                        }}
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
                            {/* D.1: tombol inline wajib fullWidth={false} — default
                                Button adalah w-full, meluber di dalam baris. */}
                            <Button
                              size="sm"
                              variant="ghost"
                              fullWidth={false}
                              onPress={() => void toggleComments(q)}
                            >
                              {openQuestionId === q.id ? translate("Tutup balasan") : translate("Lihat balasan")}
                            </Button>
                            {isMyQuestion(q) ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                fullWidth={false}
                                onPress={() => setDeleteQ(q)}
                              >
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
                            <Text variant="caption" tone="secondary">{translate("Belum ada komentar.")}</Text>
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
                                extra={
                                  isSelf && !c.deleted && !c.isOwner ? (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      fullWidth={false}
                                      onPress={() => setHideC(c)}
                                    >
                                      Sembunyikan
                                    </Button>
                                  ) : undefined
                                }
                              />
                            ))
                          )}

                          <QaCommentComposer
                            value={commentText}
                            onChangeText={setCommentText}
                            onSubmit={() => void submitComment()}
                            submitting={commentSending}
                            maxLength={1000}
                            placeholder={translate("Tulis balasan untuk @{x}…", { x: handle })}
                          />
                        </Card>
                      ) : null}
                    </View>
                  ))
                )}
              </View>
            ) : null}

            {/* ── Tab Content 3: Ulasan (Ratings) ─────────────────
                Perilaku tidak berubah — dipindah ke <ProfileRatingsTab>
                (ekstrak G-11). */}
            {activeTab === "ratings" ? (
              <ProfileRatingsTab
                ratings={ratings}
                loading={ratingsLoading}
                filter={ratingFilter}
                onFilterChange={setRatingFilter}
                handle={handle}
                isSelf={isSelf}
              />
            ) : null}

            {/* ── Tab Content 4: Tentang (About & Info) ───────────
                B.1: "Laporkan"/"Blokir" pindah ke header (menu kebab profil
                orang lain). B.2: kontak publik + "Bergabung sejak" —
                selengkapnya di <ProfileAboutTab> (ekstrak G-11). */}
            {activeTab === "about" ? <ProfileAboutTab profile={profile} /> : null}
          </View>
        ) : (
          <EmptyState icon={UserCircle} title={translate("Profil tidak ditemukan")} />
        )}
        </Crossfade>
      </DataScroll>

      {/* Navbar kini persisten di root (_layout PersistentShellBar) — tidak per halaman. */}
      {/* ── Dialog Bertanya ──────────────────────────────────── */}
      <Dialog
        title={translate("Bertanya kepada @{x}", { x: handle })}
        description={translate("Pertanyaan Anda akan tampil di profil ini dan dijawab oleh pemiliknya.")}
        visible={askOpen}
        loading={asking}
        confirmLabel={translate("Kirim Pertanyaan")}
        confirmButtonProps={{ disabled: askText.trim().length < 5 }}
        cancelLabel={translate("Batal")}
        onConfirm={() => void submitAsk()}
        onCancel={() => setAskOpen(false)}
        onRequestClose={() => setAskOpen(false)}
      >
        <TextArea
          value={askText}
          onChangeText={setAskText}
          placeholder={translate("Tulis pertanyaan Anda minimal 5 karakter…")}
          maxLength={500}
          showCount
        />
      </Dialog>

      {/* ── Dialog Hapus Pertanyaan / Komentar ──────────────── */}
      <Dialog
        title={deleteQ ? translate("Hapus pertanyaan?") : translate("Hapus komentar?")}
        description={
          deleteQ
            ? translate("Pertanyaan beserta jawabannya akan dihapus dari profil ini.")
            : translate("Komentar Anda akan dihapus dari utas ini.")
        }
        visible={!!deleteQ || !!deleteC}
        destructive
        loading={deleting}
        confirmLabel={translate("Hapus")}
        cancelLabel={translate("Batal")}
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
        title={translate("Blokir @{x}?", { x: handle })}
        description={translate("Anda tidak akan lagi melihat aktivitas atau dapat bertransaksi dengan pengguna ini.")}
        visible={blockOpen}
        destructive
        loading={blocking}
        confirmLabel={translate("Blokir")}
        cancelLabel={translate("Batal")}
        onConfirm={() => void handleBlock()}
        onCancel={() => setBlockOpen(false)}
        onRequestClose={() => setBlockOpen(false)}
      />

      {/* ── Dialog Pilihan Lainnya ──────────────────────────── */}
      <Dialog
        title={translate("Pilihan Akun")}
        visible={moreOptionsOpen}
        hideCancel
        confirmLabel={translate("Tutup")}
        onConfirm={() => setMoreOptionsOpen(false)}
        onRequestClose={() => setMoreOptionsOpen(false)}
      >
        <View className="gap-2 pt-2">
          {/* ShareSheetTrigger menggantikan tombol Bagikan tulisan tangan:
              guard "sedang berbagi" (dua tap tidak lagi bisa membuka dua
              sheet bertumpuk) dan pemetaan outcome pindah ke komponen.
              Mode render-prop DIPAKAI, bukan mode Button bawaan, karena
              dialog "Pilihan Akun" harus ditutup LEBIH DULU sebelum sheet OS
              muncul (§9.9 satu overlay pada satu waktu). */}
          <ShareSheetTrigger
            payload={profileSharePayload}
            disabled={!handle}
            onUnavailable={(payload) => void shareUnavailable(payload)}
          >
            {(share, state) => (
              <Button
                variant="ghost"
                leftIcon={ShareNetwork}
                loading={state.sharing}
                disabled={state.sharing}
                onPress={() => {
                  setMoreOptionsOpen(false)
                  share()
                }}
              >
                Bagikan profil
              </Button>
            )}
          </ShareSheetTrigger>
          <Button
            variant="ghost"
            leftIcon={Flag}
            onPress={() => {
              setMoreOptionsOpen(false)
              // Tanpa `id` pun laporan tetap bisa dibuka: username dipakai
              // sebagai identifier cadangan oleh api.settings.reportUser.
              if (profile?.id || handle)
                router.push(
                  ROUTES.reports({ targetId: profile?.id || handle, targetName: handle }),
                )
            }}
          >
            Laporkan pengguna
          </Button>
          <Button
            variant="destructive"
            leftIcon={Prohibit}
            onPress={() => {
              setMoreOptionsOpen(false)
              setBlockOpen(true)
            }}
          >
            Blokir pengguna
          </Button>
        </View>
      </Dialog>

      {/* Inquiry — buka ruang pra-transaksi (POST /v1/chat/inquiries) lalu
          langsung masuk ke ruang chat hasil inquiry. */}
      <BottomSheet
        avoidKeyboard
        visible={hideC != null}
        onRequestClose={() => setHideC(null)}
        title={translate("Sembunyikan komentar")}
        description={translate("Komentar tidak lagi tampil untuk pengguna lain. Tindakan dapat dibatalkan lewat moderasi.")}
        footer={
          <Button
            fullWidth
            variant="destructive"
            loading={hidingC}
            onPress={() => void submitHideComment()}
          >
            Sembunyikan
          </Button>
        }
      >
        <View className="px-5 pb-2">
          <RadioGroup value={hideCReason} onChange={(v) => setHideCReason(v as HiddenReason)}>
            {qaHideReasons.map((r) => (
              <Radio key={r.value} value={r.value} label={r.label} description={r.description} />
            ))}
          </RadioGroup>
        </View>
      </BottomSheet>

      <BottomSheet
        avoidKeyboard
        visible={inquiryOpen}
        onRequestClose={() => setInquiryOpen(false)}
        title={translate("Mulai percakapan")}
        description={
          profile?.fullName
            ? translate("Ajukan pertanyaan atau negosiasi dengan {x} sebelum transaksi.", {
                x: profile.fullName,
              })
            : translate("Ajukan pertanyaan atau negosiasi sebelum transaksi.")
        }
        footer={
          <Button
            fullWidth
            loading={inquirySending}
            disabled={!inquiryMessage.trim()}
            onPress={() => {
              if (!profile?.id) return
              setInquirySending(true)
              createInquiry({
                counterpartId: profile.id,
                subject: inquirySubject.trim() || undefined,
                message: inquiryMessage.trim(),
              })
                .then((res) => {
                  setInquiryOpen(false)
                  // C-06: nama lawan bicara = pemilik profil layar ini.
                  router.push(
                    ROUTES.chatRoom(res.room.id, profile?.fullName ?? `@${handle}`),
                  )
                })
                .catch((err) => {
                  toast.show({
                    title: translate("Gagal memulai percakapan"),
                    description: isApiError(err) ? userMessage(err) : undefined,
                    tone: "danger",
                  })
                })
                .finally(() => setInquirySending(false))
            }}
          >
            Kirim
          </Button>
        }
      >
        <View className="gap-3 px-5 pb-2">
          <Input
            label={translate("Subjek (opsional)")}
            value={inquirySubject}
            onChangeText={setInquirySubject}
            placeholder={translate("Mis. Harga grosir 10 pcs")}
            containerClassName="mb-1"
          />
          <TextArea
            label={translate("Pesan")}
            value={inquiryMessage}
            onChangeText={setInquiryMessage}
            rows={4}
            placeholder={translate("Tulis pertanyaan atau tawaran Anda…")}
            accessibilityLabel={translate("Pesan inquiry")}
          />
        </View>
      </BottomSheet>
    </Screen>
  )
}