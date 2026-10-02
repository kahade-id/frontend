/**
 * Kahade — <ChatAttachmentSheet> menu lampiran composer chat.
 *
 * Dibuka tombol "+" di <ChatComposer>: Gambar, Video, File, Voice Note —
 * masing-masing dengan ikon Phosphor + label + deskripsi singkat. Dibangun
 * di atas <ActionSheet> agar animasi, backdrop, dan aturan stacking (§9.9)
 * ikut.
 *
 * Komponen ini TIDAK memilih berkas sendiri: tiap aksi memanggil callback
 * pemanggil (layar) yang menjalankan picker/perekam lalu mengantrekan hasil
 * ke alur unggah yang sudah ada. Alasan: aturan validasi berbeda per layar
 * (ruang chat vs sengketa), dan picker butuh toast/konteks layar.
 */
import { File, Image, VideoCamera } from "phosphor-react-native"

import { ActionSheet } from "@/components/ui/action-sheet"
import type { IconComponent } from "@/components/ui/icon"

/**
 * Kualitas foto yang dipilih user (B05): "standard" = terkompresi,
 * "file" = kualitas asli tanpa kompresi.
 */
export type ChatImageQuality = "standard" | "file"

export type ChatAttachmentSheetProps = {
  visible: boolean
  /** Diminta menutup (backdrop / drag / X). Parent yang set visible=false. */
  onRequestClose: () => void
  title?: string
  onPickImage: (quality: ChatImageQuality) => void
  onPickVideo: () => void
  onPickFile: () => void
  /**
   * Aksi tambahan (batch 43 FE-CHAT): lokasi / polling / kartu produk.
   * Rendered setelah File; diabaikan bila tidak diisi.
   */
  extraActions?: {
    key: string
    label: string
    icon: IconComponent
    onPress: () => void
  }[]
}

export function ChatAttachmentSheet({
  visible,
  onRequestClose,
  title = "Lampirkan berkas",
  onPickImage,
  onPickVideo,
  onPickFile,
  extraActions = [],
}: ChatAttachmentSheetProps) {
  return (
    <ActionSheet
      visible={visible}
      onRequestClose={onRequestClose}
      title={title}
      // 2026-10-02: deskripsi DIHAPUS (permintaan user) — cukup judul saja.
      // Tombol batal & separator bawah juga dihapus (sudah ada ikon X).
      actions={[
        {
          key: "image-standard",
          label: "Foto (standar)",
          icon: Image,
          onPress: () => onPickImage("standard"),
        },
        {
          key: "image-file",
          label: "Foto (asli)",
          icon: Image,
          onPress: () => onPickImage("file"),
        },
        {
          key: "video",
          label: "Video",
          icon: VideoCamera,
          onPress: onPickVideo,
        },
        {
          key: "file",
          label: "File",
          icon: File,
          onPress: onPickFile,
        },
        // 2026-10-03: Voice Note DIHAPUS dari sheet (sudah ada tombol mic
        // di samping input teks).
        ...extraActions,
      ]}
    />
  )
}
