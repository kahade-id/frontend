/**
 * Kahade — <QaThread>: utas balasan Tanya Jawab profil ala Threads.
 *
 * Presentasi saja. Susunan pohon, batas indentasi, dan aturan collapse ada di
 * lib/qa-thread.ts (murni, diuji unit). Komponen ini hanya menggambar:
 *   - kontrol urutan "Teratas" | "Terbaru" (di atas, bila ada >1 balasan);
 *   - tiap balasan lewat <QaCommentItem> dengan Balas / Hapus / Sembunyikan;
 *   - anak balasan di bawah induknya, ber-indent per level (maks. 2 level);
 *   - di kedalaman collapse, anak disembunyikan di balik "Tampilkan N balasan".
 *
 * Keputusan non-obvious:
 *   - Keadaan buka/tutup collapse disimpan di komponen induk per node
 *     (`Set` id), BUKAN di setiap item: kalau disimpan lokal, daftar yang
 *     di-refresh (tiap kirim balasan, daftar diambil ulang) akan menutup
 *     kembali cabang yang baru saja dibuka pengguna.
 *   - Garis konektor (`hasNext`) hanya digambar bila cabang terbuka — garis ke
 *     anak yang tersembunyi akan menunjuk ke ruang kosong.
 *   - Hak aksi tetap milik pemanggil: `isMine` (Hapus), `onHide` (Sembunyikan
 *     oleh pemilik profil). Komponen tidak tahu sesi.
 */
import { useCallback, useMemo, useState } from "react"
import { Pressable, View } from "react-native"

import type { QuestionComment } from "@/lib/api/users"
import { formatNumber } from "@/lib/format"
import { translate, useLanguage } from "@/lib/i18n"
import {
  countThread,
  indentLevel,
  startsCollapsed,
  type ThreadNode,
  type ThreadSort,
} from "@/lib/qa-thread"
import { TEXT_ROW_HIT_SLOP } from "@/lib/hit-slop"

import { Chip } from "@/components/ui/chip"
import { QaCommentItem } from "@/components/ui/qa-comment-item"
import { Text } from "@/components/ui/text"

/** Lebar satu level indent = kolom teks balasan induk (avatar sm 32 + gap 12). */
const INDENT_STEP = 44

export type QaThreadProps = {
  nodes: ThreadNode[]
  sort: ThreadSort
  onSortChange: (sort: ThreadSort) => void
  /** Balasan milik viewer — tombol Hapus hanya untuk ini. */
  isMine: (c: QuestionComment) => boolean
  /** Viewer = pemilik profil: boleh menyembunyikan balasan orang lain. */
  canHide?: boolean
  onHide?: (c: QuestionComment) => void
  onReply: (c: QuestionComment) => void
  onDelete: (c: QuestionComment) => void
  /** Id induk balasan yang sedang dibalas — dipakai pemanggil untuk menyorot. */
  replyingToId?: string | null
}

function useSortLabels(): { value: ThreadSort; label: string }[] {
  useLanguage()
  return [
    { value: "top", label: translate("Teratas") },
    { value: "newest", label: translate("Terbaru") },
  ]
}

function displayName(c: QuestionComment): string {
  return c.authorName ?? c.authorUsername ?? translate("Pengguna")
}

export function QaThread(props: QaThreadProps) {
  const { nodes, sort, onSortChange } = props
  const sortOptions = useSortLabels()
  const total = useMemo(() => countThread(nodes), [nodes])

  return (
    <View className="gap-1">
      {total > 1 ? (
        <View className="flex-row flex-wrap items-center gap-2 pb-2">
          {sortOptions.map((o) => (
            <Chip
              key={o.value}
              selected={sort === o.value}
              accessibilityState={{ selected: sort === o.value }}
              onPress={() => onSortChange(o.value)}
            >
              {o.label}
            </Chip>
          ))}
        </View>
      ) : null}
      <ThreadBranch {...props} />
    </View>
  )
}

type BranchProps = Omit<QaThreadProps, "nodes" | "sort" | "onSortChange"> & {
  nodes: ThreadNode[]
}

/**
 * Keadaan buka/tutup dikelola di satu tempat (ThreadBranch akar) dan diteruskan
 * ke bawah lewat `OpenState`, supaya semua cabang berbagi satu sumber kebenaran.
 */
type OpenState = { open: Set<string>; toggle: (id: string) => void }

function ThreadBranch(props: BranchProps) {
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const toggle = useCallback((id: string) => {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])
  return <Branch nodes={props.nodes} shared={props} state={{ open, toggle }} />
}

function Branch({
  nodes,
  shared,
  state,
}: {
  nodes: ThreadNode[]
  shared: BranchProps
  state: OpenState
}) {
  return (
    <>
      {nodes.map((node) => (
        <ThreadItem key={node.comment.id} node={node} shared={shared} state={state} />
      ))}
    </>
  )
}

function ThreadItem({
  node,
  shared,
  state,
}: {
  node: ThreadNode
  shared: BranchProps
  state: OpenState
}) {
  const c = node.comment
  const hasChildren = node.children.length > 0
  // Node collapse: terbuka bila pengguna sudah membukanya; default tertutup
  // bila kedalamannya melewati ambang. Node biasa selalu terbuka.
  const collapsible = startsCollapsed(node)
  const expanded = collapsible ? state.open.has(c.id) : true
  const showChildren = hasChildren && expanded
  const level = indentLevel(node.depth)
  const isOwnerComment = c.isOwner === true
  const canHide = shared.canHide === true && !c.isOwner && !c.deleted

  return (
    <View style={{ paddingLeft: level * INDENT_STEP }}>
      <QaCommentItem
        authorName={displayName(c)}
        isOwner={isOwnerComment}
        content={c.content}
        createdAt={c.createdAt}
        deleted={c.deleted}
        hasNext={showChildren}
        helpfulCount={c.upvoteCount ?? undefined}
        onReply={c.deleted ? undefined : () => shared.onReply(c)}
        onDelete={shared.isMine(c) && !c.deleted ? () => shared.onDelete(c) : undefined}
        extra={
          canHide && shared.onHide ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={translate("Sembunyikan")}
              hitSlop={TEXT_ROW_HIT_SLOP}
              onPress={() => shared.onHide?.(c)}
            >
              <Text variant="caption" weight={600} tone="secondary">
                {translate("Sembunyikan")}
              </Text>
            </Pressable>
          ) : undefined
        }
      />

      {hasChildren && collapsible && !expanded ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={translate("Tampilkan {x} balasan", { x: formatNumber(node.descendantCount) })}
          hitSlop={TEXT_ROW_HIT_SLOP}
          onPress={() => state.toggle(c.id)}
          style={{ paddingLeft: INDENT_STEP }}
          className="pb-3"
        >
          <Text variant="caption" weight={600} tone="accent">
            {translate("Tampilkan {x} balasan", { x: formatNumber(node.descendantCount) })}
          </Text>
        </Pressable>
      ) : null}

      {showChildren ? (
        <>
          {collapsible ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={translate("Sembunyikan balasan")}
              hitSlop={TEXT_ROW_HIT_SLOP}
              onPress={() => state.toggle(c.id)}
              style={{ paddingLeft: INDENT_STEP }}
              className="pb-2"
            >
              <Text variant="caption" weight={600} tone="secondary">
                {translate("Sembunyikan balasan")}
              </Text>
            </Pressable>
          ) : null}
          <Branch nodes={node.children} shared={shared} state={state} />
        </>
      ) : null}
    </View>
  )
}
