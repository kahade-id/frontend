/**
 * Kahade — <ShowcaseCommentsSheet> daftar komentar + KOMPOSER satu item
 * showcase di BottomSheet (revisi audit 2026-09-23).
 *
 * Perbaikan audit Etalase:
 *  - G-01: hitungan header tidak dobel — total = total server + komentar
 *    lokal yang BELUM ada di respons server (fallback halus bila
 *    listShowcaseComments sudah menyertakan komentar yang baru dikirim).
 *  - G-02: sheet hanya memuat 30 komentar root; bila ada lebih, baris bawah
 *    menawarkan "Lihat semua komentar" → halaman detail (paginasi penuh).
 *  - G-03/C-08: state dibuang saat sheet DITUTUP (item → null), bukan hanya
 *    saat id berganti — tidak ada jendela draf/listing basi.
 *  - G-04: membuka ulang item yang sama meng-RELOAD query (data komentar
 *    dari kunjungan sebelumnya tidak diasumsikan masih segar).
 *  - F-04 kelas yang sama: komposer dibatasi 1000 karakter (kontrak DTO).
 *  - A-05 kelas yang sama: tamu tidak melihat komposer — tombol "Masuk"
 *    sebagai gantinya (membaca komentar tetap boleh, endpoint publik).
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { ChatCircle, PaperPlaneRight } from "phosphor-react-native"
import { ScrollView, View, useWindowDimensions } from "react-native"
import { router } from "expo-router"

import {
  addShowcaseComment,
  listShowcaseComments,
  type ShowcaseCommentWithReplies,
  type ShowcaseSocialItem,
} from "@/lib/api/showcase"
import { isApiError, userMessage } from "@/lib/api"
import { API_CONSTRAINTS } from "@/lib/api/constraints"
import { formatNumber } from "@/lib/format"
import { useHasSession } from "@/lib/guest-gate"
import { ROUTES } from "@/lib/routes"
import { useApiQuery } from "@/lib/use-api-query"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
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
/** Kontrak DTO CreateShowcaseCommentDto (sumber: constraints.ts, D-08). */
const COMMENT_MAX = API_CONSTRAINTS.CreateShowcaseCommentDto.content.maxLength

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
  const hasSession = useHasSession()
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

  /**
   * G-03/C-08: tutup sheet ATAU ganti item = percakapan lain: buang
   * draf & komentar lokal. (Efek kunci pada `showcaseId`; undefined→id
   * juga berjalan saat dibuka.)
   */
  useEffect(() => {
    setLocalComments([])
    setDraft("")
  }, [showcaseId])

  /**
   * G-04: buka ulang (item → non-null) memuat ulang komentar, termasuk
   * untuk item yang sama — respons lama tidak diasumsikan segar.
   * Buka pertama kali sudah diambil oleh useApiQuery (enabled flip), jadi
   * hanya reload bila sebelumnya PERNAH terbuka sesi ini.
   */
  const hasOpenedRef = useRef(false)
  useEffect(() => {
    if (!showcaseId) return
    if (hasOpenedRef.current) {
      void query.reload()
    } else {
      hasOpenedRef.current = true
    }
    // Hanya pada transisi buka — query.reload tidak menjadi trigger ulang.
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
  const serverComments = query.data?.data.filter((c) => !localIds.has(c.id)) ?? []
  const comments = [...localComments, ...serverComments]

  /**
   * G-01: total = total server + komentar lokal yang BELUM tercakup server.
   * (Fallback halus untuk respons yang sudah memuat komentar lokal —
   * tanpa dedupe ini hitungan header dobel setelah kirim+buka ulang.)
   */
  const serverTotal = query.data?.total ?? item?.commentCount ?? 0
  const serverIds = new Set((query.data?.data ?? []).map((c) => c.id))
  const localOnlyCount = localComments.filter((c) => !serverIds.has(c.id)).length
  const total = serverTotal + localOnlyCount

  const loading = query.loading && query.data == null
  /** G-02: mungkin masih ada komentar di luar halaman sheet. */
  const maybeMore = comments.length >= SHEET_COMMENT_LIMIT || total > comments.length

  const handleSeeAll = useCallback(() => {
    if (!showcaseId) return
    onRequestClose()
    router.push(ROUTES.showcaseDetail(showcaseId))
  }, [showcaseId, onRequestClose])

  // Header: "Komentar  12" — count di samping tanpa menulis "Komentar" lagi
  const headerTitle = total > 0 ? `Komentar  ${formatNumber(total)}` : "Komentar"

  return (
    <BottomSheet
      avoidKeyboard
      visible={item != null}
      onRequestClose={onRequestClose}
      title={headerTitle}
      padding="none"
      footer={
        // Wrapper footer sheet sudah px-5 -> tanpa padding horizontal lagi.
        hasSession ? (
          <View className="pb-1">
            <View className="flex-row items-end gap-2">
              <Input
                value={draft}
                onChangeText={setDraft}
                placeholder="Tulis komentar…"
                accessibilityLabel="Komentar baru"
                containerClassName="flex-1"
                maxLength={COMMENT_MAX}
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
        ) : (
          // A-05 (kelas): tamu tidak melihat komposer — ajakan login.
          <View className="pb-1">
            <Button onPress={() => router.push(ROUTES.loginRequired())}>
              Masuk untuk berkomentar
            </Button>
          </View>
        )
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
                {/* Bingkai bawah komentar terakhir — konsisten dengan garis atas
                    & antar item (v2 2026-09, separasi BottomSheet). */}
                <Divider />
              </View>
            ))}
            {maybeMore ? (
              // G-02: jalan membaca komentar di luar 30 pertama.
              <Button variant="secondary" onPress={handleSeeAll}>
                Lihat semua komentar
              </Button>
            ) : null}
          </View>
        </ScrollView>
      )}
    </BottomSheet>
  )
}
