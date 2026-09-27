/**
 * Screen — Tanya Jawab saya.
 *
 * Kontrak API (docs/api/kahade-api-mobile.json):
 *   GET    /v1/users/me/questions?type&page&limit   (SEMUA REQUIRED)
 *          `type` tidak berenum di spec — asumsi "received" (ditanyakan
 *          ke profil saya) | "asked" (yang saya tanyakan), dari summary
 *          "Get my received or asked questions".
 *   PUT    /v1/users/questions/{id}/answer          AnswerQuestionDto { answer 1–2000 }
 *   DELETE /v1/users/questions/{id}                 hapus (pemilik profil ATAU penanya)
 *
 * Segmen "Diterima": jawab (belum dijawab) / hapus. Segmen "Ditanyakan":
 * lihat status jawaban, hapus pertanyaan saya, buka profil yang ditanya.
 * Daftar dipaginasi (PAGE_SIZE 20 + <LoadMore>); respons array|{data,meta}.
 */

import { Crossfade } from "@/components/ui/fade-in"
import { ListLoading } from "@/components/ui/paginated-list"
import { useCallback, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { router } from "expo-router"

import { api, userMessage } from "@/lib/api"
import { readQuestionList, type MyQuestionsType, type QuestionItem, type UserProfile } from "@/lib/api/users"
import { CONTENT_REPORT_REASONS, type ContentReportReason } from "@/lib/labels/report"
import { ROUTES } from "@/lib/routes"
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
import { QaCommentComposer } from "@/components/ui/qa-comment-item"
import { QaEmptyState } from "@/components/ui/qa-empty-state"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Radio, RadioGroup } from "@/components/ui/radio"
import { SegmentedControl, type SegmentItem } from "@/components/ui/segmented-control"
import { useToast } from "@/components/ui/toast"
import { translate, useLanguage } from "@/lib/i18n"

/** G-13: opsi hide satu sumber di lib/labels/report (= HiddenReason API). */
const HIDE_REASONS = CONTENT_REPORT_REASONS
type HiddenReason = ContentReportReason

const PAGE_SIZE = 20
/** AnswerQuestionDto: minLength 1 · maxLength 2000 (batas lokal min 10 agar jawaban bermakna) */
const ANSWER_MIN = 10
const ANSWER_MAX = 2000

const SEGMENTS: SegmentItem<MyQuestionsType>[] = [
  { value: "received", label: "Diterima" },
  { value: "asked", label: "Ditanyakan" },
]

export default function QuestionsScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  // i18n: label segmen mengikuti bahasa aktif.
  useLanguage()

  const [type, setType] = useState<MyQuestionsType>("received")

  const [answerTarget, setAnswerTarget] = useState<QuestionItem | null>(null)
  const [answerText, setAnswerText] = useState("")
  const [answering, setAnswering] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<QuestionItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  /**
   * `usePaginatedQuery`, bukan rakitan manual page/hasMore/loadingMore. Yang
   * sebelumnya hilang dan sekarang ditangani hook: ganti tab (received/sent)
   * membatalkan request tab lama sehingga respons lambat tidak bisa menimpa
   * hasil tab baru, "muat lagi" single-flight, dan baris yang sudah ada TETAP
   * tampil saat halaman berikutnya gagal.
   *
   * Perubahan umpan balik yang disengaja: kegagalan "muat lagi" dulu hanya
   * memunculkan Toast (hilang dalam beberapa detik, tanpa aksi). Sekarang ia
   * memakai status "error" milik <LoadMore> yang memang sudah ada di komponen
   * itu tetapi tidak pernah dipakai — persisten dan punya tombol coba lagi.
   */
  const query = usePaginatedQuery<QuestionItem>(
    `my-questions:${type}`,
    async (page, signal) => {
      const body = await api.users.getMyQuestions({ type, page, limit: PAGE_SIZE }, signal)
      const { items, totalPages } = readQuestionList(body)
      return {
        data: items,
        meta: {
          page,
          limit: PAGE_SIZE,
          // Fallback meniru logika lama: tanpa totalPages dari server, halaman
          // penuh dianggap masih punya lanjutan.
          totalPages: totalPages ?? (items.length >= PAGE_SIZE ? page + 1 : page),
        },
      }
    },
    // C-08 (audit): pertanyaan terbaru di atas; jawaban masuk mengubah urutan.
    { compare: byTimestampDesc<QuestionItem>((question) => question.createdAt) },
  )
  const items = query.data
  const [upvotingId, setUpvotingId] = useState<string | null>(null)

  // Avatar + nama penulis untuk composer jawaban (proyeksi ringan dari cache me).
  const meQuery = useApiQuery<
    UserProfile,
    { fullName?: string; username?: string | null; avatarUrl?: string | null }
  >(
    queryKeys.me(),
    (signal) => api.users.getMe(signal),
    true,
    {
      select: (me) => ({
        fullName: me.fullName,
        username: me.username,
        avatarUrl: me.avatarUrl,
      }),
    },
  )
  const me = meQuery.data
  const [hideTarget, setHideTarget] = useState<QuestionItem | null>(null)
  const [hideReason, setHideReason] = useState<HiddenReason>("SPAM")
  const [hiding, setHiding] = useState(false)

  const submitHide = useCallback(async () => {
    if (!hideTarget || hiding) return
    setHiding(true)
    try {
      await api.users.hideQuestion(hideTarget.id, hideReason)
      // Pertanyaan tersembunyi hilang dari list server (filter isHidden) —
      // cukup hapus dari state lokal.
      query.setData((prev) => prev.filter((q) => q.id !== hideTarget.id))
      setHideTarget(null)
      toast.show({ title: translate("Pertanyaan disembunyikan"), tone: "success", duration: 2500 })
    } catch (err: unknown) {
      toast.show({
        title: translate("Gagal menyembunyikan pertanyaan"),
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setHiding(false)
    }
  }, [hideTarget, hideReason, hiding, query.setData, toast])

  const patchQuestion = useCallback(
    (id: string, patch: Partial<QuestionItem>) => {
      query.setData((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)))
    },
    [query.setData],
  )

  const handleUpvote = useCallback(
    async (q: QuestionItem, next: boolean) => {
      if (upvotingId) return
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
        patchQuestion(q.id, { upvoteCount: prevCount, isUpvotedByViewer: prevActive })
        toast.show({
          title: translate("Gagal memperbarui dukungan"),
          description: userMessage(err),
          tone: "danger",
        })
      } finally {
        setUpvotingId(null)
      }
    },
    [upvotingId, patchQuestion, toast],
  )

  const openAnswer = useCallback((q: QuestionItem) => {
    setAnswerTarget(q)
    setAnswerText("")
  }, [])

  const submitAnswer = useCallback(async () => {
    if (!answerTarget) return
    const value = answerText.trim()
    if (value.length < ANSWER_MIN) {
      toast.show({
        title: translate("Jawaban minimal {x} karakter", { x: ANSWER_MIN }),
        tone: "danger",
      })
      return
    }
    setAnswering(true)
    try {
      await api.users.answerQuestion(answerTarget.id, value)
      toast.show({ title: translate("Jawaban terkirim"), tone: "success", duration: 3000 })
      setAnswerTarget(null)
      await query.reload()
    } catch (err) {
      toast.show({ title: translate("Gagal mengirim jawaban"), description: userMessage(err), tone: "danger" })
    } finally {
      setAnswering(false)
    }
  }, [answerTarget, answerText, toast, query])

  const handleDelete = useCallback(async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      await api.users.deleteQuestion(deleteTarget.id)
      toast.show({ title: translate("Pertanyaan dihapus"), tone: "neutral", duration: 3000 })
      setDeleteTarget(null)
      await query.reload()
    } catch (err) {
      toast.show({
        title: translate("Gagal menghapus pertanyaan"),
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, deleting, toast, query])

  const received = type === "received"

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title={translate("Tanya Jawab")} />
      <View className="px-5" style={{ paddingTop: tokens.space[3] }}>
        <SegmentedControl
          accessibilityLabel="Jenis pertanyaan"
          items={SEGMENTS.map((sg) => ({ ...sg, label: translate(sg.label) }))}
          value={type}
          onChange={setType}
        />
      </View>
      <PullToRefresh
        onRefresh={query.refresh}
        refreshing={query.refreshing}
        contentContainerClassName="px-5"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        <Crossfade loading={query.loading} skeleton={<ListLoading />}>
          {query.error ? (
          <ErrorState
            title={translate("Gagal memuat")}
            description={query.error}
            onRetry={() => void query.reload()}
          />
        ) : items.length === 0 ? (
          <QaEmptyState
            isSelf={received}
            title={
              received
                ? translate("Belum ada pertanyaan masuk")
                : translate("Belum ada pertanyaan yang Anda ajukan")
            }
            description={
              received
                ? translate("Pertanyaan dari calon pembeli akan muncul di sini.")
                : translate("Ajukan pertanyaan dari halaman profil pengguna lain.")
            }
          />
        ) : (
          <View style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader title={translate("Pertanyaan")} />
            {items.map((q) => {
              const other = received ? q.asker : q.target
              const otherName =
                other?.fullName ?? other?.username ?? (received ? translate("Seseorang") : translate("Pengguna"))
              return (
                <QACard
                  key={q.id}
                  upvote={{
                    count: q.upvoteCount ?? 0,
                    active: q.isUpvotedByViewer === true,
                    loading: upvotingId === q.id,
                    onToggle: (next) => void handleUpvote(q, next),
                  }}
                  commentCount={q.commentCount ?? 0}
                  question={q.question}
                  asker={
                    received
                      ? {
                          name: otherName,
                          username: q.asker?.username,
                          avatar: q.asker?.avatarUrl ?? undefined,
                        }
                      : { name: translate("Anda") }
                  }
                  date={q.createdAt}
                  answer={
                    q.answer
                      ? {
                          text: q.answer,
                          by: {
                            name: received ? translate("Anda") : otherName,
                            avatar: received ? undefined : (other?.avatarUrl ?? undefined),
                          },
                          date: q.answeredAt ?? q.createdAt,
                        }
                      : undefined
                  }
                  answerAction={
                    received && !q.answer ? (
                      <Button size="sm" variant="secondary" onPress={() => openAnswer(q)}>
                        {translate("Jawab")}
                      </Button>
                    ) : undefined
                  }
                  footer={
                    <View className="flex-row flex-wrap gap-2">
                      {other?.username ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onPress={() => router.push(ROUTES.userProfile(other.username))}
                        >
                          {translate("Lihat profil")}
                        </Button>
                      ) : null}
                      {received ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onPress={() => {
                            setHideReason("SPAM")
                            setHideTarget(q)
                          }}
                        >
                          {translate("Sembunyikan")}
                        </Button>
                      ) : null}
                      <Button size="sm" variant="ghost" onPress={() => setDeleteTarget(q)}>
                        {translate("Hapus")}
                      </Button>
                    </View>
                  }
                />
              )
            })}
            <LoadMore
              status={
                query.loadMoreError
                  ? "error"
                  : query.loadingMore
                    ? "loading"
                    : query.hasMore
                      ? "idle"
                      : "end"
              }
              onLoadMore={() => void query.loadMore()}
              hideEnd
            />
            </View>
          )}
        </Crossfade>
      </PullToRefresh>

      <BottomSheet
        avoidKeyboard
        visible={!!answerTarget}
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
            authorName={me?.fullName ?? me?.username ?? translate("Anda")}
            authorAvatar={me?.avatarUrl ? { source: me.avatarUrl } : undefined}
            placeholder={translate("Tulis jawaban Anda…")}
            submitLabel={translate("Kirim jawaban")}
          />
        </View>
      </BottomSheet>

      <BottomSheet
        avoidKeyboard
        visible={hideTarget != null}
        onRequestClose={() => setHideTarget(null)}
        title={translate("Sembunyikan pertanyaan")}
        description={translate("Pertanyaan tidak lagi tampil di profil publik. Tindakan dapat dibatalkan lewat moderasi.")}
        footer={
          <Button
            fullWidth
            variant="destructive"
            loading={hiding}
            onPress={() => void submitHide()}
          >
            {translate("Sembunyikan")}
          </Button>
        }
      >
        <View className="px-5 pb-2">
          <RadioGroup
            accessibilityLabel="Alasan menyembunyikan"
            value={hideReason}
            onChange={(v) => setHideReason(v as HiddenReason)}
          >
            {HIDE_REASONS.map((r) => (
              <Radio key={r.value} value={r.value} label={r.label} description={r.description} />
            ))}
          </RadioGroup>
        </View>
      </BottomSheet>

      <Dialog
        title={translate("Hapus pertanyaan?")}
        description={
          received
            ? translate("Pertanyaan ini akan hilang dari profil publik Anda.")
            : translate("Pertanyaan Anda akan dihapus dari profil pengguna tersebut.")
        }
        visible={!!deleteTarget}
        destructive
        loading={deleting}
        confirmLabel={translate("Hapus")}
        cancelLabel={translate("Batal")}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
        onRequestClose={() => setDeleteTarget(null)}
      />
    </Screen>
  )
}