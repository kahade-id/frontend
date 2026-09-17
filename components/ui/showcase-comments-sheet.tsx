/**
 * Kahade — <ShowcaseCommentsSheet> daftar komentar satu item showcase di
 * BottomSheet.
 *
 * Dipakai feed Showcase (app/(tabs)/showcase.tsx → ShowcaseFeedTab): mengetuk
 * ikon komentar pada kartu feed membuka SELURUH percakapan item itu tanpa
 * meninggalkan feed — pengguna bisa membaca komentar lalu lanjut menggulir.
 *
 * Keputusan non-obvious:
 *   - Data diambil DI DALAM sheet (key `showcase-comments:<id>`), bukan
 *     diteruskan feed: feed berisi 20 item sekaligus, memuat komentar semua
 *     item di awal = 20 request yang 19 di antaranya tidak pernah dibuka.
 *     `item` tetap dikirim saat menutup supaya konten tidak hilang di tengah
 *     animasi keluar (pola sama dengan sheet menu komentar di detail).
 *   - Tinggi maksimum daftar = 55% window (nilai runtime → style, bukan
 *     className) mengikuti <BankSelect>; sheet sendiri sudah dibatasi 90%
 *     tinggi window, jadi header + CTA selalu terlihat.
 *   - Server mengirim balasan satu tingkat di dalam `replies` root-nya —
 *     di sini balasan digeser 32px (ml-8) agar sejajar teks induk, sama
 *     dengan layar detail.
 *   - Komentar moderasi (`isHidden`) hanya terlihat oleh pemilik item; baris
 *     menampilkan penandanya lewat <ShowcaseCommentRow> tanpa logika khusus.
 *   - Tanpa komposer: menulis komentar butuh konteks penuh (balas, edit,
 *     moderasi) yang sudah ada di layar detail — footer menyediakan jalan
 *     ke sana, bukan menduplikasi form yang setengah fungsi.
 */
import { ChatCircle } from "phosphor-react-native"
import { ScrollView, View, useWindowDimensions } from "react-native"

import { listShowcaseComments, type ShowcaseSocialItem } from "@/lib/api/showcase"
import { formatNumber } from "@/lib/format"
import { useApiQuery } from "@/lib/use-api-query"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { Icon } from "@/components/ui/icon"
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton"
import { ShowcaseCommentRow } from "@/components/ui/showcase-comment-row"
import { Text } from "@/components/ui/text"

/** Komentar yang dimuat sekali buka — cukup untuk percakapan di feed. */
const SHEET_COMMENT_LIMIT = 30

export type ShowcaseCommentsSheetProps = {
  /** Item yang komentarnya dibuka. `null` = sheet tertutup. */
  item: ShowcaseSocialItem | null
  onRequestClose: () => void
  /** Buka layar detail (untuk menulis komentar) — sheet ditutup lebih dulu. */
  onOpenDetail?: () => void
}

export function ShowcaseCommentsSheet({
  item,
  onRequestClose,
  onOpenDetail,
}: ShowcaseCommentsSheetProps) {
  const { height: windowHeight } = useWindowDimensions()
  const showcaseId = item?.id
  const query = useApiQuery(
    `showcase-comments:${showcaseId ?? "none"}`,
    (signal) =>
      listShowcaseComments(showcaseId as string, { page: 1, limit: SHEET_COMMENT_LIMIT }, signal),
    Boolean(showcaseId),
  )

  const comments = query.data?.data ?? []
  const total = query.data?.total ?? item?.commentCount ?? 0
  const loading = query.loading && query.data == null

  return (
    <BottomSheet
      visible={item != null}
      onRequestClose={onRequestClose}
      title="Komentar"
      description={total > 0 ? `${formatNumber(total)} Komentar` : undefined}
      contentClassName="px-0 pb-0"
      footer={
        onOpenDetail ? (
          <View className="px-5 pb-1">
            <Button variant="ghost" onPress={onOpenDetail}>
              Tulis komentar
            </Button>
          </View>
        ) : undefined
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
            Belum ada komentar.
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
