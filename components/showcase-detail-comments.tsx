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
import { useState } from "react"
import { View, type ViewInstance } from "react-native"
import type { ReactNode, Ref } from "react"

import type { ShowcaseComment, ShowcaseCommentWithReplies } from "@/lib/api/showcase"
import { translate } from "@/lib/i18n/translate"
import { type ShowcaseCommentOrder } from "@/lib/showcase-social"
import { Divider } from "@/components/ui/divider"
import { LoadMore, type LoadMoreStatus } from "@/components/ui/load-more"
import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { Text } from "@/components/ui/text"
import { CommentRepliesToggle, ShowcaseCommentRow } from "@/components/ui/showcase-comment-row"

export type ShowcaseDetailCommentsProps = {
  /** Komposer komentar berada di utas, bukan di footer CTA pembelian. */
  composer?: ReactNode
  comments: ShowcaseCommentWithReplies[]
  commentTotal: number
  commentsStatus: LoadMoreStatus
  commentRenderLimit: number
  /** L-06: id komentar yang disorot dari deep link `?comment=`. */
  highlightComment?: string
  /**
   * C14 (batch 139): id komentar yang difokuskan (scroll otomatis).
   * Biasanya sama dengan `highlightComment` saat datang dari deep link.
   */
  focusCommentId?: string
  /**
   * C14: ref dipasang pada pembungkus baris target — induk mengukur
   * posisinya untuk scroll. `collapsable={false}` supaya terukur di Android.
   */
  focusRowRef?: Ref<ViewInstance>
  isOwner: boolean
  hasSession: boolean
  isMine: (comment: ShowcaseComment) => boolean
  canReply: (comment: ShowcaseComment) => boolean
  onReply: (comment: ShowcaseComment) => void
  onOpenMenu: (comment: ShowcaseComment) => void
  onShowMore: () => void
  onLoadMore: () => void
  /**
   * BFE-114 (fix 2026-10-03): urutan komentar diurutkan SERVER via
   * ?sort=newest|oldest (lihat listShowcaseComments). Komponen ini murni
   * presentasi — TIDAK me-sort sisi klien. Induk WAJIB me-refetch dengan
   * `sort` yang sesuai saat `onCommentOrderChange` dipanggil, lalu
   * meneruskan `commentOrder` yang sama ke sini.
   */
  commentOrder?: ShowcaseCommentOrder
  onCommentOrderChange?: (order: ShowcaseCommentOrder) => void
}

/**
 * U-02 (audit 2026-09-24): dulu SEMUA balasan setiap komentar root dirender
 * sekaligus (`root.replies.map`) — utas populer bisa menumpahkan ratusan baris
 * ke satu layar tanpa bisa dilipat. Sekarang balasan diringkas dulu (3 baris)
 * dengan tombol "Lihat {x} balasan"; root yang disorot deep link otomatis
 * dibuka supaya `?comment=<id>` tetap menemukan barisnya.
 */
const REPLY_PREVIEW = 3

/** Sorotan baris yang dituju deep link `?comment=`. */
const HIGHLIGHT_ROW = "rounded-md bg-surface-elevated px-2 py-2"

export function ShowcaseDetailComments({
  composer,
  comments,
  // commentTotal tetap di props (dipakai pemanggil) tapi tidak ditampilkan
  // di judul lagi (2026-10-05: count sudah ada di samping ikon).
  commentsStatus,
  commentRenderLimit,
  highlightComment,
  focusCommentId,
  focusRowRef,
  isOwner,
  hasSession,
  isMine,
  canReply,
  onReply,
  onOpenMenu,
  onShowMore,
  onLoadMore,
  commentOrder: commentOrderProp,
  onCommentOrderChange,
}: ShowcaseDetailCommentsProps) {
  /** Root yang balasannya dibuka penuh (default: ringkas 3 baris). */
  const [expandedReplies, setExpandedReplies] = useState<ReadonlySet<string>>(new Set())
  /**
   * Item 160 (FE-IMP-1): urutan komentar — Terbaru / Terlama.
   * BFE-114: pilihan user dikirim ke SERVER (?sort=) oleh induk; komponen
   * ini hanya menampilkan `comments` sesuai urutan datangnya (tanpa sort
   * klien). Fallback internal agar chip tetap berfungsi bila induk belum
   * memasang onCommentOrderChange — induk yang benar WAJIB me-refetch.
   */
  const [internalOrder, setInternalOrder] = useState<ShowcaseCommentOrder>("newest")
  const commentOrder = commentOrderProp ?? internalOrder
  const handleOrderChange = (order: ShowcaseCommentOrder) => {
    if (onCommentOrderChange) onCommentOrderChange(order)
    else setInternalOrder(order)
  }
  const toggleReplies = (rootId: string) =>
    setExpandedReplies((current) => {
      const next = new Set(current)
      if (next.has(rootId)) next.delete(rootId)
      else next.add(rootId)
      return next
    })

  return (
    <>
      {/* ── Komentar header (2026-10-05: count dihapus dari judul — sudah ada di samping ikon) ── */}
      <View className="gap-0 px-5 pb-0 pt-8">
        <View className="flex-row items-center gap-2">
          {/* UI-F011: header ikut kamus (sebelumnya hardcoded). */}
          <Text variant="h3" accessibilityRole="header">{translate("Komentar")}</Text>
          {/* Item 160: kontrol urutan — hanya bila ada ≥2 komentar.
              T2-F08: boleh wrap agar chip "Terbaru"/"Terlama" tidak terpotong
              di layar sempit (320pt). */}
          {comments.length >= 2 ? (
            <View className="ml-auto flex-row flex-wrap items-center justify-end gap-1.5">
              <Chip
                selected={commentOrder === "newest"}
                accessibilityState={{ selected: commentOrder === "newest" }}
                accessibilityLabel={translate("Urutkan komentar terbaru dulu")}
                onPress={() => handleOrderChange("newest")}
              >
                {translate("Terbaru")}
              </Chip>
              <Chip
                selected={commentOrder === "oldest"}
                accessibilityState={{ selected: commentOrder === "oldest" }}
                accessibilityLabel={translate("Urutkan komentar terlama dulu")}
                onPress={() => handleOrderChange("oldest")}
              >
                {translate("Terlama")}
              </Chip>
            </View>
          ) : null}
        </View>
        <Divider className="mt-3" />
      </View>

      {composer ? <View className="px-5 pt-3">{composer}</View> : null}

      {/* Polish 2026-10-02: gap antar komentar 20px (ala YouTube). */}
      <View className="gap-5 px-5 pb-6 pt-4">
        {/* F-06: status "loading" di awal — tanpa kilatan kosong/tombol. */}
        {comments.length === 0 && commentsStatus !== "loading" && commentsStatus !== "error" ? (
          <Text variant="body" tone="secondary">
            {translate("Belum ada komentar. Jadilah yang pertama!")}
          </Text>
        ) : null}
        {comments.slice(0, commentRenderLimit).map((root) => {
          const replies = root.replies ?? []
          // Deep link ke balasan yang terlipat harus tetap terlihat.
          const deepLinkInside = replies.some((reply) => reply.id === highlightComment)
          const expanded = expandedReplies.has(root.id) || deepLinkInside
          const visibleReplies = expanded ? replies : replies.slice(0, REPLY_PREVIEW)
          // BFE-118: total balasan dari server (replyCount) — replies[]
          // inline dibatasi backend, jadi label toggle memakai total agar
          // tidak undercount pada utas panjang.
          const totalReplies = Math.max(root.replyCount ?? 0, replies.length)
          const hiddenCount = Math.max(0, totalReplies - visibleReplies.length)
          return (
            // C14: baris target deep link dibungkus untuk pengukuran posisi
            // scroll (collapsable=false agar terukur di Android).
            <View
              key={root.id}
              ref={root.id === focusCommentId ? focusRowRef : undefined}
              collapsable={false}
            >
              <ShowcaseCommentRow
                comment={root}
                // L-06: sorot baris yang dituju deep link.
                className={root.id === highlightComment ? HIGHLIGHT_ROW : undefined}
                isMine={isMine(root)}
                canReply={canReply(root)}
                menuable={isMine(root) || isOwner || (!root.isHidden && hasSession)}
                onReply={onReply}
                onOpenMenu={onOpenMenu}
                /*
                  Balasan dikirim sebagai ANAK, bukan saudara (revisi
                  2026-09-26): dengan begitu garis utas di kolom avatar
                  komentar induk turun terus sampai balasan terakhir, dan
                  indentasinya otomatis sejajar dengan teks induk — bukan
                  angka ml-8 yang harus dirawat terpisah.
                */
                threaded={visibleReplies.length > 0}
              >
                {visibleReplies.map((reply) => {
                  const row = (
                    <ShowcaseCommentRow
                      key={reply.id}
                      comment={reply}
                      avatarSize="xs"
                      className={reply.id === highlightComment ? HIGHLIGHT_ROW : undefined}
                      isMine={isMine(reply)}
                      canReply={false}
                      menuable={isMine(reply) || isOwner || (!reply.isHidden && hasSession)}
                      onReply={onReply}
                      onOpenMenu={onOpenMenu}
                    />
                  )
                  // C14: hanya balasan target yang dibungkus (pengukuran
                  // posisi); sisanya dirender persis seperti sebelumnya.
                  if (reply.id !== focusCommentId) return row
                  return (
                    <View key={reply.id} ref={focusRowRef} collapsable={false}>
                      {row}
                    </View>
                  )
                })}
                {/* U-02: lipatan utas — jangan tumpahkan semua balasan. */}
                {replies.length > REPLY_PREVIEW && !deepLinkInside ? (
                  <CommentRepliesToggle
                    expanded={expanded}
                    hiddenCount={hiddenCount}
                    onPress={() => toggleReplies(root.id)}
                  />
                ) : null}
              </ShowcaseCommentRow>
            </View>
          )
        })}
        {comments.length > commentRenderLimit ? (
          <Button variant="ghost" fullWidth onPress={onShowMore}>
            {translate("Tampilkan komentar lainnya")}
          </Button>
        ) : null}
        {/* F-07: halaman baru ditambahkan DI BAWAH → tombolnya di bawah. */}
        <LoadMore status={commentsStatus} onLoadMore={onLoadMore} hideEnd idleLabel={translate("Muat komentar berikutnya")} />
      </View>
    </>
  )
}
