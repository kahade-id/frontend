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
import { formatDateTime } from "@/lib/format"
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
  // D-18 (audit 2026-09-23): komentar yang diedit diberi penanda — dulu
  // `updatedAt` diabaikan. C-04 (audit 2026-09-24): perbandingan memakai waktu
  // terurai dengan toleransi 1 detik, bukan kesamaan string — server yang
  // mengirim presisi berbeda (detik vs milidetik) dulu memunculkan penanda
  // "(diedit)" palsu pada komentar yang tidak pernah disunting.
  const edited = isEditedComment(comment.createdAt, comment.updatedAt)

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
            {/* D-20 (audit 2026-09-23): nama penulis bisa ditekan → profil
                (gated login untuk tamu, pola H-04). */}
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
              <Text variant="body" weight={600} numberOfLines={1}>
                {authorName}
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
          <Text variant="body" tone={hidden ? "secondary" : "primary"}>
            {hidden ? translate("(Komentar disembunyikan)") : comment.content}
          </Text>
          {/* C-03 (audit 2026-09-24): tamu tanpa sesi tidak punya menu ⋯,
              jadi baris tersembunyi tanpa `hiddenReason` dulu tampil sebagai
              kalimat misterius. Sekarang ALASAN STATIS selalu ada. */}
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
          <View className="flex-row items-center gap-4">
            <Text variant="caption" tone="secondary" className="tabular-nums">
              {formatDateTime(comment.createdAt)}
              {edited ? ` ${translate("(diedit)")}` : null}
            </Text>
            {isMine ? (
              <Text variant="caption" tone="secondary">
                {translate("Anda")}
              </Text>
            ) : null}
            {canReply && onReply ? (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={translate("Balas komentar")}
                // A-01 (audit 2026-09-24): dulu area 44px HANYA tak terlihat
                // (hitSlop `REPLY_HIT_SLOP`), jadi tidak ada petunjuk visual
                // sama sekali. Sekarang targetnya benar-benar setinggi 44px
                // (min-h-11) dan terbaca sebagai tombol kecil bergaris —
                // paritas dengan target sentuh lain di aplikasi.
                containerClassName={cn(
                  "min-h-11 justify-center rounded-sm border border-border-control px-2.5",
                  focusRing,
                )}
                onPress={() => onReply(comment)}
              >
                <Text variant="caption" tone="primary" weight={600}>
                  {translate("Balas")}
                </Text>
              </PressableScale>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  )
}
