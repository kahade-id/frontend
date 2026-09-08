import { ListLoading } from "@/components/ui/paginated-list"
/**
 * Screen — Tanya Jawab Publik sebuah profil.
 *
 * Kontrak API (docs/api/kahade-api-mobile.json):
 *   GET    /v1/users/{username}/questions?page&limit     (keduanya REQUIRED)
 *   POST   /v1/users/{username}/questions                AskQuestionDto { question 5–500 }
 *   GET    /v1/users/questions/{id}/comments?page&limit  (REQUIRED)
 *   POST   /v1/users/questions/{id}/comments             AddCommentDto { content 1–1000, parentId? }
 *   DELETE /v1/users/questions/{id}                      (pertanyaan milik saya)
 *   DELETE /v1/users/comments/{commentId}                (komentar milik saya)
 *
 * Bentuk respons daftar tidak berschema (UNVERIFIED) → `readQuestionList`/
 * `readQuestionComments` menerima array polos atau {data, meta}.
 * Kepemilikan (untuk tombol Hapus) dibandingkan dengan GET /v1/users/me:
 * `asker.id`/`authorId` vs id saya; bila tidak ada info → tidak ditawarkan.
 *
 * Keputusan non-obvious:
 *   - Batas pertanyaan mengikuti AskQuestionDto (min 5, bukan 10 seperti
 *     sebelumnya); komentar ≤ 1000 (AddCommentDto).
 *   - Komentar per utas dipaginasi (COMMENT_PAGE 20 + "Muat lebih banyak")
 *     di dalam kartu, bukan semua sekaligus.
 */
import { useCallback, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ChatCircleDots } from "phosphor-react-native"

import { api, userMessage } from "@/lib/api"
import {
  readQuestionComments,
  readQuestionList,
  type QuestionComment,
  type QuestionItem,
} from "@/lib/api/users"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { usePaginatedQuery } from "@/lib/use-paginated-query"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { LoadMore } from "@/components/ui/load-more"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { QACard } from "@/components/ui/qa-card"
import { QaCommentComposer, QaCommentItem } from "@/components/ui/qa-comment-item"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"

const PAGE_SIZE = 20
const COMMENT_PAGE = 20
/** AskQuestionDto: minLength 5 · maxLength 500 */
const QUESTION_MIN = 5
const QUESTION_MAX = 500
/** AddCommentDto: maxLength 1000 */
const COMMENT_MAX = 1000

type CommentsState = {
  items: QuestionComment[]
  page: number
  hasMore: boolean
  loading: boolean
}

export default function PublicQuestionsScreen() {
  const { username } = useLocalSearchParams<{ username: string }>()
  const insets = useSafeAreaInsets()
  const toast = useToast()

  /**
   * Audit — layar ini merakit paginator sendiri. Diganti `usePaginatedQuery`
   * karena tiga cacat terbukti dari kode lama:
   *   1. `handleRefresh` → `fetchAll()` → `setLoading(true)`: tarik-untuk-
   *      menyegarkan mengganti daftar pertanyaan dengan kerangka.
   *   2. `setItems(prev => [...prev, ...data])` MENAMBAH tanpa dedupe —
   *      halaman yang tumpang tindih membuat pertanyaan muncul dua kali.
   *   3. `loadMore` tidak single-flight: dua tap cepat = dua request.
   *
   * `meId` dipisah jadi query sendiri karena bukan bagian dari halaman.
   */
  const meQuery = useApiQuery<{ id?: string }>("questions-me", async (signal) => {
    const me = await api.users.getMe(signal)
    return { id: me.id ?? undefined }
  })
  const meId = meQuery.data?.id

  /**
   * PENTING — `readQuestionList` mengembalikan `totalPages?: number` dan bisa
   * `undefined` (body array polos, atau `meta`/`total_pages` hilang).
   * `usePaginatedQuery` tidak punya fallback: `page < undefined` = false, jadi
   * `hasMore` akan permanen false dan tombol muat-lanjut lenyap tanpa pesan.
   * Fallback kode lama (`data.length >= PAGE_SIZE`) direplikasi sebagai
   * `totalPages` sintetis.
   */
  const query = usePaginatedQuery<QuestionItem>(
    `public-questions:${username}`,
    async (page, signal) => {
      if (!username) return { data: [], meta: { page: 1, limit: PAGE_SIZE, totalPages: 1 } }
      const body = await api.users.getPublicQuestions(username, { page, limit: PAGE_SIZE }, signal)
      const { items: rows, totalPages } = readQuestionList(body)
      return {
        data: rows,
        meta: {
          page,
          limit: PAGE_SIZE,
          totalPages: totalPages ?? (rows.length >= PAGE_SIZE ? page + 1 : page),
        },
      }
    },
  )
  const items = query.data
  const { loading, error, refreshing, loadingMore, loadMoreError, hasMore } = query

  const [askOpen, setAskOpen] = useState(false)
  const [askText, setAskText] = useState("")
  const [asking, setAsking] = useState(false)

  const [openId, setOpenId] = useState<string | null>(null)
  const [comments, setComments] = useState<CommentsState>({
    items: [],
    page: 1,
    hasMore: false,
    loading: false,
  })
  const [commentText, setCommentText] = useState("")
  const [commentSending, setCommentSending] = useState(false)

  const [deleteQ, setDeleteQ] = useState<QuestionItem | null>(null)
  const [deleteC, setDeleteC] = useState<QuestionComment | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Komentar ───────────────────────────────────────────────────────
  const loadComments = useCallback(
    async (questionId: string, p: number) => {
      setComments((c) => ({ ...c, loading: true }))
      try {
        const body = await api.users.getQuestionComments(questionId, {
          page: p,
          limit: COMMENT_PAGE,
        })
        const { items: data, totalPages } = readQuestionComments(body)
        setComments((c) => ({
          items: p === 1 ? data : [...c.items, ...data],
          page: p,
          hasMore: typeof totalPages === "number" ? p < totalPages : data.length >= COMMENT_PAGE,
          loading: false,
        }))
      } catch {
        setComments((c) => ({ ...c, loading: false }))
        toast.show({ title: "Gagal memuat komentar", tone: "danger" })
      }
    },
    [toast],
  )

  const toggleComments = useCallback(
    async (q: QuestionItem) => {
      if (openId === q.id) {
        setOpenId(null)
        return
      }
      setOpenId(q.id)
      setComments({ items: [], page: 1, hasMore: false, loading: true })
      await loadComments(q.id, 1)
    },
    [openId, loadComments],
  )

  const submitComment = useCallback(async () => {
    if (!openId || !commentText.trim() || commentSending) return
    setCommentSending(true)
    try {
      await api.users.addQuestionComment(openId, { content: commentText.trim() })
      setCommentText("")
      await loadComments(openId, 1)
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
  }, [openId, commentText, commentSending, loadComments, toast])

  // ── Bertanya ───────────────────────────────────────────────────────
  const submitAsk = useCallback(async () => {
    if (!username) return
    const value = askText.trim()
    if (value.length < QUESTION_MIN) {
      toast.show({ title: `Pertanyaan minimal ${QUESTION_MIN} karakter`, tone: "danger" })
      return
    }
    setAsking(true)
    try {
      await api.users.addQuestion(username, value)
      toast.show({ title: "Pertanyaan terkirim", tone: "success", duration: 3000 })
      setAskOpen(false)
      setAskText("")
      await query.refresh()
    } catch (err) {
      toast.show({
        title: "Gagal mengirim pertanyaan",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setAsking(false)
    }
  }, [username, askText, toast, query])

  // ── Hapus ──────────────────────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (deleting) return
    setDeleting(true)
    try {
      if (deleteQ) {
        await api.users.deleteQuestion(deleteQ.id)
        setDeleteQ(null)
        if (openId === deleteQ.id) setOpenId(null)
        toast.show({ title: "Pertanyaan dihapus", tone: "neutral", duration: 3000 })
        await query.refresh()
      } else if (deleteC && openId) {
        await api.users.deleteQuestionComment(deleteC.id)
        setDeleteC(null)
        toast.show({ title: "Komentar dihapus", tone: "neutral", duration: 3000 })
        await loadComments(openId, 1)
      }
    } catch (err) {
      toast.show({ title: "Gagal menghapus", description: userMessage(err), tone: "danger" })
    } finally {
      setDeleting(false)
    }
  }, [deleting, deleteQ, deleteC, openId, toast, query, loadComments])

  const isMyQuestion = (q: QuestionItem) => !!meId && q.asker?.id === meId
  const isMyComment = (c: QuestionComment) => !!meId && c.authorId === meId

  return (
    <Screen edges={["top"]} padded={false}>
      <Header
        title="Tanya Jawab"
        right={
          <Button size="sm" variant="secondary" onPress={() => setAskOpen(true)}>
            Bertanya
          </Button>
        }
      />
      <PullToRefresh
        onRefresh={() => void query.refresh()}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {loading ? (
          <ListLoading />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void query.reload()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={ChatCircleDots}
            title="Belum ada pertanyaan"
            description="Jadilah yang pertama bertanya pada profil ini."
          />
        ) : (
          <View className="gap-3" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader title={`@${username}`} />
            {items.map((q) => (
              <View key={q.id} className="gap-3">
                <QACard
                  question={q.question}
                  asker={{
                    name: q.asker?.fullName ?? q.asker?.username ?? "Seseorang",
                    avatar: q.asker?.avatarUrl ?? undefined,
                  }}
                  date={q.createdAt}
                  answer={
                    q.answer
                      ? {
                          text: q.answer,
                          by: { name: `@${username}` },
                          date: q.answeredAt ?? q.createdAt,
                        }
                      : undefined
                  }
                  questionLines={undefined}
                  footer={
                    <View className="flex-row flex-wrap gap-2">
                      <Button size="sm" variant="ghost" onPress={() => void toggleComments(q)}>
                        {openId === q.id ? "Tutup komentar" : "Komentar"}
                      </Button>
                      {isMyQuestion(q) ? (
                        <Button size="sm" variant="ghost" onPress={() => setDeleteQ(q)}>
                          Hapus pertanyaan
                        </Button>
                      ) : null}
                    </View>
                  }
                />
                {openId === q.id ? (
                  <Card padded className="gap-3">
                    {comments.loading && comments.items.length === 0 ? (
                      <ListLoading />
                    ) : comments.items.length === 0 ? (
                      <EmptyState icon={ChatCircleDots} title="Belum ada komentar" />
                    ) : (
                      <View className="gap-3">
                        {comments.items.map((c) => (
                          <QaCommentItem
                            key={c.id}
                            authorName={c.authorName ?? c.authorUsername ?? "Pengguna"}
                            authorAvatar={
                              c.authorAvatarUrl ? { source: c.authorAvatarUrl } : undefined
                            }
                            isOwner={c.isOwner}
                            content={c.content}
                            timestamp={formatDateTime(c.createdAt)}
                            reply={c.reply || !!c.parentId}
                            deleted={c.deleted}
                            onDelete={
                              isMyComment(c) && !c.deleted ? () => setDeleteC(c) : undefined
                            }
                          />
                        ))}
                        {comments.hasMore ? (
                          <LoadMore
                            status={comments.loading ? "loading" : "idle"}
                            onLoadMore={() => void loadComments(q.id, comments.page + 1)}
                            idleLabel="Muat komentar lainnya"
                          />
                        ) : null}
                      </View>
                    )}
                    <QaCommentComposer
                      value={commentText}
                      onChangeText={setCommentText}
                      onSubmit={() => void submitComment()}
                      submitting={commentSending}
                      maxLength={COMMENT_MAX}
                      placeholder={`Tulis komentar untuk @${username}…`}
                    />
                  </Card>
                ) : null}
              </View>
            ))}
            {/* loadMoreError kini punya permukaan sendiri. Sebelumnya
                kegagalan muat-lanjut hanya jadi toast yang menghilang, lalu
                status kembali "idle" — tidak ada tanda gagal dan tidak ada
                cara mencoba lagi. */}
            <LoadMore
              status={loadingMore ? "loading" : loadMoreError ? "error" : hasMore ? "idle" : "end"}
              errorLabel={loadMoreError ?? undefined}
              onLoadMore={() => void query.loadMore()}
              hideEnd
            />
          </View>
        )}
      </PullToRefresh>

      <Dialog
        title={`Bertanya kepada @${username}`}
        description="Pertanyaan Anda akan tampil di profil ini dan dijawab oleh pemiliknya."
        visible={askOpen}
        loading={asking}
        confirmLabel="Kirim Pertanyaan"
        confirmButtonProps={{ disabled: askText.trim().length < QUESTION_MIN }}
        cancelLabel="Batal"
        onConfirm={() => void submitAsk()}
        onCancel={() => setAskOpen(false)}
        onRequestClose={() => setAskOpen(false)}
      >
        <TextArea
          value={askText}
          onChangeText={setAskText}
          placeholder="Tulis pertanyaan Anda…"
          maxLength={QUESTION_MAX}
          showCount
        />
      </Dialog>

      <Dialog
        title={deleteQ ? "Hapus pertanyaan?" : "Hapus komentar?"}
        description={
          deleteQ
            ? "Pertanyaan beserta jawabannya akan hilang dari profil ini."
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
    </Screen>
  )
}