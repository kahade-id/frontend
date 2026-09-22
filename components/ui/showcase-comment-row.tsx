/**
 * Kahade — <ShowcaseCommentRow> baris komentar showcase (gaya feed).
 *
 * Satu implementasi untuk dua tempat: daftar komentar di layar detail
 * (app/showcase/[id].tsx) dan BottomSheet komentar di feed
 * (components/ui/showcase-comments-sheet.tsx) — supaya bentuk, format waktu,
 * dan penanda "(Komentar disembunyikan)" tidak pernah berbeda antar layar.
 *
 * Keputusan non-obvious:
 *   - Menu ⋯ hanyalah tombol kecil di ujung baris (bukan tap seluruh baris):
 *     seluruh baris yang bisa ditekan menyulitkan seleksi teks dan memicu menu
 *     saat jari tersenggol ketika scroll.
 *   - `Balas` hanya untuk komentar ROOT — backend membatasi kedalaman balasan
 *     satu tingkat (SHOWCASE_COMMENT_DEPTH_EXCEEDED), jadi baris balasan tidak
 *     pernah menampilkan tautan yang pasti gagal.
 *   - Semua aksi (menu, balas) OPSIONAL: sheet hanya membaca, jadi barisnya
 *     cukup tampil statis tanpa affordance yang tidak berfungsi.
 */
import { DotsThree } from "phosphor-react-native"
import { View } from "react-native"
import { translate } from "@/lib/i18n/translate"

import type { ShowcaseComment } from "@/lib/api/showcase"
import { formatDateTime } from "@/lib/format"

import { Avatar } from "@/components/ui/avatar"
import { IconButton } from "@/components/ui/icon-button"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"

export type ShowcaseCommentRowProps = {
  comment: ShowcaseComment
  /** Komentar milik viewer — menampilkan penanda "Anda" */
  isMine?: boolean
  /** Tampilkan tautan "Balas" (hanya komentar root yang boleh dibalas) */
  canReply?: boolean
  /** Tampilkan tombol ⋯ (pemanggil memutuskan: pengarang ATAU pemilik item) */
  menuable?: boolean
  onReply?: (c: ShowcaseComment) => void
  onOpenMenu?: (c: ShowcaseComment) => void
  /** Tonjolkan komentar baru/terpilih (mis. dari notifikasi) */
  className?: string
}

export function ShowcaseCommentRow({
  comment,
  isMine = false,
  canReply = false,
  menuable = false,
  onReply,
  onOpenMenu,
  className,
}: ShowcaseCommentRowProps) {
  const hidden = comment.isHidden === true
  const authorName = comment.author.fullName ?? comment.author.username

  return (
    <View className={className}>
      <View className="flex-row items-start gap-2">
        <Avatar
          source={comment.author.avatarUrl ? { uri: comment.author.avatarUrl } : undefined}
          name={authorName}
          size="xs"
        />
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-2">
            <Text variant="body" weight={600} numberOfLines={1} className="flex-1">
              {authorName}
            </Text>
            {menuable && onOpenMenu ? (
              <IconButton
                icon={DotsThree}
                variant="ghost"
                size="sm"
                accessibilityLabel={translate("Opsi komentar dari {x}", { x: authorName })}
                onPress={() => onOpenMenu(comment)}
              />
            ) : null}
          </View>
          <Text variant="body" tone={hidden ? "secondary" : "primary"}>
            {hidden ? "(Komentar disembunyikan)" : comment.content}
          </Text>
          {hidden && comment.hiddenReason ? (
            <Text variant="caption" tone="secondary">
              Alasan: {comment.hiddenReason.toLowerCase()}
            </Text>
          ) : null}
          <View className="flex-row items-center gap-4">
            <Text variant="caption" tone="secondary" className="tabular-nums">
              {formatDateTime(comment.createdAt)}
            </Text>
            {isMine ? (
              <Text variant="caption" tone="secondary">
                Anda
              </Text>
            ) : null}
            {canReply && onReply ? (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Balas komentar"
                onPress={() => onReply(comment)}
              >
                <Text variant="caption" tone="primary" weight={600}>
                  Balas
                </Text>
              </PressableScale>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  )
}
