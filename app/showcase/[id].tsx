/**
 * Screen — Detail Item Showcase (GET /v1/showcase/{showcaseId}).
 *
 * Kontrak (showcase.service.ts, sesi P1 2026-09-15):
 *   GET  /v1/showcase/{id}                 → item + images + counter + orderLink
 *                                            (viewCount di-increment sekali/viewer/jam)
 *   GET  /v1/showcase/{id}/comments        → root + balasan 1 tingkat (offset)
 *   POST /v1/showcase/{id}/comments        → komentar / balas (parentId)
 *   PATCH /v1/showcase/comments/{cid}      → edit komentar sendiri
 *   DELETE /v1/showcase/comments/{cid}     → hapus (pengarang ATAU pemilik item)
 *   POST   /v1/showcase/comments/{cid}/hide    → moderasi (pemilik item, reason)
 *   POST   /v1/showcase/comments/{cid}/unhide  → buka kembali (pemilik item)
 *   POST /v1/showcase/{id}/like / DELETE   → { liked, likeCount } final
 *   GET  /v1/showcase/{id}/share           → metadata deep link
 *   POST /v1/showcase/{id}/report          → { reason, description? } (5/jam)
 *
 * Keputusan revisi #3 (2026-09-17): 9 poin showcase
 *   - Media KARTU (mx-5 rounded-sm, border) swipe — selaras feed, bukan full-bleed
 *   - Separator inset di atas & bawah bar aksi (mx-5)
 *   - Footer Kirim → PaperPlaneRight IconButton
 *   - Header komentar: "Komentar 12" count di samping + separator
 *   - Gambar preventDownload
 *   - Count di samping ikon (horizontal)
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { ScrollView, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent, type TextInput } from "react-native"
import { useLocalSearchParams, router } from "expo-router"

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
import {
  addShowcaseComment,
  deleteShowcaseComment,
  getShowcaseDetail,
  getShowcaseSharePayload,
  hideShowcaseComment,
  likeShowcase,
  listShowcaseComments,
  reportShowcase,
  unhideShowcaseComment,
  unlikeShowcase,
  updateShowcaseComment,
  type ShowcaseComment,
  type ShowcaseCommentWithReplies,
  type ShowcaseSocialItem,
} from "@/lib/api/showcase"
import { formatCountCompact, formatDateTime, formatNumber } from "@/lib/format"
import { resolveMediaUrl } from "@/lib/media"
import { ROUTES } from "@/lib/routes"
import { shareContent } from "@/lib/share"
import { useApiQuery } from "@/lib/use-api-query"

import { ActionSheet } from "@/components/ui/action-sheet"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { DataScreen } from "@/components/ui/data-screen"
import { Divider } from "@/components/ui/divider"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { Input } from "@/components/ui/input"
import { LoadMore, type LoadMoreStatus } from "@/components/ui/load-more"
import { MediaViewer, type MediaViewerItem } from "@/components/ui/media-viewer"
import { Dialog } from "@/components/ui/modal"
import { PageIndicator } from "@/components/ui/page-indicator"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Radio, RadioGroup } from "@/components/ui/radio"
import { Picture } from "@/components/ui/picture"
import { ShowcaseCommentRow } from "@/components/ui/showcase-comment-row"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"

const HIDE_REASONS = [
  { value: "SPAM", label: "Spam", description: "Link/jualan tidak relevan" },
  { value: "INAPPROPRIATE", label: "Tidak pantas", description: "Konten menyinggung" },
  { value: "HARASSMENT", label: "Perundungan", description: "Ancaman/pelecehan" },
  { value: "OTHER", label: "Lainnya", description: "Sebutkan di keterangan" },
] as const

const REPORT_REASONS = HIDE_REASONS

type Reason = (typeof HIDE_REASONS)[number]["value"]

export default function ShowcaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const toast = useToast()

  const query = useApiQuery<ShowcaseSocialItem>(
    `showcase-detail:${id}`,
    (signal) => getShowcaseDetail(id, signal),
    Boolean(id),
  )
  const item = query.data

  const [meId, setMeId] = useState<string | null>(null)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [likePending, setLikePending] = useState(false)
  const [viewerItem, setViewerItem] = useState<MediaViewerItem | null>(null)
  const [saved, setSaved] = useState(false)
  const [mediaPage, setMediaPage] = useState(0)
  const [pagerWidth, setPagerWidth] = useState(0)
  const { width: windowWidth } = useWindowDimensions()
  const composerRef = useRef<TextInput>(null)

  useEffect(() => {
    setMediaPage(0)
  }, [id])

  const [comments, setComments] = useState<ShowcaseCommentWithReplies[]>([])
  const [commentTotal, setCommentTotal] = useState(0)
  const [commentsPage, setCommentsPage] = useState(1)
  const [commentsStatus, setCommentsStatus] = useState<LoadMoreStatus>("idle")
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

  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState<Reason>("SPAM")
  const [reportDescription, setReportDescription] = useState("")
  const [reporting, setReporting] = useState(false)

  useEffect(() => {
    void api.users.getMe().then((me) => setMeId(me.id ?? null)).catch(() => setMeId(null))
  }, [])

  const fetchComments = useCallback(
    async (page: number, append: boolean) => {
      if (!id) return
      try {
        setCommentsStatus("loading")
        const res = await listShowcaseComments(id, { page, limit: 20 })
        setComments((prev) => (append ? [...prev, ...res.data] : res.data))
        setCommentTotal(res.total)
        setCommentsPage(page)
        setCommentsStatus(res.hasNext ? "idle" : "end")
      } catch {
        setCommentsStatus("error")
      }
    },
    [id],
  )

  useEffect(() => {
    void fetchComments(1, false)
  }, [fetchComments])

  useEffect(() => {
    if (item) {
      setLiked(Boolean(item.isLiked))
      setLikeCount(item.likeCount)
    }
  }, [item])

  const isOwner = item?.isOwner === true

  const resolvedImages = ((item?.images ?? []) as any).flatMap((image: { id: string; imageUrl: string; sortOrder: number }) => {
    const url = resolveMediaUrl(image.imageUrl)
    return url ? [{ id: image.id, url }] : []
  })

  const openViewer = (index: number) => {
    if (!item) return
    const image = resolvedImages[index]
    if (!image) return
    setViewerItem({
      url: image.url,
      title: item.title,
      caption: item.description ?? undefined,
    })
  }

  const focusComposer = () => composerRef.current?.focus()

  const handlePagerMomentum = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const rawWidth = pagerWidth || windowWidth - 40
      if (rawWidth > 0) {
        setMediaPage(Math.max(0, Math.round(event.nativeEvent.contentOffset.x / rawWidth)))
      }
    },
    [pagerWidth, windowWidth],
  )

  const patchComment = useCallback(
    (patch: (c: ShowcaseComment) => ShowcaseComment | null) => {
      setComments((prev) =>
        prev.flatMap((root) => {
          const nextRoot = patch(root)
          const nextReplies = (root.replies ?? [])
            .map((r) => patch(r))
            .filter((r): r is ShowcaseComment => r !== null)
          if (nextRoot === null) return nextReplies.length > 0 ? [{ ...root, replies: nextReplies }] : []
          return [{ ...nextRoot, replies: nextReplies }]
        }),
      )
    },
    [],
  )

  const applyServerComment = useCallback(
    (saved: ShowcaseComment) => {
      const exists = (c: ShowcaseComment) => c.id === saved.id
      const known =
        comments.some((r) => exists(r)) ||
        comments.some((r) => (r.replies ?? []).some(exists))
      if (known) {
        patchComment((c) =>
          c.id === saved.id ? { ...c, content: saved.content, isHidden: saved.isHidden, hiddenReason: saved.hiddenReason, updatedAt: saved.updatedAt ?? c.updatedAt } : c,
        )
      }
      void fetchComments(1, false)
    },
    [comments, patchComment, fetchComments],
  )

  const handleSendComment = useCallback(async () => {
    if (!id) return
    const content = draft.trim()
    if (!content) return
    setSendingComment(true)
    try {
      const saved = await addShowcaseComment(id, {
        content,
        parentId: replyTo?.id,
      })
      setDraft("")
      setReplyTo(null)
      applyServerComment(saved)
    } catch (err) {
      toast.show({
        title: "Gagal mengirim komentar",
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    } finally {
      setSendingComment(false)
    }
  }, [id, draft, replyTo, applyServerComment, toast.show])

  const handleSaveEdit = useCallback(async () => {
    if (!editTarget) return
    const content = editText.trim()
    if (!content) return
    setSavingComment(true)
    try {
      const saved = await updateShowcaseComment(editTarget.id, content)
      patchComment((c) =>
        c.id === saved.id ? { ...c, content: saved.content } : c,
      )
      setEditTarget(null)
    } catch (err) {
      toast.show({
        title: "Gagal menyimpan komentar",
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    } finally {
      setSavingComment(false)
    }
  }, [editTarget, editText, patchComment, toast.show])

  const handleConfirmAction = useCallback(async () => {
    if (!confirmTarget) return
    setConfirmBusy(true)
    try {
      if (confirmKind === "delete") {
        await deleteShowcaseComment(confirmTarget.id)
        patchComment(() => null)
        setCommentTotal((n) => Math.max(0, n - 1))
        toast.show({ title: "Komentar dihapus", tone: "success", duration: 2500 })
      } else {
        const saved = await hideShowcaseComment(confirmTarget.id, hideReason)
        patchComment((c) =>
          c.id === saved.id ? { ...c, isHidden: true, hiddenReason: hideReason } : c,
        )
        setCommentTotal((n) => Math.max(0, n - 1))
        toast.show({ title: "Komentar disembunyikan", tone: "success", duration: 2500 })
      }
      setConfirmTarget(null)
    } catch (err) {
      toast.show({
        title: "Gagal memperbarui komentar",
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    } finally {
      setConfirmBusy(false)
    }
  }, [confirmTarget, confirmKind, hideReason, patchComment, toast.show])

  const handleUnhide = useCallback(
    async (comment: ShowcaseComment) => {
      try {
        const saved = await unhideShowcaseComment(comment.id)
        patchComment((c) =>
          c.id === saved.id ? { ...c, isHidden: false, hiddenReason: null } : c,
        )
        setCommentTotal((n) => n + 1)
        toast.show({ title: "Komentar ditampilkan kembali", tone: "success", duration: 2500 })
      } catch (err) {
        toast.show({
          title: "Gagal membuka komentar",
          description: isApiError(err) ? userMessage(err) : undefined,
          tone: "danger",
        })
      }
    },
    [patchComment, toast.show],
  )

  const handleToggleLike = useCallback(async () => {
    if (!id || likePending) return
    const next = !liked
    setLiked(next)
    setLikeCount((n) => Math.max(0, n + (next ? 1 : -1)))
    setLikePending(true)
    try {
      const res = next ? await likeShowcase(id) : await unlikeShowcase(id)
      setLiked(res.liked)
      setLikeCount(res.likeCount)
    } catch (err) {
      setLiked(!next)
      setLikeCount((n) => Math.max(0, n + (next ? -1 : 1)))
      const isRace = isApiError(err) && err.backendCode === "SHOWCASE_ALREADY_LIKED"
      if (!isRace) {
        toast.show({
          title: "Gagal memperbarui suka",
          description: userMessage(err),
          tone: "danger",
        })
      }
    } finally {
      setLikePending(false)
    }
  }, [id, liked, likePending, toast.show])

  const handleShare = useCallback(async () => {
    if (!id) return
    try {
      const payload = await getShowcaseSharePayload(id)
      const outcome = await shareContent({
        message: `${payload.title} — ${payload.authorFullName ?? "@" + payload.authorUsername}`,
        url: payload.shareUrl,
        title: payload.title,
      })
      if (outcome === "unavailable") {
        toast.show({ title: "Share tidak tersedia di perangkat ini", tone: "info" })
      }
    } catch (err) {
      toast.show({
        title: "Gagal menyiapkan share",
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    }
  }, [id, toast.show])

  const handleReport = useCallback(async () => {
    if (!id) return
    setReporting(true)
    try {
      await reportShowcase(id, {
        reason: reportReason,
        description: reportDescription.trim() || undefined,
      })
      setReportOpen(false)
      setReportDescription("")
      toast.show({ title: "Laporan terkirim", tone: "success", duration: 2500 })
    } catch (err) {
      toast.show({
        title: "Gagal mengirim laporan",
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    } finally {
      setReporting(false)
    }
  }, [id, reportReason, reportDescription, toast.show])

  if (!item) {
    return (
      <DataScreen
        title="Showcase"
        state={{
          loading: query.loading,
          refreshing: query.refreshing,
          error: query.error,
          refresh: query.refresh,
          reload: query.reload,
        }}
        loadingMessage="Memuat item showcase"
        errorTitle="Gagal memuat"
        refreshable={false}
      />
    )
  }

  const priceLabel =
    item.priceMin != null && item.priceMax != null && item.priceMin !== item.priceMax
      ? `Rp ${formatNumber(item.priceMin)} – Rp ${formatNumber(item.priceMax)}`
      : item.priceMin != null
        ? `Rp ${formatNumber(item.priceMin)}`
        : "Harga lewat diskusi"

  const canReply = (c: ShowcaseComment) => !c.isHidden && c.parentId == null
  const isMine = (c: ShowcaseComment) => meId != null && c.author.userId === meId

  return (
    <DataScreen
      title="Showcase"
      padded={false}
      state={{
        loading: false,
        refreshing: query.refreshing,
        error: null,
        refresh: query.refresh,
        reload: query.reload,
      }}
      refreshable={false}
      contentClassName="gap-0"
      footer={
        (
          <View className="border-t border-border bg-background px-4 py-3">
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
            <View className="flex-row items-end gap-2">
              <Input
                ref={composerRef}
                value={draft}
                onChangeText={setDraft}
                placeholder="Tulis komentar…"
                accessibilityLabel="Komentar baru"
                containerClassName="flex-1"
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
          </View>
        )
      }
    >
      {/* ── Penulis DI ATAS media (selaras kartu feed) + laporkan ── */}
      <View className="flex-row items-center gap-3 px-5 pt-4">
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Lihat profil ${item.author.fullName ?? item.author.username}`}
          onPress={() => router.push(ROUTES.userProfile(item.author.username))}
          containerClassName="flex-1 flex-row items-center gap-3 rounded-md"
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
        {!isOwner ? (
          <IconButton
            icon={Flag}
            variant="ghost"
            size="sm"
            accessibilityLabel="Laporkan"
            onPress={() => setReportOpen(true)}
          />
        ) : null}
      </View>

      {/* ── Media: CARD pager (mx-5, selaras avatar) — bukan full-bleed ── */}
      <View className="mx-5 pt-3" onLayout={(e) => setPagerWidth(e.nativeEvent.layout.width)}>
        {resolvedImages.length > 0 ? (
          <View className="overflow-hidden rounded-sm border border-border">
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handlePagerMomentum}
              // @ts-expect-error RN Web
              onContextMenu={(e: unknown) => (e as { preventDefault: () => void }).preventDefault?.()}
            >
              {resolvedImages.map((image, index) => (
                <View key={image.id} style={{ width: pagerWidth || windowWidth - 40 }}>
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={`Lihat foto ${index + 1} dari ${resolvedImages.length}`}
                    onPress={() => openViewer(index)}
                    containerClassName="w-full"
                  >
                    <Picture
                      source={image.url}
                      alt={item.title}
                      aspectRatio={1}
                      radius="none"
                      bordered={false}
                      recyclingKey={image.id}
                      preventDownload
                    />
                  </PressableScale>
                </View>
              ))}
            </ScrollView>
            {resolvedImages.length > 1 ? (
              <View className="items-center bg-background py-2">
                <PageIndicator count={resolvedImages.length} index={mediaPage} />
              </View>
            ) : null}
          </View>
        ) : (
          <View className="h-64 items-center justify-center rounded-sm border border-border bg-surface">
            <Text variant="body" tone="secondary">
              Tidak ada gambar
            </Text>
          </View>
        )}
      </View>

      {/* ── Harga · kategori ── */}
      <View className="flex-row flex-wrap items-center gap-2 px-5 pt-3">
        <Text variant="bodyLarge" weight={600} className="tabular-nums">
          {priceLabel}
        </Text>
        {item.category ? <Badge variant="outline">{item.category}</Badge> : null}
      </View>

      <View className="px-5 pt-1">
        <Text variant="h3" numberOfLines={2}>
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
          accessibilityHint={`${formatCountCompact(likeCount)} suka`}
          onPress={() => void handleToggleLike()}
          containerClassName="min-h-11 flex-row items-center gap-1.5 rounded-md px-3"
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
          accessibilityHint={`${formatCountCompact(commentTotal)} komentar`}
          onPress={focusComposer}
          containerClassName="min-h-11 flex-row items-center gap-1.5 rounded-md px-3"
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
          accessibilityHint="Bagikan showcase ini"
          onPress={() => void handleShare()}
          containerClassName="min-h-11 min-w-11 items-center justify-center rounded-md"
        >
          <Icon icon={Export} size="md" tone="active" />
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={saved ? "Hapus dari tersimpan" : "Simpan"}
          accessibilityState={{ selected: saved }}
          onPress={() => setSaved((v) => !v)}
          containerClassName="min-h-11 min-w-11 items-center justify-center rounded-md"
        >
          <Icon icon={BookmarkSimple} size="md" tone="active" weight={saved ? "fill" : "regular"} />
        </PressableScale>
      </View>

      {/* Separator bawah aksi — inset */}
      <Divider inset className="mt-1" />

      <View className="px-5 pt-4">
        {!isOwner ? (
          <Button
            fullWidth
            onPress={() =>
              router.push(ROUTES.createTransactionWith(item.author.username))
            }
          >
            Buat Transaksi
          </Button>
        ) : (
          <Text variant="caption" tone="secondary" className="text-center">
            Item Anda — komentar di sini bisa Anda moderasi.
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
        <LoadMore
          status={commentsStatus}
          onLoadMore={() => void fetchComments(commentsPage + 1, true)}
          hideEnd
          idleLabel="Muat komentar berikutnya"
        />
        {comments.length === 0 && commentsStatus !== "loading" && commentsStatus !== "error" ? (
          <Text variant="body" tone="secondary">
            Belum ada komentar. Jadilah yang pertama!
          </Text>
        ) : null}
        {comments.map((root) => (
          <View key={root.id} className="gap-4">
            <ShowcaseCommentRow
              comment={root}
              isMine={isMine(root)}
              canReply={canReply(root)}
              menuable={isMine(root) || isOwner}
              onReply={setReplyTo}
              onOpenMenu={setCommentMenu}
            />
            {(root.replies ?? []).map((reply) => (
              <View key={reply.id} className="ml-8">
                <ShowcaseCommentRow
                  comment={reply}
                  isMine={isMine(reply)}
                  canReply={false}
                  menuable={isMine(reply) || isOwner}
                  onReply={setReplyTo}
                  onOpenMenu={setCommentMenu}
                />
              </View>
            ))}
          </View>
        ))}
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

      <BottomSheet
        avoidKeyboard
        visible={reportOpen}
        onRequestClose={() => setReportOpen(false)}
        title="Laporkan item"
        description="Laporan ditinjau tim Kahade. Maksimal 5 laporan per jam."
        footer={
          <Button
            fullWidth
            variant="destructive"
            loading={reporting}
            onPress={() => void handleReport()}
          >
            Kirim Laporan
          </Button>
        }
      >
        <View className="gap-3 px-5 pb-2">
          <RadioGroup value={reportReason} onChange={(v) => setReportReason(v as Reason)}>
            {REPORT_REASONS.map((r) => (
              <Radio key={r.value} value={r.value} label={r.label} description={r.description} />
            ))}
          </RadioGroup>
          <TextArea
            value={reportDescription}
            onChangeText={setReportDescription}
            rows={3}
            placeholder="Keterangan (opsional)"
            accessibilityLabel="Keterangan laporan"
          />
        </View>
      </BottomSheet>
    </DataScreen>
  )
}
