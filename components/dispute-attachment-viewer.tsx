/**
 * Kahade — <DisputeAttachmentViewer>: pratinjau lampiran pesan sengketa.
 *
 * GAP-B3 (G136–G142):
 * - G137: gambar dibuka dengan pinch-to-zoom (<ZoomableImage>) + navigasi
 *   antar lampiran (tombol Sebelumnya/Berikutnya, indikator "2 dari 5").
 * - G138: berkas non-gambar (PDF/video) dibuka lewat viewer OS — hanya URL
 *   https yang divalidasi (safeHttpsUrl); URL mentah tidak pernah ditampilkan.
 * - G139: signed URL kedaluwarsa → minta ulang ke backend
 *   (getDisputeMessageAttachmentUrl), bukan menampilkan URL mentah.
 * - G140: status per lampiran — memuat / siap / tidak tersedia / gagal dibuka.
 * - G141/G142: label pihak (Bukti Pembeli/Penjual/Moderator/Anda) + metadata
 *   (nama berkas, tipe, ukuran, waktu) tanpa mengubah berkas asli.
 * - G146: accessibilityLabel nama + tipe + status.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { Linking, Modal, View, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { CaretLeft, CaretRight, FilePdf, Warning, X } from "phosphor-react-native"

import { getDisputeMessageAttachmentUrl, type DisputeMessageAttachment } from "@/lib/api/disputes"
import {
  attachmentTypeLabel,
  DISPUTE_ATTACHMENT_PARTY_LABELS,
  isAttachmentUrlExpired,
  type AttachmentParty,
} from "@/lib/dispute-attachments"
import { formatDateTime, formatFileSize } from "@/lib/format"
import { safeHttpsUrl } from "@/lib/version"
import { tokens } from "@/lib/tokens"
import { translate } from "@/lib/i18n/translate"
import { logWarn } from "@/lib/telemetry"

import { Icon } from "@/components/ui/icon"
import { IconBox } from "@/components/ui/icon-box"
import { IconButton } from "@/components/ui/icon-button"
import { Text } from "@/components/ui/text"
import { ZoomableImage } from "@/components/ui/zoomable-image"
import { DetailLoading } from "@/components/ui/paginated-list"

export type ViewerAttachment = DisputeMessageAttachment & {
  /** Cap waktu pesan induk (untuk metadata G142). */
  messageCreatedAt?: string
}

type UrlState =
  | { status: "loading" }
  | { status: "ready"; url: string; expiresAt: string }
  | { status: "unavailable"; reason: string }

function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/")
}

export function DisputeAttachmentViewer({
  visible,
  disputeId,
  items,
  index,
  onIndexChange,
  onClose,
  party,
  messageCreatedAt,
  onOpenError,
}: {
  visible: boolean
  disputeId: string
  items: ViewerAttachment[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
  /** Label pihak pengirim lampiran yang sedang tampil (G141). */
  party?: AttachmentParty
  messageCreatedAt?: string
  onOpenError?: (message: string) => void
}) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const item = items[index]
  // Cache URL per fileKey selama viewer terbuka — lampiran yang sudah
  // dimuat tidak diminta ulang saat navigasi bolak-balik.
  const urlCache = useRef(new Map<string, { url: string; expiresAt: string }>())
  const [urlState, setUrlState] = useState<UrlState>({ status: "loading" })
  const [opening, setOpening] = useState(false)

  const resolveUrl = useCallback(async () => {
    const current = items[index]
    if (!current?.fileKey) {
      setUrlState({ status: "unavailable", reason: "Berkas tidak ditemukan." })
      return
    }
    const cached = urlCache.current.get(current.fileKey)
    const embedded = current.url
      ? { url: current.url, expiresAt: current.expiresAt ?? "" }
      : undefined
    const candidate = cached ?? embedded
    // G139: pakai URL bila masih segar; bila kedaluwarsa/hilang → minta ulang.
    if (candidate && candidate.url && !isAttachmentUrlExpired(candidate.expiresAt)) {
      setUrlState({ status: "ready", url: candidate.url, expiresAt: candidate.expiresAt })
      return
    }
    setUrlState({ status: "loading" })
    try {
      const fresh = await getDisputeMessageAttachmentUrl(disputeId, current.fileKey)
      urlCache.current.set(current.fileKey, fresh)
      setUrlState({ status: "ready", url: fresh.url, expiresAt: fresh.expiresAt })
    } catch (err) {
      logWarn("dispute:attachment-url", err)
      setUrlState({
        status: "unavailable",
        reason: "Tautan berkas kedaluwarsa dan tidak dapat dimuat ulang.",
      })
    }
  }, [disputeId, items, index])

  useEffect(() => {
    if (visible) {
      urlCache.current.clear()
      void resolveUrl()
    }
  }, [visible, resolveUrl])

  const openExternal = useCallback(async () => {
    if (urlState.status !== "ready" || opening) return
    // G138: viewer aman — hanya https; tolak skema asing (D-05 media-viewer).
    const target = safeHttpsUrl(urlState.url)
    if (!target) {
      onOpenError?.("Tidak dapat membuka berkas")
      return
    }
    setOpening(true)
    try {
      await Linking.openURL(target)
    } catch {
      onOpenError?.("Tidak dapat membuka berkas")
    } finally {
      setOpening(false)
    }
  }, [urlState, opening, onOpenError])

  if (!visible || !item) return null

  const image = isImage(item.fileType)
  const partyLabel = party ? DISPUTE_ATTACHMENT_PARTY_LABELS[party] : undefined
  const createdAt = messageCreatedAt ?? item.messageCreatedAt
  const meta = [
    attachmentTypeLabel(item.fileType),
    typeof item.fileSize === "number" ? formatFileSize(item.fileSize) : null,
    createdAt ? formatDateTime(createdAt) : null,
  ]
    .filter(Boolean)
    .join(" · ")
  const a11yStatus =
    urlState.status === "loading"
      ? "memuat"
      : urlState.status === "ready"
        ? "siap dibuka"
        : "tidak tersedia"

  const imageWidth = Math.min(windowWidth - tokens.space[8], 560)
  const imageHeight = Math.min(windowHeight * 0.55, 560)

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityLabel={translate("Pratinjau lampiran: {x}", { x: item.fileName })}
    >
      {/* UX-SPA-019: safe-area aware (dulu pt-12/pb-8 hardcoded — berisiko
          tertutup notch/home indicator di device yang berbeda). */}
      {/* Viewer lampiran = pemutar media: scrim hitam/90 + chrome putih di
          kedua mode (DARK_ALLOWLIST check-tokens, preseden media-viewer). */}
      <View
        className="flex-1 bg-black/90 px-4"
        style={{
          paddingTop: insets.top + tokens.space[3],
          paddingBottom: insets.bottom + tokens.space[4],
        }}
      >
        {/* Kepala: judul + tutup */}
        <View className="flex-row items-center gap-3">
          <View
            className="flex-1"
            accessible
            accessibilityRole="header"
            accessibilityLabel={`${item.fileName}, ${attachmentTypeLabel(item.fileType)}, ${a11yStatus}`}
          >
            <Text variant="body" weight={600} tone="primary" className="text-white" numberOfLines={1}>
              {item.fileName}
            </Text>
            <Text variant="caption" className="text-white/70" numberOfLines={2}>
              {[partyLabel, meta].filter(Boolean).join(" · ")}
            </Text>
          </View>
          <IconButton
            icon={X}
            variant="ghost"
            accessibilityLabel="Tutup pratinjau"
            onPress={onClose}
          />
        </View>

        {/* Isi */}
        <View className="flex-1 items-center justify-center py-4">
          {urlState.status === "loading" ? (
            <DetailLoading />
          ) : urlState.status === "unavailable" ? (
            <View
              className="items-center gap-2 px-8"
              accessible
              accessibilityLabel={translate("Lampiran tidak tersedia: {x}", { x: urlState.reason })}
            >
              <Icon icon={Warning} size="lg" tone="danger" />
              <Text variant="body" className="text-center text-white">
                Lampiran tidak tersedia
              </Text>
              <Text variant="caption" className="text-center text-white/70">
                {urlState.reason}
              </Text>
            </View>
          ) : image ? (
            <ZoomableImage
              source={urlState.url}
              alt={item.fileName}
              width={imageWidth}
              height={imageHeight}
            />
          ) : (
            <View className="items-center gap-3 px-8">
              <IconBox icon={FilePdf} size="lg" variant="surface" />
              <Text
                variant="body"
                className="text-center text-white"
                accessibilityLabel={`${item.fileName}, ${attachmentTypeLabel(item.fileType)}, ${a11yStatus}`}
              >
                {item.fileName}
              </Text>
              <Text variant="caption" className="text-center text-white/70">
                {meta}
              </Text>
              <Text
                variant="caption"
                className="text-center text-white/70 underline"
                onPress={() => void openExternal()}
                accessibilityRole="button"
                accessibilityLabel={translate("Buka {x} di aplikasi lain", {
                  x: attachmentTypeLabel(item.fileType),
                })}
              >
                {opening ? "Membuka…" : "Buka di aplikasi lain"}
              </Text>
            </View>
          )}
        </View>

        {/* Navigasi antar lampiran (G137) */}
        {items.length > 1 ? (
          <View className="flex-row items-center justify-between">
            <IconButton
              icon={CaretLeft}
              variant="secondary"
              accessibilityLabel="Lampiran sebelumnya"
              disabled={index <= 0}
              onPress={() => onIndexChange(index - 1)}
            />
            <Text
              variant="caption"
              className="text-white/80"
              accessibilityLabel={translate("Lampiran {x} dari {y}", { x: index + 1, y: items.length })}
            >
              {index + 1} / {items.length}
            </Text>
            <IconButton
              icon={CaretRight}
              variant="secondary"
              accessibilityLabel="Lampiran berikutnya"
              disabled={index >= items.length - 1}
              onPress={() => onIndexChange(index + 1)}
            />
          </View>
        ) : null}
      </View>
    </Modal>
  )
}
