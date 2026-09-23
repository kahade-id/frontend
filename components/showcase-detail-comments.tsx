/**
 * Kahade — <ShowcaseDetailComments>: header hitungan + utas komentar detail.
 *
 * Diekstrak dari app/showcase/[id].tsx (G-11/S9: god component hanya boleh
 * menyusut). Semua interaksinya milik induk lewat callback — komponen ini
 * murni presentasi utas (root + balasan satu tingkat).
 *
 * L-06 (audit 2026-09-23): deep link `?comment=<id>` menyorot baris yang
 * dituju lewat `className` (prop yang sudah terdokumentasi di
 * <ShowcaseCommentRow>).
 */
import { View } from "react-native"

import type { ShowcaseComment, ShowcaseCommentWithReplies } from "@/lib/api/showcase"
import { formatNumber } from "@/lib/format"
import { Divider } from "@/components/ui/divider"
import { LoadMore, type LoadMoreStatus } from "@/components/ui/load-more"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"
import { ShowcaseCommentRow } from "@/components/ui/showcase-comment-row"

export type ShowcaseDetailCommentsProps = {
  comments: ShowcaseCommentWithReplies[]
  commentTotal: number
  commentsStatus: LoadMoreStatus
  commentRenderLimit: number
  /** L-06: id komentar yang disorot dari deep link `?comment=`. */
  highlightComment?: string
  isOwner: boolean
  hasSession: boolean
  isMine: (comment: ShowcaseComment) => boolean
  canReply: (comment: ShowcaseComment) => boolean
  onReply: (comment: ShowcaseComment) => void
  onOpenMenu: (comment: ShowcaseComment) => void
  onShowMore: () => void
  onLoadMore: () => void
}

export function ShowcaseDetailComments({
  comments,
  commentTotal,
  commentsStatus,
  commentRenderLimit,
  highlightComment,
  isOwner,
  hasSession,
  isMine,
  canReply,
  onReply,
  onOpenMenu,
  onShowMore,
  onLoadMore,
}: ShowcaseDetailCommentsProps) {
  return (
    <>
      {/* ── Komentar header: count di samping + separator ── */}
      <View className="gap-0 px-5 pb-0 pt-8">
        <View className="flex-row items-baseline gap-2">
          <Text variant="h3">Komentar</Text>
          {commentTotal > 0 ? (
            <Text variant="body" tone="secondary" className="tabular-nums">
              {formatNumber(commentTotal)}
            </Text>
          ) : null}
        </View>
        <Divider className="mt-3" />
      </View>

      <View className="gap-4 px-5 pb-6 pt-4">
        {/* F-06: status "loading" di awal — tanpa kilatan kosong/tombol. */}
        {comments.length === 0 && commentsStatus !== "loading" && commentsStatus !== "error" ? (
          <Text variant="body" tone="secondary">
            Belum ada komentar. Jadilah yang pertama!
          </Text>
        ) : null}
        {comments.slice(0, commentRenderLimit).map((root) => (
          <View key={root.id} className="gap-4">
            <ShowcaseCommentRow
              comment={root}
              // L-06: sorot baris yang dituju deep link.
              className={root.id === highlightComment ? "rounded-md bg-surface-elevated px-2 py-2" : undefined}
              isMine={isMine(root)}
              canReply={canReply(root)}
              menuable={isMine(root) || isOwner || (!root.isHidden && hasSession)}
              onReply={onReply}
              onOpenMenu={onOpenMenu}
            />
            {(root.replies ?? []).map((reply) => (
              <View key={reply.id} className="ml-8">
                <ShowcaseCommentRow
                  comment={reply}
                  className={reply.id === highlightComment ? "rounded-md bg-surface-elevated px-2 py-2" : undefined}
                  isMine={isMine(reply)}
                  canReply={false}
                  menuable={isMine(reply) || isOwner || (!reply.isHidden && hasSession)}
                  onReply={onReply}
                  onOpenMenu={onOpenMenu}
                />
              </View>
            ))}
          </View>
        ))}
        {comments.length > commentRenderLimit ? (
          <Button variant="ghost" fullWidth onPress={onShowMore}>
            Tampilkan komentar lainnya
          </Button>
        ) : null}
        {/* F-07: halaman baru ditambahkan DI BAWAH → tombolnya di bawah. */}
        <LoadMore status={commentsStatus} onLoadMore={onLoadMore} hideEnd idleLabel="Muat komentar berikutnya" />
      </View>
    </>
  )
}
