import { CONTENT_REPORT_REASONS } from "@/lib/labels/report"
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
import { router } from "expo-router"
import { translate } from "@/lib/i18n/translate"

import type { ShowcaseComment } from "@/lib/api/showcase"
import { formatRelativeTime } from "@/lib/format"
import { useHasSession } from "@/lib/guest-gate"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"
import { ROUTES } from "@/lib/routes"

import { Avatar } from "@/components/ui/avatar"
import { IconButton } from "@/components/ui/icon-button"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"


/**
 * C-04 (audit 2026-09-24): komentar dianggap diedit hanya bila `updatedAt`
 * benar-benar BERBEDA dari `createdAt` (toleransi 1 detik, karena server bisa
 * mengirim presisi detik vs milidetik). Perbandingan string mentah dulu
 * memunculkan penanda "(diedit)" palsu.
 */
const EDITED_TOLERANCE_MS = 1000

export function isEditedComment(createdAt: string, updatedAt?: string | null): boolean {
  if (typeof updatedAt !== "string" || updatedAt.length === 0) return false
  const created = Date.parse(createdAt)
  const updated = Date.parse(updatedAt)
  if (!Number.isFinite(created) || !Number.isFinite(updated)) return createdAt !== updatedAt
  return Math.abs(updated - created) > EDITED_TOLERANCE_MS
}

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
  const hasSession = useHasSession()
  const hidden = comment.isHidden === true
  const authorName = comment.author.fullName ?? comment.author.username
  const username = comment.author.username
  const edited = isEditedComment(comment.createdAt, comment.updatedAt)
  const timeLabel = formatRelativeTime(comment.createdAt)

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
            {/* Username gray regular: @username • 3 h lalu (sesuai request bug #3) */}
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={translate("Lihat profil {x}", { x: authorName })}
              onPress={() =>
                router.push(
                  hasSession
                    ? ROUTES.userProfile(comment.author.username)
                    : ROUTES.loginRequired(`/user/${encodeURIComponent(comment.author.username)}`),
                )
              }
              containerClassName={cn("flex-1 rounded-sm", focusRing)}
            >
              <Text variant="caption" tone="secondary" weight={400} numberOfLines={1} className="tabular-nums">
                @{username} • {timeLabel}
                {edited ? ` ${translate("(diedit)")}` : null}
                {isMine ? ` • ${translate("Anda")}` : null}
              </Text>
            </PressableScale>
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
          <Text variant="body" tone={hidden ? "secondary" : "primary"} weight={400}>
            {hidden ? translate("(Komentar disembunyikan)") : comment.content}
          </Text>
          {hidden && !comment.hiddenReason ? (
            <Text variant="caption" tone="secondary">
              {translate("Disembunyikan karena melanggar pedoman komunitas.")}
            </Text>
          ) : null}
          {hidden && comment.hiddenReason ? (
            <Text variant="caption" tone="secondary">
              {translate("Alasan: {x}", {
                x: translate(CONTENT_REPORT_REASONS.find((reason) => reason.value === comment.hiddenReason)?.label ?? "Lainnya"),
              })}
            </Text>
          ) : null}
          {canReply && onReply ? (
            <View className="flex-row items-center pt-1">
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={translate("Balas komentar")}
                containerClassName={cn("justify-center rounded-sm px-0 py-1", focusRing)}
                onPress={() => onReply(comment)}
              >
                <Text variant="caption" tone="secondary" weight={500}>
                  {translate("Balas")}
                </Text>
              </PressableScale>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  )
}
