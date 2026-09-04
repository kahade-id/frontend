/**
 * Kahade — <DisputeEvidenceItem> satu entri bukti sengketa (§9.6 Card,
 * §9.19 batasan berkas, §13 format, §10 konfirmasi destruktif = Dialog).
 *
 * Untuk `GET /v1/disputes/{id}/evidence` (paginated) dan hasil
 * `POST /v1/disputes/{id}/evidence` (batch, validasi per berkas). Satu entri
 * = satu pengunggahan: siapa yang mengunggah, kapan, deskripsi, dan N berkas
 * (foto thumbnail 1:1 grid 3 kolom, PDF sebagai baris ikon).
 *
 * Keputusan non-obvious:
 *   - Pihak pengunggah ditandai `party` ("Anda" / nama lawan / "Kahade")
 *     dengan Badge outline, BUKAN warna berbeda per pihak: bukti adalah
 *     fakta netral — pewarnaan memihak akan bertentangan dengan posisi
 *     Kahade sebagai penengah (§1).
 *   - Tombol hapus hanya untuk bukti milik sendiri (`own`) dan hanya bila
 *     `onDelete` diberikan (server: DELETE .../evidence/{evidenceId} hanya
 *     own). IconButton ghost Trash — pemanggil WAJIB Dialog konfirmasi (§10).
 *   - Per-file `error` (validasi server per berkas) dirender inline di bawah
 *     berkas terkait, bukan Alert global: batch bisa sebagian berhasil,
 *     user harus tahu berkas MANA yang ditolak.
 *   - Thumbnail memakai <Picture radius="sm" bordered>; tap -> `onOpenFile(i)`
 *     agar pemanggil membuka viewer (Push §10), komponen tidak menyimpan
 *     state zoom sendiri.
 */
import { FilePdf, Trash } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Badge } from "@/components/ui/badge"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { Picture } from "@/components/ui/picture"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { formatFileSize } from "@/lib/format"

export type DisputeEvidenceFile = {
  id: string
  uri: string
  /** MIME dari `fileTypes`, mis. "image/jpeg" | "application/pdf" */
  mimeType: string
  name?: string
  size?: number
  /** Pesan validasi per berkas dari server */
  error?: string
}

export type DisputeEvidenceItemLabels = {
  you: string
  kahade: string
  delete: string
  openFile: (i: number, total: number) => string
}

const DEFAULT_LABELS: DisputeEvidenceItemLabels = {
  you: "Anda",
  kahade: "Kahade",
  delete: "Hapus bukti",
  openFile: (i, total) => `Buka berkas ${i + 1} dari ${total}`,
}

export type DisputeEvidenceItemProps = Omit<ViewProps, "children"> & {
  /** Nama pengunggah; diabaikan bila `own` atau `fromKahade` */
  uploaderName?: string
  own?: boolean
  fromKahade?: boolean
  description?: string
  files: DisputeEvidenceFile[]
  /** Sudah diformat (§13) */
  uploadedAt?: string
  onOpenFile?: (index: number) => void
  /** Hanya berlaku bila `own` */
  onDelete?: () => void
  deleting?: boolean
  labels?: Partial<DisputeEvidenceItemLabels>
  className?: string
}

function isImage(mime: string) {
  return mime.startsWith("image/")
}

export function DisputeEvidenceItem({
  uploaderName,
  own = false,
  fromKahade = false,
  description,
  files,
  uploadedAt,
  onOpenFile,
  onDelete,
  deleting = false,
  labels,
  className,
  ...rest
}: DisputeEvidenceItemProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const who = own ? t.you : fromKahade ? t.kahade : uploaderName ?? ""
  const images = files.filter((f) => isImage(f.mimeType))
  const docs = files.filter((f) => !isImage(f.mimeType))

  return (
    <View className={cn("w-full gap-3 rounded-md border border-border bg-surface p-4", className)} {...rest}>
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 flex-row items-center gap-2">
          <Badge variant={own ? "soft" : "outline"} tone="neutral">
            {who}
          </Badge>
          {uploadedAt ? (
            <Text variant="caption" tone="tertiary" numberOfLines={1} className="tabular-nums">
              {uploadedAt}
            </Text>
          ) : null}
        </View>
        {own && onDelete ? (
          <IconButton
            icon={Trash}
            variant="ghost"
            size="sm"
            accessibilityLabel={t.delete}
            onPress={onDelete}
            loading={deleting}
          />
        ) : null}
      </View>

      {description ? (
        <Text variant="body" tone="primary">
          {description}
        </Text>
      ) : null}

      {images.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {images.map((f) => {
            const index = files.indexOf(f)
            return (
              <View key={f.id} className="w-[31%] gap-1">
                <PressableScale
                  accessibilityRole="imagebutton"
                  accessibilityLabel={t.openFile(index, files.length)}
                  onPress={onOpenFile ? () => onOpenFile(index) : undefined}
                  disabled={!onOpenFile}
                  className={cn(f.error && "border-error rounded-sm border-border-error")}
                >
                  <Picture source={f.uri} alt={f.name ?? ""} aspectRatio={1} radius="sm" bordered />
                </PressableScale>
                {f.error ? (
                  <Text variant="caption" tone="danger" numberOfLines={2}>
                    {f.error}
                  </Text>
                ) : null}
              </View>
            )
          })}
        </View>
      ) : null}

      {docs.map((f) => {
        const index = files.indexOf(f)
        return (
          <PressableScale
            key={f.id}
            scaleOnPress={false}
            accessibilityRole="button"
            accessibilityLabel={t.openFile(index, files.length)}
            onPress={onOpenFile ? () => onOpenFile(index) : undefined}
            disabled={!onOpenFile}
            className={cn(
              "flex-row items-center gap-3 rounded-sm border bg-surface-elevated px-3 py-2",
              f.error ? "border-border-error" : "border-border",
            )}
          >
            <Icon icon={FilePdf} size="sm" />
            <View className="flex-1 gap-[2px]">
              <Text variant="caption" weight={500} tone="primary" numberOfLines={1}>
                {f.name ?? "Dokumen"}
              </Text>
              {f.error ? (
                <Text variant="caption" tone="danger" numberOfLines={2}>
                  {f.error}
                </Text>
              ) : f.size != null ? (
                <Text variant="caption" tone="tertiary" className="font-mono-500 tracking-mono">
                  {formatFileSize(f.size)}
                </Text>
              ) : null}
            </View>
          </PressableScale>
        )
      })}
    </View>
  )
}
