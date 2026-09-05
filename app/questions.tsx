import { LoadingScreen } from "@/components/ui/loading-screen"
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
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ChatCircleDots } from "phosphor-react-native"
import { router } from "expo-router"

import { api, userMessage } from "@/lib/api"
import { readQuestionList, type MyQuestionsType, type QuestionItem } from "@/lib/api/users"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

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
  const [items, setItems] = useState<QuestionItem[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const [answerTarget, setAnswerTarget] = useState<QuestionItem | null>(null)
  const [answerText, setAnswerText] = useState("")
  const [answering, setAnswering] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<QuestionItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchPage = useCallback(
    async (p: number) => {
      const body = await api.users.getMyQuestions({ type, page: p, limit: PAGE_SIZE })
      const { items: data, totalPages } = readQuestionList(body)
      setItems((prev) => (p === 1 ? data : [...prev, ...data]))
      setPage(p)
      setHasMore(typeof totalPages === "number" ? p < totalPages : data.length >= PAGE_SIZE)
    },
    [type],
  )

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await fetchPage(1)
    } catch {
      setError("Gagal memuat pertanyaan.")
    } finally {
      setLoading(false)
    }
  }, [fetchPage])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchAll()
    setRefreshing(false)
  }, [fetchAll])

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      await fetchPage(page + 1)
    } catch {
      toast.show({ title: "Gagal memuat halaman berikutnya", tone: "danger" })
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, fetchPage, page, toast])

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
      await fetchPage(1)
    } catch (err) {
      toast.show({ title: "Gagal mengirim jawaban", description: userMessage(err), tone: "danger" })
    } finally {
      setAnswering(false)
    }
  }, [answerTarget, answerText, toast, fetchPage])

  const handleDelete = useCallback(async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      await api.users.deleteQuestion(deleteTarget.id)
      toast.show({ title: "Pertanyaan dihapus", tone: "neutral", duration: 3000 })
      setDeleteTarget(null)
      await fetchPage(1)
    } catch (err) {
      toast.show({
        title: "Gagal menghapus pertanyaan",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, deleting, toast, fetchPage])

  const received = type === "received"

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Tanya Jawab" />
      <View className="px-6" style={{ paddingTop: tokens.space[3] }}>
        <SegmentedControl items={SEGMENTS} value={type} onChange={setType} />
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
          <LoadingScreen message="Memuat pertanyaan…" />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchAll()} />
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
              status={loadingMore ? "loading" : hasMore ? "idle" : "end"}
              onLoadMore={() => void handleLoadMore()}
              hideEnd
            />
          </View>
        )}
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
