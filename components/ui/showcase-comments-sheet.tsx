/**
 * Kahade — <ShowcaseCommentsSheet> daftar komentar + KOMPOSER satu item
 * showcase di BottomSheet (revisi 2026-09-17 #2).
 *
 * Dipakai feed Showcase (app/(tabs)/showcase.tsx → ShowcaseFeedTab): mengetuk
 * ikon komentar pada kartu feed membuka percakapan item itu tanpa
 * meninggalkan feed — pengguna bisa MEMBACA dan MENULIS komentar langsung di
 * sheet, tidak perlu masuk layar detail (permintaan produk).
 *
 * Keputusan non-obvious:
 *   - Data diambil DI DALAM sheet (key `showcase-comments:<id>`), bukan
 *     diteruskan feed: feed berisi 20 item sekaligus, memuat komentar semua
 *     item di awal = 20 request yang 19 di antaranya tidak pernah dibuka.
 *     `item` tetap dikirim saat menutup supaya konten tidak hilang di tengah
 *     animasi keluar.
 *   - Komentar yang baru dikirim disimpan di state `localComments` dan
 *     dirender DI ATAS hasil query (query di-dedupe terhadap id lokal) —
 *     tidak ada refetch paksa, angka total = total server + lokal, dan
 *     `onCommentAdded` menaikkan hitungan kartu di feed. Reset saat item
 *     berganti supaya komentar tidak bocor ke percakapan lain.
 *   - Tinggi maksimum daftar = 55% window (nilai runtime → style, bukan
 *     className) mengikuti <BankSelect>; komposer sticky di footer sheet
 *     (avoidKeyboard) sehingga selalu terlihat.
 *   - Server mengirim balasan satu tingkat di dalam `replies` root-nya —
 *     balasan digeser 32px (ml-8) agar sejajar teks induk, sama dengan detail.
 *   - Komentar moderasi (`isHidden`) hanya terlihat oleh pemilik item; baris
 *     menampilkan penandanya lewat <ShowcaseCommentRow> tanpa logika khusus.
 */
import { useCallback, useEffect, useState } from "react"
import { ChatCircle } from "phosphor-react-native"
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
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { Icon } from "@/components/ui/icon"
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

  return (
    <BottomSheet
      avoidKeyboard
      visible={item != null}
      onRequestClose={onRequestClose}
      title="Komentar"
      description={total > 0 ? `${formatNumber(total)} Komentar` : undefined}
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
            />
            <Button
              size="sm"
              loading={sending}
              disabled={!draft.trim()}
              onPress={() => void handleSend()}
            >
              Kirim
            </Button>
          </View>
        </View>
      }
    >
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
                  // Indent 32px = avatar xs (24) + gap (8) — sejajar teks induk.
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
