/**
 * Screen — Tanya Jawab saya (GET /v1/users/me/questions, PUT/…/answer).
 * Pertanyaan yang masuk di profil Anda; jawab lewat Dialog.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ChatCircleDots } from "phosphor-react-native"
import { router } from "expo-router"

import { api } from "@/lib/api"
import type { QuestionItem } from "@/lib/api/users"
import { formatDateTime } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { QACard } from "@/components/ui/qa-card"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"

export default function QuestionsScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [items, setItems] = useState<QuestionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [answerTarget, setAnswerTarget] = useState<QuestionItem | null>(null)
  const [answerText, setAnswerText] = useState("")
  const [answering, setAnswering] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.users.getMyQuestions()
      setItems(res ?? [])
    } catch {
      setError("Gagal memuat pertanyaan.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchAll()
    setRefreshing(false)
  }, [fetchAll])

  const openAnswer = useCallback((q: QuestionItem) => {
    setAnswerTarget(q)
    setAnswerText("")
  }, [])

  const submitAnswer = useCallback(async () => {
    if (!answerTarget) return
    const value = answerText.trim()
    if (value.length < 10) {
      toast.show({ title: "Jawaban minimal 10 karakter", tone: "danger" })
      return
    }
    setAnswering(true)
    try {
      await api.users.answerQuestion(answerTarget.id, value)
      toast.show({ title: "Jawaban terkirim", tone: "success", duration: 3000 })
      setAnswerTarget(null)
      await fetchAll()
    } catch {
      toast.show({ title: "Gagal mengirim jawaban", tone: "danger" })
    } finally {
      setAnswering(false)
    }
  }, [answerTarget, answerText, toast.show, fetchAll])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Pertanyaan" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        {loading ? (
          <EmptyState icon={ChatCircleDots} title="Memuat pertanyaan…" />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchAll()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={ChatCircleDots}
            title="Belum ada pertanyaan"
            description="Pertanyaan dari calon pembeli akan muncul di sini."
          />
        ) : (
          <View className="gap-3" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader title={`${items.length} pertanyaan`} />
            {items.map((q) => (
              <QACard
                key={q.id}
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
                        by: { name: "Anda" },
                        date: q.answeredAt ?? q.createdAt,
                      }
                    : undefined
                }
                answerAction={
                  q.answer ? undefined : (
                    <Button size="sm" variant="secondary" onPress={() => openAnswer(q)}>
                      Jawab
                    </Button>
                  )
                }
                footer={
                  q.asker ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onPress={() => router.push(ROUTES.userProfile(q.asker!.username))}
                    >
                      Lihat profil
                    </Button>
                  ) : undefined
                }
              />
            ))}
          </View>
        )}
      </PullToRefresh>

      <Dialog
        title="Jawab pertanyaan"
        description={`Dari ${answerTarget?.asker?.fullName ?? answerTarget?.asker?.username ?? ""}`}
        visible={!!answerTarget}
        loading={answering}
        confirmLabel="Kirim Jawaban"
        confirmButtonProps={{ disabled: answerText.trim().length < 10 }}
        cancelLabel="Batal"
        onConfirm={() => void submitAnswer()}
        onCancel={() => setAnswerTarget(null)}
        onRequestClose={() => setAnswerTarget(null)}
      >
        <TextArea
          value={answerText}
          onChangeText={setAnswerText}
          placeholder="Tulis jawaban Anda…"
          maxLength={2000}
        />
      </Dialog>
    </Screen>
  )
}
