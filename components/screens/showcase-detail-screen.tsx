import type { OpeningMediaTap } from "@/lib/use-opening-media-tap"
/** Public Etalase detail with optional viewer authentication and fenced comment mutations.
 * Comment reads reconcile complete loaded pages after a mutation. Server authorization remains authoritative. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ScrollView,
  UIManager,
  View,
  findNodeHandle,
  type TextInput,
} from "react-native"
import { runOnJS } from "react-native-reanimated"
import { useLocalSearchParams, router } from "expo-router"
import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"
import { formatNumber } from "@/lib/format"

import {
  BookmarkSimple,
  ChatCircle,
  Flag,
  PaperPlaneRight,
  ShareNetwork,
  Trash,
} from "phosphor-react-native"
import { api, createIdempotencyKey, isApiError, userMessage } from "@/lib/api"
import { API_CONSTRAINTS } from "@/lib/api/constraints"
import {
  addShowcaseComment,
  deleteShowcaseComment,
  getShowcaseDetail,
  hideShowcaseComment,
  listShowcaseComments,
  unhideShowcaseComment,
  updateShowcaseComment,
  type ShowcaseComment,
  type ShowcaseCommentWithReplies,
  type ShowcaseSocialItem,
} from "@/lib/api/showcase"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"
import { ROUTES } from "@/lib/routes"
import { showcasePriceLabelOrFallback } from "@/lib/showcase-labels"
import { showcaseHtmlHasFormatting } from "@/lib/showcase-html"
import { useShowcaseSocialActions } from "@/lib/use-showcase-social-actions"
import { useApiQuery } from "@/lib/use-api-query"
import { consumePrefetchedShowcaseDetail } from "@/lib/showcase-detail-prefetch"
import { isShowcaseSoldOut } from "@/lib/showcase-stock"

import { useSessionRevision } from "@/lib/guest-gate"
import { useShowcaseOperation } from "@/lib/use-showcase-operation"
import { mergeComments, patchComments } from "@/lib/showcase-state"
import { showcaseImages, showcaseMedia, showcaseSpin360Groups, findShowcaseComment, shouldFetchNextCommentPage, sortShowcaseComments, type ShowcaseCommentOrder } from "@/lib/showcase-social"
import { markShowcaseDeleted } from "@/lib/showcase-deleted"
import { markShowcaseFeedDirty, queueShowcaseCommentCount } from "@/lib/showcase-social-prefs"
import { invalidateQueryPrefix } from "@/lib/query-cache"
import { SHOWCASE_COMMENT_MESSAGES } from "@/lib/showcase-comment-messages"
import {
  clearShowcaseCommentDraft,
  loadShowcaseCommentDraft,
  saveShowcaseCommentDraft,
} from "@/lib/showcase-comment-drafts"

import { ActionSheet } from "@/components/ui/action-sheet"
import { Badge } from "@/components/ui/badge"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { CollapsibleText } from "@/components/ui/collapsible-text"
import { DataScreen } from "@/components/ui/data-screen"
import { Divider } from "@/components/ui/divider"
import { useDocumentTitle } from "@/components/ui/header"
import { IconButton } from "@/components/ui/icon-button"
import { ImageViewer } from "@/components/ui/image-viewer"
import { Input } from "@/components/ui/input"
import type { LoadMoreStatus } from "@/components/ui/load-more"
import { Dialog } from "@/components/ui/modal"
import { PressableScale } from "@/components/ui/pressable-scale"
import { ShowcaseAuthorRow } from "@/components/showcase-author-row"
import { ShowcaseLikersSheet, type LikersTab } from "@/components/ui/showcase-likers-sheet"
import { Radio, RadioGroup } from "@/components/ui/radio"
import { ShowcaseMediaGallery } from "@/components/ui/showcase-media-gallery"
import {
  DiscountPrice,
  ProductBadges,
  ServiceSlotSection,
} from "@/components/showcase/product-commerce-section"
import { ProductStatsSection } from "@/components/showcase/product-stats-section"
import { DigitalAssetsSellerManager } from "@/components/showcase/digital-asset-section"
import { getCommerceFieldsCache } from "@/lib/commerce-fields"
import { Spin360Viewer } from "@/components/ui/spin360-viewer"
import { ShowcaseDetailActions } from "@/components/ui/showcase-detail-actions"
import { ShowcaseHtmlView } from "@/components/ui/showcase-html-description-editor"
import { ShowcaseDetailComments } from "@/components/showcase-detail-comments"
import { ShowcaseRelatedCard } from "@/components/showcase-related-card"
import { ShowcaseReportSheet } from "@/components/ui/showcase-report-sheet"
import { ShowcaseShareSheet } from "@/components/ui/showcase-share-sheet"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"
import { CONTENT_REPORT_REASONS, type ContentReportReason } from "@/lib/labels/report"

/** G-13: opsi hide konten satu sumber di lib/labels/report. */
const HIDE_REASONS = CONTENT_REPORT_REASONS

type Reason = ContentReportReason

/** F-06(revisi lama): jumlah root comment yang dirender per langkah. */
const COMMENT_RENDER_STEP = 40
/** Kontrak DTO CreateShowcaseCommentDto (audit F-04, sumber constraints.ts). */
const COMMENT_MAX = API_CONSTRAINTS.CreateShowcaseCommentDto.content.maxLength
/**
 * C14 (batch 139): pencarian komentar deep link dibatasi — jangan mengunduh
 * seluruh utas (hemat data & waktu).
 */
const COMMENT_FOCUS_MAX_PAGES = 5
/** C14: jarak baris target dari atas viewport scroll saat difokuskan. */
const COMMENT_FOCUS_TOP_MARGIN = 88

export default function ShowcaseDetailScreen() {
  // i18n: label mengikuti bahasa aktif.
  useLanguage()
  const { id } = useLocalSearchParams<{ id: string }>()
  const revision = useSessionRevision()

  /**
   * C05 (batch 139): hasil prefetch dari feed (press-in pada kartu) dipakai
   * SEKALI sebagai respons pertama — halaman langsung render tanpa request
   * ulang bila masih segar (TTL 90 dtk di lib). `useRef` initializer berjalan
   * sekali per mount, selaras sifat sekali-pakai `consume…`.
   */
  const prefetchedRef = useRef<ShowcaseSocialItem | null>(
    id ? consumePrefetchedShowcaseDetail(id) : null,
  )

  const query = useApiQuery<ShowcaseSocialItem>(
    `showcase-detail:${revision}:${id}`,
    (signal) => {
      const hit = prefetchedRef.current
      prefetchedRef.current = null
      if (hit) return Promise.resolve(hit)
      return getShowcaseDetail(id, signal)
    },
    Boolean(id),
    // D-08 (audit 2026-09-23): jangan `retry: 0` di lapis hook — satu
    // gangguan jaringan sesaat tidak boleh langsung layar error penuh.
    // SH-F-009 (audit 2026-09-27): TANPA refreshOnFocus — GET /v1/showcase/:id
    // MENAIKKAN viewCount, jadi refetch tiap kembali fokus (dari komentar,
    // ganti tab, dsb.) menggelembungkan view. Penyegaran manual tetap ada
    // lewat tarik-untuk-menyegarkan (query.refresh di DataScreen).
    { useCache: true },
  )
  const item = query.data

  // I-03: judul dokumen = judul item; fallback nama fitur (J-01).
  // D-09: "" juga harus jatuh ke "Etalase" ("" ?? x tetap "").
  useDocumentTitle(item?.title || translate("Etalase"))

  // S3 (audit 2026-09-26): 404 (karya dihapus/privat/tak ada) → EmptyState khusus
  // TANPA tombol retry — "Coba lagi" untuk 404 tidak akan pernah berhasil.
  // Error lain tetap lewat DataScreen (ErrorState + retry).
  const isNotFound =
    !item && query.errorStatus === 404
  if (isNotFound) {
    return (
      <DataScreen
        title={translate("Etalase")}
        state={{
          loading: false,
          refreshing: false,
          error: null,
          refresh: query.refresh,
          reload: query.reload,
        }}
        empty={{
          icon: ChatCircle,
          title: translate("Etalase tidak ditemukan"),
          description: translate("Etalase ini mungkin sudah dihapus atau tidak lagi tersedia."),
          // Item 167 (FE-IMP-1): CTA eksplisit — user punya jalan keluar
          // yang jelas, bukan layar buntu.
          action: (
            <Button fullWidth={false} onPress={() => router.replace(ROUTES.showcase)}>
              {translate("Lihat etalase lain")}
            </Button>
          ),
        }}
      />
    )
  }

  // D-01 (audit 2026-09-23): error refresh/fokus-ulang TIDAK menggantikan
  // konten yang masih ada — draf komentar & posisi scroll tetap hidup.
  // ErrorState hanya saat belum ada data sama sekali.
  if (!item) {
    return (
      <DataScreen
        title={translate("Etalase")}
        state={{
          loading: query.loading,
          refreshing: query.refreshing,
          error: query.error,
          refresh: query.refresh,
          reload: query.reload,
        }}
        loadingMessage={translate("Memuat etalase")}
        errorTitle={translate("Gagal memuat")}
      />
    )
  }

  return <ShowcaseDetailContent key={`${revision}:${item.id}`} item={item} query={query} />
}

/**
 * Konten detail dipisah supaya hook sosial (& hook lain) tidak dipanggil
 * kondisional — `item` selalu non-null di sini. `key={`${revision}:${item.id}`}` memastikan
 * state komentar tidak bocor antar item bila rute [id] dipakai ulang.
 */
function ShowcaseDetailContent({
  item,
  query,
}: {
  item: ShowcaseSocialItem
  query: ReturnType<typeof useApiQuery<ShowcaseSocialItem>>
}) {
  const id = item.id
  const revision = useSessionRevision()
  const operation = useShowcaseOperation(id)
  const mutationPending = useRef(false)
  const toast = useToast()
  /**
   * A-05/A-06/A-07: suka & simpan lewat store bersama — sinkron dengan feed
   * & profil dalam satu sesi; tamu diarahkan ke layar login oleh hook.
   */
  const { liked, likeCount, saved, saveCount, likePending, savedPending, toggleLike, toggleSave, share, shareSheetVisible, setShareSheetVisible, hasSession } =
    useShowcaseSocialActions(item)

  // L-01/L-06 (audit 2026-09-23): param rute untuk tab asal & highlight.
  const { kind: tabKind, comment: highlightComment } = useLocalSearchParams<{
    kind?: string
    comment?: string
  }>()
  const [meId, setMeId] = useState<string | null>(null)
  // S9: username untuk komentar optimistis.
  const [meUsername, setMeUsername] = useState<string | null>(null)
  /** Index foto yang dibuka di <ImageViewer>; null = viewer tertutup. */
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const viewerOpeningTap = useRef<OpeningMediaTap | undefined>(undefined)
  const composerRef = useRef<TextInput>(null)

  const [comments, setComments] = useState<ShowcaseCommentWithReplies[]>([])
  // D-07 (audit 2026-09-23): mulai dari `item.commentCount` — tidak ada
  // kilatan "0 Komentar" lalu melompat. D-05: patch lokal sinkron dengan
  // SEMUA komentar (root+balasan) seperti `commentCount` kartu feed.
  const [commentTotal, setCommentTotal] = useState(item.commentCount ?? 0)
  const [commentsPage, setCommentsPage] = useState(1)
  // F-06: berawal "loading" — bingkai awal yang jujur.
  const [commentsStatus, setCommentsStatus] = useState<LoadMoreStatus>("loading")
  const [commentRenderLimit, setCommentRenderLimit] = useState(COMMENT_RENDER_STEP)
  const [commentsRefreshing, setCommentsRefreshing] = useState(false)
  // BFE-114/FAL-014: urutan komentar dikirim ke server (`?sort=`), bukan
  // di-sort client-side. Default "newest" = perilaku lama.
  const [commentOrder, setCommentOrder] = useState<ShowcaseCommentOrder>("newest")
  /**
   * C14 (batch 139): fokus komentar dari deep link `?comment=`.
   * - `detailScrollRef`/`detailScrollOffsetRef`: scroll terprogram + offset
   *   terkini (offset dipantau via onScroll web/iOS, worklet Android).
   * - `commentTargetRowRef`: pembungkus baris target (dipasang oleh
   *   <ShowcaseDetailComments>) untuk pengukuran posisi.
   * - `commentFocusDoneRef`: fokus hanya sekali per deep link.
   */
  const detailScrollRef = useRef<ScrollView>(null)
  const detailScrollOffsetRef = useRef(0)
  const commentTargetRowRef = useRef<View>(null)
  const commentFocusDoneRef = useRef(false)
  const trackDetailScrollOffset = useCallback((offsetY: number) => {
    detailScrollOffsetRef.current = offsetY
  }, [])
  const handleDetailScroll = useCallback(
    (event: { nativeEvent?: { contentOffset?: { y?: number } } }) => {
      const y = event?.nativeEvent?.contentOffset?.y
      if (typeof y === "number" && Number.isFinite(y)) trackDetailScrollOffset(y)
    },
    [trackDetailScrollOffset],
  )
  const handleDetailScrollWorklet = useCallback(
    (offsetY: number) => {
      "worklet"
      runOnJS(trackDetailScrollOffset)(offsetY)
    },
    [trackDetailScrollOffset],
  )
  const [replyTo, setReplyTo] = useState<ShowcaseComment | null>(null)
  const [draft, setDraft] = useState("")
  /**
   * Item 161 (FE-IMP-1): draft komentar persisten — dimuat sekali per item
   * dari SecureStore (pola sama seperti draft chat). Tidak memblokir render
   * awal: state mulai "", lalu diisi bila draft tersimpan ada.
   */
  useEffect(() => {
    let alive = true
    void loadShowcaseCommentDraft(id).then((text) => {
      if (alive && text) setDraft(text)
    })
    return () => {
      alive = false
    }
  }, [id])
  const handleDraftChange = useCallback(
    (text: string) => {
      setDraft(text)
      // Persist di-debounce 800ms di dalam lib — aman dipanggil tiap ketikan.
      saveShowcaseCommentDraft(id, text)
    },
    [id],
  )
  const [sendingComment, setSendingComment] = useState(false)
  /**
   * T4 (audit 2026-09-26): satu kunci idempotency per (item × isi komentar),
   * dipakai ulang saat retry setelah timeout — tiru pola
   * `showcase-comments-sheet.tsx`. Komponen ini me-remount per item
   * (`key={`${revision}:${item.id}`}`), jadi tidak perlu reset per item.
   */
  const sendKey = useRef<{ item: string; content: string; key: string } | null>(null)

  const [commentMenu, setCommentMenu] = useState<ShowcaseComment | null>(null)
  const [editTarget, setEditTarget] = useState<ShowcaseComment | null>(null)
  const [editText, setEditText] = useState("")
  const [savingComment, setSavingComment] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<ShowcaseComment | null>(null)
  const [confirmKind, setConfirmKind] = useState<"delete" | "hide">("delete")
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [hideReason, setHideReason] = useState<Reason>("SPAM")
  /** T5 (audit 2026-09-26): hapus karya dari layar detail (pemilik saja). */
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // Batch 43 (item 5/7): catat hit klik produk — fire-and-forget, sekali per
  // mount (analytics badge Terlaris). Kegagalan tidak mengganggu UX.
  useEffect(() => {
    api.commerce.recordProductClick(id)
  }, [id])
  /**
   * Kontrak final Tim A #5 (2026-09-28): sheet daftar penyuka/penyimpan.
   * null = tertutup; selain itu tab awal yang dibuka.
   */
  const [likersSheetTab, setLikersSheetTab] = useState<LikersTab | null>(null)

  /** A-11: sheet laporan bersama — null = tertutup. */
  const [reportItem, setReportItem] = useState<ShowcaseSocialItem | null>(null)

  useEffect(() => {
    let alive = true
    setMeId(null)
    setMeUsername(null)
    if (hasSession) void api.users.getMeCached().then((me) => {
      if (alive) {
        // meId dipakai untuk dibandingkan dengan author.userId (public
        // USR-XXX dari backend) — pakai pickPublicUserId (userId publik),
        // BUKAN me.id (cuid internal) yang tidak pernah cocok.
        setMeId(api.users.pickPublicUserId(me))
        setMeUsername(me.username ?? null)
      }
    }).catch(() => { if (alive) { setMeId(null); setMeUsername(null) } })
    return () => { alive = false }
  }, [hasSession, revision])

  /**
   * F-03: AbortController per request — request lama dibatalkan saat yang
   * baru dimulai, dan semuanya dibatalkan saat unmount (lihat cleanup effect
   * di bawah), sehingga tidak ada setState pada komponen mati / respons basi
   * yang menimpa daftar terbaru.
   */
  const commentsAbort = useRef<AbortController | null>(null)
  /**
   * NP-008 (perf-fix): paginasi komentar memakai keyset cursor backend —
   * tanpa `skip` besar. `commentsNextCursor` = kursor untuk langkah berikut;
   * `commentsLoadCount` = jumlah pemuatan (guard kedalaman C14, ganti nomor
   * halaman). `failedComments` menyimpan kursor yang gagal untuk retry.
   */
  const commentsNextCursor = useRef<string | null>(null)
  const commentsLoadCount = useRef(0)
  const failedComments = useRef<{ append: boolean; cursor: string | null }>({ append: false, cursor: null })
  const fetchComments = useCallback(
    async (append: boolean, cursorOverride?: string | null) => {
      if (mutationPending.current) return
      // Tanpa override: tambah = lanjutkan rantai cursor; segarkan = dari awal.
      const startCursor = cursorOverride !== undefined ? cursorOverride : append ? commentsNextCursor.current : null
      failedComments.current = { append, cursor: startCursor }
      commentsAbort.current?.abort()
      const controller = new AbortController()
      commentsAbort.current = controller
      try {
        setCommentsStatus("loading")
        let collected: ShowcaseCommentWithReplies[] = []
        let total = 0
        let hasNext = false
        let next: string | null = startCursor
        // Segarkan: pulihkan jumlah halaman yang sudah dimuat dengan mengikuti
        // rantai cursor (bukan offset) — perilaku lama memuat ulang 1..N.
        // Muat-berikutnya: tepat satu langkah cursor.
        const targetLoads = append ? 1 : Math.max(1, commentsLoadCount.current)
        let loads = 0
        do {
          const res = await listShowcaseComments(id, { limit: 20, cursor: next, sort: commentOrder }, controller.signal)
          if (controller.signal.aborted) return
          collected = mergeComments(collected, res.data)
          total = res.total
          hasNext = res.hasNext
          next = res.nextCursor ?? null
          loads += 1
        } while (!append && hasNext && loads < targetLoads)
        if (controller.signal.aborted) return
        setComments((prev) => (append ? mergeComments(prev, collected) : collected))
        commentsLoadCount.current = append ? commentsLoadCount.current + loads : loads
        commentsNextCursor.current = next
        if (!append) setCommentRenderLimit(COMMENT_RENDER_STEP)
        setCommentTotal(total)
        setCommentsPage(commentsLoadCount.current)
        setCommentsStatus(hasNext ? "idle" : "end")
        failedComments.current = { append: false, cursor: null }
      } catch {
        if (controller.signal.aborted) return
        setCommentsStatus("error")
      }
    },
    [id, commentOrder],
  )
  useEffect(() => {
    void fetchComments(false)
    return () => commentsAbort.current?.abort()
  }, [fetchComments])

  /**
   * C14 (batch 139): deep link `?comment=` — cari target lintas halaman
   * (bounded: berhenti saat ketemu, halaman habis, atau batas halaman).
   * Tidak mengganggu tombol "muat berikutnya" manual (guard status).
   */
  useEffect(() => {
    // C14: keputusan lanjut-cari murni & teruji (batas halaman).
    if (
      !shouldFetchNextCommentPage({
        commentId: highlightComment,
        focusDone: commentFocusDoneRef.current,
        targetFound: !!highlightComment && !!findShowcaseComment(comments, highlightComment),
        commentsStatus,
        commentsPage,
        maxPages: COMMENT_FOCUS_MAX_PAGES,
      })
    ) {
      return
    }
    void fetchComments(true)
  }, [highlightComment, comments, commentsStatus, commentsPage, fetchComments])

  /**
   * C14: pastikan baris target ikut ter-render — perluas render limit sampai
   * mencakup indeks target pada urutan default ("newest", sama seperti
   * komponen daftar saat deep link tiba).
   */
  useEffect(() => {
    if (!highlightComment || commentFocusDoneRef.current) return
    const ordered = sortShowcaseComments(comments, commentOrder)
    const targetIndex = ordered.findIndex((root) => root.id === highlightComment)
    if (targetIndex >= 0 && targetIndex >= commentRenderLimit) {
      setCommentRenderLimit(targetIndex + 1)
    }
  }, [highlightComment, comments, commentRenderLimit])

  /**
   * C14: scroll otomatis ke baris target setelah ter-render. Posisi diukur
   * via `measure()` (koordinat halaman) dikurangi posisi ScrollView +
   * offset scroll terkini — lalu `scrollTo` terprogram. Sekali per deep link.
   */
  useEffect(() => {
    if (!highlightComment || commentFocusDoneRef.current) return
    const found = findShowcaseComment(comments, highlightComment)
    if (!found) return
    const ordered = sortShowcaseComments(comments, commentOrder)
    const targetIndex = ordered.findIndex((root) => root.id === highlightComment)
    if (targetIndex < 0 || targetIndex >= commentRenderLimit) return
    let cancelled = false
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return
        const row = commentTargetRowRef.current
        const scroller = detailScrollRef.current
        if (!row || !scroller) return
        row.measure((_x, _y, _w, _h, _pageX, pageY) => {
          // ScrollView tidak mengekspos .measure di tipenya — ukur via node.
          const scrollNode = findNodeHandle(scroller)
          if (scrollNode == null) return
          UIManager.measure(scrollNode, (_sx, _sy, _sw, _sh, _spx, spy) => {
            if (cancelled) return
            const targetY =
              pageY - spy + detailScrollOffsetRef.current - COMMENT_FOCUS_TOP_MARGIN
            commentFocusDoneRef.current = true
            scroller.scrollTo({ y: Math.max(0, targetY), animated: true })
          })
        })
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [highlightComment, comments, commentRenderLimit])

  const isOwner = item.isOwner === true || (hasSession && meId === item.author.userId)

  // Batch 19: slide galeri (gambar/video); viewer layar penuh hanya gambar.
  // PERF-FIX (2026-09-30): halaman detail memakai thumbnail untuk semua slide
  // (`thumbnails` default true); slide AKTIF di-upgrade ke full-res via
  // `activeFullRes` di galeri — bukan full-res untuk semua slide sekaligus
  // (8 slide × 2–5 MB = ~40 MB bila user swipe semua).
  const resolvedMedia = useMemo(() => showcaseMedia(item), [item])
  // Kontrak final Tim A (2026-09-28): spin360 dirangkai dari entri images
  // (groupKey + groupOrder), bukan field `frames` terpisah.
  const spin360Frames = useMemo(() => showcaseSpin360Groups(item), [item])

  /** Ketuk media → viewer layar penuh (pinch-zoom + swipe antar foto). */
  const openViewer = (index: number, openingTap?: OpeningMediaTap) => {
    viewerOpeningTap.current = openingTap
    // Item 158 (FE-IMP-1): viewer kini campuran gambar+video — indeks slide
    // media dipakai langsung (tidak lagi dipetakan ke indeks gambar).
    if (index >= 0 && index < resolvedMedia.length) setViewerIndex(index)
  }

  const focusComposer = () => composerRef.current?.focus()

  const patchComment = useCallback(
    (patch: (c: ShowcaseComment) => ShowcaseComment | null) => {
      setComments((prev) => patchComments(prev, patch))
    },
    [],
  )

  /**
   * F-02: komentar terkirim disisipkan LOKAL (bukan fetchComments(1,false)
   * yang membuang halaman 2..N). Balasan di-append ke induknya; root baru
   * di-unshift. Total +1. Pelurusan akhir diserahkan refresh berikutnya.
   */
  const insertLocalComment = useCallback((saved: ShowcaseComment) => {
    setComments((prev) => {
      if (saved.parentId) {
        let appended = false
        const next = prev.map((root) => {
          if (root.id === saved.parentId) {
            appended = true
            return { ...root, replies: [...(root.replies ?? []), saved] }
          }
          return root
        })
        // Induk tidak terlihat (halaman lebih baru) → tampilkan sebagai root
        // sementara; lebih baik terlihat dua kali sesaat daripada hilang.
        return appended ? next : [{ ...saved, replies: [] }, ...prev]
      }
      return [{ ...saved, replies: [] }, ...prev]
    })
    setCommentTotal((n) => n + 1)
  }, [])

  const handleSendComment = useCallback(async () => {
    const content = draft.trim()
    if (!content || !hasSession) return
    const task = operation.begin()
    if (!task) return
    mutationPending.current = true
    commentsAbort.current?.abort()
    setSendingComment(true)

    // S9 (audit 2026-09-26): insert optimistis — komentar langsung tampil
    // dengan ID sementara; sukses → diganti data server, gagal → dihapus
    // (rollback). Idempotency-Key T4 dipertahankan supaya retry tidak dobel.
    const tempId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const optimistic: ShowcaseComment = {
      id: tempId,
      showcaseId: id,
      parentId: replyTo?.id ?? null,
      content,
      createdAt: new Date().toISOString(),
      author: {
        userId: meId ?? "",
        username: meUsername ?? translate("Anda"),
        fullName: null,
      },
    }
    insertLocalComment(optimistic)
    // Kosongkan draft segera — UX terasa instan.
    setDraft("")
    // Item 161: draft tersimpan ikut dihapus — komentar sudah terkirim.
    clearShowcaseCommentDraft(id)
    setReplyTo(null)

    try {
      const keyed =
        sendKey.current?.item === id && sendKey.current?.content === content
          ? sendKey.current.key
          : (sendKey.current = { item: id, content, key: createIdempotencyKey() }).key
      const saved = await addShowcaseComment(
        id,
        {
          content,
          parentId: replyTo?.id,
        },
        keyed,
      )
      // Kiriman ini tuntas — teks yang sama berikutnya adalah aksi BARU.
      sendKey.current = null
      // F-01/C-01 (audit 2026-09-24): delta ke ledger — feed/profil ikut naik
      // TANPA refetch yang membuang halaman 2..N.
      queueShowcaseCommentCount(id, 1)
      if (!task.valid()) return
      // Ganti baris optimistis dengan data server (ID asli).
      setComments((prev) =>
        prev.map((c) =>
          c.id === tempId
            ? { ...saved, replies: c.replies ?? [] }
            : {
                ...c,
                replies: c.replies?.map((r) => (r.id === tempId ? { ...saved } : r)),
              },
        ),
      )
    } catch (err) {
      if (!task.valid()) return
      // Rollback: hapus baris optimistis.
      setComments((prev) =>
        prev
          .filter((c) => c.id !== tempId)
          .map((c) => ({
            ...c,
            replies: c.replies?.filter((r) => r.id !== tempId),
          })),
      )
      setCommentTotal((n) => Math.max(0, n - 1))
      // Item 161: kirim gagal — kembalikan draft (state + SecureStore) supaya
      // teks yang diketik pengguna tidak hilang.
      setDraft(content)
      saveShowcaseCommentDraft(id, content)
      toast.show({
        title: SHOWCASE_COMMENT_MESSAGES.sendFailed,
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    } finally {
      if (task.valid()) {
        setSendingComment(false)
        setCommentsStatus((status) => status === "loading" ? "idle" : status)
      }
      mutationPending.current = false
      task.finish()
    }
  }, [id, draft, replyTo, insertLocalComment, toast.show, hasSession, operation, fetchComments, commentsPage, meId, meUsername])

  const handleSaveEdit = useCallback(async () => {
    if (!editTarget) return
    const content = editText.trim()
    if (!content) return
    const task = operation.begin()
    if (!task) return
    mutationPending.current = true
    commentsAbort.current?.abort()
    setSavingComment(true)
    try {
      const saved = await updateShowcaseComment(editTarget.id, content)
      if (!task.valid()) return
      // Suntingan tidak mengubah hitungan komentar — tidak ada event ledger.
      patchComment((c) => (c.id === saved.id ? { ...c, content: saved.content } : c))
      setEditTarget(null)
    } catch (err) {
      if (!task.valid()) return
      toast.show({
        title: SHOWCASE_COMMENT_MESSAGES.saveFailed,
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    } finally {
      if (task.valid()) {
        setSavingComment(false)
        setCommentsStatus((status) => status === "loading" ? "idle" : status)
      }
      mutationPending.current = false
      task.finish()
    }
  }, [editTarget, editText, patchComment, toast.show, operation, fetchComments, commentsPage])

  const handleConfirmAction = useCallback(async () => {
    if (!confirmTarget) return
    const task = operation.begin()
    if (!task) return
    mutationPending.current = true
    commentsAbort.current?.abort()
    setConfirmBusy(true)
    try {
      if (confirmKind === "delete") {
        await deleteShowcaseComment(confirmTarget.id)
        if (!task.valid()) return
        // D-06: patchComments menghapus root BESERTA balasannya.
        const removed =
          1 + (comments.find((c) => c.id === confirmTarget.id)?.replies?.length ?? 0)
        // F-01 (audit 2026-09-24): delta negatif ke ledger, bukan refetch.
        queueShowcaseCommentCount(id, -removed)
        patchComment((comment) => comment.id === confirmTarget.id ? null : comment)
        // F-08/D-05: hanya HAPUS yang menggeser total — ikut jumlah yang
        // benar-benar hilang (root + balasan).
        setCommentTotal((n) => Math.max(0, n - removed))
        toast.show({ title: SHOWCASE_COMMENT_MESSAGES.deleted, tone: "success", duration: 2500 })
      } else {
        const saved = await hideShowcaseComment(confirmTarget.id, hideReason)
        if (!task.valid()) return
        // Hide tidak mengubah hitungan yang DITAMPILKAN (komentar tetap ada
        // untuk pemilik; apakah server mengeluarkannya dari hitungan publik
        // tidak dinyatakan di kontrak) — tidak ada event ledger yang dikarang.
        patchComment((c) =>
          c.id === saved.id ? { ...c, isHidden: true, hiddenReason: hideReason } : c,
        )
        toast.show({ title: SHOWCASE_COMMENT_MESSAGES.hidden, tone: "success", duration: 2500 })
      }
      setConfirmTarget(null)
    } catch (err) {
      if (!task.valid()) return
      toast.show({
        title: SHOWCASE_COMMENT_MESSAGES.updateFailed,
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    } finally {
      if (task.valid()) {
        setConfirmBusy(false)
        setCommentsStatus((status) => status === "loading" ? "idle" : status)
      }
      mutationPending.current = false
      task.finish()
    }
  }, [confirmTarget, confirmKind, hideReason, patchComment, toast.show, operation, fetchComments, commentsPage])

  const handleUnhide = useCallback(
    async (comment: ShowcaseComment) => {
      const task = operation.begin()
      if (!task) return
      mutationPending.current = true
      commentsAbort.current?.abort()
      try {
        const saved = await unhideShowcaseComment(comment.id)
        if (!task.valid()) return
        // Unhide = kebalikan hide: tidak ada perubahan hitungan yang pasti.
        patchComment((c) =>
          c.id === saved.id ? { ...c, isHidden: false, hiddenReason: null } : c,
        )
        // F-08: unhide tidak mengubah total (komentar tidak pernah hilang).
        toast.show({ title: SHOWCASE_COMMENT_MESSAGES.restored, tone: "success", duration: 2500 })
      } catch (err) {
        if (!task.valid()) return
        toast.show({
          title: SHOWCASE_COMMENT_MESSAGES.revealFailed,
          description: isApiError(err) ? userMessage(err) : undefined,
          tone: "danger",
        })
      } finally {
        mutationPending.current = false
        if (task.valid()) setCommentsStatus((status) => status === "loading" ? "idle" : status)
        task.finish()
      }
    },
    [patchComment, toast.show, operation, fetchComments, commentsPage],
  )

  /** F-09: tarik-segarkan memuat ulang item DAN komentar halaman 1. */
  const handleRefresh = useCallback(() => {
    if (commentsRefreshing) return
    setCommentsRefreshing(true)
    void query.refresh()
    void fetchComments(false).finally(() => setCommentsRefreshing(false))
  }, [commentsRefreshing, query, fetchComments])

  const priceLabel = showcasePriceLabelOrFallback(item)
  // C06 (batch 139): status stok konsisten dengan kartu feed — CTA
  // "Buat Transaksi" nonaktif saat stok habis. Graceful: tanpa field stok
  // dari backend, perilaku sama seperti sebelumnya.
  const soldOut = isShowcaseSoldOut(item)

  const canReply = (c: ShowcaseComment) => hasSession && !c.isHidden && c.parentId == null
  const isMine = (c: ShowcaseComment) => meId != null && c.author.userId === meId

  /**
   * D-03 (audit 2026-09-23): lapor komentar = kirim BUKTI komentarnya —
   * id + isi ikut terbawa ke /reports (dulu hanya userId penulis, sehingga
   * ID/isi komentar tidak pernah sampai ke moderator). targetName membuat
   * judul form spesifik, bukan "Laporkan pengguna" generik.
   */
  const handleReportComment = useCallback((comment: ShowcaseComment) => {
    router.push(
      ROUTES.reports({
        targetId: comment.author.userId,
        targetName: comment.author.username,
        commentId: comment.id,
        commentBody: comment.content.slice(0, 200),
      }),
    )
  }, [])

  /**
   * F-01: hormati orderLink saat tersedia; jatuh ke counterpart saja.
   * D-04 (audit 2026-09-23): tamu tidak boleh menabrak create-transaction
   * yang terproteksi — gate ke loginRequired dengan `next` kembali ke detail.
   */
  const handleCreateTransaction = useCallback(() => {
    const target = item.orderLink
      ? ROUTES.createTransactionFromShowcase(item.orderLink, item.author.username)
      : // FE-044: tanpa orderLink, tombol "Beli via Escrow" dari etalase tetap
        // membawa flag fromShowcase — wizard mulai dari langkah 1 (mode &
        // peran sudah pasti), bukan langkah 0.
        ROUTES.createTransactionWith(item.author.username, { fromShowcase: true })
    router.push(hasSession ? target : ROUTES.loginRequired(`/showcase/${encodeURIComponent(item.id)}`))
  }, [item, hasSession])

  /** T5 (audit 2026-09-26): hapus karya milik sendiri dari layar detail. */
  const handleDeleteItem = useCallback(async () => {
    if (!isOwner) return
    const task = operation.begin()
    if (!task) return
    setDeleting(true)
    try {
      await api.users.deleteShowcase(id)
      if (!task.valid()) return
      // Soft-delete: catat lokal agar bisa dipulihkan dari Kelola Etalase.
      await markShowcaseDeleted({
        id,
        title: item?.title?.trim() || translate("Etalase tanpa judul"),
        deletedAt: new Date().toISOString(),
        coverUrl: item ? (showcaseImages(item)?.[0]?.url ?? undefined) : undefined,
      })
      markShowcaseFeedDirty()
      // PERF-FIX (network P0): item dihapus — cache "Etalase Saya" basi.
      invalidateQueryPrefix("my-showcase")
      toast.show({ title: translate("Etalase dihapus. Dapat dipulihkan dalam 30 hari."), tone: "success", duration: 2500 })
      setDeleteOpen(false)
      router.back()
    } catch (err) {
      if (!task.valid()) return
      toast.show({
        title: translate("Gagal menghapus"),
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    } finally {
      if (task.valid()) setDeleting(false)
      task.finish()
    }
  }, [id, isOwner, operation, toast.show])

  // TIM-8 (audit performa 2026-09-30): `showcaseHtmlHasFormatting` = parse +
  // sanitasi penuh — di-memo per description supaya tidak jalan ulang tiap
  // render (mis. tiap keystroke draft komentar).
  const descriptionHasFormatting = useMemo(
    () => (item?.description ? showcaseHtmlHasFormatting(item.description) : false),
    [item?.description],
  )

  return (
    <DataScreen
      title={translate("Etalase")}
      padded={false}
      state={{
        loading: false,
        refreshing: query.refreshing || commentsRefreshing,
        error: null,
        refresh: handleRefresh,
        reload: handleRefresh,
      }}
      refreshable
      contentClassName="gap-0"
      // Item 163: footer memuat komposer komentar — naik di atas keyboard.
      keyboardAvoiding
      // C14 (batch 139): scroll terprogram + pantau offset untuk fokus komentar.
      scrollRef={detailScrollRef}
      onScroll={handleDetailScroll}
      onScrollWorklet={handleDetailScrollWorklet}
      footer={
        // UX-SPA-004: tanpa border-t sendiri — <FooterBar> sudah memberi divider.
        <View className="bg-background py-3">
          {/* Aksi escrow sticky tetap terlihat di atas komposer; harga utama
              hanya ditampilkan di isi detail agar tidak diduplikasi. Area ini
              hanya berisi catatan escrow dan CTA, dan disembunyikan untuk pemilik. */}
          {!isOwner ? (
            <View className="mb-3 flex-row items-center gap-3 border-b border-border pb-3">
              <Text variant="caption" tone="secondary" numberOfLines={2} className="min-w-0 flex-1">
                {translate("Dana ditahan escrow sampai barang Anda terima")}
              </Text>
              <Button
                disabled={item.isActive === false || soldOut}
                onPress={handleCreateTransaction}
                accessibilityHint={
                  soldOut
                    ? translate("Stok etalase ini habis, jadi belum bisa ditransaksikan.")
                    : item.isActive === false
                      ? translate("Etalase ini sedang tidak aktif, jadi belum bisa ditransaksikan.")
                      : undefined
                }
              >
                {translate("Beli via Escrow")}
              </Button>
            </View>
          ) : null}
          {replyTo ? (
            <View className="mb-2 flex-row items-center gap-2 rounded-md bg-surface-elevated px-3 py-1.5">
              <Text variant="caption" tone="secondary" className="flex-1" numberOfLines={1}>
                {translate("Membalas {x}", { x: replyTo.author.fullName ?? `@${replyTo.author.username}` })}
              </Text>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={translate("Batalkan balasan")}
                // UI-F014: teks kecil butuh hitSlop agar mudah disentuh.
                hitSlop={12}
                onPress={() => setReplyTo(null)}
              >
                <Text variant="caption" tone="primary">
                  {translate("Batal")}
                </Text>
              </PressableScale>
            </View>
          ) : null}
          {hasSession ? (
            <View className="flex-row items-end gap-2">
              <View className="flex-1">
                <Input
                  ref={composerRef}
                  disabled={sendingComment}
                  value={draft}
                  onChangeText={handleDraftChange}
                  placeholder={translate("Tulis komentar…")}
                  accessibilityLabel={translate("Komentar baru")}
                  containerClassName="flex-1"
                  maxLength={COMMENT_MAX}
                  onSubmitEditing={() => void handleSendComment()}
                  returnKeyType="send"
                />
                {/* Item 162 (FE-IMP-1): konter SELALU "X karakter tersisa"
                    (bukan format ganda seperti "200/2000"). */}
                <Text variant="caption" tone="secondary" className="pt-1 text-right tabular-nums">
                  {translate("{x} karakter tersisa", { x: COMMENT_MAX - draft.length })}
                </Text>
              </View>
              <IconButton
                icon={PaperPlaneRight}
                variant="primary"
                size="sm"
                accessibilityLabel={translate("Kirim komentar")}
                loading={sendingComment}
                disabled={!draft.trim()}
                onPress={() => void handleSendComment()}
              />
            </View>
          ) : (
            // A-05: tamu diarahkan login, bukan komposer yang berujung 401.
            <Button onPress={() => router.push(ROUTES.loginRequired(`/showcase/${encodeURIComponent(id)}`))}>
              {translate("Masuk untuk berkomentar")}
            </Button>
          )}
        </View>
      }
    >
      {/* ── Penulis DI ATAS media (selaras kartu feed) + laporkan ──
          (G-11: baris penulis + aksi diekstrak ke ShowcaseAuthorRow) */}
      <ShowcaseAuthorRow
        item={item}
        isOwner={isOwner}
        hasSession={hasSession}
        onReport={() => setReportItem(item)}
      />

      {/* ── Media: CARD pager (mx-5, selaras avatar) — bukan full-bleed ── */}
      <View className="mx-5 pt-3">
        <ShowcaseMediaGallery
          media={resolvedMedia}
          title={item.title}
          onOpen={openViewer}
          // Item 157 (FE-IMP-1): ketuk-ganda pada media = suka. (Galeri sudah
          // punya deteksi double-tap; yang kurang hanya wiring ke toggleLike.)
          onDoubleTap={() => {
            if (!liked) toggleLike()
          }}
          autoplayActive={viewerIndex == null}
          // C01: rasio slide pertama untuk placeholder di luar jendela render.
          aspectRatio={resolvedMedia[0]?.aspectRatio ?? 1}
          // PERF-FIX (2026-09-30): slide aktif full-res, sisanya thumbnail.
          activeFullRes
        />
      </View>

      {/* ── Tampilan 360° (batch 19, item 12) — di bawah galeri, kontrak TIM A pending ── */}
      {spin360Frames.map((frames, spinIndex) => (
        <View key={`spin360-${spinIndex}`} className="mx-5 pt-3">
          <Spin360Viewer frames={frames} alt={item.title} />
        </View>
      ))}

      {/* ── Harga · kategori ── */}
      {/* TYP-A (2026-09-30): hierarki judul ≥ harga — harga bodyLarge/700 (16px
          bold) tetap menonjol tapi tidak lagi mendominasi judul h3/700. */}
      <View className="flex-row flex-wrap items-center gap-2 px-5 pt-3">
        <Text variant="bodyLarge" weight={700} className="tabular-nums">
          {priceLabel}
        </Text>
        {/* Batch 43: harga coret + badge Terlaris/Diskon */}
        <DiscountPrice showcaseId={id} salePriceIdr={item.priceMin ?? item.priceMax} />
        <ProductBadges showcaseId={id} />
        {item.category ? (
          // A-12: badge kategori juga menavigasi ke feed terfilter.
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={translate("Lihat kategori {x}", { x: item.category })}
            // L-01: teruskan tab aktif dari param `?kind=` bila ada.
            onPress={() => router.push(ROUTES.showcaseWithCategory(item.category as string, tabKind))}
            containerClassName={cn("rounded-full", focusRing)}
          >
            <Badge variant="outline">{item.category}</Badge>
          </PressableScale>
        ) : null}
      </View>

      <View className="px-5 pt-1">
        {/* TYP-A (2026-09-30): judul memimpin hierarki — h3/700 ≥ harga bodyLarge/700. */}
        <Text variant="h3" weight={700}>
          {item.title}
        </Text>
      </View>

      {/* DC-007 (audit Discovery 2026-09-26): descriptionHtml (Kahade+ benefit 7)
          diutamakan bila ada — render TERSANITASI via <ShowcaseHtmlView>.
          description plaintext tetap fallback. */}
      {item.descriptionHtml ? (
        <View className="px-5 pt-1">
          <ShowcaseHtmlView html={item.descriptionHtml} />
        </View>
      ) : item.description ? (
        descriptionHasFormatting ? (
          /* Benefit 7 Kahade+: deskripsi HTML anggota Plus di-render
             tersanitasi via <ShowcaseHtmlView> — JANGAN render mentah. */
          <View className="px-5 pt-1">
            <ShowcaseHtmlView html={item.description} />
          </View>
        ) : (
          // Item 152 (FE-IMP-1): deskripsi panjang dilipat ke 4 baris +
          // tautan "Selengkapnya"/"Tutup". (Deskripsi HTML Kahade+ sengaja
          // tidak dilipat — struktur bloknya tidak bisa dihitung per-baris
          // dengan andal.)
          <CollapsibleText text={item.description} maxLines={4} className="px-5 pt-1" />
        )
      ) : null}

      {/* Batch 43 (item 10): kalender slot jasa + booking — hanya render bila
          penjual mengonfigurasi slot untuk karya ini. */}
      <ServiceSlotSection
        showcaseId={id}
        sellerUsername={item.author.username}
        hasSession={hasSession}
        isOwner={isOwner}
      />

      {/* Separator atas aksi — inset mx-5, bukan full */}
      <Divider inset className="mt-4" />

      {/* G-11/S9: baris aksi diekstrak ke ShowcaseDetailActions. */}
      <ShowcaseDetailActions
        liked={liked}
        likeCount={likeCount}
        likePending={likePending}
        onToggleLike={toggleLike}
        onShowLikers={() => setLikersSheetTab("likers")}
        commentTotal={commentTotal}
        onCommentPress={focusComposer}
        saved={saved}
        savedPending={savedPending}
        onToggleSave={toggleSave}
        onShowSavers={isOwner ? () => setLikersSheetTab("savers") : undefined}
        onShare={() => void share()}
      />
      {/* Daftar penyuka/penyimpan dibuka dengan long-press pada aksi suka/simpan.
          DC-008: metrik share dari backend — tampil ringan bila ada. */}
      {(item.shareCount ?? 0) > 0 ? (
        <Text variant="caption" tone="tertiary" className="px-5">
          {translate("{x} kali dibagikan", { x: formatNumber(item.shareCount ?? 0) })}
        </Text>
      ) : null}

      {/* Batch 43 (item 6): statistik produk — hanya pemilik. */}
      {isOwner ? <ProductStatsSection showcaseId={id} /> : null}

      {/* Batch 43 (item 14): kelola aset digital — hanya pemilik produk
          DIGITAL. Tipe produk tidak dikembalikan GET publik/owner, jadi
          andalkan cache sesi (diisi saat PATCH commerce di Kelola Etalase). */}
      {isOwner && getCommerceFieldsCache(id)?.productType === "DIGITAL" ? (
        <View className="px-5 pt-4">
          <DigitalAssetsSellerManager showcaseId={id} />
        </View>
      ) : null}

      {/* Separator bawah aksi — inset */}
      <Divider inset className="mt-1" />

      <View className="px-5 pt-4">
        {/* Item 163 (FE-IMP-1): CTA transaksi kini sticky di footer — blok ini
            hanya menyimpan catatan pemilik & aksi hapus. Untuk non-pemilik,
            catatan "karya tidak aktif" pindah ke accessibilityHint CTA sticky. */}
        {isOwner ? (
          // T5 (audit 2026-09-26): pemilik bisa menghapus karyanya dari sini.
          <View className="gap-2">
            <Button variant="ghost" fullWidth onPress={() => setDeleteOpen(true)}>
              {translate("Hapus etalase")}
            </Button>
          </View>
        ) : null}
      </View>

      {/* G-11/S9: utas komentar diekstrak ke komponen sendiri. */}
      <ShowcaseDetailComments
        comments={comments}
        commentTotal={commentTotal}
        commentsStatus={commentsStatus}
        commentRenderLimit={commentRenderLimit}
        highlightComment={highlightComment}
        // BFE-114/FAL-014: urutan dikirim ke server via `sort`; ganti urutan
        // = reset paginasi + refetch dari awal.
        commentOrder={commentOrder}
        onCommentOrderChange={(order) => {
          if (order === commentOrder) return
          commentsNextCursor.current = null
          commentsLoadCount.current = 0
          setCommentOrder(order)
        }}
        // C14: fokus + scroll otomatis ke komentar deep link.
        focusCommentId={highlightComment}
        focusRowRef={commentTargetRowRef}
        isOwner={isOwner}
        hasSession={hasSession}
        isMine={isMine}
        canReply={canReply}
        onReply={setReplyTo}
        onOpenMenu={setCommentMenu}
        onShowMore={() => setCommentRenderLimit((n) => n + COMMENT_RENDER_STEP)}
        onLoadMore={() => {
          // NP-008: error → ulangi kursor yang gagal; normal → satu langkah cursor.
          if (commentsStatus === "error") {
            const failed = failedComments.current
            void fetchComments(failed.append, failed.cursor)
          } else {
            void fetchComments(true)
          }
        }}
      />

      {/* Item 158/159 (FE-IMP-1): viewer fullscreen media CAMPURAN
          (gambar + video) dengan aksi Bagikan & Simpan di chrome bawah. */}
      <ImageViewer
        visible={viewerIndex != null}
        images={resolvedMedia.map((m) => ({
          // PERF-FIX (2026-09-30): viewer fullscreen selalu full-res.
          url: m.fullUrl ?? m.url,
          alt: item.title,
          kind: m.kind === "video" ? "video" : "image",
        }))}
        index={viewerIndex ?? 0}
        openingTap={viewerOpeningTap.current}
        onClose={() => setViewerIndex(null)}
        title={item.title}
        actions={
          <>
            <IconButton
              icon={ShareNetwork}
              variant="ghost"
              accessibilityLabel={translate("Bagikan etalase ini")}
              // Item 159: tutup viewer dulu sebelum membuka sheet berbagi —
              // dua Modal bertumpuk rawan sheet tertutup viewer.
              onPress={() => {
                setViewerIndex(null)
                void share()
              }}
            />
            <IconButton
              icon={BookmarkSimple}
              variant="ghost"
              active={saved}
              accessibilityLabel={
                saved ? translate("Hapus dari simpanan") : translate("Simpan etalase ini")
              }
              accessibilityState={{ selected: saved }}
              loading={savedPending}
              onPress={() => void toggleSave()}
            />
          </>
        }
      />

      {/* Karya terkait — kategori sama, lalu populer sebagai pengisi. */}
      {item.related && item.related.length > 0 ? (
        <View className="pt-4">
          <Divider inset className="mb-3" />
          <Text variant="h3" className="px-5 pb-3">
            {translate("Etalase terkait")}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-3 px-5 pb-2"
          >
            {/* Item 166 (FE-IMP-1): kartu diekstrak ke <ShowcaseRelatedCard>
                — quick-like per kartu butuh hook (tidak legal di dalam .map). */}
            {item.related.map((rel) => (
              <ShowcaseRelatedCard key={rel.id} rel={rel} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <ActionSheet
        visible={commentMenu != null}
        onRequestClose={() => setCommentMenu(null)}
        title={translate("Komentar")}
        actions={[
          ...(commentMenu && canReply(commentMenu)
            ? [
                {
                  key: "reply",
                  label: translate("Balas"),
                  icon: ChatCircle,
                  onPress: () => setReplyTo(commentMenu),
                },
              ]
            : []),
          ...(commentMenu && isMine(commentMenu) && !commentMenu.isHidden
            ? [
                {
                  key: "edit",
                  label: translate("Ubah"),
                  icon: undefined,
                  onPress: () => {
                    setEditTarget(commentMenu)
                    setEditText(commentMenu.content)
                  },
                },
              ]
            : []),
          ...(commentMenu && isOwner && !commentMenu.isHidden
            ? [
                {
                  key: "hide",
                  label: translate("Sembunyikan"),
                  icon: undefined,
                  onPress: () => {
                    setConfirmKind("hide")
                    setConfirmTarget(commentMenu)
                  },
                },
              ]
            : []),
          ...(commentMenu && isOwner && commentMenu.isHidden
            ? [
                {
                  key: "unhide",
                  label: translate("Tampilkan kembali"),
                  icon: undefined,
                  onPress: () => void handleUnhide(commentMenu),
                },
              ]
            : []),
          // F-05: laporkan komentar orang lain (bukan milik sendiri).
          ...(commentMenu && hasSession && !isMine(commentMenu)
            ? [
                {
                  key: "report",
                  label: translate("Laporkan pengguna"),
                  icon: Flag,
                  onPress: () => handleReportComment(commentMenu),
                },
              ]
            : []),
          ...(commentMenu && (isMine(commentMenu) || isOwner)
            ? [
                {
                  key: "delete",
                  label: translate("Hapus"),
                  icon: Trash,
                  destructive: true,
                  onPress: () => {
                    setConfirmKind("delete")
                    setConfirmTarget(commentMenu)
                  },
                },
              ]
            : []),
        ]}
      />

      <BottomSheet
        avoidKeyboard
        visible={editTarget != null}
        onRequestClose={() => setEditTarget(null)}
        title={translate("Ubah komentar")}
        footer={
          <View className="gap-2">
            <Button
              fullWidth
              loading={savingComment}
              disabled={!editText.trim()}
              onPress={() => void handleSaveEdit()}
            >
              Simpan
            </Button>
          </View>
        }
      >
        <View className="px-5 pb-2">
          <TextArea
            value={editText}
            onChangeText={setEditText}
            rows={3}
            maxLength={COMMENT_MAX}
            placeholder={translate("Tulis ulang komentar")}
            accessibilityLabel={translate("Komentar yang diedit")}
          />
        </View>
      </BottomSheet>

      <Dialog
        title={confirmKind === "hide" ? translate("Sembunyikan komentar ini?") : translate("Hapus komentar ini?")}
        description={
          // FE-083: judul "Sembunyikan komentar ini?" + tombol "Sembunyikan"
          // sudah jelas — description hanya mengulang. Varian hapus tetap
          // memakai description (sifat permanennya perlu ditegaskan).
          confirmKind === "hide" ? undefined : translate("Komentar dihapus permanen.")
        }
        visible={confirmTarget != null}
        destructive
        loading={confirmBusy}
        confirmLabel={confirmKind === "hide" ? translate("Sembunyikan") : translate("Hapus")}
        cancelLabel={translate("Batal")}
        onConfirm={() => void handleConfirmAction()}
        onCancel={() => setConfirmTarget(null)}
        onRequestClose={() => setConfirmTarget(null)}
      >
        {confirmKind === "hide" ? (
          <View className="gap-2">
            <Text variant="caption" tone="secondary">
              {translate("Kategori alasan:")}
            </Text>
            <RadioGroup value={hideReason} onChange={(v) => setHideReason(v as Reason)}>
              {HIDE_REASONS.map((r) => (
                <Radio key={r.value} value={r.value} label={r.label} description={r.description} />
              ))}
            </RadioGroup>
          </View>
        ) : null}
      </Dialog>

      {/* T5 (audit 2026-09-26): konfirmasi hapus karya (pemilik). */}
      <Dialog
        title={translate("Hapus etalase ini?")}
        description={translate("Etalase dihapus dan dapat dipulihkan dalam 30 hari.")}
        visible={deleteOpen}
        destructive
        loading={deleting}
        confirmLabel={translate("Hapus")}
        cancelLabel={translate("Batal")}
        onConfirm={() => void handleDeleteItem()}
        onCancel={() => setDeleteOpen(false)}
        onRequestClose={() => setDeleteOpen(false)}
      />

      {/* A-11: SATU sheet laporan (copy seragam "Laporkan Karya"). */}
      <ShowcaseReportSheet item={reportItem} onRequestClose={() => setReportItem(null)} />
      <ShowcaseShareSheet visible={shareSheetVisible} item={item} onClose={() => setShareSheetVisible(false)} />
      {/* Kontrak final Tim A #5: daftar penyuka (publik) & penyimpan (pemilik). */}
      <ShowcaseLikersSheet
        visible={likersSheetTab !== null}
        onClose={() => setLikersSheetTab(null)}
        itemId={item.id}
        likeCount={likeCount}
        saveCount={saveCount}
        canViewSavers={isOwner}
        initialTab={likersSheetTab ?? "likers"}
      />
    </DataScreen>
  )
}
