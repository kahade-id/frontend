/** Public Etalase detail with optional viewer authentication and fenced comment mutations.
 * Comment reads reconcile complete loaded pages after a mutation. Server authorization remains authoritative. */

import { useCallback, useEffect, useRef, useState } from "react"
import {
  View,
  type TextInput,
} from "react-native"
import { useLocalSearchParams, router } from "expo-router"
import { translate } from "@/lib/i18n/translate"

import {
  BookmarkSimple,
  ChatCircle,
  Export,
  Flag,
  Heart,
  HeartStraight,
  PaperPlaneRight,
  Trash,
} from "phosphor-react-native"
import { api, isApiError, userMessage } from "@/lib/api"
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
import { formatCountCompact, formatDateTime, formatNumber } from "@/lib/format"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"
import { ROUTES } from "@/lib/routes"
import { showcasePriceLabelOrFallback } from "@/lib/showcase-labels"
import { useShowcaseSocialActions } from "@/lib/use-showcase-social-actions"
import { useApiQuery } from "@/lib/use-api-query"

import { useSessionRevision } from "@/lib/guest-gate"
import { useShowcaseOperation } from "@/lib/use-showcase-operation"
import { mergeComments, patchComments } from "@/lib/showcase-state"
import { showcaseImages } from "@/lib/showcase-social"
import { markShowcaseFeedDirty } from "@/lib/showcase-social-prefs"

import { ActionSheet } from "@/components/ui/action-sheet"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { DataScreen } from "@/components/ui/data-screen"
import { Divider } from "@/components/ui/divider"
import { useDocumentTitle } from "@/components/ui/header"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { Input } from "@/components/ui/input"
import { LoadMore, type LoadMoreStatus } from "@/components/ui/load-more"
import { MediaViewer, type MediaViewerItem } from "@/components/ui/media-viewer"
import { Dialog } from "@/components/ui/modal"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Radio, RadioGroup } from "@/components/ui/radio"
import { ShowcaseMediaGallery } from "@/components/ui/showcase-media-gallery"
import { ShowcaseCommentRow } from "@/components/ui/showcase-comment-row"
import { ShowcaseReportSheet } from "@/components/ui/showcase-report-sheet"
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
  const { id } = useLocalSearchParams<{ id: string }>()
  const revision = useSessionRevision()

  const query = useApiQuery<ShowcaseSocialItem>(
    `showcase-detail:${revision}:${id}`,
    (signal) => getShowcaseDetail(id, signal),
    Boolean(id),
    { retry: 0, useCache: false, refreshOnFocus: true },
  )
  const item = query.data

  // I-03: judul dokumen = judul item; fallback nama fitur (J-01).
  useDocumentTitle(item?.title ?? translate("Etalase"))

  if (!item || query.error) {
    return (
      <DataScreen
        title="Etalase"
        state={{
          loading: query.loading,
          refreshing: query.refreshing,
          error: query.error,
          refresh: query.refresh,
          reload: query.reload,
        }}
        loadingMessage="Memuat karya"
        errorTitle="Gagal memuat"
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
  const { liked, likeCount, saved, toggleLike, toggleSave, share, hasSession } =
    useShowcaseSocialActions(item)

  const [meId, setMeId] = useState<string | null>(null)
  const [viewerItem, setViewerItem] = useState<MediaViewerItem | null>(null)
  const composerRef = useRef<TextInput>(null)

  const [comments, setComments] = useState<ShowcaseCommentWithReplies[]>([])
  const [commentTotal, setCommentTotal] = useState(0)
  const [commentsPage, setCommentsPage] = useState(1)
  // F-06: berawal "loading" — bingkai awal yang jujur.
  const [commentsStatus, setCommentsStatus] = useState<LoadMoreStatus>("loading")
  const [commentRenderLimit, setCommentRenderLimit] = useState(COMMENT_RENDER_STEP)
  const [commentsRefreshing, setCommentsRefreshing] = useState(false)
  const [replyTo, setReplyTo] = useState<ShowcaseComment | null>(null)
  const [draft, setDraft] = useState("")
  const [sendingComment, setSendingComment] = useState(false)

  const [commentMenu, setCommentMenu] = useState<ShowcaseComment | null>(null)
  const [editTarget, setEditTarget] = useState<ShowcaseComment | null>(null)
  const [editText, setEditText] = useState("")
  const [savingComment, setSavingComment] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<ShowcaseComment | null>(null)
  const [confirmKind, setConfirmKind] = useState<"delete" | "hide">("delete")
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [hideReason, setHideReason] = useState<Reason>("SPAM")

  /** A-11: sheet laporan bersama — null = tertutup. */
  const [reportItem, setReportItem] = useState<ShowcaseSocialItem | null>(null)

  useEffect(() => {
    let alive = true
    setMeId(null)
    if (hasSession) void api.users.getMeCached().then((me) => {
      if (alive) setMeId(me.id ?? null)
    }).catch(() => { if (alive) setMeId(null) })
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
    try {
      const saved = await addShowcaseComment(id, {
        content,
        parentId: replyTo?.id,
      })
      markShowcaseFeedDirty()
      if (!task.valid()) return
      setDraft((current) => current.trim() === content ? "" : current)
      setReplyTo(null)
      insertLocalComment(saved)
    } catch (err) {
      if (!task.valid()) return
      toast.show({
        title: "Gagal mengirim komentar",
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
      if (task.valid()) void fetchComments(commentsPage, false)
    }
  }, [id, draft, replyTo, insertLocalComment, toast.show, hasSession, operation, fetchComments, commentsPage])

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
      markShowcaseFeedDirty()
      patchComment((c) => (c.id === saved.id ? { ...c, content: saved.content } : c))
      setEditTarget(null)
    } catch (err) {
      if (!task.valid()) return
      toast.show({
        title: "Gagal menyimpan komentar",
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
      if (task.valid()) void fetchComments(commentsPage, false)
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
      markShowcaseFeedDirty()
      patchComment((comment) => comment.id === confirmTarget.id ? null : comment)
        // F-08: hanya HAPUS yang menggeser total.
        setCommentTotal((n) => Math.max(0, n - 1))
        toast.show({ title: "Komentar dihapus", tone: "success", duration: 2500 })
      } else {
        const saved = await hideShowcaseComment(confirmTarget.id, hideReason)
        if (!task.valid()) return
      markShowcaseFeedDirty()
      patchComment((c) =>
          c.id === saved.id ? { ...c, isHidden: true, hiddenReason: hideReason } : c,
        )
        toast.show({ title: "Komentar disembunyikan", tone: "success", duration: 2500 })
      }
      setConfirmTarget(null)
    } catch (err) {
      if (!task.valid()) return
      toast.show({
        title: "Gagal memperbarui komentar",
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
      if (task.valid()) void fetchComments(commentsPage, false)
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
        markShowcaseFeedDirty()
        patchComment((c) =>
          c.id === saved.id ? { ...c, isHidden: false, hiddenReason: null } : c,
        )
        // F-08: unhide tidak mengubah total (komentar tidak pernah hilang).
        toast.show({ title: "Komentar ditampilkan kembali", tone: "success", duration: 2500 })
      } catch (err) {
        if (!task.valid()) return
        toast.show({
          title: "Gagal membuka komentar",
          description: isApiError(err) ? userMessage(err) : undefined,
          tone: "danger",
        })
      } finally {
        mutationPending.current = false
        if (task.valid()) setCommentsStatus((status) => status === "loading" ? "idle" : status)
        task.finish()
        if (task.valid()) void fetchComments(commentsPage, false)
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

  /** F-05: laporkan KOMENTAR = laporkan penulisnya (layar /reports). */
  const handleReportComment = useCallback((comment: ShowcaseComment) => {
    router.push(ROUTES.reports({ targetId: comment.author.userId }))
  }, [])

  /** F-01: hormati orderLink saat tersedia; jatuh ke counterpart saja. */
  const handleCreateTransaction = useCallback(() => {
    router.push(
      item.orderLink
        ? ROUTES.createTransactionFromShowcase(item.orderLink, item.author.username)
        : ROUTES.createTransactionWith(item.author.username),
    )
  }, [item])

  return (
    <DataScreen
      title="Etalase"
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
                accessibilityLabel="Batalkan balasan"
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
                placeholder="Tulis komentar…"
                accessibilityLabel="Komentar baru"
                containerClassName="flex-1"
                maxLength={COMMENT_MAX}
                onSubmitEditing={() => void handleSendComment()}
                returnKeyType="send"
              />
              <IconButton
                icon={PaperPlaneRight}
                variant="primary"
                size="sm"
                accessibilityLabel="Kirim komentar"
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
      {/* ── Penulis DI ATAS media (selaras kartu feed) + laporkan ── */}
      <View className="flex-row items-center gap-3 px-5 pt-4">
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={translate("Lihat profil {x}", {
            x: item.author.fullName ?? item.author.username,
          })}
          onPress={() => router.push(ROUTES.userProfile(item.author.username))}
          containerClassName={cn("flex-1 flex-row items-center rounded-md", focusRing)}
          className="flex-1 flex-row items-center gap-3"
        >
          <Avatar
            source={item.author.avatarUrl ? { uri: item.author.avatarUrl } : undefined}
            name={item.author.fullName ?? item.author.username}
            size="md"
            verified={item.author.isKycVerified === true}
          />
          <View className="flex-1 gap-0.5">
            <Text variant="body" weight={600} numberOfLines={1}>
              {item.author.fullName ?? item.author.username}
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={1} className="tabular-nums">
              {`@${item.author.username} · ${formatDateTime(item.createdAt)}`}
            </Text>
          </View>
          {isOwner ? <Badge variant="outline">Anda</Badge> : null}
        </PressableScale>
        {/* B-05 selaras: bendera disembunyikan untuk item sendiri. */}
        {!isOwner ? (
          <IconButton
            icon={Flag}
            variant="ghost"
            size="sm"
            accessibilityLabel="Laporkan"
            onPress={() => setReportItem(item)}
          />
        ) : null}
      </View>

      {/* ── Media: CARD pager (mx-5, selaras avatar) — bukan full-bleed ── */}
      <View className="mx-5 pt-3">
        <ShowcaseMediaGallery images={resolvedImages} title={item.title} onOpen={openViewer} />
      </View>

      {/* ── Harga · kategori ── */}
      <View className="flex-row flex-wrap items-center gap-2 px-5 pt-3">
        <Text variant="bodyLarge" weight={600} className="tabular-nums">
          {priceLabel}
        </Text>
        {item.category ? (
          // A-12: badge kategori juga menavigasi ke feed terfilter.
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={translate("Lihat kategori {x}", { x: item.category })}
            onPress={() => router.push(ROUTES.showcaseWithCategory(item.category as string))}
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
        <Text variant="body" tone="primary" className="px-5 pt-1">
          {item.description}
        </Text>
      ) : null}

      {/* Separator atas aksi — inset mx-5, bukan full */}
      <Divider inset className="mt-4" />

      {/* ── Baris aksi sosial — count di samping ikon (horizontal) ── */}
      <View className="flex-row items-center px-2 pt-1">
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={liked ? "Hapus suka" : "Sukai"}
          accessibilityHint={translate("{x} suka", { x: formatCountCompact(likeCount) })}
          onPress={toggleLike}
          containerClassName={cn(
            "min-h-11 flex-row items-center rounded-md px-3",
            focusRing,
          )}
          className="flex-row items-center gap-1.5"
        >
          <Icon
            icon={liked ? Heart : HeartStraight}
            size="md"
            tone="active"
            weight={liked ? "fill" : "regular"}
          />
          <Text variant="caption" weight={600} className="tabular-nums">
            {formatCountCompact(likeCount)}
          </Text>
          <Text variant="caption" tone="secondary">
            Suka
          </Text>
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Tulis komentar"
          accessibilityHint={translate("{x} komentar", { x: formatCountCompact(commentTotal) })}
          onPress={focusComposer}
          containerClassName={cn(
            "min-h-11 flex-row items-center rounded-md px-3",
            focusRing,
          )}
          className="flex-row items-center gap-1.5"
        >
          <Icon icon={ChatCircle} size="md" tone="active" />
          <Text variant="caption" weight={600} className="tabular-nums">
            {formatCountCompact(commentTotal)}
          </Text>
          <Text variant="caption" tone="secondary">
            Komentar
          </Text>
        </PressableScale>
        <View className="flex-1" />
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Bagikan"
          accessibilityHint="Bagikan karya ini"
          onPress={() => void share()}
          containerClassName={cn(
            "min-h-11 min-w-11 items-center justify-center rounded-md",
            focusRing,
          )}
        >
          <Icon icon={Export} size="md" tone="active" />
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={saved ? "Hapus dari tersimpan" : "Simpan"}
          accessibilityHint="Simpan karya ini"
          onPress={toggleSave}
          containerClassName={cn(
            "min-h-11 min-w-11 items-center justify-center rounded-md",
            focusRing,
          )}
        >
          <Icon
            icon={BookmarkSimple}
            size="md"
            tone="active"
            weight={saved ? "fill" : "regular"}
          />
        </PressableScale>
      </View>

      {/* Separator bawah aksi — inset */}
      <Divider inset className="mt-1" />

      <View className="px-5 pt-4">
        {!isOwner ? (
          <Button fullWidth onPress={handleCreateTransaction}>
            Buat Transaksi
          </Button>
        ) : (
          <Text variant="caption" tone="secondary" className="text-center">
            Karya Anda — komentar di sini bisa Anda moderasi.
          </Text>
        )}
      </View>

      {/* ── Komentar header: count di samping + separator ── */}
      <View className="gap-0 px-5 pb-0 pt-8">
        <View className="flex-row items-baseline gap-2">
          <Text variant="h3">Komentar</Text>
          {commentTotal > 0 ? (
            <Text variant="body" tone="secondary" className="tabular-nums">
              {formatNumber(commentTotal)}
            </Text>
          ) : null}
        </View>
        <Divider className="mt-3" />
      </View>

      <View className="gap-4 px-5 pb-6 pt-4">
        {/* F-06: status "loading" di awal — tanpa kilatan kosong/tombol. */}
        {comments.length === 0 && commentsStatus !== "loading" && commentsStatus !== "error" ? (
          <Text variant="body" tone="secondary">
            Belum ada komentar. Jadilah yang pertama!
          </Text>
        ) : null}
        {comments.slice(0, commentRenderLimit).map((root) => (
          <View key={root.id} className="gap-4">
            <ShowcaseCommentRow
              comment={root}
              isMine={isMine(root)}
              canReply={canReply(root)}
              menuable={isMine(root) || isOwner || (!root.isHidden && hasSession)}
              onReply={setReplyTo}
              onOpenMenu={setCommentMenu}
            />
            {(root.replies ?? []).map((reply) => (
              <View key={reply.id} className="ml-8">
                <ShowcaseCommentRow
                  comment={reply}
                  isMine={isMine(reply)}
                  canReply={false}
                  menuable={isMine(reply) || isOwner || (!reply.isHidden && hasSession)}
                  onReply={setReplyTo}
                  onOpenMenu={setCommentMenu}
                />
              </View>
            ))}
          </View>
        ))}
        {comments.length > commentRenderLimit ? (
          <Button
            variant="ghost"
            fullWidth
            onPress={() => setCommentRenderLimit((n) => n + COMMENT_RENDER_STEP)}
          >
            Tampilkan komentar lainnya
          </Button>
        ) : null}
        {/* F-07: halaman baru ditambahkan DI BAWAH → tombolnya di bawah. */}
        <LoadMore
          status={commentsStatus}
          onLoadMore={() => {
            const request = commentsStatus === "error" ? failedComments.current : { page: commentsPage + 1, append: true }
            void fetchComments(request.page, request.append)
          }}
          hideEnd
          idleLabel="Muat komentar berikutnya"
        />
      </View>

      <MediaViewer
        item={viewerItem}
        onClose={() => setViewerItem(null)}
        onOpenError={(msg) => toast.show({ title: msg, tone: "danger" })}
      />

      <ActionSheet
        visible={commentMenu != null}
        onRequestClose={() => setCommentMenu(null)}
        title="Komentar"
        actions={[
          ...(commentMenu && canReply(commentMenu)
            ? [
                {
                  key: "reply",
                  label: "Balas",
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
                  label: "Sembunyikan",
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
                  label: "Tampilkan kembali",
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
                  label: "Laporkan pengguna",
                  icon: Flag,
                  onPress: () => handleReportComment(commentMenu),
                },
              ]
            : []),
          ...(commentMenu && (isMine(commentMenu) || isOwner)
            ? [
                {
                  key: "delete",
                  label: "Hapus",
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
        title="Edit komentar"
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
            placeholder="Tulis ulang komentar"
            accessibilityLabel="Komentar yang diedit"
          />
        </View>
      </BottomSheet>

      <Dialog
        title={confirmKind === "hide" ? "Sembunyikan komentar ini?" : "Hapus komentar ini?"}
        description={
          confirmKind === "hide"
            ? "Komentar tidak lagi terlihat publik, tetapi tetap bisa Anda tampilkan kembali."
            : "Komentar dihapus permanen."
        }
        visible={confirmTarget != null}
        destructive
        loading={confirmBusy}
        confirmLabel={confirmKind === "hide" ? "Sembunyikan" : "Hapus"}
        cancelLabel="Batal"
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

      {/* A-11: SATU sheet laporan (copy seragam "Laporkan Karya"). */}
      <ShowcaseReportSheet item={reportItem} onRequestClose={() => setReportItem(null)} />
    </DataScreen>
  )
}
