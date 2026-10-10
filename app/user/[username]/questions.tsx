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

import { Crossfade } from "@/components/ui/fade-in"
import { ListLoading } from "@/components/ui/paginated-list"
import { useCallback, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams, router } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api } from "@/lib/api"
import {
  isOwnQuestion,
  readQuestionComments,
  readQuestionList,
  type QuestionComment,
  type QuestionItem,
} from "@/lib/api/users"
import { atHandle } from "@/lib/profile-uiux"
import { ROUTES } from "@/lib/routes"
import { useHasSession } from "@/lib/guest-gate"
import type { UserProfile } from "@/lib/api/users"
import { queryKeys } from "@/lib/query-keys"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { byTimestampDesc, usePaginatedQuery } from "@/lib/use-paginated-query"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { LoadMore } from "@/components/ui/load-more"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { QACard } from "@/components/ui/qa-card"
import { QaCommentComposer, QaCommentItem } from "@/components/ui/qa-comment-item"
import { QaEmptyState } from "@/components/ui/qa-empty-state"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"
import { translate, useLanguage } from "@/lib/i18n"
import { showMutationError } from "@/lib/mutation-toast"

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
  // Klasifikasi toast: kegagalan MUAT section → INLINE + retry (bukan
  // toast — tanpa ini gagal-muat tampil sebagai "Belum ada balasan").
  loadFailed: boolean
}

export default function PublicQuestionsScreen() {
  const { username } = useLocalSearchParams<{ username: string }>()
  const insets = useSafeAreaInsets()
  const toast = useToast()
  // i18n: label mengikuti bahasa aktif.
  useLanguage()
  // UI-P012: tamu di-gate ke login sebelum aksi sosial — konsisten dengan tab
  // Utas di layar profil (P3) yang me-gate Bertanya/upvote/komentar.
  const hasSession = useHasSession()
  const requireSession = useCallback(() => {
    if (hasSession) return true
    router.push(ROUTES.loginRequired(`/user/${encodeURIComponent(username ?? "")}/questions`))
    return false
  }, [hasSession, username])

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
  /**
   * C-02 (audit): `GET /v1/users/me` — kunci bersama `queryKeys.me()` dengan
   * proyeksi `select` (layar ini hanya butuh id untuk menandai pertanyaan milik
   * sendiri), bukan kunci pribadi "questions-me".
   */
  const meQuery = useApiQuery<
    UserProfile,
    { id?: string; fullName?: string; username?: string | null; avatarUrl?: string | null }
  >(
    queryKeys.me(),
    (signal) => api.users.getMe(signal),
    true,
    {
      select: (me) => ({
        id: me.id ?? undefined,
        fullName: me.fullName,
        username: me.username,
        avatarUrl: me.avatarUrl,
      }),
    },
  )
  const meId = meQuery.data?.id
  const me = meQuery.data

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
    // C-08 (audit): daftar tanya-jawab kronologis — terbaru di atas.
    // UI-P025: `enabled` — username datang dari param rute; tanpa ini fetcher
    // menembak /v1/users/undefined/questions sebelum rute selesai di-resolve.
    {
      compare: byTimestampDesc<QuestionItem>((question) => question.createdAt),
      enabled: Boolean(username),
    },
  )
  const items = query.data
  const { loading, error, refreshing, loadingMore, loadMoreError, hasMore } = query
  const [upvotingId, setUpvotingId] = useState<string | null>(null)
  const patchQuestion = useCallback(
    (id: string, patch: Partial<QuestionItem>) => {
      query.setData((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)))
    },
    [query.setData],
  )
  const handleUpvote = useCallback(
    async (q: QuestionItem, next: boolean) => {
      if (upvotingId) return
      if (!requireSession()) return
      setUpvotingId(q.id)
      const prevCount = q.upvoteCount ?? 0
      const prevActive = q.isUpvotedByViewer === true
      patchQuestion(q.id, { upvoteCount: Math.max(0, prevCount + (next ? 1 : -1)), isUpvotedByViewer: next })
      try {
        const res = next
          ? await api.users.upvoteQuestion(q.id)
          : await api.users.removeQuestionUpvote(q.id)
        patchQuestion(q.id, { upvoteCount: res.upvoteCount, isUpvotedByViewer: res.upvoted })
      } catch (err: unknown) {
        // Klasifikasi toast: error mutasi non-blokir via showMutationError.
        if (
          showMutationError(toast.show, {
            failTitle: translate("Gagal memperbarui dukungan"),
            uncertainHint: translate("Aksi mungkin sudah diproses — memuat ulang…"),
            err: err,
            scope: "user:username:questions:memperbarui-dukungan",
          })
        ) {
          void query.reload()
        } else {
          patchQuestion(q.id, { upvoteCount: prevCount, isUpvotedByViewer: prevActive })
        }
      } finally {
        setUpvotingId(null)
      }
    },
    [upvotingId, patchQuestion, requireSession, toast, query],
  )

  const [askOpen, setAskOpen] = useState(false)
  const [askText, setAskText] = useState("")
  const [asking, setAsking] = useState(false)

  const [openId, setOpenId] = useState<string | null>(null)
  const [comments, setComments] = useState<CommentsState>({
    items: [],
    page: 1,
    hasMore: false,
    loading: false,
    loadFailed: false,
  })
  const [commentText, setCommentText] = useState("")
  const [commentSending, setCommentSending] = useState(false)

  const [deleteQ, setDeleteQ] = useState<QuestionItem | null>(null)
  const [deleteC, setDeleteC] = useState<QuestionComment | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Komentar ───────────────────────────────────────────────────────
  const loadComments = useCallback(
    async (questionId: string, p: number) => {
      setComments((c) => ({ ...c, loading: true, loadFailed: false }))
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
          loadFailed: false,
        }))
      } catch {
        setComments((c) => ({ ...c, loading: false, loadFailed: c.items.length === 0 }))
      }
    },
    [],
  )

  const toggleComments = useCallback(
    async (q: QuestionItem) => {
      if (openId === q.id) {
        setOpenId(null)
        return
      }
      setOpenId(q.id)
      setComments({ items: [], page: 1, hasMore: false, loading: true, loadFailed: false })
      await loadComments(q.id, 1)
    },
    [openId, loadComments],
  )

  const submitComment = useCallback(async () => {
    if (!openId || !commentText.trim() || commentSending) return
    if (!requireSession()) return
    setCommentSending(true)
    try {
      await api.users.addQuestionComment(openId, { content: commentText.trim() })
      setCommentText("")
      await loadComments(openId, 1)
      toast.show({ title: translate("Komentar terkirim"), tone: "success", duration: 3000 })
    } catch (err) {
      // Klasifikasi toast: error mutasi non-blokir via showMutationError.
      if (
        showMutationError(toast.show, {
          failTitle: translate("Gagal mengirim komentar"),
          uncertainHint: translate("Aksi mungkin sudah diproses — memuat ulang…"),
          err: err,
          scope: "user:username:questions:mengirim-komentar",
        })
      ) {
        void loadComments(openId, 1)
      }
    } finally {
      setCommentSending(false)
    }
  }, [openId, commentText, commentSending, loadComments, requireSession, toast])

  // ── Bertanya ───────────────────────────────────────────────────────
  const submitAsk = useCallback(async () => {
    if (!username) return
    const value = askText.trim()
    if (value.length < QUESTION_MIN) {
      toast.show({
        title: translate("Pertanyaan minimal {x} karakter", { x: QUESTION_MIN }),
        tone: "danger",
      })
      return
    }
    setAsking(true)
    try {
      await api.users.addQuestion(username, value)
      toast.show({ title: translate("Pertanyaan terkirim"), tone: "success", duration: 3000 })
      setAskOpen(false)
      setAskText("")
      await query.refresh()
    } catch (err) {
      // Klasifikasi toast: error mutasi non-blokir via showMutationError.
      if (
        showMutationError(toast.show, {
          failTitle: translate("Gagal mengirim pertanyaan"),
          uncertainHint: translate("Aksi mungkin sudah diproses — memuat ulang…"),
          err: err,
          scope: "user:username:questions:mengirim-pertanyaan",
        })
      ) {
        void query.refresh()
      }
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
        toast.show({ title: translate("Pertanyaan dihapus"), tone: "neutral", duration: 3000 })
        await query.refresh()
      } else if (deleteC && openId) {
        await api.users.deleteQuestionComment(deleteC.id)
        setDeleteC(null)
        toast.show({ title: translate("Komentar dihapus"), tone: "neutral", duration: 3000 })
        await loadComments(openId, 1)
      }
    } catch (err) {
      // Klasifikasi toast: error mutasi non-blokir via showMutationError.
      if (
        showMutationError(toast.show, {
          failTitle: translate("Gagal menghapus"),
          uncertainHint: translate("Aksi mungkin sudah diproses — memuat ulang…"),
          err: err,
          scope: "user:username:questions:menghapus",
        })
      ) {
        void query.refresh()
        if (openId) void loadComments(openId, 1)
      }
    } finally {
      setDeleting(false)
    }
  }, [deleting, deleteQ, deleteC, openId, toast, query, loadComments])

  // UI-P008: kepemilikan via helper bersama (askerId dulu) — versi lama hanya
  // q.asker?.id sehingga tombol Hapus milik sendiri tak pernah muncul (PRF-001).
  const isMyQuestion = (q: QuestionItem) => isOwnQuestion(q, meId)
  const isMyComment = (c: QuestionComment) => !!meId && c.authorId === meId

  return (
    <Screen edges={["top"]} padded={false}>
      <Header
        title={translate("Tanya Jawab")}
        right={
          <Button size="sm" variant="secondary" fullWidth={false} onPress={() => {
            if (requireSession()) setAskOpen(true)
          }}>
            {translate("Bertanya")}
          </Button>
        }
      />
      <PullToRefresh
        onRefresh={() => void query.refresh()}
        refreshing={refreshing}
        contentContainerClassName="px-5"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        <Crossfade loading={loading} skeleton={<ListLoading />}>
          {error ? (
          <ErrorState title={translate("Gagal memuat pertanyaan")} description={error} onRetry={() => void query.reload()} />
        ) : items.length === 0 ? (
          <QaEmptyState
            onAsk={() => {
              if (requireSession()) setAskOpen(true)
            }}
          />
        ) : (
          <View style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader title={atHandle(username)} />
            {items.map((q) => (
              <View key={q.id}>
                <QACard
                  upvote={{
                    count: q.upvoteCount ?? 0,
                    active: q.isUpvotedByViewer === true,
                    loading: upvotingId === q.id,
                    onToggle: (next) => void handleUpvote(q, next),
                  }}
                  commentCount={q.commentCount ?? 0}
                  commentsOpen={openId === q.id}
                  onToggleComments={() => void toggleComments(q)}
                  onDelete={isMyQuestion(q) ? () => setDeleteQ(q) : undefined}
                  question={q.question}
                  asker={{
                    name: q.asker?.fullName ?? q.asker?.username ?? translate("Seseorang"),
                    username: q.asker?.username,
                    avatar: q.asker?.avatarUrl ?? undefined,
                  }}
                  date={q.createdAt}
                  answer={
                    q.answer
                      ? {
                          text: q.answer,
                          by: { name: atHandle(username), username: username ?? undefined },
                          date: q.answeredAt ?? q.createdAt,
                        }
                      : undefined
                  }
                  questionLines={undefined}
                />
                {openId === q.id ? (
                  <View className="-mx-5 border-b border-border px-5 py-2">
                    {comments.loading && comments.items.length === 0 ? (
                      <ListLoading />
                    ) : comments.loadFailed ? (
                      <ErrorState
                        title={translate("Gagal memuat balasan")}
                        onRetry={() => void loadComments(q.id, 1)}
                      />
                    ) : comments.items.length === 0 ? (
                      <Text variant="caption" tone="secondary" className="py-2">
                        {translate("Belum ada balasan. Jadilah yang pertama membalas.")}
                      </Text>
                    ) : (
                      <View>
                        {comments.items.map((c, i) => (
                          <QaCommentItem
                            key={c.id}
                            authorName={c.authorName ?? c.authorUsername ?? translate("Pengguna")}
                            authorAvatar={
                              c.authorAvatarUrl ? { source: c.authorAvatarUrl } : undefined
                            }
                            isOwner={c.isOwner}
                            content={c.content}
                            createdAt={c.createdAt}
                            hasNext={i < comments.items.length - 1 || comments.hasMore}
                            deleted={c.deleted}
                            onDelete={
                              isMyComment(c) && !c.deleted ? () => setDeleteC(c) : undefined
                            }
                          />
                        ))}
                      </View>
                    )}
                    {comments.hasMore ? (
                      <LoadMore
                        status={comments.loading ? "loading" : "idle"}
                        onLoadMore={() => void loadComments(q.id, comments.page + 1)}
                        idleLabel={translate("Lihat balasan lainnya")}
                      />
                    ) : null}
                    <View className="py-3">
                      <QaCommentComposer
                        value={commentText}
                        onChangeText={setCommentText}
                        onSubmit={() => void submitComment()}
                        submitting={commentSending}
                        maxLength={COMMENT_MAX}
                        authorName={me?.fullName ?? me?.username ?? undefined}
                        authorAvatar={me?.avatarUrl ? { source: me.avatarUrl } : undefined}
                        placeholder={translate("Tulis balasan untuk @{x}…", { x: username ?? "" })}
                      />
                    </View>
                  </View>
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
        </Crossfade>
      </PullToRefresh>

      <BottomSheet
        avoidKeyboard
        visible={askOpen}
        onRequestClose={() => setAskOpen(false)}
        title={translate("Bertanya kepada @{x}", { x: username ?? "" })}
        description={translate("Pertanyaan Anda akan tampil di profil ini dan dijawab oleh pemiliknya.")}
      >
        <View className="px-5 pb-4">
          <QaCommentComposer
            value={askText}
            onChangeText={setAskText}
            onSubmit={() => void submitAsk()}
            submitting={asking}
            minLength={QUESTION_MIN}
            maxLength={QUESTION_MAX}
            authorName={me?.fullName ?? me?.username ?? undefined}
            authorAvatar={me?.avatarUrl ? { source: me.avatarUrl } : undefined}
            placeholder={translate("Tulis pertanyaan Anda…")}
            submitLabel={translate("Kirim pertanyaan")}
          />
        </View>
      </BottomSheet>

      <Dialog
        title={deleteQ ? translate("Hapus pertanyaan?") : translate("Hapus komentar?")}
        description={
          deleteQ
            ? translate("Pertanyaan beserta jawabannya akan hilang dari profil ini.")
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
    </Screen>
  )
}
