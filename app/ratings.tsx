import { ListLoading } from "@/components/ui/paginated-list"
/**
 * Screen — Ulasan Saya.
 *
 * Kontrak API (docs/api/kahade-api-mobile.json):
 *   GET    /v1/ratings/my?page&limit            → ulasan (diterima & diberikan)
 *   POST   /v1/ratings/{ratingId}/reply         { content }   ← balas ulasan masuk
 *   PUT    /v1/ratings/replies/{replyId}        { content }   ← ubah balasan
 *   DELETE /v1/ratings/replies/{replyId}                       ← hapus balasan
 *   PUT    /v1/ratings/{ratingId}               { stars?, comment? } ← ubah
 *          ulasan yang SAYA tulis
 *
 * Dua segmen: "Diterima" (bisa dibalas/ubah/hapus balasan) dan "Diberikan"
 * (bisa diubah bintang/komentar). Respons my-ratings tidak berschema
 * (UNVERIFIED): arah ditentukan dari `direction`/`isMine`, fallback
 * membandingkan `authorUsername`/`authorId` dengan profil saya (GET /v1/users/me).
 * Edit/hapus balasan hanya ditawarkan bila `replyId` ada.
 *
 * Keputusan non-obvious:
 *   - Paginasi (PAGE_SIZE 20 + <LoadMore>) — spec mendukung page/limit; array
 *     polos tanpa meta → akhir paginasi = halaman < PAGE_SIZE.
 *   - Form ubah ulasan memakai <RatingForm editing> yang sama dengan layar
 *     beri ulasan, supaya validasi (1–5 bintang, komentar ≤ 500) satu sumber.
 *   - Hapus balasan lewat <Dialog destructive>, bukan langsung — balasan
 *     publik, tidak bisa dibatalkan.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { PencilSimple, Star } from "phosphor-react-native"

import { api, userMessage } from "@/lib/api"
import { readMyRatings, type Rating } from "@/lib/api/ratings"
import { tokens } from "@/lib/tokens"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { LoadMore } from "@/components/ui/load-more"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { RATING_COMMENT_MAX, RatingForm, type RatingFormValue } from "@/components/ui/rating-form"
import { RatingReviewCard, type RatingReply } from "@/components/ui/rating-review-card"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { SegmentedControl, type SegmentItem } from "@/components/ui/segmented-control"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

const PAGE_SIZE = 20
/** RatingReplyDto.content — batas lokal sama dengan komentar ulasan (spec tanpa maxLength) */
const REPLY_MAX = RATING_COMMENT_MAX

type Segment = "RECEIVED" | "GIVEN"
const SEGMENTS: SegmentItem<Segment>[] = [
  { value: "RECEIVED", label: "Diterima" },
  { value: "GIVEN", label: "Diberikan" },
]

type ReplyEditor = { rating: Rating; mode: "create" | "edit"; replyId?: string } | null

export default function RatingsScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [me, setMe] = useState<{ id?: string; username?: string } | null>(null)
  const [items, setItems] = useState<Rating[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [segment, setSegment] = useState<Segment>("RECEIVED")

  // Balasan (buat/ubah) + hapus
  const [replyEditor, setReplyEditor] = useState<ReplyEditor>(null)
  const [replyText, setReplyText] = useState("")
  const [sending, setSending] = useState(false)
  const [deleteReply, setDeleteReply] = useState<{ rating: Rating; replyId: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Ubah ulasan yang saya tulis
  const [editRating, setEditRating] = useState<Rating | null>(null)
  const [editValue, setEditValue] = useState<RatingFormValue>({ stars: 0, comment: "" })
  const [savingEdit, setSavingEdit] = useState(false)

  const fetchPage = useCallback(async (p: number) => {
    const body = await api.ratings.getMyRatings({ page: p, limit: PAGE_SIZE })
    const { items: data, totalPages } = readMyRatings(body)
    setItems((prev) => (p === 1 ? data : [...prev, ...data]))
    setPage(p)
    setHasMore(typeof totalPages === "number" ? p < totalPages : data.length >= PAGE_SIZE)
  }, [])

  const fetchRatings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [, profile] = await Promise.all([
        fetchPage(1),
        me ? Promise.resolve(me) : api.users.getMe().catch(() => null),
      ])
      if (profile) setMe({ id: profile.id ?? undefined, username: profile.username ?? undefined })
    } catch (err) {
      setError(userMessage(err))
    } finally {
      setLoading(false)
    }
  }, [fetchPage, me])

  useEffect(() => {
    void fetchRatings()

  }, [])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchRatings()
    setRefreshing(false)
  }, [fetchRatings])

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      await fetchPage(page + 1)
    } catch (err: unknown) {
      toast.show({
        title: "Gagal memuat halaman berikutnya",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, fetchPage, page, toast])

  /** Apakah ulasan ini SAYA yang menulis (→ segmen "Diberikan"). */
  const isGivenByMe = useCallback(
    (r: Rating): boolean => {
      if (r.direction === "GIVEN") return true
      if (r.direction === "RECEIVED") return false
      if (typeof r.isMine === "boolean") return r.isMine
      if (me?.id && r.authorId) return r.authorId === me.id
      if (me?.username && r.authorUsername) return r.authorUsername === me.username
      return false
    },
    [me],
  )

  const visible = useMemo(
    () => items.filter((r) => (segment === "GIVEN" ? isGivenByMe(r) : !isGivenByMe(r))),
    [items, segment, isGivenByMe],
  )

  // ── Balasan ────────────────────────────────────────────────────────
  const openReply = useCallback((rating: Rating) => {
    setReplyEditor({ rating, mode: "create" })
    setReplyText("")
  }, [])

  const openEditReply = useCallback((rating: Rating, reply: RatingReply) => {
    if (!rating.replyId) return
    setReplyEditor({ rating, mode: "edit", replyId: rating.replyId })
    setReplyText(reply.content)
  }, [])

  const handleSendReply = useCallback(async () => {
    if (!replyEditor || !replyText.trim() || sending) return
    setSending(true)
    const content = replyText.trim()
    try {
      if (replyEditor.mode === "edit" && replyEditor.replyId) {
        await api.ratings.updateRatingReply(replyEditor.replyId, { content })
        toast.show({ title: "Balasan diperbarui", tone: "success", duration: 3000 })
      } else {
        await api.ratings.replyRating(replyEditor.rating.id, { content })
        toast.show({ title: "Balasan terkirim", tone: "success", duration: 3000 })
      }
      setReplyEditor(null)
      setReplyText("")
      await fetchPage(1)
    } catch (err) {
      toast.show({
        title: "Gagal menyimpan balasan",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setSending(false)
    }
  }, [replyEditor, replyText, sending, toast, fetchPage])

  const handleDeleteReply = useCallback(async () => {
    if (!deleteReply || deleting) return
    setDeleting(true)
    try {
      await api.ratings.deleteRatingReply(deleteReply.replyId)
      toast.show({ title: "Balasan dihapus", tone: "neutral", duration: 3000 })
      setDeleteReply(null)
      await fetchPage(1)
    } catch (err) {
      toast.show({
        title: "Gagal menghapus balasan",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setDeleting(false)
    }
  }, [deleteReply, deleting, toast, fetchPage])

  // ── Ubah ulasan saya ───────────────────────────────────────────────
  const openEditRating = useCallback((rating: Rating) => {
    setEditRating(rating)
    setEditValue({ stars: rating.stars, comment: rating.comment ?? "" })
  }, [])

  const handleSaveEdit = useCallback(
    async (v: RatingFormValue) => {
      if (!editRating || savingEdit) return
      setSavingEdit(true)
      try {
        await api.ratings.updateRating(editRating.id, {
          stars: v.stars,
          comment: v.comment.trim() || undefined,
        })
        toast.show({ title: "Ulasan diperbarui", tone: "success", duration: 3000 })
        setEditRating(null)
        await fetchPage(1)
      } catch (err) {
        toast.show({
          title: "Gagal memperbarui ulasan",
          description: userMessage(err),
          tone: "danger",
        })
      } finally {
        setSavingEdit(false)
      }
    },
    [editRating, savingEdit, toast, fetchPage],
  )

  const replyOf = (r: Rating): RatingReply | undefined =>
    r.reply
      ? {
          id: r.replyId ?? `reply-${r.id}`,
          content: r.reply,
          by: { name: segment === "RECEIVED" ? "Anda" : (r.targetUsername ?? "Penjual") },
          role: "seller",
          date: r.replyCreatedAt ?? r.createdAt,
          mine: segment === "RECEIVED",
        }
      : undefined

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Ulasan" />
      <View accessible={false} className="px-6" style={{ paddingTop: tokens.space[3] }}>
        <SegmentedControl items={SEGMENTS} value={segment} onChange={setSegment} />
      </View>
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {loading ? (
          <ListLoading />
        ) : error ? (
          <ErrorState
            title="Gagal memuat"
            description={error}
            onRetry={() => void fetchRatings()}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Star}
            title={
              segment === "RECEIVED" ? "Belum ada ulasan masuk" : "Belum ada ulasan yang Anda beri"
            }
            description={
              segment === "RECEIVED"
                ? "Ulasan dari lawan transaksi akan muncul di sini."
                : "Beri ulasan dari halaman order yang sudah selesai."
            }
          />
        ) : (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader
              title={segment === "RECEIVED" ? "Ulasan masuk" : "Ulasan yang Anda beri"}
            />
            {visible.map((r) => {
              const reply = replyOf(r)
              const received = segment === "RECEIVED"
              return (
                <RatingReviewCard
                  key={r.id}
                  stars={r.stars}
                  comment={r.comment ?? undefined}
                  reviewer={
                    received
                      ? {
                          name: r.authorUsername ?? "Pengguna",
                          avatar: r.authorAvatarUrl ?? undefined,
                        }
                      : { name: "Anda" }
                  }
                  date={r.createdAt}
                  orderId={r.orderId}
                  reply={reply}
                  onReply={received && !r.reply ? () => openReply(r) : undefined}
                  onEditReply={received && r.replyId ? (rep) => openEditReply(r, rep) : undefined}
                  onDeleteReply={
                    received && r.replyId
                      ? () => setDeleteReply({ rating: r, replyId: r.replyId as string })
                      : undefined
                  }
                  footer={
                    !received ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={PencilSimple}
                        onPress={() => openEditRating(r)}
                      >
                        Ubah ulasan
                      </Button>
                    ) : undefined
                  }
                />
              )
            })}
            <LoadMore
              status={loadingMore ? "loading" : hasMore ? "idle" : "end"}
              onLoadMore={() => void handleLoadMore()}
              hideEnd
            />
          </View>
        )}
      </PullToRefresh>

      {/* Balas / ubah balasan */}
      <Dialog
        title={replyEditor?.mode === "edit" ? "Ubah balasan" : "Balas ulasan"}
        description="Jaga nada tetap ramah dan profesional."
        visible={!!replyEditor}
        loading={sending}
        confirmLabel={replyEditor?.mode === "edit" ? "Simpan" : "Kirim Balasan"}
        cancelLabel="Batal"
        onConfirm={() => void handleSendReply()}
        onCancel={() => setReplyEditor(null)}
        onRequestClose={() => setReplyEditor(null)}
        confirmButtonProps={{ disabled: !replyText.trim() }}
      >
        <TextArea
          value={replyText}
          onChangeText={setReplyText}
          placeholder="Tulis balasan"
          maxLength={REPLY_MAX}
          showCount
          numberOfLines={4}
        />
      </Dialog>

      {/* Hapus balasan */}
      <Dialog
        title="Hapus balasan?"
        description="Balasan akan hilang dari profil publik Anda. Tindakan ini tidak bisa dibatalkan."
        visible={!!deleteReply}
        destructive
        loading={deleting}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        onConfirm={() => void handleDeleteReply()}
        onCancel={() => setDeleteReply(null)}
        onRequestClose={() => setDeleteReply(null)}
      />

      {/* Ubah ulasan yang saya beri */}
      <BottomSheet
        visible={!!editRating}
        onRequestClose={() => (savingEdit ? undefined : setEditRating(null))}
        title="Ubah ulasan"
        description={editRating?.orderTitle ?? undefined}
      >
        <RatingForm
          value={editValue}
          onChange={setEditValue}
          onSubmit={(v) => void handleSaveEdit(v)}
          orderTitle={editRating?.orderTitle}
          editing
          submitting={savingEdit}
        />
      </BottomSheet>
    </Screen>
  )
}