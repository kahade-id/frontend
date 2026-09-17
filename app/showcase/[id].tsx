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
 * Keputusan non-obvious:
 *   - 2026-09-17: layout dirombak mengikuti mockup postingan sosial
 *     (docs/image/IMG_20260917_224056_353.jpg) TANPA card — media 1:1
 *     full-bleed, baris penulis, caption, harga, baris aksi (suka · komentar
 *     · simpan), lalu komentar bergaya feed. Like AKTIF tinta hitam (bukan
 *     merah) — merah dicoret dari palet aksi sosial (referensi warna brand:
 *     docs/image/f739a1072b861fa6f9ae25e44ee7628e.jpg).
 *   - Layar ini JUGA dipakai untuk item milik sendiri (isOwner=true dari
 *     server): CTA transaksi disembunyikan, moderasi komentar (sembunyikan/
 *     buka/hapus komentar orang lain) muncul. Komentar tersembunyi hanya
 *     dikirim server kepada pemilik, jadi UI tidak perlu menyaring sendiri.
 *   - Like memakai optimistic update + angka final dari respons
 *     `{ liked, likeCount }`; konflik SHOWCASE_ALREADY_LIKED (race) hanya
 *     menyinkronkan state, bukan error.
 *   - Balasan dibatasi 1 tingkat oleh backend (SHOWCASE_COMMENT_DEPTH_EXCEEDED)
 *     → tombol "Balas" hanya pada komentar root.
 *   - Gambar cover = `images[0]`; galeri penuh dibuka di MediaViewer.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { ScrollView, View, type TextInput } from "react-native"
import { useLocalSearchParams, router } from "expo-router"

import {
  BookmarkSimple,
  ChatCircle,
  DotsThree,
  Flag,
  Heart,
  HeartStraight,
  ShareNetwork,
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
import { formatDateTime, formatNumber } from "@/lib/format"
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
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { Input } from "@/components/ui/input"
import { LoadMore, type LoadMoreStatus } from "@/components/ui/load-more"
import { MediaViewer, type MediaViewerItem } from "@/components/ui/media-viewer"
import { Dialog } from "@/components/ui/modal"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Radio, RadioGroup } from "@/components/ui/radio"
import { Picture } from "@/components/ui/picture"
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
  /**
   * Simpan postingan (bookmark) — UI lokal. Kontrak showcase.service belum
   * punya endpoint koleksi tersimpan, jadi state ini tidak persisten; tombol
   * tetap ditampilkan karena menjadi bagian pola baris aksi feed (mockup §9).
   */
  const [saved, setSaved] = useState(false)
  const composerRef = useRef<TextInput>(null)

  // ── Komentar ────────────────────────────────────────────────────────────
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

  // State like mengikuti payload server saat item tiba.
  useEffect(() => {
    if (item) {
      setLiked(Boolean(item.isLiked))
      setLikeCount(item.likeCount)
    }
  }, [item])

  const isOwner = item?.isOwner === true

  /** Buka MediaViewer pada foto ke-N dari galeri item. */
  const openViewer = (index: number) => {
    if (!item) return
    const image = item.images[index]
    if (!image) return
    const url = resolveMediaUrl(image.imageUrl)
    if (!url) return
    setViewerItem({
      url,
      title: item.title,
      caption: item.description ?? undefined,
    })
  }

  /** Baris aksi "N Komentar" melompatkan kursor ke komposer di footer. */
  const focusComposer = () => composerRef.current?.focus()

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

  // ── Aksi komentar ───────────────────────────────────────────────────────
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
      // Komentar baru (baris root yang belum ada) → muat ulang halaman 1 agar
      // count/tiebreak server yang jadi acuan, tanpa duplikat lokal.
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

  // ── Like ────────────────────────────────────────────────────────────────
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
      // SHOWCASE_ALREADY_LIKED (race double-like) bukan error pengguna —
      // cukup sinkronkan state; selain itu kembalikan pilihan.
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

  // ── Share & report ──────────────────────────────────────────────────────
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

  const coverUrl = item.images[0]?.imageUrl ?? item.coverImageUrl ?? item.imageUrl
  const resolvedCover = coverUrl ? resolveMediaUrl(coverUrl) : undefined
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
              />
              <Button
                size="sm"
                loading={sendingComment}
                disabled={!draft.trim()}
                onPress={() => void handleSendComment()}
              >
                Kirim
              </Button>
            </View>
          </View>
        )
      }
    >
      {/*
        Layout feed (mockup docs/image/IMG_20260917_224056_353.jpg, tanpa
        card): media full-bleed 1:1 di atas, lalu identitas penulis, caption,
        harga, dan baris aksi sosial — semuanya mengalir di atas background
        tanpa kotak/border. Pemisah antar-bagian memakai ruang, bukan garis.
      */}
      {/* ── Media (cover persegi + strip galeri) ── */}
      <View>
        {resolvedCover ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Lihat gambar ${item.title}`}
            onPress={() => openViewer(0)}
          >
            <Picture
              source={resolvedCover}
              alt={item.title}
              aspectRatio={1}
              radius="none"
              bordered={false}
            />
            {item.images.length > 1 ? (
              // Scrim `bg-overlay` hitam di kedua mode, jadi teks penghitung
              // memakai putih eksplisit (sama dengan showcase-gallery-grid).
              <View style={{ pointerEvents: "none" }} className="absolute right-3 top-3">
                <View className="rounded-full bg-overlay px-2.5 py-1">
                  <Text variant="caption" tone="inherit" className="text-white">
                    {`${item.images.length} foto`}
                  </Text>
                </View>
              </View>
            ) : null}
          </PressableScale>
        ) : (
          <View className="h-64 items-center justify-center bg-surface">
            <Text variant="body" tone="secondary">
              Tidak ada gambar
            </Text>
          </View>
        )}
        {item.images.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2 px-5 pt-3"
          >
            {item.images.map((image, index) => {
              const thumb = resolveMediaUrl(image.imageUrl)
              if (!thumb) return null
              return (
                <PressableScale
                  key={image.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Lihat foto ${index + 1} dari ${item.images.length}`}
                  onPress={() => openViewer(index)}
                  containerClassName="h-16 w-16 overflow-hidden rounded-sm"
                >
                  <Picture
                    source={thumb}
                    alt={item.title}
                    width={64}
                    height={64}
                    radius="sm"
                    bordered={false}
                    recyclingKey={image.id}
                  />
                </PressableScale>
              )
            })}
          </ScrollView>
        ) : null}
      </View>

      {/* ── Penulis + aksi bagikan/laporkan ── */}
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
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              @{item.author.username}
            </Text>
          </View>
          {isOwner ? <Badge variant="outline">Anda</Badge> : null}
        </PressableScale>
        <IconButton
          icon={ShareNetwork}
          variant="ghost"
          size="sm"
          accessibilityLabel="Bagikan"
          onPress={() => void handleShare()}
        />
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

      {/* ── Caption ── */}
      {item.description ? (
        <Text variant="body" tone="primary" className="px-5 pt-3">
          {item.description}
        </Text>
      ) : null}

      {/* ── Harga · kategori · waktu ── */}
      <View className="flex-row flex-wrap items-center gap-2 px-5 pt-3">
        <Text variant="body" weight={600} tone="primary">
          {priceLabel}
        </Text>
        {item.category ? <Badge variant="outline">{item.category}</Badge> : null}
        <Text variant="caption" tone="secondary" className="ml-auto tabular-nums">
          {formatDateTime(item.createdAt)}
        </Text>
      </View>

      {/* ── Baris aksi sosial (like · komentar · simpan) ── */}
      <View className="flex-row items-center px-5 pt-2">
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={liked ? "Hapus suka" : "Sukai"}
          accessibilityHint={`${formatNumber(likeCount)} suka`}
          onPress={() => void handleToggleLike()}
          containerClassName="min-h-11 flex-row items-center gap-2 rounded-md pr-4"
        >
          <Icon
            icon={liked ? Heart : HeartStraight}
            size="md"
            tone="active"
            weight={liked ? "fill" : "regular"}
          />
          <Text variant="body" weight={600} tone="primary" className="tabular-nums">
            {`${formatNumber(likeCount)} Suka`}
          </Text>
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Tulis komentar"
          accessibilityHint={`${formatNumber(commentTotal)} komentar`}
          onPress={focusComposer}
          containerClassName="min-h-11 flex-row items-center gap-2 rounded-md px-4"
        >
          <Icon icon={ChatCircle} size="md" tone="active" />
          <Text variant="body" weight={600} tone="primary" className="tabular-nums">
            {`${formatNumber(commentTotal)} Komentar`}
          </Text>
        </PressableScale>
        <View className="flex-1" />
        <IconButton
          icon={BookmarkSimple}
          variant="ghost"
          size="sm"
          active={saved}
          accessibilityLabel={saved ? "Hapus dari tersimpan" : "Simpan"}
          onPress={() => setSaved((v) => !v)}
        />
      </View>

      {/* ── CTA transaksi ── */}
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

      {/* ── Komentar ── */}
      <View className="gap-4 px-5 pb-6 pt-8">
        <Text variant="h3">Komentar</Text>
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
            <CommentRow
              comment={root}
              isMine={isMine(root)}
              canReply={canReply(root)}
              menuable={isMine(root) || isOwner}
              onReply={setReplyTo}
              onOpenMenu={setCommentMenu}
            />
            {(root.replies ?? []).map((reply) => (
              // Indent 32px = avatar xs (24) + gap (8) — balasan sejajar teks induk.
              <View key={reply.id} className="ml-8">
                <CommentRow
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

      {/* ── Menu komentar ── */}
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

      {/* ── Edit komentar ── */}
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

      {/* ── Konfirmasi hapus / sembunyikan ── */}
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

      {/* ── Laporkan item ── */}
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

// ------------------------------------------------------------------
// Baris komentar
// ------------------------------------------------------------------

/**
 * Baris komentar gaya feed (mockup IMG_20260917_224056_353.jpg): avatar di
 * kiri, nama + isi + baris meta (waktu · Anda · Balas) di kanan. Menu
 * edit/hapus/moderasi pindah ke tombol ⋯ di ujung baris — dulu SELURUH baris
 * bisa ditekan, yang menyulitkan seleksi teks dan memicu menu sesaat jari
 * tersenggol saat scroll.
 */
function CommentRow({
  comment,
  isMine,
  canReply,
  menuable,
  onReply,
  onOpenMenu,
}: {
  comment: ShowcaseComment
  isMine: boolean
  canReply: boolean
  /** tampilkan tombol ⋯ (pemanggil memutuskan: pengarang ATAU pemilik item) */
  menuable: boolean
  onReply: (c: ShowcaseComment) => void
  onOpenMenu: (c: ShowcaseComment) => void
}) {
  const hidden = comment.isHidden === true
  return (
    <View className="flex-row items-start gap-2">
      <Avatar
        source={comment.author.avatarUrl ? { uri: comment.author.avatarUrl } : undefined}
        name={comment.author.fullName ?? comment.author.username}
        size="xs"
      />
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text variant="body" weight={600} numberOfLines={1} className="flex-1">
            {comment.author.fullName ?? comment.author.username}
          </Text>
          {menuable ? (
            <IconButton
              icon={DotsThree}
              variant="ghost"
              size="sm"
              accessibilityLabel={`Opsi komentar dari ${comment.author.fullName ?? comment.author.username}`}
              onPress={() => onOpenMenu(comment)}
            />
          ) : null}
        </View>
        <Text variant="body" tone={hidden ? "secondary" : "primary"}>
          {hidden ? "(Komentar disembunyikan)" : comment.content}
        </Text>
        {hidden && comment.hiddenReason ? (
          <Text variant="caption" tone="secondary">
            Alasan: {comment.hiddenReason.toLowerCase()}
          </Text>
        ) : null}
        <View className="flex-row items-center gap-4">
          <Text variant="caption" tone="secondary" className="tabular-nums">
            {formatDateTime(comment.createdAt)}
          </Text>
          {isMine ? (
            <Text variant="caption" tone="secondary">
              Anda
            </Text>
          ) : null}
          {canReply ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Balas komentar"
              onPress={() => onReply(comment)}
            >
              <Text variant="caption" tone="primary" weight={600}>
                Balas
              </Text>
            </PressableScale>
          ) : null}
        </View>
      </View>
    </View>
  )
}
