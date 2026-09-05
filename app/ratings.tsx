/**
 * Screen — Ulasan Saya (GET /v1/ratings/my; reply/update via dialog).
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Star } from "phosphor-react-native"

import { api } from "@/lib/api"
import type { Rating } from "@/lib/api/ratings"
import { tokens } from "@/lib/tokens"

import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { RatingReviewCard } from "@/components/ui/rating-review-card"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"

export default function RatingsScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [items, setItems] = useState<Rating[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [replyTarget, setReplyTarget] = useState<Rating | null>(null)
  const [replyText, setReplyText] = useState("")
  const [sending, setSending] = useState(false)

  const fetchRatings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.ratings.getMyRatings()
      setItems(res ?? [])
    } catch {
      setError("Gagal memuat ulasan.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchRatings()
  }, [fetchRatings])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchRatings()
    setRefreshing(false)
  }, [fetchRatings])

  const handleSendReply = useCallback(async () => {
    if (!replyTarget || !replyText.trim()) return
    setSending(true)
    try {
      await api.ratings.replyRating(replyTarget.id, { content: replyText.trim() })
      toast.show({ title: "Balasan terkirim", tone: "success", duration: 3000 })
      setReplyTarget(null)
      setReplyText("")
      await fetchRatings()
    } catch {
      toast.show({ title: "Gagal mengirim balasan", tone: "danger" })
    } finally {
      setSending(false)
    }
  }, [replyTarget, replyText, toast.show, fetchRatings])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Ulasan" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        {loading ? (
          <EmptyState icon={Star} title="Memuat ulasan…" />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchRatings()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Star}
            title="Belum ada ulasan"
            description="Ulasan yang Anda terima akan muncul di sini."
          />
        ) : (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader title="Ulasan masuk" />
            {items.map((r) => (
              <RatingReviewCard
                key={r.id}
                stars={r.stars}
                comment={r.comment ?? undefined}
                reviewer={{ name: r.authorUsername ?? "—" }}
                date={r.createdAt}
                orderId={r.orderId}
                reply={
                  r.reply
                    ? {
                        id: `reply-${r.id}`,
                        content: r.reply,
                        by: { name: "Anda" },
                        date: r.createdAt,
                      }
                    : undefined
                }
                onReply={!r.replied ? () => { setReplyTarget(r); setReplyText("") } : undefined}
              />
            ))}
          </View>
        )}
      </PullToRefresh>

      <Dialog
        title="Balas ulasan"
        description="Jaga nada tetap ramah dan profesional."
        visible={!!replyTarget}
        loading={sending}
        confirmLabel="Kirim Balasan"
        cancelLabel="Batal"
        onConfirm={() => void handleSendReply()}
        onCancel={() => setReplyTarget(null)}
        onRequestClose={() => setReplyTarget(null)}
        confirmButtonProps={{ disabled: !replyText.trim() }}
      >
        <TextArea
          value={replyText}
          onChangeText={setReplyText}
          placeholder="Tulis balasan"
          maxLength={500}
          numberOfLines={4}
        />
      </Dialog>
    </Screen>
  )
}
