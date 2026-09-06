/**
 * Kahade — <EvidenceGrid> + <EvidenceTile> (§9.19 Dokumen viewer, §5 radius
 * gambar sm, §7 ikon berkas, §13 format ukuran/tanggal).
 *
 * Grid bukti sengketa dari `GET /v1/disputes/{id}/evidence` (jpeg/png/webp/pdf
 * sesuai `SubmitEvidenceDto.fileTypes`). Tiap ubin: thumbnail (gambar) atau
 * ikon FilePdf di atas bg-surface, label pengunggah kecil, tombol hapus untuk
 * bukti MILIK SENDIRI (`DELETE .../evidence/{evidenceId}`).
 *
 * Keputusan non-obvious:
 *   - 3 kolom persegi (rasio 1) — bukti biasanya screenshot chat/foto paket;
 *     persegi + `cover` cukup untuk mengenali berkas, tap membuka viewer penuh
 *     (`onOpen`). Berbeda dari KycDocumentViewer yang `contain` karena di
 *     sana seluruh tepi dokumen harus terlihat.
 *   - Pembeda "bukti saya" vs "bukti lawan": chip kecil di pojok kiri bawah
 *     (bg-primary + primary-foreground untuk "Anda", bg-surface-elevated +
 *     border untuk nama lawan). Bukan warna semantik — kepemilikan bukan
 *     status (§2.3).
 *   - Tombol hapus (X) hanya untuk milik sendiri DAN `canDelete` (sengketa
 *     masih aktif): pemanggil yang tahu aturan bisnisnya. Hit area 32px di
 *     pojok kanan atas, IconButton `secondary` di atas thumbnail agar kontras
 *     terjamin di foto terang/gelap.
 *   - Deskripsi bukti tidak dirender di ubin (terlalu kecil); ditampilkan
 *     oleh viewer penuh. Ubin hanya perlu identitas visual + siapa.
 *   - Ubin "Tambah bukti" (`onAdd`) adalah ubin pertama bergaris putus-putus
 *     dengan ikon Plus — konsisten dengan pola UploadField.
 */
import { FilePdf, Plus, X } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { Picture } from "@/components/ui/picture"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { isImageMime } from "@/lib/mime"

export type EvidenceMime = "image/jpeg" | "image/png" | "image/webp" | "application/pdf"

export type EvidenceItem = {
  id: string
  url: string
  /** Thumbnail terpisah bila ada (untuk PDF dari server) */
  thumbnailUrl?: string
  mimeType: EvidenceMime | string
  description?: string
  /** Nama pengunggah; diabaikan bila `mine` */
  uploaderName?: string
  mine?: boolean
  /** Sudah diformat pemanggil (§13) */
  uploadedAt?: string
}

// `item.mimeType` datang mentah dari response (tanpa normalizer); penjaga
// `typeof` ada di `lib/mime`.
export function isImageEvidence(mime: string): boolean {
  return isImageMime(mime)
}

export type EvidenceGridLabels = {
  you: string
  add: string
  remove: string
  pdf: string
}

const DEFAULT_LABELS: EvidenceGridLabels = {
  you: "Anda",
  add: "Tambah bukti",
  remove: "Hapus bukti",
  pdf: "Dokumen PDF",
}

export type EvidenceTileProps = Omit<ViewProps, "children"> & {
  item: EvidenceItem
  onOpen?: (item: EvidenceItem) => void
  onRemove?: (item: EvidenceItem) => void
  /** Izinkan hapus (sengketa masih aktif) — hanya berlaku untuk `item.mine` */
  canDelete?: boolean
  labels?: Partial<EvidenceGridLabels>
  className?: string
}

export function EvidenceTile({ item, onOpen, onRemove, canDelete = false, labels, className, ...rest }: EvidenceTileProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const isImage = isImageEvidence(item.mimeType)
  const owner = item.mine ? t.you : item.uploaderName
  const showRemove = item.mine && canDelete && !!onRemove

  const a11y = [isImage ? "Foto bukti" : t.pdf, item.description, owner ? `dari ${owner}` : undefined, item.uploadedAt]
    .filter(Boolean)
    .join(", ")

  return (
    <View className={cn("relative aspect-square", className)} {...rest}>
      <PressableScale
        onPress={onOpen ? () => onOpen(item) : undefined}
        disabled={!onOpen}
        accessibilityRole="imagebutton"
        accessibilityLabel={a11y}
        accessibilityHint={onOpen ? "Buka bukti" : undefined}
        containerClassName="w-full h-full"
        className="h-full w-full overflow-hidden rounded-sm border border-border bg-surface"
      >
        {isImage || item.thumbnailUrl ? (
          <Picture source={item.thumbnailUrl ?? item.url} alt="" aspectRatio={1} radius="none" resizeMode="cover" recyclingKey={item.id} className="h-full w-full" />
        ) : (
          <View className="h-full w-full items-center justify-center gap-1">
            <Icon icon={FilePdf} size="xl" tone="default" />
            <Text variant="caption" tone="secondary">
              PDF
            </Text>
          </View>
        )}

        {owner ? (
          <View
            className={cn(
              "absolute bottom-1.5 left-1.5 max-w-[80%] rounded-xs px-1.5 py-0.5",
              item.mine ? "bg-primary" : "border border-border bg-surface-elevated",
            )}
          >
            <Text variant="caption" weight={500} tone={item.mine ? "inverse" : "secondary"} numberOfLines={1}>
              {owner}
            </Text>
          </View>
        ) : null}
      </PressableScale>

      {showRemove ? (
        <View className="absolute right-1.5 top-1.5">
          <IconButton icon={X} size="sm" variant="secondary" accessibilityLabel={t.remove} onPress={() => onRemove?.(item)} />
        </View>
      ) : null}
    </View>
  )
}

export type EvidenceGridProps = Omit<ViewProps, "children"> & {
  items: EvidenceItem[]
  onOpen?: (item: EvidenceItem) => void
  onRemove?: (item: EvidenceItem) => void
  canDelete?: boolean
  /** Tampilkan ubin "Tambah bukti" di posisi pertama */
  onAdd?: () => void
  /** Nonaktifkan ubin tambah (mis. kuota berkas habis) */
  addDisabled?: boolean
  columns?: 2 | 3
  labels?: Partial<EvidenceGridLabels>
  className?: string
}

export function EvidenceGrid({
  items,
  onOpen,
  onRemove,
  canDelete = false,
  onAdd,
  addDisabled = false,
  columns = 3,
  labels,
  className,
  ...rest
}: EvidenceGridProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  // gap-2 (8px) -> lebar ubin dihitung dari persen dikurangi gap supaya tidak
  // pecah baris di lebar layar ganjil.
  const basis = columns === 3 ? "w-[31.5%]" : "w-[48.5%]"

  return (
    <View className={cn("flex-row flex-wrap gap-2", className)} accessibilityRole="list" {...rest}>
      {onAdd ? (
        <PressableScale
          onPress={onAdd}
          disabled={addDisabled}
          accessibilityRole="button"
          accessibilityLabel={t.add}
          containerClassName={basis}
          className={cn(
            // Tile tambah = tombol tanpa fill; outline dashed-nya yang mengenali kontrol -> border-control (WCAG 1.4.11, audit #6)
            "aspect-square w-full items-center justify-center gap-1 rounded-sm border border-dashed border-border-control bg-transparent",
            addDisabled && "opacity-40",
          )}
        >
          <Icon icon={Plus} size="md" tone="active" />
          <Text variant="caption" weight={500} tone="secondary">
            {t.add}
          </Text>
        </PressableScale>
      ) : null}

      {items.map((item) => (
        <EvidenceTile key={item.id} item={item} onOpen={onOpen} onRemove={onRemove} canDelete={canDelete} labels={labels} className={basis} />
      ))}
    </View>
  )
}
