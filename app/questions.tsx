import { Crossfade } from "@/components/ui/fade-in"
import { ListLoading } from "@/components/ui/paginated-list"
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
import { useCallback, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ChatCircleDots } from "phosphor-react-native"
import { router } from "expo-router"

import { api, userMessage } from "@/lib/api"
import { readQuestionList, type MyQuestionsType, type QuestionItem } from "@/lib/api/users"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { usePaginatedQuery } from "@/lib/use-paginated-query"

import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { LoadMore } from "@/components/ui/load-more"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { QACard } from "@/components/ui/qa-card"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { SegmentedControl, type SegmentItem } from "@/components/ui/segmented-control"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"

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
  )
  const items = query.data

  const openAnswer = useCallback((q: QuestionItem) => {
    setAnswerTarget(q)
    setAnswerText("")
  }, [])

  const submitAnswer = useCallback(async () => {
    if (!answerTarget) return
    const value = answerText.trim()
    if (value.length < ANSWER_MIN) {
      toast.show({ title: `Jawaban minimal ${ANSWER_MIN} karakter`, tone: "danger" })
      return
    }
    setAnswering(true)
    try {
      await api.users.answerQuestion(answerTarget.id, value)
      toast.show({ title: "Jawaban terkirim", tone: "success", duration: 3000 })
      setAnswerTarget(null)
      await query.reload()
    } catch (err) {
      toast.show({ title: "Gagal mengirim jawaban", description: userMessage(err), tone: "danger" })
    } finally {
      setAnswering(false)
    }
  }, [answerTarget, answerText, toast, query])

  const handleDelete = useCallback(async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      await api.users.deleteQuestion(deleteTarget.id)
      toast.show({ title: "Pertanyaan dihapus", tone: "neutral", duration: 3000 })
      setDeleteTarget(null)
      await query.reload()
    } catch (err) {
      toast.show({
        title: "Gagal menghapus pertanyaan",
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
      <Header title="Tanya Jawab" />
      <View className="px-6" style={{ paddingTop: tokens.space[3] }}>
        <SegmentedControl items={SEGMENTS} value={type} onChange={setType} />
      </View>
      <PullToRefresh
        onRefresh={query.refresh}
        refreshing={query.refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        <Crossfade loading={query.loading} skeleton={<ListLoading />}>
          {query.error ? (
          <ErrorState
            title="Gagal memuat"
            description={query.error}
            onRetry={() => void query.reload()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={ChatCircleDots}
            title={
              received ? "Belum ada pertanyaan masuk" : "Belum ada pertanyaan yang Anda ajukan"
            }
            description={
              received
                ? "Pertanyaan dari calon pembeli akan muncul di sini."
                : "Ajukan pertanyaan dari halaman profil pengguna lain."
            }
          />
        ) : (
          <View className="gap-3" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader title={`${items.length} pertanyaan`} />
            {items.map((q) => {
              const other = received ? q.asker : q.target
              const otherName =
                other?.fullName ?? other?.username ?? (received ? "Seseorang" : "Pengguna")
              return (
                <QACard
                  key={q.id}
                  question={q.question}
                  asker={
                    received
                      ? { name: otherName, avatar: q.asker?.avatarUrl ?? undefined }
                      : { name: "Anda" }
                  }
                  date={q.createdAt}
                  answer={
                    q.answer
                      ? {
                          text: q.answer,
                          by: {
                            name: received ? "Anda" : otherName,
                            avatar: received ? undefined : (other?.avatarUrl ?? undefined),
                          },
                          date: q.answeredAt ?? q.createdAt,
                        }
                      : undefined
                  }
                  answerAction={
                    received && !q.answer ? (
                      <Button size="sm" variant="secondary" onPress={() => openAnswer(q)}>
                        Jawab
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
                          Lihat profil
                        </Button>
                      ) : null}
                      <Button size="sm" variant="ghost" onPress={() => setDeleteTarget(q)}>
                        Hapus
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

      <Dialog
        title="Jawab pertanyaan"
        description={`Dari ${answerTarget?.asker?.fullName ?? answerTarget?.asker?.username ?? ""}`}
        visible={!!answerTarget}
        loading={answering}
        confirmLabel="Kirim Jawaban"
        confirmButtonProps={{ disabled: answerText.trim().length < ANSWER_MIN }}
        cancelLabel="Batal"
        onConfirm={() => void submitAnswer()}
        onCancel={() => setAnswerTarget(null)}
        onRequestClose={() => setAnswerTarget(null)}
      >
        <TextArea
          value={answerText}
          onChangeText={setAnswerText}
          placeholder="Tulis jawaban Anda…"
          maxLength={ANSWER_MAX}
          showCount
        />
      </Dialog>

      <Dialog
        title="Hapus pertanyaan?"
        description={
          received
            ? "Pertanyaan ini akan hilang dari profil publik Anda."
            : "Pertanyaan Anda akan dihapus dari profil pengguna tersebut."
        }
        visible={!!deleteTarget}
        destructive
        loading={deleting}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
        onRequestClose={() => setDeleteTarget(null)}
      />
    </Screen>
  )
}