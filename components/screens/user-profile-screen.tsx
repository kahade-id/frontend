import { useProfileShowcase } from "@/lib/use-profile-showcase"
/**
 * Screen — Profil User (gaya Instagram / Threads)
 *
 *  - Navigasi atas di atas kartu sampul (+ untuk profil sendiri, back untuk orang lain).
 *  - Cover kartu (rounded + border + margin), avatar bulat menimpa sampul.
 *  - Statistik (Mengikuti, Pengikut, Ulasan) di samping avatar — semua profil.
 *  - Identitas: Nama lengkap & @username berdekatan, bio, tautan sosial.
 *  - Aksi: [Ubah profil] [Bagikan] [QR] untuk diri sendiri;
 *    [Ikuti] + [Kirim Pesan] untuk orang lain.
 *  - Tab in-page: Etalase, Utas (Q&A), Ulasan, Tentang.
 *  - Tamu (tanpa sesi) boleh melihat; aksi sosial digerbang `requireSession`.
 */
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Pressable,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"
import {
  BookmarkSimple,
  ChatCircleDots,
  DotsThreeVertical,
  Flag,
  Handshake,
  Image as ImageIcon,
  Lock,
  PencilSimple,
  Prohibit,
  QrCode,
  ShareNetwork,
  UserCircle,
} from "phosphor-react-native"
import { api, isApiError, userMessage } from "@/lib/api"
import type { HiddenReason, PublicUserProfile, QuestionComment, QuestionItem, VerificationBadge } from "@/lib/api/users"
import {
  readMyRatings,
  readPublicRatingsHidden,
  type PublicRatingFilter,
  type Rating,
} from "@/lib/api/ratings"
import { isOfflineKnown } from "@/lib/connectivity"
import { isOwnQuestion, isOwnQuestionComment, resolveFollowStatus } from "@/lib/api/users"
import {
  readQuestionComments,
  readQuestionList,
} from "@/lib/api/users"
import { useCopy } from "@/lib/clipboard"
import { openDrawer } from "@/lib/drawer"
import { profileUrl } from "@/lib/deeplinks"
import { formatNumber } from "@/lib/format"
import { acquireShowcaseMutation } from "@/lib/showcase-state"
import { useHasSession } from "@/lib/guest-gate"
import { goBackOrNavigate } from "@/lib/navigation"
import { resolveMediaUrl } from "@/lib/media"
import { ROUTES } from "@/lib/routes"
import { isFilePayload, shareContent, type SharePayload } from "@/lib/share"
import { TEXT_ROW_HIT_SLOP } from "@/lib/hit-slop"
import { logWarn } from "@/lib/telemetry"

import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
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
import { FollowButton } from "@/components/ui/follow-button"
import { Header } from "@/components/ui/header"
import { Icon } from "@/components/ui/icon"
import { ImageViewer } from "@/components/ui/image-viewer"
import { Picture } from "@/components/ui/picture"
import { PressableScale } from "@/components/ui/pressable-scale"
import { IconButton } from "@/components/ui/icon-button"
import { Collapse } from "@/components/ui/collapse"
import { Crossfade } from "@/components/ui/fade-in"
import { ListLoading } from "@/components/ui/paginated-list"
import { DataScroll } from "@/components/ui/data-screen"
import { QACard } from "@/components/ui/qa-card"
import { QaCommentComposer } from "@/components/ui/qa-comment-item"
import { QaThread } from "@/components/ui/qa-thread"
import { buildCommentThread, type ThreadSort } from "@/lib/qa-thread"
import { ProfileAboutTab } from "@/components/ui/profile-about-tab"
import { ProfileEtalaseTab } from "@/components/ui/profile-etalase-tab"
import { ProfileLinks } from "@/components/ui/profile-links"
import { ProfileRatingsTab } from "@/components/ui/profile-ratings-tab"
import { ProfileEditSheet } from "@/components/ui/profile-edit-sheet"
import { ProfileHighlightsStrip } from "@/components/ui/profile-highlights-strip"
import { StoryHighlightsStrip } from "@/components/story/story-highlights-strip"
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
 * Ambang (px offset konten) saat strip tab "menempel" ke bawah <Header>
 * (collapsing toolbar). Posisi ambang ≈ strip tab asli di dalam konten
 * (sampul 120 + blok identitas) — saat ambang terlampaui, strip in-flow
 * sudah berada tepat di bawah header sehingga pergantian ke strip sticky
 * terasa tanpa lompatan.
 */
const TABS_STUCK_OFFSET = 280

/**
 * Batas jawaban pemilik — sama dengan layar inbox Tanya Jawab (app/questions.tsx):
 * AnswerQuestionDto minLength 1, batas lokal 10 agar jawaban bermakna.
 */
const ANSWER_MIN = 10
const ANSWER_MAX = 2000


/**
 * Nama ikon badge dari backend adalah string kebab-case Phosphor. Beberapa
 * nama TIDAK ADA di build phosphor-react-native yang terpasang
 * (BadgeCheck, BriefcaseCheck, EnvelopeCheck), jadi dipetakan ke ekuivalen:
 * badge-check → IdentificationBadge, briefcase-check → Briefcase,
 * envelope-check → Envelope. Fallback SealCheck menjaga badge tak dikenal
 * tetap terrender.
 */
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
      className="items-center"
    >
      <Text variant="body" weight={700} tone="primary" className="text-[17px]">
        {formatNumber(count)}
      </Text>
      <Text variant="caption" tone="tertiary">
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
  // Public USR-XXX untuk perbandingan dengan profile.id (public
  // namespace). meId tetap cuid internal (dipakai untuk authorId).
  const [meUserId, setMeUserId] = useState<string | null>(null)
  const [meUsername, setMeUsername] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Follow state (favorit/love dihapus 2026-10-09 — tidak ada gunanya)
  // "Tersimpan" (bookmark pribadi) — terpisah dari favorit publik.
  const [saved, setSaved] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  /** Badge verifikasi aktif (GET /v1/users/{username}/badges). */
  const [badges, setBadges] = useState<VerificationBadge[]>([])
  const [following, setFollowing] = useState<boolean | null>(null)
  const [followLoading, setFollowLoading] = useState(false)
  const [followerCount, setFollowerCount] = useState<number | null>(null)
  const [followingCount, setFollowingCount] = useState<number | null>(null)



  // Active tab state — item 72: inisial dari memori sesi (bukan selalu
  // "content"); `selectTab` menulis balik agar sesi mengingatnya.
  const [activeTab, setActiveTab] = useState<ProfileTab>(sessionProfileTab ?? "content")
  /**
   * Collapsing toolbar (2026-10-05): strip tab sticky di bawah <Header>
   * aktif saat konten lewat ambang scroll; strip in-flow disembunyikan.
   *
   * DUA PINTU scroll — kontrak <PullToRefresh>/<DataScroll>:
   *   - Android: `onScrollWorklet` dipanggil per frame (jalur RNGH).
   *   - web/iOS: hanya `onScroll` JS biasa yang berjalan; `onScrollWorklet`
   *     DIABAIKAN di jalur ini.
   * Kedua pintu wajib diisi — sebelumnya hanya worklet yang dikirim,
   * sehingga di web/iOS `tabsStuck` tidak pernah aktif dan strip sticky
   * tidak pernah muncul (bug collapsing toolbar "hilang" saat scroll).
   */
  const [tabsStuck, setTabsStuck] = useState(false)
  const applyTabsStuck = useCallback((y: number) => {
    if (typeof y === "number" && Number.isFinite(y)) {
      setTabsStuck(y > TABS_STUCK_OFFSET)
    }
  }, [])
  /** Pintu Android (dipanggil per frame dari surface pull-to-refresh). */
  const handleProfileScroll = applyTabsStuck
  /** Pintu web/iOS (event scroll ScrollView). */
  const handleProfileScrollEvent = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      applyTabsStuck(event.nativeEvent.contentOffset.y)
    },
    [applyTabsStuck],
  )
  const selectTab = useCallback((tab: ProfileTab) => {
    sessionProfileTab = tab
    startTransition(() => setActiveTab(tab))
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
  /** Pertanyaan yang sedang dijawab pemilik profil (sheet jawab). */
  const [answerTarget, setAnswerTarget] = useState<QuestionItem | null>(null)
  const [answerText, setAnswerText] = useState("")
  const [answering, setAnswering] = useState(false)
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null)
  const [questionComments, setQuestionComments] = useState<{
    items: QuestionComment[]
    loading: boolean
  }>({ items: [], loading: false })
  const [commentText, setCommentText] = useState("")
  const [commentSending, setCommentSending] = useState(false)
  /** Urutan balasan utas: "Teratas" (paling membantu dulu) | "Terbaru". */
  const [commentSort, setCommentSort] = useState<ThreadSort>("top")
  /** Balasan yang sedang dibalas (null = balas langsung ke pertanyaan). */
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null)
  /** Pohon balasan dari daftar datar (lib/qa-thread.ts) — diurutkan sesuai pilihan. */
  const commentTree = useMemo(
    () => buildCommentThread(questionComments.items, commentSort),
    [questionComments.items, commentSort],
  )
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
  /** P-11: pemilik menyembunyikan ulasan (`hidden: true` dari backend). */
  const [ratingsHidden, setRatingsHidden] = useState(false)
  const [ratingFilter, setRatingFilter] = useState<PublicRatingFilter>("all")
  /**
   * Nilai filter yang dibaca `fetchTabContents` (supaya callback itu stabil);
   * perubahan filter memicu HANYA `fetchRatings` (lihat effect di bawah).
   */
  const ratingFilterRef = useRef<PublicRatingFilter>("all")
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
    // P-08 (audit 2026-10-10): buang profil lama — tanpa ini nama/bio/
    // tautan/QR milik profil A tetap tampil di bawah header @B sampai
    // respons B tiba (Crossfade hanya menampilkan kerangka bila profil null).
    setProfile(null)
    setQuestions([])
    setRatings([])
    setQuestionsError(null)
    setRatingsError(null)
    setRatingsHidden(false)
    setRatingFilter("all")
    // P-09: samakan ref agar effect filter tidak menganggap reset ini sebagai
    // perubahan filter dan menembak `fetchRatings` untuk profil LAMA.
    ratingFilterRef.current = "all"
    setRatingSort("newest")
    setBioExpanded(false)
    setAvatarViewerOpen(false)
    setFollowing(null)
    setFollowerCount(null)
    setFollowingCount(null)
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
  /**
   * Ulasan dipisah dari `fetchTabContents` (audit 2026-10-10): dulu
   * `fetchTabContents` bergantung pada `ratingFilter`, sehingga `fetchProfile`
   * ikut berubah identitas dan effect `[fetchProfile]` menjalankan ULANG
   * seluruh muat profil (profil, me, etalase, pertanyaan, badge, tersimpan)
   * — 7+ request dan tombol Ikuti berkedip ke spinner — hanya karena
   * pengguna mengganti chip "Positif". Kini ganti filter = satu request.
   *
   * Respons basi dijaga dengan nomor urut: filter diganti cepat dua kali →
   * hanya hasil request terakhir yang diterapkan.
   */
  const ratingsRequest = useRef(0)
  const fetchRatings = useCallback(
    (targetName: string, filter: PublicRatingFilter, opts?: { silent?: boolean }) => {
      const started = ++ratingsRequest.current
      const current = () => ratingsRequest.current === started
      // P-06: tarik-untuk-menyegarkan (silent) tidak mengganti daftar dengan kerangka.
      if (!opts?.silent) setRatingsLoading(true)
      setRatingsError(null)
      void api.ratings
        .getPublicRatings(targetName, {
          page: 1,
          limit: 20,
          ...(filter === "all" ? {} : { filter }),
        })
        .then((res) => {
          if (!current()) return
          const { items } = readMyRatings(res)
          setRatings(items)
          setRatingsHidden(readPublicRatingsHidden(res))
        })
        .catch((err: unknown) => {
          if (!current()) return
          // UX-FDB-008: jangan samarkan kegagalan sebagai empty state.
          setRatings([])
          setRatingsError(userMessage(err))
        })
        .finally(() => {
          if (current()) setRatingsLoading(false)
        })
    },
    [],
  )

  /**
   * P-07 (audit 2026-10-10): pertanyaan punya penjaga respons basi sendiri
   * (nomor urut) — dulu tanpa guard, pindah profil A→B cepat membuat
   * respons A yang mendarat belakangan menampilkan pertanyaan A di profil B.
   */
  const questionsRequest = useRef(0)
  const fetchQuestions = useCallback((targetName: string, opts?: { silent?: boolean }) => {
    const started = ++questionsRequest.current
    const current = () => questionsRequest.current === started
    if (!opts?.silent) setQuestionsLoading(true)
    setQuestionsError(null)
    void api.users
      .getPublicQuestions(targetName, { page: 1, limit: 20 })
      .then((res) => {
        if (!current()) return
        const { items } = readQuestionList(res)
        setQuestions(items)
      })
      .catch((err: unknown) => {
        if (!current()) return
        // UX-FDB-008: jangan samarkan kegagalan sebagai empty state.
        setQuestions([])
        setQuestionsError(userMessage(err))
      })
      .finally(() => {
        if (current()) setQuestionsLoading(false)
      })
  }, [])

  /**
   * Muat ketiga tab. `silent` (P-06) diteruskan ke semuanya — dulu hanya
   * header yang "diam" saat tarik-untuk-menyegarkan, sementara tab aktif
   * tetap berganti kerangka.
   */
  const fetchTabContents = useCallback(
    (targetName: string, opts?: { silent?: boolean }) => {
      fetchShowcaseTab(targetName, { silent: opts?.silent === true })
      fetchQuestions(targetName, opts)
      fetchRatings(targetName, ratingFilterRef.current, opts)
    },
    [fetchShowcaseTab, fetchQuestions, fetchRatings],
  )

  /**
   * Perubahan filter memicu HANYA `fetchRatings`. Dilewati saat profil belum
   * termuat — muat awal sudah memanggilnya.
   */
  useEffect(() => {
    if (ratingFilterRef.current === ratingFilter) return
    ratingFilterRef.current = ratingFilter
    if (profile?.username) fetchRatings(profile.username, ratingFilter)
  }, [ratingFilter, profile?.username, fetchRatings])

  /**
   * UX-FDB-008: muat ulang SATU tab setelah kegagalan. P-21: dulu satu tombol
   * "Coba lagi" memuat ulang ketiga tab (3 request + kerangka di tab lain).
   */
  const retryQuestions = useCallback(() => {
    if (handle) fetchQuestions(handle)
  }, [handle, fetchQuestions])
  const retryRatings = useCallback(() => {
    if (handle) fetchRatings(handle, ratingFilterRef.current)
  }, [handle, fetchRatings])

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
      // P-03 (audit 2026-10-10): tamu TIDAK memanggil endpoint ber-auth
      // "required" (`getMeCached`, `checkSavedProfile`). Tanpa token, client
      // mencoba refresh → 401 → `expireSession` menaikkan revisi sesi →
      // request profil publik yang masih in-flight dibatalkan (ABORTED) →
      // "Gagal memuat profil — Permintaan dibatalkan" untuk tamu.
      const [res, me] = await Promise.all([
        api.users.getUserByUsername(username),
        hasSession
          ? api.users.getMeCached().catch((err) => {
              logWarn("profile:me-fallback", err)
              return null
            })
          : Promise.resolve(null),
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

      // Fetch tab data (silent diteruskan — P-06).
      fetchTabContents(targetName, opts)

      if (hasSession) {
        void api.users
          .checkSavedProfile(targetName)
          .then((isSaved) => {
            if (current()) setSaved(isSaved)
          })
          .catch(() => {
            if (current()) setSaved(false)
          })
      } else {
        setSaved(false)
      }

      // P-05 (audit 2026-10-10): lencana dibaca dari payload profil
      // (`badges`, sumber yang sama dengan GET /users/:username/badges) —
      // satu request lebih sedikit, dan pemilik profil privat tetap melihat
      // lencananya (endpoint terpisah dulu dipanggil tanpa token → 404).
      // Request terpisah hanya cadangan bila payload tidak memuatnya.
      if (Array.isArray(res.badges)) {
        setBadges(res.badges)
      } else {
        void api.users
          .getVerificationBadges(targetName)
          .then((rows) => {
            if (current()) setBadges(rows)
          })
          .catch(() => {
            if (current()) setBadges([])
          })
      }

      // Rekonsiliasi SS-019 DIHAPUS (audit 2026-10-10): backend sudah
      // menghitung `social.followersCount/followingCount` dengan
      // visibleUserFilter yang SAMA PERSIS dengan total daftar, jadi dua
      // request `?limit=1` tambahan per kunjungan profil hanya membuang
      // kuota rate-limit (20/menit) tanpa mengubah angka. Lebih parah:
      // daftar yang disembunyikan privasi mengembalikan `total: 0`, sehingga
      // "Privat" (null dari payload) tertimpa menjadi "0" palsu.

      // PRF-003: status follow dibaca LANGSUNG dari payload profil
      // (`social.isFollowing` yang dihitung backend dari tabel follow).
      // Versi lama menurunkannya dari GET followers?search= — daftar itu
      // tidak menyertakan id internal (R1), sehingga perbandingan
      // `user.id === me.id` selalu false dan tombol "Ikuti" balik sendiri
      // setiap refresh (bug yang dilaporkan user). Pola itu dihapus total.
      if (current()) setFollowing(resolveFollowStatus(res))
    } catch (err) {
      if (current()) {
        // 403 USER_BLOCKED (relasi blokir dua arah): backend menutup seluruh
        // endpoint. Jangan tampilkan "Anda tidak memiliki akses" generik —
        // cukup "tidak tersedia" tanpa membocorkan siapa memblokir siapa.
        setError(
          isApiError(err) && err.status === 403
            ? translate("Profil ini tidak tersedia.")
            : isApiError(err) && err.status !== 404
              ? userMessage(err)
              : translate("Profil tidak ditemukan."),
        )
      }
    } finally {
      if (current()) setLoading(false)
    }
  }, [username, fetchTabContents, hasSession])

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
  /**
   * PRF-002: "Kirim Pesan" langsung ke halaman chat seperti WhatsApp —
   * get-or-create room DM tanpa wajib mengisi pesan pertama (backend
   * memakai ulang room INQUIRY bila sudah ada). Berbeda dengan pesan dalam
   * transaksi (room ORDER — admin bisa masuk saat dispute); room DM tidak
   * bisa dimasuki admin.
   */
  const handleSendMessage = useCallback(() => {
    if (!requireSession() || !handle) return
    // Only the public handle is needed to resolve the recipient. Keep display
    // names and other personal data out of route/query parameters.
    router.navigate({ pathname: "/prepare-navigation", params: { kind: "dm", id: handle } } as never)
  }, [requireSession, handle])

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
      // P-10 (audit 2026-10-10): saat PASTI offline, client mengantrekan aksi
      // (`enqueue-social`) dan promise-nya baru selesai ketika antrean
      // dikirim ulang — `await` di bawah akan menggantung: spinner & kunci
      // follow tertahan sampai tersambung. Biarkan state optimistis, lepas
      // kunci seketika; toast "diantrekan" sudah ditampilkan root layout.
      if (isOfflineKnown()) {
        void (next ? api.users.followUser(handle) : api.users.unfollowUser(handle)).catch((err) => {
          logWarn("profile:follow-offline", err)
        })
        release()
        return
      }
      setFollowLoading(true)
      try {
        if (next) await api.users.followUser(handle)
        else await api.users.unfollowUser(handle)
        toast.show({
          title: next ? translate("Profil diikuti") : translate("Profil batal diikuti"),
        })
      } catch (err) {
        // Idempoten di sisi klien: server sudah berada di state yang
        // diminta (409 ALREADY_FOLLOWING saat ikuti, 400 NOT_FOLLOWING saat
        // berhenti) — mis. aksi dari perangkat lain atau replay antrean
        // offline. Dulu di-rollback → tombol menampilkan kebalikan dari
        // kenyataan server + toast "Gagal mengikuti".
        const code = isApiError(err) ? err.backendCode : undefined
        if ((next && code === "ALREADY_FOLLOWING") || (!next && code === "NOT_FOLLOWING")) {
          // Angka optimistis (+1/-1) tidak sahih karena server tidak berubah.
          setFollowerCount(prevCount)
          return
        }
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
      // P-13 (audit 2026-10-10): optimistis + rollback (CLAUDE.md §3) — dulu
      // ikon hanya berputar dan baru berubah setelah respons.
      const prevSaved = saved
      setSaved(next)
      setSaveLoading(true)
      try {
        if (next) {
          await api.users.saveProfile(handle)
          toast.show({ title: translate("Profil disimpan"), tone: "success", duration: 2500 })
        } else {
          await api.users.unsaveProfile(handle)
          toast.show({ title: translate("Profil dihapus dari tersimpan"), tone: "success", duration: 2500 })
        }
      } catch (err: unknown) {
        setSaved(prevSaved)
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
    [handle, saved, toast, requireSession],
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

  /**
   * Bagikan profil SENDIRI dari baris aksi (tombol langsung, bukan lewat
   * sheet titik tiga). Payload & fallback salin = sumber yang sama dengan
   * <ShareSheetTrigger> profil orang lain; kunci sinkron menolak tap ganda
   * selagi sheet OS terbuka (guard yang sama dengan ShareSheetTrigger).
   */
  const shareBusyRef = useRef(false)
  const handleShareProfile = useCallback(async () => {
    if (!handle || shareBusyRef.current) return
    shareBusyRef.current = true
    try {
      const payload = profileSharePayload()
      const outcome = await shareContent(payload)
      if (outcome === "unavailable") await shareUnavailable(payload)
    } finally {
      shareBusyRef.current = false
    }
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
      goBackOrNavigate(ROUTES.showcase)
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
    // Pemilik profil TIDAK bertanya di profilnya sendiri — hanya menjawab.
    if (isSelf) return
    if (!requireSession()) return
    setAskOpen(true)
  }, [requireSession, isSelf])

  const submitAsk = useCallback(async () => {
    if (isSelf || !username || askText.trim().length < 5) return
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
  }, [username, askText, toast, isSelf])

  /** Pemilik menjawab pertanyaan langsung di profilnya (tanpa pindah ke inbox). */
  const openAnswer = useCallback(
    (q: QuestionItem) => {
      if (!isSelf) return
      setAnswerTarget(q)
      setAnswerText("")
    },
    [isSelf],
  )

  const submitAnswer = useCallback(async () => {
    if (!isSelf || !answerTarget || answering) return
    const value = answerText.trim()
    if (value.length < ANSWER_MIN || value.length > ANSWER_MAX) return
    setAnswering(true)
    try {
      await api.users.answerQuestion(answerTarget.id, value)
      toast.show({ title: translate("Jawaban terkirim"), tone: "success", duration: 3000 })
      setAnswerTarget(null)
      setAnswerText("")
      const res = await api.users.getPublicQuestions(username, { page: 1, limit: 20 })
      const { items } = readQuestionList(res)
      setQuestions(items)
    } catch (err) {
      toast.show({
        title: translate("Gagal mengirim jawaban"),
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setAnswering(false)
    }
  }, [isSelf, answerTarget, answerText, answering, toast, username])

  const toggleComments = useCallback(
    async (q: QuestionItem) => {
      setReplyTo(null)
      setCommentText("")
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
    // P-14: tamu digerbang ke login (seperti openAsk/handleUpvote) — bukan
    // toast "Gagal mengirim komentar" setelah 401.
    if (!requireSession()) return
    setCommentSending(true)
    try {
      await api.users.addQuestionComment(openQuestionId, {
        content: commentText.trim(),
        ...(replyTo ? { parentId: replyTo.id } : {}),
      })
      setCommentText("")
      setReplyTo(null)
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
  }, [openQuestionId, commentText, commentSending, toast, replyTo, requireSession])

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
        <Header
          transparent
          title={handle ? `@${handle}` : undefined}
          showBack={true}
          onBack={() => goBackOrNavigate(ROUTES.showcase)}
          right={
            profile ? (
              isSelf ? (
                // Sidebar 2026-10-05: /settings dihapus — titik tiga profil
                // sendiri membuka sidebar (hub: Keamanan, Bisnis, dll).
                <IconButton
                  icon={DotsThreeVertical}
                  variant="ghost"
                  accessibilityLabel={translate("Menu")}
                  onPress={() => openDrawer()}
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
      {/* Collapsing toolbar: strip tab sticky di bawah <Header>.
          Struktur 2026-10-05 (fix "sticky tabs rusak saat tabsStuck=true"):

          - <Collapse>, BUKAN display:none. display:none tidak me-layout
            anak, jadi pengukuran <Tabs> (onLayout per tombol) baru terjadi
            saat strip tampil — indicator underline pun
            "meluncur" dari tepi kiri ke tab aktif di depan mata. Dengan
            <Collapse>, saat tertutup (height 0 + overflow hidden) isi
            TETAP di-layout: pengukuran selesai sebelum strip pernah
            terlihat, dan indicator langsung duduk di bawah tab aktif
            saat strip muncul.
          - height 0 + overflow hidden = tidak mengambil ruang alur, tidak
            tergambar, pointerEvents none; Collapse juga menyembunyikan isi
            dari screen reader (accessibilityElementsHidden + importantFor
            Accessibility) — jadi selalu tepat SATU tablist hidup:
            strip sticky XOR strip in-flow.
          - Tingginya dianimasikan (0 <-> konten), bukan dipop — strip
            muncul/menusut mulus, tidak menjengkruk daftar. */}
      <Collapse
        open={tabsStuck}
        duration="fast"
        className="bg-background px-5 pb-1 pt-2"
      >
        <Tabs<ProfileTab>
          items={profileTabs}
          value={activeTab}
          onChange={selectTab}
        />
      </Collapse>
      <DataScroll
        onRefresh={handleRefresh}
        refreshing={refreshing}
        padded={false}
        // DUA pintu scroll untuk collapsing toolbar — lihat catatan
        // `tabsStuck`: Android = worklet, web/iOS = onScroll JS.
        onScroll={handleProfileScrollEvent}
        onScrollWorklet={handleProfileScroll}
      >
        {/* ── Top Bar (di atas cover) ──────────────────────────
            <Header transparent>: @username PUSAT di bar — satu-satunya
            tempat username ditulis (baris identitas di bawah hanya nama).
            Profil sekarang seragam memiliki tombol Back untuk semua pengguna. */}

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
                  {translate("Belum ada foto sampul")}
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
              {/* Pakai display-toggle yang sama dengan strip in-flow: saat
                  stuck (mis. muat ulang profil) strip skeleton ikut hilang
                  — sticky di atas adalah satu-satunya tablist yang tampil. */}
              <View style={{ display: tabsStuck ? "none" : "flex" } as object}>
                <Tabs<ProfileTab>
                  items={profileTabs}
                  value={activeTab}
                  onChange={selectTab}
                />
              </View>
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

              {/* A.4 — statistik sosial duduk di samping avatar (gaya
                  Instagram): angka bold di atas, label abu di bawah. Tampil
                  untuk SEMUA profil — versi 2026-10-09 menukar blok ini
                  dengan tombol [Ubah profil] di profil sendiri, sehingga
                  pemilik tidak pernah melihat jumlah pengikut/mengikuti/
                  ulasannya sendiri. [Ubah profil] kini di baris aksi bawah
                  bio (bersama Bagikan & QR), seperti Instagram. */}
              <View className="flex-row items-center gap-2 pb-1">
                <View className="flex-row items-center gap-5">
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
                  {profile.ratingCount != null ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={translate("{x} ulasan", { x: formatNumber(profile.ratingCount) })}
                      accessibilityHint={translate("Lihat ulasan")}
                      onPress={() => selectTab("ratings")}
                      className="items-center"
                    >
                      <Text variant="body" weight={700} tone="primary" className="text-[17px]">
                        {formatNumber(profile.ratingCount)}
                      </Text>
                      <Text variant="caption" tone="tertiary">
                        {translate("Ulasan")}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
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


              {/*
               * POIN 3 (2026-10-04) — seksi usaha: mewujudkan janji "profil
               * usaha" untuk akun bisnis yang dulu hanya klaim di layar
               * Tipe Akun (kini dihapus bersama self-claim). Tampil bila
               * accountType === "BUSINESS" (alias flat GET /v1/users/:username;
               * BAI-064 menaikkan ke BUSINESS saat verifikasi disetujui).
               * Nama usaha TIDAK ada di payload profil publik (hanya di
               * endpoint verifikasi milik sendiri) — jadi tampilkan seal
               * biru + label "Bisnis Terverifikasi" saja. Minimal, tanpa
               * layar baru.
               */}
              {/* Bisnis Terverifikasi: dihapus (2026-10-09) — sudah ada verified
                  di samping nama dan lencana di tab Tentang. */}

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

              {/*
               * Tautan sosial (bug "link tidak muncul"): baris ringkas ala
               * Instagram — maks 3 chip ikon platform + domain/label, sisanya
               * "+N" membuka tab Tentang (daftar lengkap). Data dari
               * `profile.links` (GET /v1/users/{username} → `links`).
               */}
              <ProfileLinks
                links={profile.links ?? []}
                compact
                onMore={() => selectTab("about")}
              />

              {/* Stats dipindah ke baris avatar (2026-10-09) — bagian ini dihapus. */}

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
                        showIcon={false}
                        onToggle={(next) => void handleFollow(next)}
                      />
                    </View>
                    <IconButton
                      icon={ChatCircleDots}
                      variant="secondary"
                      size="sm"
                      accessibilityLabel={translate("Kirim Pesan")}
                      onPress={() => void handleSendMessage()}
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
                  </View>

                  <View className="gap-1 pt-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={Handshake}
                      onPress={() => router.push(ROUTES.createTransactionWith(handle))}
                    >
                      {translate("Buat Transaksi")}
                    </Button>
                  </View>
                </>
              ) : (
                /* Profil SENDIRI (gaya Instagram): [Ubah profil] [Bagikan] [QR].
                   Dulu Bagikan & Kode QR hanya ada di sheet titik tiga profil
                   ORANG LAIN — pemilik tidak punya jalan membagikan / memindai
                   profilnya sendiri dari layar ini. */
                <View className="flex-row items-center gap-2 pt-2">
                  <View className="flex-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={PencilSimple}
                      // Item 22 (2026-09-28): edit inline lewat bottom sheet —
                      // layar edit lengkap tetap ada via link di sheet.
                      onPress={() => setEditOpen(true)}
                    >
                      {translate("Ubah profil")}
                    </Button>
                  </View>
                  <View className="flex-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={ShareNetwork}
                      onPress={() => void handleShareProfile()}
                    >
                      {translate("Bagikan profil")}
                    </Button>
                  </View>
                  <IconButton
                    icon={QrCode}
                    variant="secondary"
                    size="sm"
                    accessibilityLabel={translate("Kode QR profil")}
                    onPress={() => setQrOpen(true)}
                  />
                </View>
              )}
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
              {/* Sorotan story (arsip permanen), terpisah dari highlight etalase. */}
              {/* P-03: endpoint highlights ber-auth (bukan @Public) — tamu
                  tidak memanggilnya agar tidak memicu refresh 401 →
                  expireSession → request profil dibatalkan. */}
              <StoryHighlightsStrip userId={hasSession ? (profile?.id ?? null) : null} />
              <View style={{ display: tabsStuck ? "none" : "flex" } as object}>
                <Tabs<ProfileTab>
                  items={profileTabs}
                  value={activeTab}
                  onChange={selectTab}
                />
              </View>
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

            {/* ── Tab Content 2: Utas (Q&A, mantan "Tanya Jawab") ──────────────── */}
            {activeTab === "questions" ? (
              <View className="px-5 pt-4 gap-4">
                {/*
                 * D.1 (overflow): <Button> default fullWidth=true (w-full), jadi
                 * tombol "Bertanya" mengambil selebar baris dan meluber keluar
                 * layar. Perbaikan dua sisi: teks dibatasi (flex-1 + 1 baris)
                 * dan tombol dikecilkan ke lebar konten (fullWidth={false}).
                 */}
                {/*
                 * CTA "Tanya" untuk pengunjung — dibuat seperti kolom balas
                 * Threads (pill + ikon), jelas terlihat tanpa membaca daftar.
                 * Pemilik profil tidak melihatnya: ia hanya menjawab.
                 */}
                {!isSelf ? (
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={translate("Tanya @{x}…", { x: handle })}
                    onPress={openAsk}
                    containerClassName="rounded-full"
                    className="flex-row items-center gap-3 rounded-full border border-border bg-surface px-4 py-2.5"
                  >
                    <Icon icon={ChatCircleDots} size="sm" tone="default" />
                    <Text variant="body" tone="secondary" numberOfLines={1} className="flex-1">
                      {translate("Tanya @{x}…", { x: handle })}
                    </Text>
                    <Text variant="caption" weight={700} tone="primary">
                      {translate("Tanya")}
                    </Text>
                  </PressableScale>
                ) : (
                  <Text variant="label" tone="secondary" numberOfLines={1}>
                    {translate("Pertanyaan Pengguna")}
                  </Text>
                )}

                {questionsLoading ? (
                  <ListLoading />
                ) : questionsError ? (
                  /* UX-FDB-008: kegagalan muat ≠ "belum ada pertanyaan". */
                  <ErrorState
                    compact
                    title={translate("Gagal memuat pertanyaan")}
                    description={questionsError}
                    onRetry={retryQuestions}
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
                          name: q.asker?.fullName ?? q.asker?.username ?? translate("Pengguna"),
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
                              onPress={() => openAnswer(q)}
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
                            <QaThread
                              nodes={commentTree}
                              sort={commentSort}
                              onSortChange={setCommentSort}
                              isMine={isMyComment}
                              canHide={isSelf}
                              onHide={(c) => setHideC(c)}
                              onReply={(c) => {
                                setReplyTo({ id: c.id, name: c.authorUsername ?? c.authorName ?? translate("Pengguna") })
                              }}
                              onDelete={(c) => setDeleteC(c)}
                            />
                          )}

                          <QaCommentComposer
                            value={commentText}
                            onChangeText={setCommentText}
                            onSubmit={() => void submitComment()}
                            submitting={commentSending}
                            maxLength={1000}
                            placeholder={translate("Tulis balasan untuk @{x}…", { x: handle })}
                            replyingTo={replyTo ? `@${replyTo.name}` : undefined}
                            onCancelReply={() => setReplyTo(null)}
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
                onRetry={retryRatings}
                hidden={ratingsHidden}
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
            {activeTab === "about" ? <ProfileAboutTab profile={profile} badges={badges} /> : null}
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

      {/* ── Sheet Jawab (pemilik profil) — pola sama dengan inbox Tanya Jawab ── */}
      <BottomSheet
        avoidKeyboard
        visible={!!answerTarget && isSelf}
        onRequestClose={() => setAnswerTarget(null)}
        title={translate("Jawab pertanyaan")}
        description={translate("Dari {x}", {
          x: answerTarget?.asker?.fullName ?? answerTarget?.asker?.username ?? translate("Pengguna"),
        })}
      >
        <View className="px-5 pb-4">
          <QaCommentComposer
            value={answerText}
            onChangeText={setAnswerText}
            onSubmit={() => void submitAnswer()}
            submitting={answering}
            minLength={ANSWER_MIN}
            maxLength={ANSWER_MAX}
            authorName={profile?.fullName ?? handle}
            authorAvatar={profile?.avatarUrl ? { source: profile.avatarUrl } : undefined}
            placeholder={translate("Tulis jawaban Anda…")}
            submitLabel={translate("Kirim jawaban")}
          />
        </View>
      </BottomSheet>

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
                key: "qrcode",
                label: translate("Kode QR profil"),
                icon: QrCode,
                onPress: () => setQrOpen(true),
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
          QR berisi deep link profil https://kahade.id/<username>
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
            caption={profileUrl(handle).replace("https://", "")}
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