/**
 * Kahade — <ShowcaseCommentsSheet> daftar komentar + KOMPOSER satu item
 * showcase di BottomSheet (revisi 2026-09-17 #3).
 *
 * Perubahan #3 — 9 poin showcase:
 *  5. Tombol Kirim → IconButton PaperPlaneRight
 *  6. Header: count di samping "Komentar" tanpa menulis "Komentar" lagi, plus separator
 *     dan list selaras dengan title (replies ml-8 = avatar 24 + gap 8)
 */

import { useCallback, useEffect, useState } from "react"
import { ChatCircle, PaperPlaneRight } from "phosphor-react-native"
import { ScrollView, View, useWindowDimensions } from "react-native"

import {
  addShowcaseComment,
  listShowcaseComments,
  type ShowcaseCommentWithReplies,
  type ShowcaseSocialItem,
} from "@/lib/api/showcase"
import { isApiError, userMessage } from "@/lib/api"
import { formatNumber } from "@/lib/format"
import { useApiQuery } from "@/lib/use-api-query"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Divider } from "@/components/ui/divider"
import { ErrorState } from "@/components/ui/error-state"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { Input } from "@/components/ui/input"
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton"
import { ShowcaseCommentRow } from "@/components/ui/showcase-comment-row"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

/** Komentar yang dimuat sekali buka — cukup untuk percakapan di feed. */
const SHEET_COMMENT_LIMIT = 30

export type ShowcaseCommentsSheetProps = {
  /** Item yang komentarnya dibuka. `null` = sheet tertutup. */
  item: ShowcaseSocialItem | null
  onRequestClose: () => void
  /** Komentar terkirim dari sheet — feed menaikkan hitungan kartunya. */
  onCommentAdded?: (showcaseId: string) => void
}

export function ShowcaseCommentsSheet({
  item,
  onRequestClose,
  onCommentAdded,
}: ShowcaseCommentsSheetProps) {
  const { height: windowHeight } = useWindowDimensions()
  const toast = useToast()
  const showcaseId = item?.id
  const query = useApiQuery(
    `showcase-comments:${showcaseId ?? "none"}`,
    (signal) =>
      listShowcaseComments(showcaseId as string, { page: 1, limit: SHEET_COMMENT_LIMIT }, signal),
    Boolean(showcaseId),
  )

  /** Komentar yang ditulis dari komposer sheet (belum tentu ada di query). */
  const [localComments, setLocalComments] = useState<ShowcaseCommentWithReplies[]>([])
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)

  // Item berganti = percakapan lain: buang draf & komentar lokal.
  useEffect(() => {
    setLocalComments([])
    setDraft("")
  }, [showcaseId])

  const handleSend = useCallback(async () => {
    if (!showcaseId) return
    const content = draft.trim()
    if (!content || sending) return
    setSending(true)
    try {
      const saved = await addShowcaseComment(showcaseId, { content })
      setLocalComments((previous) => [{ ...saved, replies: [] }, ...previous])
      setDraft("")
      onCommentAdded?.(showcaseId)
    } catch (err) {
      toast.show({
        title: "Gagal mengirim komentar",
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    } finally {
      setSending(false)
    }
  }, [showcaseId, draft, sending, onCommentAdded, toast.show])

  const localIds = new Set(localComments.map((c) => c.id))
  const comments = [...localComments, ...query.data?.data.filter((c) => !localIds.has(c.id)) ?? []]
  const total = (query.data?.total ?? item?.commentCount ?? 0) + localComments.length
  const loading = query.loading && query.data == null

  // Header: "Komentar  12" — count di samping tanpa menulis "Komentar" lagi
  const headerTitle = total > 0 ? `Komentar  ${formatNumber(total)}` : "Komentar"

  return (
    <BottomSheet
      avoidKeyboard
      visible={item != null}
      onRequestClose={onRequestClose}
      title={headerTitle}
      contentClassName="px-0 pb-0"
      footer={
        <View className="px-4 pb-1">
          <View className="flex-row items-end gap-2">
            <Input
              value={draft}
              onChangeText={setDraft}
              placeholder="Tulis komentar…"
              accessibilityLabel="Komentar baru"
              containerClassName="flex-1"
              onSubmitEditing={() => void handleSend()}
              returnKeyType="send"
            />
            <IconButton
              icon={PaperPlaneRight}
              variant="primary"
              size="sm"
              accessibilityLabel="Kirim komentar"
              accessibilityHint="Kirim komentar showcase"
              loading={sending}
              disabled={!draft.trim()}
              onPress={() => void handleSend()}
            />
          </View>
        </View>
      }
    >
      {/* Separator di header komentar — inset selaras list px-5 */}
      <Divider className="mx-5 mb-3" />

      {loading ? (
        <SkeletonGroup className="gap-4 px-5 py-2">
          {Array.from({ length: 3 }, (_, index) => (
            <View key={index} className="flex-row items-start gap-2">
              <Skeleton shape="circle" width={24} height={24} />
              <View className="flex-1 gap-2">
                <Skeleton height={14} className="w-2/5" />
                <Skeleton height={14} className="w-4/5" />
              </View>
            </View>
          ))}
        </SkeletonGroup>
      ) : query.error ? (
        <View className="px-5 pb-2">
          <ErrorState
            compact
            title="Gagal memuat komentar"
            description={query.error}
            onRetry={() => void query.reload()}
          />
        </View>
      ) : comments.length === 0 ? (
        <View className="flex-row items-center gap-2 px-5 pb-6">
          <Icon icon={ChatCircle} size="sm" tone="default" />
          <Text variant="body" tone="secondary">
            Belum ada komentar. Jadilah yang pertama!
          </Text>
        </View>
      ) : (
        // Tinggi maks 55% window: nilai runtime -> style, bukan className.
        // List selaras title: px-5 sama dengan header sheet (gap & indent konsisten)
        <ScrollView
          style={{ maxHeight: windowHeight * 0.55 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-4 px-5 pb-6 pt-1">
            {comments.map((root) => (
              <View key={root.id} className="gap-4">
                <ShowcaseCommentRow comment={root} />
                {(root.replies ?? []).map((reply) => (
                  // Indent 32px = avatar xs (24) + gap (8) — sejajar teks induk, selaras title px-5.
                  <ShowcaseCommentRow key={reply.id} comment={reply} className="ml-8" />
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </BottomSheet>
  )
}
