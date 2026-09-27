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
import { File, Image, Microphone, VideoCamera } from "phosphor-react-native"

import { ActionSheet } from "@/components/ui/action-sheet"

export type ChatAttachmentSheetProps = {
  visible: boolean
  /** Diminta menutup (backdrop / drag / X). Parent yang set visible=false. */
  onRequestClose: () => void
  title?: string
  description?: string
  onPickImage: () => void
  onPickVideo: () => void
  onPickFile: () => void
  onRecordVoice: () => void
}

export function ChatAttachmentSheet({
  visible,
  onRequestClose,
  title = "Lampirkan berkas",
  description = "Pilih jenis lampiran untuk pesan ini.",
  onPickImage,
  onPickVideo,
  onPickFile,
  onRecordVoice,
}: ChatAttachmentSheetProps) {
  return (
    <ActionSheet
      visible={visible}
      onRequestClose={onRequestClose}
      title={title}
      description={description}
      showCancel
      cancelLabel="Batal"
      actions={[
        {
          key: "image",
          label: "Gambar",
          description: "Foto dari galeri perangkat",
          icon: Image,
          onPress: onPickImage,
        },
        {
          key: "video",
          label: "Video",
          description: "Video dari galeri perangkat",
          icon: VideoCamera,
          onPress: onPickVideo,
        },
        {
          key: "file",
          label: "File",
          description: "Dokumen dari penyimpanan perangkat",
          icon: File,
          onPress: onPickFile,
        },
        {
          key: "voice",
          label: "Voice Note",
          description: "Rekam pesan suara langsung",
          icon: Microphone,
          onPress: onRecordVoice,
        },
      ]}
    />
  )
}
