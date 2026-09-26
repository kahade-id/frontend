/** Public Etalase detail with optional viewer authentication and fenced comment mutations.
 * Comment reads reconcile complete loaded pages after a mutation. Server authorization remains authoritative. */

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Image,
  ScrollView,
  View,
  type TextInput,
} from "react-native"
import { useLocalSearchParams, router } from "expo-router"
import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"

import {
  ChatCircle,
  Flag,
  PaperPlaneRight,
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

import { useSessionRevision } from "@/lib/guest-gate"
import { useShowcaseOperation } from "@/lib/use-showcase-operation"
import { mergeComments, patchComments } from "@/lib/showcase-state"
import { showcaseImages } from "@/lib/showcase-social"
import { markShowcaseDeleted } from "@/lib/showcase-deleted"
import { markShowcaseFeedDirty, queueShowcaseCommentCount } from "@/lib/showcase-social-prefs"
import { SHOWCASE_COMMENT_MESSAGES } from "@/lib/showcase-comment-messages"

import { ActionSheet } from "@/components/ui/action-sheet"
import { Badge } from "@/components/ui/badge"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { DataScreen } from "@/components/ui/data-screen"
import { Divider } from "@/components/ui/divider"
import { useDocumentTitle } from "@/components/ui/header"
import { IconButton } from "@/components/ui/icon-button"
import { Input } from "@/components/ui/input"
import type { LoadMoreStatus } from "@/components/ui/load-more"
import { MediaViewer, type MediaViewerItem } from "@/components/ui/media-viewer"
import { Dialog } from "@/components/ui/modal"
import { PressableScale } from "@/components/ui/pressable-scale"
import { ShowcaseAuthorRow } from "@/components/showcase-author-row"
import { Radio, RadioGroup } from "@/components/ui/radio"
import { ShowcaseMediaGallery } from "@/components/ui/showcase-media-gallery"
import { ShowcaseDetailActions } from "@/components/ui/showcase-detail-actions"
import { ShowcaseHtmlView } from "@/components/ui/showcase-html-description-editor"
import { ShowcaseDetailComments } from "@/components/showcase-detail-comments"
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

export default function ShowcaseDetailScreen() {
  // i18n: label mengikuti bahasa aktif.
  useLanguage()
  const { id } = useLocalSearchParams<{ id: string }>()
  const revision = useSessionRevision()

  const query = useApiQuery<ShowcaseSocialItem>(
    `showcase-detail:${revision}:${id}`,
    (signal) => getShowcaseDetail(id, signal),
    Boolean(id),
    // D-08 (audit 2026-09-23): jangan `retry: 0` di lapis hook — satu
    // gangguan jaringan sesaat tidak boleh langsung layar error penuh.
    { useCache: false, refreshOnFocus: true },
  )
  const item = query.data

  // I-03: judul dokumen = judul item; fallback nama fitur (J-01).
  // D-09: "" juga harus jatuh ke "Etalase" ("" ?? x tetap "").
  useDocumentTitle(item?.title || translate("Etalase"))

  // S3 (audit 2026-09-26): 404 (karya dihapus/privat/tak ada) → EmptyState khusus
  // TANPA tombol retry — "Coba lagi" untuk 404 tidak akan pernah berhasil.
  // Error lain tetap lewat DataScreen (ErrorState + retry).
  const isNotFound =
    !item && !!query.error && isApiError(query.error) && query.error.status === 404
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
          title: translate("Karya tidak ditemukan"),
          description: translate("Karya ini mungkin sudah dihapus atau tidak lagi tersedia."),
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
        loadingMessage={translate("Memuat karya")}
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
  const { liked, likeCount, saved, likePending, savedPending, toggleLike, toggleSave, share, shareSheetVisible, setShareSheetVisible, hasSession } =
    useShowcaseSocialActions(item)

  // L-01/L-06 (audit 2026-09-23): param rute untuk tab asal & highlight.
  const { kind: tabKind, comment: highlightComment } = useLocalSearchParams<{
    kind?: string
    comment?: string
  }>()
  const [meId, setMeId] = useState<string | null>(null)
  // S9: username untuk komentar optimistis.
  const [meUsername, setMeUsername] = useState<string | null>(null)
  const [viewerItem, setViewerItem] = useState<MediaViewerItem | null>(null)
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
  const [replyTo, setReplyTo] = useState<ShowcaseComment | null>(null)
  const [draft, setDraft] = useState("")
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

  /** A-11: sheet laporan bersama — null = tertutup. */
  const [reportItem, setReportItem] = useState<ShowcaseSocialItem | null>(null)

  useEffect(() => {
    let alive = true
    setMeId(null)
    setMeUsername(null)
    if (hasSession) void api.users.getMeCached().then((me) => {
      if (alive) {
        // BUG#1 (2026-09-26): meId dipakai untuk dibandingkan dengan
        // author.userId (public USR-XXX dari backend) — pakai me.userId,
        // BUKAN me.id (cuid internal) yang tidak pernah cocok.
        setMeId(me.userId ?? me.id ?? null)
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
  const failedComments = useRef({ page: 1, append: false })
  const fetchComments = useCallback(
    async (page: number, append: boolean) => {
      if (mutationPending.current) return
      failedComments.current = { page, append }
      commentsAbort.current?.abort()
      const controller = new AbortController()
      commentsAbort.current = controller
      try {
        setCommentsStatus("loading")
        let collected: ShowcaseCommentWithReplies[] = []
        let lastPage = append ? page : 1
        let total = 0
        let hasNext = false
        for (let cursor = append ? page : 1; cursor <= page; cursor++) {
          const res = await listShowcaseComments(id, { page: cursor, limit: 20 }, controller.signal)
          if (controller.signal.aborted) return
          collected = mergeComments(collected, res.data)
          total = res.total
          hasNext = res.hasNext
          lastPage = cursor
          if (!res.hasNext) break
        }
        setComments((prev) => append ? mergeComments(prev, collected) : collected)
        if (!append && page === 1) setCommentRenderLimit(COMMENT_RENDER_STEP)
        setCommentTotal(total)
        setCommentsPage(lastPage)
        setCommentsStatus(hasNext ? "idle" : "end")
      } catch {
        if (controller.signal.aborted) return
        setCommentsStatus("error")
      }
    },
    [id],
  )
  useEffect(() => {
    void fetchComments(1, false)
    return () => commentsAbort.current?.abort()
  }, [fetchComments])

  const isOwner = item.isOwner === true || (hasSession && meId === item.author.userId)

  const resolvedImages = showcaseImages(item)

  const openViewer = (index: number) => {
    const image = resolvedImages[index]
    if (!image) return
    setViewerItem({
      url: image.url,
      title: item.title,
      caption: item.description ?? undefined,
    })
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
    void fetchComments(1, false).finally(() => setCommentsRefreshing(false))
  }, [commentsRefreshing, query, fetchComments])

  const priceLabel = showcasePriceLabelOrFallback(item)

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
      : ROUTES.createTransactionWith(item.author.username)
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
        title: item?.title?.trim() || translate("Karya tanpa judul"),
        deletedAt: new Date().toISOString(),
        coverUrl: item ? (showcaseImages(item)?.[0]?.url ?? undefined) : undefined,
      })
      markShowcaseFeedDirty()
      toast.show({ title: translate("Karya dihapus. Dapat dipulihkan dalam 30 hari."), tone: "success", duration: 2500 })
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
      footer={
        <View className="border-t border-border bg-background py-3">
          {replyTo ? (
            <View className="mb-2 flex-row items-center gap-2 rounded-md bg-surface-elevated px-3 py-1.5">
              <Text variant="caption" tone="secondary" className="flex-1" numberOfLines={1}>
                Membalas {replyTo.author.fullName ?? `@${replyTo.author.username}`}
              </Text>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={translate("Batalkan balasan")}
                onPress={() => setReplyTo(null)}
              >
                <Text variant="caption" tone="primary">
                  Batal
                </Text>
              </PressableScale>
            </View>
          ) : null}
          {hasSession ? (
            <View className="flex-row items-end gap-2">
              <Input
                ref={composerRef}
                disabled={sendingComment}
                value={draft}
                onChangeText={setDraft}
                placeholder={translate("Tulis komentar…")}
                accessibilityLabel={translate("Komentar baru")}
                containerClassName="flex-1"
                maxLength={COMMENT_MAX}
                onSubmitEditing={() => void handleSendComment()}
                returnKeyType="send"
              />
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
              Masuk untuk berkomentar
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
        <ShowcaseMediaGallery images={resolvedImages} title={item.title} onOpen={openViewer} />
      </View>

      {/* ── Harga · kategori ── */}
      <View className="flex-row flex-wrap items-center gap-2 px-5 pt-3">
        <Text variant="h2" weight={700} className="tabular-nums">
          {priceLabel}
        </Text>
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
        <Text variant="h3">
          {item.title}
        </Text>
      </View>

      {item.description ? (
        showcaseHtmlHasFormatting(item.description) ? (
          /* Benefit 7 Kahade+: deskripsi HTML anggota Plus di-render
             tersanitasi via <ShowcaseHtmlView> — JANGAN render mentah. */
          <View className="px-5 pt-1">
            <ShowcaseHtmlView html={item.description} />
          </View>
        ) : (
          <Text variant="body" tone="primary" className="px-5 pt-1">
            {item.description}
          </Text>
        )
      ) : null}

      {/* Separator atas aksi — inset mx-5, bukan full */}
      <Divider inset className="mt-4" />

      {/* G-11/S9: baris aksi diekstrak ke ShowcaseDetailActions. */}
      <ShowcaseDetailActions
        liked={liked}
        likeCount={likeCount}
        likePending={likePending}
        onToggleLike={toggleLike}
        commentTotal={commentTotal}
        onCommentPress={focusComposer}
        saved={saved}
        savedPending={savedPending}
        onToggleSave={toggleSave}
        onShare={() => void share()}
      />

      {/* Separator bawah aksi — inset */}
      <Divider inset className="mt-1" />

      <View className="px-5 pt-4">
        {!isOwner ? (
          // T3 (audit 2026-09-26): karya nonaktif tidak bisa ditransaksikan —
          // gagal-cepat di UI, bukan di tengah alur transaksi.
          <View className="gap-2">
            <Button fullWidth disabled={item.isActive === false} onPress={handleCreateTransaction}>
              Buat Transaksi
            </Button>
            {item.isActive === false ? (
              <Text variant="caption" tone="secondary" className="text-center">
                Karya ini sedang tidak aktif, jadi belum bisa ditransaksikan.
              </Text>
            ) : null}
          </View>
        ) : (
          // T5 (audit 2026-09-26): pemilik bisa menghapus karyanya dari sini.
          <View className="gap-2">
            <Text variant="caption" tone="secondary" className="text-center">
              Karya Anda — komentar di sini bisa Anda moderasi.
            </Text>
            <Button variant="ghost" fullWidth onPress={() => setDeleteOpen(true)}>
              Hapus karya
            </Button>
          </View>
        )}
      </View>

      {/* G-11/S9: utas komentar diekstrak ke komponen sendiri. */}
      <ShowcaseDetailComments
        comments={comments}
        commentTotal={commentTotal}
        commentsStatus={commentsStatus}
        commentRenderLimit={commentRenderLimit}
        highlightComment={highlightComment}
        isOwner={isOwner}
        hasSession={hasSession}
        isMine={isMine}
        canReply={canReply}
        onReply={setReplyTo}
        onOpenMenu={setCommentMenu}
        onShowMore={() => setCommentRenderLimit((n) => n + COMMENT_RENDER_STEP)}
        onLoadMore={() => {
          const request = commentsStatus === "error" ? failedComments.current : { page: commentsPage + 1, append: true }
          void fetchComments(request.page, request.append)
        }}
      />

      <MediaViewer
        item={viewerItem}
        onClose={() => setViewerItem(null)}
        onOpenError={(msg) => toast.show({ title: msg, tone: "danger" })}
      />

      {/* Karya terkait — kategori sama, lalu populer sebagai pengisi. */}
      {item.related && item.related.length > 0 ? (
        <View className="pt-4">
          <Divider inset className="mb-3" />
          <Text variant="h3" className="px-5 pb-3">
            {translate("Karya terkait")}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-3 px-5 pb-2"
          >
            {item.related.map((rel) => {
              const cover = rel.coverImageUrl ?? rel.imageUrl ?? undefined
              return (
                <PressableScale
                  key={rel.id}
                  accessibilityRole="button"
                  accessibilityLabel={rel.title}
                  onPress={() => router.push(ROUTES.showcaseDetail(rel.id))}
                  containerClassName={cn("w-36 overflow-hidden rounded-xl bg-surface-elevated", focusRing)}
                >
                  {cover ? (
                    <Image
                      source={{ uri: cover }}
                      className="h-24 w-36"
                      resizeMode="cover"
                      accessibilityLabel={rel.title}
                    />
                  ) : (
                    <View className="h-24 w-36 items-center justify-center bg-surface">
                      <Text variant="caption" tone="secondary">
                        {translate("Etalase")}
                      </Text>
                    </View>
                  )}
                  <View className="p-2">
                    <Text variant="caption" weight={600} numberOfLines={2}>
                      {rel.title}
                    </Text>
                    <Text variant="caption" tone="secondary" numberOfLines={1} className="tabular-nums">
                      {showcasePriceLabelOrFallback(rel)}
                    </Text>
                  </View>
                </PressableScale>
              )
            })}
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
                  label: "Edit",
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
        title={translate("Edit komentar")}
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
          confirmKind === "hide"
            ? translate("Komentar tidak lagi terlihat publik, tetapi tetap bisa Anda tampilkan kembali.")
            : translate("Komentar dihapus permanen.")
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
              Kategori alasan:
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
        title={translate("Hapus karya ini?")}
        description={translate("Karya dihapus dan dapat dipulihkan dalam 30 hari.")}
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
    </DataScreen>
  )
}
