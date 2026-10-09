/**
 * Kahade — kartu BERKAS (dokumen) di bubble chat.
 *
 * Menggantikan baris lampiran generik 56px: kartu penuh selebar bubble berisi
 * ikon jenis-berkas, nama (2 baris, ellipsis tengah), dan "ukuran · ekstensi".
 * Ketuk → halaman media viewer (`type=file`: PDF/teks/office in-app, sisanya
 * kartu + unduh/buka-dengan-app). TIDAK PERNAH browser luar.
 *
 * Status kirim: sending → bar indeterminate + "Mengirim…"; failed →
 * "Belum terkirim" + tombol "Coba lagi" (SEJAJAR area ketuk kartu — Pressable
 * bersarang RN memicu dua-duanya, jadi tombol retry tidak boleh jadi anak).
 */
import { memo } from "react"
import { View } from "react-native"
import { ArrowClockwise, FileArrowDown, FileText, FileXls, FileZip } from "phosphor-react-native"

import type { ChatAttachmentDto } from "@/lib/api/types"
import { Icon } from "@/components/ui/icon"
import { IconBox } from "@/components/ui/icon-box"
import { PressableScale } from "@/components/ui/pressable-scale"
import { ProgressBar } from "@/components/ui/progress-bar"
import { Text } from "@/components/ui/text"
import { formatBytes } from "@/lib/media-viewer"
import { summarize } from "@/lib/a11y"
import { translate, useLanguage } from "@/lib/i18n"

function fileIcon(mimeType: string | null, fileName: string) {
  const mime = (mimeType ?? "").toLowerCase()
  const ext = fileName.split(".").pop()?.toLowerCase() ?? ""
  if (mime.includes("pdf") || ext === "pdf") return FileText
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("csv") || ext === "xls" || ext === "xlsx" || ext === "csv")
    return FileXls
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext) || mime.includes("zip") || mime.includes("compressed"))
    return FileZip
  return FileArrowDown
}

export type ChatFileCardProps = {
  attachment: ChatAttachmentDto
  outgoing?: boolean
  sendStatus?: "queued" | "sending" | "failed"
  onPress: () => void
  onRetry?: () => void
}

export const ChatFileCard = memo(function ChatFileCard({
  attachment,
  outgoing = false,
  sendStatus,
  onPress,
  onRetry,
}: ChatFileCardProps) {
  useLanguage()
  const sending = sendStatus === "sending" || sendStatus === "queued"
  const sendFailed = sendStatus === "failed"
  const IconGlyph = fileIcon(attachment.mimeType, attachment.fileName)
  const ext = attachment.fileName.split(".").pop()?.toUpperCase() ?? ""
  const sizeLabel = attachment.fileSize != null ? formatBytes(attachment.fileSize) : null
  const metaLabel = [sizeLabel, ext || null].filter(Boolean).join(" · ")

  return (
    <View className="w-52">
      <PressableScale
        scaleOnPress={false}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={summarize([
          translate("Berkas: {x}", { x: attachment.fileName }),
          metaLabel || undefined,
          translate("Ketuk untuk membuka"),
          sending ? translate("Mengirim") : sendFailed ? translate("Belum terkirim") : undefined,
        ])}
        accessibilityHint={translate("Membuka berkas di penampil dalam aplikasi")}
        className="rounded-sm"
      >
        <View className="flex-row items-center gap-2.5">
          {/* Box kontras sisi bubble: masuk(surface)→inverted, keluar(primary)→surface. */}
          <IconBox icon={IconGlyph} size="md" variant={outgoing ? "surface" : "inverted"} />
          <View className="min-w-0 flex-1">
            <Text
              variant="body"
              weight={600}
              tone={outgoing ? "inverse" : "primary"}
              numberOfLines={2}
              ellipsizeMode="middle"
            >
              {attachment.fileName}
            </Text>
            {/* 2026-10-08 (temuan #13): baris meta berkas — ukuran TETAP
                tabular (kolom angka tidak bergeser antar pesan) dan format
                menjadi chip kecil, bukan "2,4 MB · PDF" yang terbaca sebagai
                satu kalimat. */}
            {sizeLabel || ext ? (
              <View className="mt-0.5 flex-row items-center gap-1.5">
                {sizeLabel ? (
                  <Text variant="caption" tone={outgoing ? "inverse" : "secondary"} className="tabular-nums">
                    {sizeLabel}
                  </Text>
                ) : null}
                {ext ? (
                  <View className="rounded-sm bg-black/[0.07] px-1 dark:bg-white/[0.14]">
                    <Text variant="caption" weight={700} tone={outgoing ? "inverse" : "secondary"} className="tracking-widest">
                      {ext}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>

        {sending ? (
          <View className="mt-2 gap-1">
            <ProgressBar value={undefined} size="sm" />
            <Text variant="caption" tone={outgoing ? "inverse" : "secondary"}>
              {sendStatus === "queued" ? translate("Menunggu koneksi") : translate("Mengirim…")}
            </Text>
          </View>
        ) : null}
      </PressableScale>

      {sendFailed ? (
        <View className="mt-2 flex-row items-center gap-2">
          <Text variant="caption" weight={600} tone={outgoing ? "inverse" : "primary"}>
            {translate("Belum terkirim")}
          </Text>
          {onRetry ? (
            <PressableScale
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityLabel={translate("Kirim ulang berkas {x}", { x: attachment.fileName })}
              className="rounded-full border border-border-default px-2 py-0.5"
            >
              <View className="flex-row items-center gap-1">
                <Icon
                  icon={ArrowClockwise}
                  size="xs"
                  weight="bold"
                  tone={outgoing ? "inverse" : "active"}
                />
                <Text variant="caption" weight={700} tone={outgoing ? "inverse" : "primary"}>
                  {translate("Coba lagi")}
                </Text>
              </View>
            </PressableScale>
          ) : null}
        </View>
      ) : null}
    </View>
  )
})
