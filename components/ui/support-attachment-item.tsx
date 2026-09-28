/**
 * Kahade — satu lampiran tiket dukungan yang bisa diketuk (item 128/130).
 *
 * - Gambar → pratinjau layar penuh (<ImageViewer>).
 * - Selain gambar → unduh (web) / share sheet OS (native).
 * - Gagal (mis. file milik staff yang tak lolos cek kepemilikan
 *   `/v1/upload/my-file`) → toast eksplisit, tanpa menebak URL.
 */
import { useCallback, useState } from "react"
import { Platform } from "react-native"
import { DownloadSimple, Image as ImageIcon } from "phosphor-react-native"
import { File, Paths } from "expo-file-system"

import { Icon } from "@/components/ui/icon"
import { ImageViewer } from "@/components/ui/image-viewer"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Spinner } from "@/components/ui/spinner"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"
import { userMessage } from "@/lib/api"
import { saveBlobFile } from "@/lib/export-file"
import { logWarn } from "@/lib/telemetry"
import { translate } from "@/lib/i18n/translate"
import {
  downloadSupportAttachment,
  supportAttachmentFilename,
} from "@/lib/support-attachments"

export function SupportAttachmentItem({
  fileKey,
  index,
}: {
  fileKey: string
  index: number
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const filename = supportAttachmentFilename(fileKey, index)

  const closePreview = useCallback(() => {
    setPreviewUrl((prev) => {
      if (prev && Platform.OS === "web" && prev.startsWith("blob:")) {
        URL.revokeObjectURL(prev)
      }
      return null
    })
  }, [])

  const handlePress = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      const blob = await downloadSupportAttachment(fileKey)
      const isImage = blob.type.startsWith("image/")
      if (isImage) {
        if (Platform.OS === "web") {
          setPreviewUrl(URL.createObjectURL(blob))
        } else {
          const file = new File(Paths.cache, filename)
          file.write(new Uint8Array(await blob.arrayBuffer()))
          setPreviewUrl(file.uri)
        }
      } else {
        await saveBlobFile(blob, filename, blob.type || "application/octet-stream")
      }
    } catch (err) {
      logWarn("support:attachment-open", err)
      toast.show({
        title: translate("Lampiran tidak dapat dibuka"),
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setBusy(false)
    }
  }, [busy, fileKey, filename, toast])

  return (
    <>
      <PressableScale
        onPress={() => void handlePress()}
        accessibilityRole="button"
        accessibilityLabel={translate("Buka {x}", { x: filename })}
        accessibilityHint={translate("Pratinjau atau unduh lampiran")}
        className="flex-row items-center gap-2 rounded-md border border-border bg-surface px-3 py-2"
      >
        {busy ? (
          <Spinner size="sm" />
        ) : (
          <Icon icon={ImageIcon} size="sm" tone="default" />
        )}
        <Text variant="caption" tone="secondary" numberOfLines={1} className="flex-1">
          {translate("Lampiran #{x}", { x: index + 1 })}
        </Text>
        <Icon icon={DownloadSimple} size="sm" tone="default" />
      </PressableScale>
      <ImageViewer
        visible={previewUrl !== null}
        images={previewUrl ? [{ url: previewUrl, alt: filename }] : []}
        title={filename}
        onClose={closePreview}
      />
    </>
  )
}
