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
  BookmarkSimple,
  Briefcase,
  ChatCircleDots,
  DotsThreeVertical,
  Envelope,
  Flag,
  Handshake,
  IdentificationBadge,
  Image as ImageIcon,
  Lock,
  PencilSimple,
  Prohibit,
  QrCode,
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
import { getOrCreateDm, isDmNotAllowedError } from "@/lib/api/chat"
import { isOwnQuestion, isOwnQuestionComment, resolveFollowStatus } from "@/lib/api/users"
import {
  readQuestionComments,
  readQuestionList,
} from "@/lib/api/users"
import { useCopy } from "@/lib/clipboard"
import { profileUrl } from "@/lib/deeplinks"
import { formatDateTime, formatDecimal, formatNumber } from "@/lib/format"
import { acquireShowcaseMutation } from "@/lib/showcase-state"
import { useHasSession } from "@/lib/guest-gate"
import { goBackOrNavigate } from "@/lib/navigation"
import { resolveMediaUrl } from "@/lib/media"
import { ROUTES } from "@/lib/routes"
import { isFilePayload, type SharePayload } from "@/lib/share"
import { TEXT_ROW_HIT_SLOP } from "@/lib/hit-slop"
import { logWarn } from "@/lib/telemetry"

import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { VerificationSheet, getSealTier } from "@/components/ui/verified-seal"
import { VerifiedName } from "@/components/ui/verified-name"
import { GreyCheckBadge } from "@/components/ui/grey-check-badge"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Radio, RadioGroup } from "@/components/ui/radio"
import { ActionSheet } from "@/components/ui/action-sheet"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { FavoriteIconButton } from "@/components/ui/favorite-icon-button"
import { FollowButton } from "@/components/ui/follow-button"
import { Header } from "@/components/ui/header"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { ImageViewer } from "@/components/ui/image-viewer"
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
import { ProfileEditSheet } from "@/components/ui/profile-edit-sheet"
import { ProfileHighlightsStrip } from "@/components/ui/profile-highlights-strip"
import { QRCodeDisplay } from "@/components/ui/qr-code-display"
import { Screen } from "@/components/ui/screen"
import { ShareSheetTrigger } from "@/components/ui/share-sheet-trigger"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { Tabs } from "@/components/ui/tabs"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"

type ProfileTab = "content" | "questions" | "ratings" | "about"

/**
 * Item 72 (mega-batch 2026-09-28): tab profil TERAKHIR diingat PER SESI
 * (memori modul — hilang saat app di-restart, bukan preferensi persisten).
 * Pindah antar profil memulihkan tab terakhir, bukan selalu "Etalase".
 */
let sessionProfileTab: ProfileTab | null = null

import { bioNeedsToggle } from "@/lib/profile-bio"
import { BioText } from "@/components/ui/bio-text"

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

/**
 * Batch 139 E05/E06 — satu statistik sosial (Mengikuti/Pengikut).
 *
 * - `count === null` SETELAH profil selesai dimuat berarti server tidak
 *   mengirim angka untuk statistik ini → diperlakukan sebagai
 *   "disembunyikan oleh privasi" dan dirender sebagai ikon gembok + teks
 *   "Privat", BUKAN "0". Backend belum punya flag privasi eksplisit untuk
 *   counter, jadi ini fallback terbaik-effort (dilaporkan parsial/butuh API);
 *   tidak ada tebakan "hidden vs error" di luar sinyal null-dari-server ini.
 * - Selama profil masih dimuat, blok profil digantikan skeleton oleh
 *   <Crossfade> di bawah — angka tidak pernah dirender sebagai 0 sementara.
 * - Statistik yang disembunyikan tidak bisa diketuk membuka daftar.
 */
function SocialStat({
  count,
  label,
  onPress,
  openListLabel,
}: {
  count: number | null
  label: string
  onPress: () => void
  openListLabel: string
}) {
  if (count === null) {
    return (
      <View
        className="flex-row items-center gap-1"
        accessibilityRole="text"
        accessibilityLabel={translate("{x}: disembunyikan", { x: label })}
      >
        <Icon icon={Lock} tone="default" size={14} />
        <Text variant="body" tone="tertiary">
          {translate("Privat")}
        </Text>
      </View>
    )
  }
  return (
    <Pressable
      accessibilityLabel={translate("{x} {y}", { x: formatNumber(count), y: label })}
      accessibilityHint={openListLabel}
      accessibilityRole="button"
      hitSlop={TEXT_ROW_HIT_SLOP}
      onPress={onPress}
    >
      <Text variant="body" tone="secondary">
        <Text variant="body" weight={700} tone="primary">
          {formatNumber(count)}{" "}
        </Text>
        {label}
      </Text>
    </Pressable>
  )
}

export default function UserProfileScreen() {  const { username: rawUsername } = useLocalSearchParams<{
    username: string
    self?: string
  }>()
  const username = rawUsername ?? ""
  const toast = useToast()
  const { copy, copiedKey } = useCopy()
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



  // Active tab state — item 72: inisial dari memori sesi (bukan selalu
  // "content"); `selectTab` menulis balik agar sesi mengingatnya.
  const [activeTab, setActiveTab] = useState<ProfileTab>(sessionProfileTab ?? "content")
  const selectTab = useCallback((tab: ProfileTab) => {
    sessionProfileTab = tab
    setActiveTab(tab)
  }, [])

  // Etalase / Showcase state — item MENTAH dari API; normalisasi ke bentuk
  // sosial + interaksinya milik <ProfileEtalaseTab> (ekstrak G-11).
  const { items: showcaseItems, loading: showcaseLoading, error: showcaseError, fetch: fetchShowcaseTab } = useProfileShowcase()

  // Questions / Tanya Jawab state
  const [questions, setQuestions] = useState<QuestionItem[]>([])
  const [upvotingId, setUpvotingId] = useState<string | null>(null)
  const [questionsLoading, setQuestionsLoading] = useState(false)
  /** UX-FDB-008: failure ≠ empty — kegagalan muat dibedakan dari daftar kosong. */
  const [questionsError, setQuestionsError] = useState<string | null>(null)
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
  /** Item 19 (2026-09-28): sheet Kode QR profil (deep link profil). */
  const [qrOpen, setQrOpen] = useState(false)
  /** Item 22 (2026-09-28): sheet edit profil inline (tanpa pindah halaman). */
  const [editOpen, setEditOpen] = useState(false)

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
  /** UX-FDB-008: failure ≠ empty — kegagalan muat dibedakan dari daftar kosong. */
  const [ratingsError, setRatingsError] = useState<string | null>(null)
  const [ratingFilter, setRatingFilter] = useState<PublicRatingFilter>("all")
  /** Item 70 (2026-09-28): urutan ulasan — Terbaru (createdAt desc) / Rating tertinggi. */
  const [ratingSort, setRatingSort] = useState<"newest" | "top">("newest")
  /** Item 61 (2026-09-28): bio kepotong 4 baris + toggle Selengkapnya/Tutup. */
  const [bioExpanded, setBioExpanded] = useState(false)
  /** Item 73 (2026-09-28): ketuk avatar → foto ukuran penuh. */
  const [avatarViewerOpen, setAvatarViewerOpen] = useState(false)

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
  // UI-P006: reset state per-profil saat username berubah — tanpa ini, pindah
  // dari profil A ke B menampilkan tab/angka/daftar milik A selagi B dimuat.
  const prevUsernameRef = useRef(username)
  useEffect(() => {
    if (prevUsernameRef.current === username) return
    prevUsernameRef.current = username
    // Item 72: pulihkan tab terakhir sesi (bukan hard-reset ke "content").
    selectTab(sessionProfileTab ?? "content")
    setQuestions([])
    setRatings([])
    setQuestionsError(null)
    setRatingsError(null)
    setRatingFilter("all")
    setRatingSort("newest")
    setBioExpanded(false)
    setAvatarViewerOpen(false)
    setFollowing(null)
    setFollowerCount(null)
    setFollowingCount(null)
    setFavorite(false)
    setSaved(false)
    setBadges([])
    setOpenQuestionId(null)
    setQuestionComments({ items: [], loading: false })
    setCommentText("")
    setAskText("")
    setAskOpen(false)
    setDeleteQ(null)
    setDeleteC(null)
  }, [username, selectTab])
  // Fetch all tab contents
  const fetchTabContents = useCallback(
    async (targetName: string) => {
      setQuestionsLoading(true)
      setRatingsLoading(true)
      setQuestionsError(null)
      setRatingsError(null)

      fetchShowcaseTab(targetName)

      void api.users
        .getPublicQuestions(targetName, { page: 1, limit: 20 })
        .then((res) => {
          const { items } = readQuestionList(res)
          setQuestions(items)
        })
        .catch((err: unknown) => {
          // UX-FDB-008: jangan samarkan kegagalan sebagai empty state.
          setQuestions([])
          setQuestionsError(userMessage(err))
        })
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
        .catch((err: unknown) => {
          // UX-FDB-008: jangan samarkan kegagalan sebagai empty state.
          setRatings([])
          setRatingsError(userMessage(err))
        })
        .finally(() => setRatingsLoading(false))
    },
    [ratingFilter, fetchShowcaseTab],
  )

  /** UX-FDB-008: muat ulang tab pertanyaan/ulasan setelah kegagalan. */
  const retryTabContents = useCallback(() => {
    if (handle) void fetchTabContents(handle)
  }, [handle, fetchTabContents])

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

      // SS-009/SS-019 (audit 2026-09-26): counter sosial dari payload profil
      // sebagai sumber utama — tersedia seketika bersama profil, sehingga
      // tidak pernah tampil "0 palsu" bila request list tambahan gagal.
      // Request list di bawah hanya merekonsiliasi agar angka sama dengan
      // total yang terlihat saat counter diketuk (membuka daftar).
      const finiteCount = (v: unknown) =>
        typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null
      setFollowerCount(finiteCount(res.social?.followersCount) ?? finiteCount(res.followersCount))
      setFollowingCount(finiteCount(res.social?.followingCount) ?? finiteCount(res.followingCount))

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

      // Rekonsiliasi dengan total list (SS-019): angka profil disamakan dengan
      // yang terlihat di daftar pengikut. Gagal → pertahankan nilai payload
      // (jangan null → "0 palsu", SS-009).
      void api.users
        .getFollowers(targetName, { page: 1, limit: 1 })
        .then((rows) => {
          if (current() && typeof rows.meta.total === "number") setFollowerCount(rows.meta.total)
        })
        .catch(() => {
          /* pertahankan nilai dari payload profil */
        })

      void api.users
        .getFollowing(targetName, { page: 1, limit: 1 })
        .then((rows) => {
          if (current() && typeof rows.meta.total === "number") setFollowingCount(rows.meta.total)
        })
        .catch(() => {
          /* pertahankan nilai dari payload profil */
        })

      // PRF-003: status follow dibaca LANGSUNG dari payload profil
      // (`social.isFollowing` yang dihitung backend dari tabel follow).
      // Versi lama menurunkannya dari GET followers?search= — daftar itu
      // tidak menyertakan id internal (R1), sehingga perbandingan
      // `user.id === me.id` selalu false dan tombol "Ikuti" balik sendiri
      // setiap refresh (bug yang dilaporkan user). Pola itu dihapus total.
      if (current()) setFollowing(resolveFollowStatus(res))
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
  const [dmLoading, setDmLoading] = useState(false)
  /**
   * PRF-002: "Kirim Pesan" langsung ke halaman chat seperti WhatsApp —
   * get-or-create room DM tanpa wajib mengisi pesan pertama (backend
   * memakai ulang room INQUIRY bila sudah ada). Berbeda dengan pesan dalam
   * transaksi (room ORDER — admin bisa masuk saat dispute); room DM tidak
   * bisa dimasuki admin.
   */
  const handleSendMessage = useCallback(async () => {
    // P3 (audit 2026-09-26): tamu di-gate login sebelum mulai percakapan.
    if (!requireSession() || !handle || dmLoading) return
    setDmLoading(true)
    try {
      const room = await getOrCreateDm(handle)
      router.push(ROUTES.chatRoom(room.id, profile?.fullName ?? `@${handle}`))
    } catch (err) {
      // Batch 43: CHAT_DM_NOT_ALLOWED (403) → penolakan sopan, bukan error
      // generik — penerima membatasi siapa yang bisa mengirimi DM baru.
      if (isDmNotAllowedError(err)) {
        toast.show({
          title: translate("Tidak bisa mengirim pesan"),
          description: translate(
            "Pengguna ini membatasi pesan langsung baru. Anda hanya bisa chat dengannya lewat transaksi.",
          ),
          tone: "info",
        })
      } else {
        toast.show({
          title: translate("Gagal membuka chat"),
          description: userMessage(err),
          tone: "danger",
        })
      }
    } finally {
      setDmLoading(false)
    }
  }, [requireSession, handle, dmLoading, profile?.fullName, toast])

  // Follow / Favorite actions
  const handleFollow = useCallback(
    async (next: boolean) => {
      if (!handle) return
      // P3 (audit 2026-09-26): tamu diarahkan login dulu — jangan tembak
      // endpoint lalu gagal 401 dengan toast "Gagal mengikuti".
      if (!requireSession()) return
      // SH-F-004 (audit 2026-09-27): kunci in-flight per-handle — guard
      // boolean `followLoading` saja balapan antar dua tap cepat (keduanya
      // membaca state lama sebelum setState pertama diterapkan), sehingga
      // follow+unfollow bisa terkirim bersamaan dan state akhir berlawanan
      // dengan server. Kunci sinkron ini menolak tap kedua seketika.
      const release = acquireShowcaseMutation(`follow:${handle}`)
      if (!release) return
      // Rollback memakai SNAPSHOT nilai sebelum optimistis (bukan `!next`) —
      // bila state sempat berubah di tengah, rollback tidak ikut membaliknya.
      const prevFollowing = following
      const prevCount = followerCount
      setFollowing(next)
      setFollowerCount((c) => (c == null ? c : Math.max(0, c + (next ? 1 : -1))))
      setFollowLoading(true)
      try {
        if (next) await api.users.followUser(handle)
        else await api.users.unfollowUser(handle)
      } catch (err) {
        setFollowing(prevFollowing)
        setFollowerCount(prevCount)
        toast.show({
          title: next ? translate("Gagal mengikuti") : translate("Gagal berhenti mengikuti"),
          description: isApiError(err) ? userMessage(err) : undefined,
          tone: "danger",
        })
      } finally {
        release()
        setFollowLoading(false)
      }
    },
    [handle, requireSession, toast, following, followerCount],
  )

  const handleFavorite = useCallback(
    async (next: boolean) => {
      if (!handle) return
      if (!requireSession()) return
      // UI-P005: kunci sinkron per-handle — guard `favLoading` (state async)
      // balapan antar dua tap cepat (keduanya membaca state lama sebelum
      // setState pertama diterapkan), seperti pada follow (SH-F-004).
      const release = acquireShowcaseMutation(`favorite:${handle}`)
      if (!release) return
      // PERF-FIX (network P2): optimistis seperti handleFollow — set dulu,
      // rollback ke snapshot saat gagal. Sebelumnya: menunggu round-trip
      // sebelum tombol berubah.
      const prevFavorite = favorite
      setFavorite(next)
      setFavLoading(true)
      try {
        if (next) await api.users.addFavorite(handle)
        else await api.users.removeFavorite(handle)
      } catch (err: unknown) {
        setFavorite(prevFavorite)
        toast.show({
          title: translate("Gagal memperbarui favorit"),
          description: userMessage(err),
          tone: "danger",
        })
      } finally {
        release()
        setFavLoading(false)
      }
    },
    [handle, requireSession, toast, favorite],
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
      // UI-P001: tamu di-gate ke login seperti aksi sosial lain (follow,
      // favorit, chat, blokir) — jangan tembak endpoint lalu gagal 401.
      if (!requireSession()) return
      // UI-P005: kunci sinkron per-handle — guard `saveLoading` (state async)
      // balapan antar dua tap cepat, seperti pada follow (SH-F-004).
      const release = acquireShowcaseMutation(`save-profile:${handle}`)
      if (!release) return
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
        release()
        setSaveLoading(false)
      }
    },
    [handle, saveLoading, toast, requireSession],
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

  // PRF-001: kepemilikan via helper bersama lib/api/users (terkunci test
  // unit) — bandingkan `askerId`/`authorId` (id internal) dengan id saya.
  // Pola yang sama dipakai layar Tanya Jawab publik.
  const isMyQuestion = (q: QuestionItem) => isOwnQuestion(q, meId)
  const isMyComment = (c: QuestionComment) => isOwnQuestionComment(c, meId)

  return (
    <Screen keyboardAvoiding edges={["top"]} padded={false}>
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
                  className="w-full"
                  style={{ width: "100%", aspectRatio: undefined }}
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
              {/* Item 73 (2026-09-28): ketuk avatar → lihat foto ukuran penuh
                  (<ImageViewer>). Hanya bila ada foto — tanpa avatar, tidak ada
                  yang bisa diperbesar. */}
              <View className="rounded-full border-4 border-background bg-background">
                {profile.avatarUrl ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={translate("Lihat foto profil ukuran penuh")}
                    onPress={() => setAvatarViewerOpen(true)}
                  >
                    <Avatar source={{ uri: profile.avatarUrl }} name={profile.fullName ?? handle} size="xl" />
                  </Pressable>
                ) : (
                  <Avatar source={undefined} name={profile.fullName ?? handle} size="xl" />
                )}
              </View>

              {/* A.4 — aksi ringkas yang relevan duduk di samping avatar;
                  aksi utama [Ikuti]/[Kirim Pesan] tetap berada di bawah bio.
                  Bagikan tersedia dari bottom sheet titik tiga. Profil sendiri
                  menampilkan [Ubah profil] di posisi kiri baris ini. */}
              <View className="flex-row items-center gap-2 pb-1">
                {isSelf ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    fullWidth={false}
                    leftIcon={PencilSimple}
                    // Item 22 (2026-09-28): edit inline lewat bottom sheet —
                    // tanpa pindah halaman. Layar edit lengkap
                    // (app/edit-profile.tsx) tetap ada via link di sheet.
                    onPress={() => setEditOpen(true)}
                  >
                    {translate("Ubah profil")}
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
                      icon={BookmarkSimple}
                      variant="secondary"
                      size="sm"
                      active={saved}
                      accessibilityLabel={saved ? translate("Hapus dari tersimpan") : translate("Simpan profil")}
                      loading={saveLoading}
                      onPress={() => void handleSaveProfile(!saved)}
                    />
                  </>
                )}
                {/* Item 19 (2026-09-28): Kode QR profil — deep link
                    https://kahade.id/user/<username>, dipindai kamera. */}
                <IconButton
                  icon={QrCode}
                  variant="secondary"
                  size="sm"
                  accessibilityLabel={translate("Kode QR profil")}
                  onPress={() => setQrOpen(true)}
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
                <VerifiedName
                  name={profile.fullName || `@${handle}`}
                  variant="h2"
                  badges={badges}
                  verified={profile.verified}
                  textProps={{ weight: 700, tone: "primary" }}
                />
                {/*
                 * Benefit 2 Kahade+ ("centang abu"): lencana keanggotaan Plus
                 * MILIK VIEWER — hanya di profil sendiri (isSelf), tidak di
                 * profil orang lain. <VerifiedName> di atas tidak diubah.
                 */}
                {isSelf ? <GreyCheckBadge size={18} /> : null}
                {/*
                 * Item 62 (mega-batch 2026-09-28): chip "Mengikuti Anda" bila
                 * `social.isFollowedBy=true` (field API sudah ada, PRF-003).
                 * Hanya di profil orang lain — di profil sendiri tidak relevan.
                 */}
                {!isSelf && profile.social?.isFollowedBy === true ? (
                  <Badge tone="accent" variant="soft">
                    {translate("Mengikuti Anda")}
                  </Badge>
                ) : null}
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

              {/*
               * Item 61 (mega-batch 2026-09-28): bio kepotong 4 baris +
               * toggle "Selengkapnya"/"Tutup". Toggle hanya muncul bila bio
               * cukup panjang untuk benar-benar terpotong (heuristik
               * BIO_PREVIEW_CHARS) — bio pendek tidak perlu tombol mati.
               *
               * Item 71 (mega-batch 2026-09-28): profil sendiri + bio kosong
               * → CTA "Tambah bio" yang membuka sheet edit inline.
               */}
              {profile.bio ? (
                <View className="gap-1">
                  {/* Batch 139 E04: URL di bio menjadi tautan berpratinjau
                      domain + konfirmasi sebelum dibuka (anti-phishing). */}
                  <BioText bio={profile.bio} expanded={bioExpanded} />
                  {bioNeedsToggle(profile.bio) ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={bioExpanded ? translate("Tutup bio") : translate("Tampilkan bio selengkapnya")}
                      hitSlop={TEXT_ROW_HIT_SLOP}
                      onPress={() => setBioExpanded((v) => !v)}
                    >
                      <Text variant="caption" weight={600} tone="accent">
                        {bioExpanded ? translate("Tutup") : translate("Selengkapnya")}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : isSelf ? (
                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  leftIcon={PencilSimple}
                  onPress={() => setEditOpen(true)}
                >
                  {translate("Tambah bio")}
                </Button>
              ) : null}

              {/* ── Stats / Counter Strip (langsung di bawah bio) ── */}
              {/* Batch 139 E05/E06: SocialStat menampilkan "Privat" (gembok)
                  untuk count null = server tidak mengirim angka (sinyal
                  privasi terbaik-effort; backend belum punya flag eksplisit),
                  bukan angka 0. */}
              <View className="flex-row flex-wrap items-center gap-4 pt-1">
                <SocialStat
                  count={followingCount}
                  label={translate("Mengikuti")}
                  onPress={() => router.push(ROUTES.followers(handle, "following"))}
                  openListLabel={translate("Lihat daftar mengikuti")}
                />
                <SocialStat
                  count={followerCount}
                  label={translate("Pengikut")}
                  onPress={() => router.push(ROUTES.followers(handle))}
                  openListLabel={translate("Lihat daftar pengikut")}
                />

                {profile.rating != null ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={translate("{x} dari {y}, buka ulasan", { x: formatDecimal(profile.rating), y: 5 })}
                    hitSlop={TEXT_ROW_HIT_SLOP}
                    onPress={() => selectTab("ratings")}
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
                  // UI-P007: skor milik sendiri dapat dibuka ke layar rincian
                  // (/trust-score memakai getMyTrustScore — hanya untuk diri
                  // sendiri; profil orang lain tetap tampilan statis).
                  isSelf ? (
                    <Pressable
                      className="flex-row items-center gap-1"
                      accessibilityRole="button"
                      accessibilityLabel={translate("Skor kepercayaan {x}, buka rincian", { x: profile.trustScore })}
                      hitSlop={TEXT_ROW_HIT_SLOP}
                      onPress={() => router.push(ROUTES.trustScore)}
                    >
                      {/* v2: skor = accent di semua permukaan (ikut TrustScoreCard). */}
                      <Icon icon={ShieldCheck} size="xs" tone="accent" weight="fill" />
                      <Text variant="body" weight={700} tone="accent">
                        {profile.trustScore}
                      </Text>
                      <Text variant="caption" tone="secondary">
                        {translate("Skor")}
                      </Text>
                    </Pressable>
                  ) : (
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
                  )
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
                        loading={dmLoading}
                        onPress={() => void handleSendMessage()}
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
                      {translate("Beli via Escrow")}
                    </Button>
                  </View>
                </>
              ) : null}
            </View>

            {/* ── Tabs Bar ───────────────────────────────────────── */}
            <View className="pt-4">
              {/* Item 20 (2026-09-28): strip highlight etalase — disembunyikan
                  sendiri sampai kontrak TIM A tiba (lihat komponen). */}
              <ProfileHighlightsStrip
                username={handle}
                isSelf={isSelf}
                showcaseItems={showcaseItems}
              />
              <Tabs<ProfileTab>
                items={profileTabs}
                value={activeTab}
                onChange={selectTab}
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
                    {translate("Pertanyaan Pengguna")}
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
                ) : questionsError ? (
                  /* UX-FDB-008: kegagalan muat ≠ "belum ada pertanyaan". */
                  <ErrorState
                    compact
                    title={translate("Gagal memuat pertanyaan")}
                    description={questionsError}
                    onRetry={retryTabContents}
                  />
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
                        // PRF-001: pemilik profil melihat pertanyaan yang belum
                        // dijawab di tab Utas — beri jalan pintas ke inbox
                        // Tanya Jawab miliknya untuk menjawab.
                        answerAction={
                          isSelf && !q.answer ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              fullWidth={false}
                              onPress={() => router.push(ROUTES.questions)}
                            >
                              {translate("Jawab")}
                            </Button>
                          ) : undefined
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
                                {translate("Hapus")}
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
                                      {translate("Sembunyikan")}
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
                {/* UI-P011: tab hanya menampilkan 20 item pertama — tautan ke
                    daftar penuh agar konten tidak terlihat terpotong. */}
                <Button
                  size="sm"
                  variant="ghost"
                  fullWidth={false}
                  onPress={() => router.push(ROUTES.userQuestions(handle))}
                >
                  {translate("Lihat semua pertanyaan")}
                </Button>
              </View>
            ) : null}

            {/* ── Tab Content 3: Ulasan (Ratings) ─────────────────
                Perilaku tidak berubah — dipindah ke <ProfileRatingsTab>
                (ekstrak G-11). */}
            {activeTab === "ratings" ? (
              <ProfileRatingsTab
                ratings={ratings}
                loading={ratingsLoading}
                error={ratingsError}
                onRetry={retryTabContents}
                filter={ratingFilter}
                onFilterChange={setRatingFilter}
                sort={ratingSort}
                onSortChange={setRatingSort}
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
        // FE-096: description dihapus — user yang menekan "Ajukan pertanyaan"
        // di profil seseorang sudah paham konteksnya.
        visible={askOpen}
        loading={asking}
        confirmLabel={translate("Kirim pertanyaan")}
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

      {/* ── Dialog Blokir ──────────────────────────────────────
          Item 69 (mega-batch 2026-09-28): dialog menjelaskan DAMPAK
          pemblokiran sebelum pengguna menekan "Blokir" — bukan sekadar
          "tidak akan melihat aktivitas". */}
      <Dialog
        title={translate("Blokir @{x}?", { x: handle })}
        description={translate(
          "Setelah diblokir:\n• Pengguna ini tidak bisa mengirimi Anda pesan atau melihat etalase Anda\n• Anda tidak bisa lagi bertransaksi dengannya\n• Anda tidak akan melihat aktivitas, postingan, atau ulasannya\n\nAnda bisa membukanya kembali kapan saja dari daftar pengguna diblokir di Pengaturan.",
        )}
        visible={blockOpen}
        destructive
        loading={blocking}
        confirmLabel={translate("Blokir")}
        cancelLabel={translate("Batal")}
        onConfirm={() => void handleBlock()}
        onCancel={() => setBlockOpen(false)}
        onRequestClose={() => setBlockOpen(false)}
      />

      {/* ── Bottom Sheet Pilihan Lainnya ────────────────────────
          Titik-tiga profil memakai bottom sheet (permintaan produk
          2026-09-28), bukan dialog tengah: Bagikan profil, Laporkan,
          Blokir. ShareSheetTrigger tetap membungkus agar guard "sedang
          berbagi" dan pemetaan outcome tidak hilang; closeOnSelect menutup
          sheet ini DULU sebelum sheet OS muncul (§9.9 satu overlay pada
          satu waktu). */}
      <ShareSheetTrigger
        payload={profileSharePayload}
        disabled={!handle}
        onUnavailable={(payload) => void shareUnavailable(payload)}
      >
        {(share, state) => (
          <ActionSheet
            title={translate("Pilihan Akun")}
            visible={moreOptionsOpen}
            onRequestClose={() => setMoreOptionsOpen(false)}
            actions={[
              {
                key: "share",
                label: translate("Bagikan profil"),
                icon: ShareNetwork,
                disabled: !handle || state.sharing,
                onPress: () => share(),
              },
              {
                key: "report",
                label: translate("Laporkan pengguna"),
                icon: Flag,
                onPress: () => {
                  // Tanpa `id` pun laporan tetap bisa dibuka: username dipakai
                  // sebagai identifier cadangan oleh api.settings.reportUser.
                  if (profile?.id || handle)
                    router.push(
                      ROUTES.reports({ targetId: profile?.id || handle, targetName: handle }),
                    )
                },
              },
              {
                key: "block",
                label: translate("Blokir pengguna"),
                icon: Prohibit,
                destructive: true,
                onPress: () => setBlockOpen(true),
              },
            ]}
          />
        )}
      </ShareSheetTrigger>

      {/* Inquiry — buka ruang pra-transaksi (POST /v1/chat/inquiries) lalu
          langsung masuk ke ruang chat hasil inquiry. */}
      {/* ── Item 73 (2026-09-28): foto profil ukuran penuh ────── */}
      {profile?.avatarUrl ? (
        <ImageViewer
          visible={avatarViewerOpen}
          images={[{ url: resolveMediaUrl(profile.avatarUrl) ?? profile.avatarUrl, alt: translate("Foto profil @{x}", { x: handle }) }]}
          title={translate("Foto profil")}
          onClose={() => setAvatarViewerOpen(false)}
        />
      ) : null}

      {/* ── Item 19 (2026-09-28): Kode QR profil ─────────────────
          QR berisi deep link profil https://kahade.id/user/<username>
          (lib/deeplinks.ts `profileUrl`), dipindai kamera HP lain. */}
      <BottomSheet
        visible={qrOpen}
        onRequestClose={() => setQrOpen(false)}
        title={translate("Kode QR profil")}
        // FE-095: description dihapus — QR + username sudah cukup jelas.
      >
        <View className="items-center px-5 pb-4">
          <QRCodeDisplay
            value={profileUrl(handle)}
            caption={translate("kahade.id/user/{x}", { x: handle })}
            onCopy={(value) => void copy(value, "profile-qr")}
            copied={copiedKey === "profile-qr"}
            accessibilityLabel={translate("Kode QR profil @{x}", { x: handle })}
          />
        </View>
      </BottomSheet>

      {/* ── Item 22 (2026-09-28): edit profil inline ────────────── */}
      {isSelf ? (
        <ProfileEditSheet
          visible={editOpen}
          onRequestClose={() => setEditOpen(false)}
          profile={{
            fullName: profile?.fullName,
            username: profile?.username,
            bio: profile?.bio,
            avatarUrl: profile?.avatarUrl,
          }}
          onSaved={() => void fetchProfile()}
        />
      ) : null}
      {/* Inquiry — buka ruang pra-transaksi (POST /v1/chat/inquiries) lalu
          langsung masuk ke ruang chat hasil inquiry. */}
      <BottomSheet
        avoidKeyboard
        visible={hideC != null}
        onRequestClose={() => setHideC(null)}
        title={translate("Sembunyikan komentar")}
        // FE-097: "lewat moderasi" adalah detail internal — cukup kalimat pertama.
        description={translate("Komentar tidak lagi tampil untuk pengguna lain.")}
        footer={
          <Button
            fullWidth
            variant="destructive"
            loading={hidingC}
            onPress={() => void submitHideComment()}
          >
            {translate("Sembunyikan")}
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
    </Screen>
  )
}