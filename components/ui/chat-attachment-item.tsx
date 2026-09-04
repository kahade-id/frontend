/**
 * Kahade — <ChatAttachmentItem> lampiran chat: chip di composer, kartu kecil
 * di bubble, dan baris di daftar "Media & berkas" (§9.17 List Item, §7 ikon,
 * §13 format ukuran).
 *
 * Bentuk data = ChatAttachmentDto (`POST /v1/chat/rooms/{roomId}/messages`,
 * hasil `POST .../upload`, daftar `GET .../attachments`): fileName, fileUrl,
 * mimeType, fileSize (≤10MB), thumbnailUrl opsional.
 *
 * Tiga `layout`:
 *   "chip"  — 40px tinggi, untuk antrean lampiran di atas composer; punya X
 *   "tile"  — kotak 72px (thumbnail atau ikon) untuk grid di dalam bubble
 *   "row"   — baris ListItem 56px untuk halaman lampiran ruang chat
 *
 * Keputusan non-obvious:
 *   - Gambar (mimeType image/*) menampilkan thumbnail asli; tipe lain memakai
 *     ikon Phosphor per keluarga MIME (PDF, dokumen, arsip, lainnya) dalam
 *     <IconBox surface>. Tidak ada warna per tipe file — kategori bukan status
 *     (§2.3), semua monokrom.
 *   - Progress upload (`progress` 0–1) digambar sebagai garis 2px di dasar
 *     chip/tile memakai <ProgressBar>, bukan overlay spinner: spinner menutup
 *     thumbnail dan tidak memberi tahu "sudah berapa persen".
 *   - Status "error" mengganti ikon dengan Warning tone danger + tombol
 *     ulang (`onRetry`); nama file tetap tampil supaya user tahu file mana
 *     yang gagal.
 *   - Ukuran file ditulis `formatFileSize` (§13) di baris meta; untuk chip
 *     disembunyikan (ruang sempit) kecuali status error.
 */
import { File, FileArchive, FilePdf, FileText, Image as ImageIcon, Warning, X } from "phosphor-react-native"
import { Pressable, View, type ViewProps } from "react-native"

import { Icon, type IconComponent } from "@/components/ui/icon"
import { IconBox } from "@/components/ui/icon-box"
import { ListItem, type ListItemProps } from "@/components/ui/list-item"
import { Picture } from "@/components/ui/picture"
import { PressableScale } from "@/components/ui/pressable-scale"
import { ProgressBar } from "@/components/ui/progress-bar"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { formatFileSize } from "@/lib/format"
import { tokens } from "@/lib/tokens"

export type ChatAttachment = {
  fileName: string
  fileUrl: string
  mimeType: string
  fileSize: number
  thumbnailUrl?: string
}

export type ChatAttachmentStatus = "idle" | "uploading" | "error"
export type ChatAttachmentLayout = "chip" | "tile" | "row"

export function isImageAttachment(a: Pick<ChatAttachment, "mimeType">): boolean {
  return a.mimeType.startsWith("image/")
}

export function attachmentIcon(mimeType: string): IconComponent {
  if (mimeType.startsWith("image/")) return ImageIcon
  if (mimeType === "application/pdf") return FilePdf
  if (/zip|rar|7z|tar|gzip/.test(mimeType)) return FileArchive
  if (/text|word|document|sheet|excel|presentation/.test(mimeType)) return FileText
  return File
}

export type ChatAttachmentItemLabels = {
  remove: string
  retry: string
  failed: string
  uploading: string
}

const DEFAULT_LABELS: ChatAttachmentItemLabels = {
  remove: "Hapus lampiran",
  retry: "Coba lagi",
  failed: "Gagal diunggah",
  uploading: "Mengunggah",
}

export type ChatAttachmentItemProps = Omit<ViewProps, "children"> & {
  attachment: ChatAttachment
  layout?: ChatAttachmentLayout
  status?: ChatAttachmentStatus
  /** 0–1, hanya dipakai saat status "uploading" */
  progress?: number
  onPress?: () => void
  /** Hanya chip: tombol X */
  onRemove?: () => void
  onRetry?: () => void
  /** Hanya row: teks meta tambahan (pengirim · waktu) */
  meta?: string
  divider?: ListItemProps["divider"]
  labels?: Partial<ChatAttachmentItemLabels>
  className?: string
}

const TILE = 72

export function ChatAttachmentItem({
  attachment,
  layout = "chip",
  status = "idle",
  progress,
  onPress,
  onRemove,
  onRetry,
  meta,
  divider,
  labels,
  className,
  ...rest
}: ChatAttachmentItemProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const image = isImageAttachment(attachment)
  const icon = attachmentIcon(attachment.mimeType)
  const errored = status === "error"
  const uploading = status === "uploading"
  const thumb = attachment.thumbnailUrl ?? (image ? attachment.fileUrl : undefined)

  const a11y = [
    attachment.fileName,
    formatFileSize(attachment.fileSize),
    errored ? t.failed : uploading ? t.uploading : undefined,
  ]
    .filter(Boolean)
    .join(", ")

  if (layout === "row") {
    return (
      <ListItem
        title={attachment.fileName}
        subtitle={[formatFileSize(attachment.fileSize), meta].filter(Boolean).join(" · ")}
        leading={
          thumb ? (
            <Picture source={thumb} alt="" width={40} height={40} radius="xs" bordered />
          ) : (
            <IconBox icon={icon} size="md" variant={errored ? "danger" : "surface"} />
          )
        }
        chevron={!!onPress}
        onPress={onPress}
        divider={divider}
        inset
        accessibilityLabel={a11y}
        {...rest}
      />
    )
  }

  if (layout === "tile") {
    return (
      <PressableScale
        scaleOnPress={false}
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? "button" : undefined}
        accessibilityLabel={a11y}
        className={cn(
          "overflow-hidden rounded-sm border border-border bg-surface",
          errored && "border-border-error",
          className,
        )}
        {...rest}
      >
        <View style={{ width: TILE, height: TILE }} className="items-center justify-center">
          {thumb && !errored ? (
            <Picture source={thumb} alt="" width={TILE} height={TILE} radius="none" />
          ) : (
            <Icon icon={errored ? Warning : icon} size="lg" tone={errored ? "danger" : "default"} />
          )}
          {!thumb ? (
            <Text variant="caption" tone="tertiary" numberOfLines={1} className="absolute bottom-1 left-1 right-1 text-center">
              {attachment.fileName.split(".").pop()?.toUpperCase()}
            </Text>
          ) : null}
        </View>
        {uploading ? <ProgressBar value={Math.round((progress ?? 0) * 100)} size="sm" className="absolute bottom-0 left-0 right-0" /> : null}
      </PressableScale>
    )
  }

  // chip
  return (
    <View
      accessible
      accessibilityLabel={a11y}
      className={cn(
        "relative h-10 max-w-[220px] flex-row items-center gap-2 overflow-hidden rounded-sm border border-border bg-surface pl-2 pr-1",
        errored && "border-border-error",
        className,
      )}
      {...rest}
    >
      {thumb && !errored ? (
        <Picture source={thumb} alt="" width={24} height={24} radius="xs" />
      ) : (
        <Icon icon={errored ? Warning : icon} size="sm" tone={errored ? "danger" : "default"} />
      )}
      <View className="flex-1">
        <Text variant="caption" weight={500} tone="primary" numberOfLines={1}>
          {attachment.fileName}
        </Text>
        {errored ? (
          <Text variant="caption" tone="danger" numberOfLines={1}>
            {t.failed}
          </Text>
        ) : null}
      </View>
      {errored && onRetry ? (
        <Pressable onPress={onRetry} hitSlop={tokens.space[2]} accessibilityRole="button" accessibilityLabel={t.retry}>
          <Text variant="caption" weight={600} tone="primary" className="px-1 underline">
            {t.retry}
          </Text>
        </Pressable>
      ) : null}
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          hitSlop={tokens.space[2]}
          accessibilityRole="button"
          accessibilityLabel={t.remove}
          className="h-8 w-8 items-center justify-center"
        >
          <Icon icon={X} size="xs" />
        </Pressable>
      ) : null}
      {uploading ? <ProgressBar value={Math.round((progress ?? 0) * 100)} size="sm" className="absolute bottom-0 left-0 right-0" /> : null}
    </View>
  )
}
