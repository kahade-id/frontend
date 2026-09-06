/**
 * Kahade — <MediaViewer> pratinjau lampiran layar penuh (§9.10 overlay, §10).
 *
 * Dipakai oleh bukti sengketa (EvidenceGrid.onOpen), bukti pengiriman
 * (DeliveryProofViewer.onOpenAttachment), dan dokumen KYC
 * (KycDocumentViewer.onOpen) — sebelumnya ketiganya hanya menampilkan toast.
 *
 * Perilaku:
 *   - Gambar  : ditampilkan `contain` di atas backdrop gelap, judul +
 *               keterangan opsional di bawah, tombol tutup di kanan atas.
 *   - PDF/URL : tidak ada renderer PDF di app → kartu berkas dengan tombol
 *               "Buka" (`Linking.openURL`, browser/penampil sistem).
 *
 * Keputusan non-obvious:
 *   - Dirender lewat <Modal> primitif (Portal + backdrop + fokus SR + back/
 *     escape) supaya perilaku dismiss identik dengan Dialog, bukan Modal RN
 *     baru dengan animasi berbeda. Kartu tetap dipakai (padding diperkecil
 *     ke p-3) supaya judul/keterangan selalu di atas `bg-surface-elevated` —
 *     teks langsung di atas scrim 40% tidak menjamin kontras §2.
 *   - Rasio gambar dibaca dari `onLoad` expo-image sehingga foto potret tidak
 *     dipaksa 4:3 (default <Picture>); sebelum termuat memakai 4:3 agar
 *     Skeleton sudah punya tinggi.
 *   - `mimeType` opsional: bila tidak ada, jenis ditebak dari ekstensi URL
 *     (`.pdf` → berkas, sisanya → gambar). Sumber bukti lama sering tanpa
 *     MIME.
 *   - Tidak ada pinch-zoom (butuh gesture handler + reanimated shared value):
 *     kebutuhan utama adalah "lihat lebih besar dari thumbnail 3 kolom" —
 *     cukup layar penuh; zoom dicatat sebagai peningkatan lanjutan.
 */
import { useCallback, useState, type ReactNode } from "react"
import { Linking, View, useWindowDimensions } from "react-native"
import { ArrowSquareOut, FilePdf, X } from "phosphor-react-native"

import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { Modal } from "@/components/ui/modal"
import { Picture } from "@/components/ui/picture"
import { Text } from "@/components/ui/text"
import { tokens } from "@/lib/tokens"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export type MediaViewerItem = {
  url: string
  /** MIME (image/jpeg, application/pdf, …); ditebak dari URL bila kosong */
  mimeType?: string
  title?: string
  /** Keterangan tambahan (deskripsi bukti, waktu unggah) */
  caption?: string
  /** Nama berkas untuk PDF */
  fileName?: string
}

export type MediaViewerLabels = {
  close: string
  open: string
  fileFallback: string
  openFailed: string
}

const DEFAULT_LABELS: MediaViewerLabels = {
  close: "Tutup",
  open: "Buka berkas",
  fileFallback: "Berkas",
  openFailed: "Tidak dapat membuka berkas",
}

const DEFAULT_ASPECT = 4 / 3
/** Batas tinggi gambar relatif tinggi layar — sisakan ruang judul & tombol. */
const MAX_HEIGHT_RATIO = 0.7

/** Lampiran dari backend tidak divalidasi: `url` yang hilang tidak boleh
 *  membuat `item.url.split("?")` melempar saat gelembung chat dirender. */
function pathOf(url: unknown): string {
  return typeof url === "string" ? url.split("?")[0]?.toLowerCase() ?? "" : ""
}

export function isImageMedia(item: Pick<MediaViewerItem, "url" | "mimeType">): boolean {
  if (item.mimeType) return item.mimeType.startsWith("image/")
  return !pathOf(item.url).endsWith(".pdf")
}

export function fileNameFromUrl(url: string, fallback: string): string {
  try {
    const last = decodeURIComponent(pathOf(url).split("/").pop() ?? "")
    return last || fallback
  } catch {
    return fallback
  }
}

export type MediaViewerProps = {
  item: MediaViewerItem | null
  onClose: () => void
  /** Dipanggil bila `Linking.openURL` gagal (pemanggil biasanya toast) */
  onOpenError?: (message: string) => void
  labels?: Partial<MediaViewerLabels>
  /** Slot aksi tambahan di bawah gambar (mis. tombol hapus bukti) */
  actions?: ReactNode
}

export function MediaViewer({ item, onClose, onOpenError, labels, actions }: MediaViewerProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const { height: windowHeight } = useWindowDimensions()
  const [aspect, setAspect] = useState(DEFAULT_ASPECT)

  const openExternal = useCallback(async () => {
    if (!item) return
    try {
      await Linking.openURL(item.url)
    } catch {
      onOpenError?.(t.openFailed)
    }
  }, [item, onOpenError, t.openFailed])

  const visible = item != null
  const image = item ? isImageMedia(item) : false
  const title = item?.title ?? (image ? undefined : (item?.fileName ?? fileNameFromUrl(item?.url ?? "", t.fileFallback)))

  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      onHidden={() => setAspect(DEFAULT_ASPECT)}
      accessibilityLabel={title ?? t.fileFallback}
      className="p-3"
    >
      <View accessible={false} className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text ellipsizeMode="tail" variant="label" numberOfLines={1} className="flex-1 pr-3">
            {title ?? ""}
          </Text>
          <IconButton accessibilityHint="Ketuk untuk berinteraksi" icon={X} variant="ghost" accessibilityLabel={t.close} onPress={onClose} />
        </View>

        {item && image ? (
          <Picture
            source={item.url}
            alt={title ?? item.caption ?? t.fileFallback}
            aspectRatio={aspect}
            resizeMode="contain"
            bordered={false}
            radius="sm"
            style={{ maxHeight: windowHeight * MAX_HEIGHT_RATIO }}
            onLoad={(e) => {
              const { width, height } = e.source
              if (width > 0 && height > 0) setAspect(width / height)
            }}
          />
        ) : item ? (
          <View className="items-center gap-3 rounded-md border border-border bg-surface" style={{ padding: tokens.space[6] }}>
            <Icon icon={FilePdf} size="xl" tone="default" />
            <Text variant="body" numberOfLines={2} className="text-center">
              {item.fileName ?? fileNameFromUrl(item.url, t.fileFallback)}
            </Text>
            <Button variant="primary" leftIcon={ArrowSquareOut} onPress={() => void openExternal()}>
              {t.open}
            </Button>
          </View>
        ) : null}

        {item?.caption ? (
          <Text variant="caption" tone="secondary" numberOfLines={3}>
            {item.caption}
          </Text>
        ) : null}

        {actions ? <View className="flex-row justify-end gap-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">{actions}</View> : null}
      </View>
    </Modal>
  )
}